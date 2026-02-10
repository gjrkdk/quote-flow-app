/**
 * REST API Endpoint: POST /api/v1/draft-orders
 *
 * Creates a Shopify Draft Order with custom matrix-based pricing.
 * Requires API key authentication, validates input, enforces rate limits.
 */

import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticateApiKey } from "~/utils/api-auth.server";
import {
  DraftOrderWithOptionsSchema,
  normalizeProductId,
  type OptionSelection,
} from "~/validators/api.validators";
import { checkRateLimit, getRateLimitHeaders } from "~/utils/rate-limit.server";
import { lookupProductMatrix } from "~/services/product-matrix-lookup.server";
import {
  calculatePrice,
  validateDimensions,
} from "~/services/price-calculator.server";
import { submitDraftOrder } from "~/services/draft-order.server";
import { prisma } from "~/db.server";
import { sessionStorage } from "~/shopify.server";
import { validateOptionSelections } from "~/services/option-validator.server";
import {
  calculatePriceWithOptions,
  type PriceModifier,
} from "~/services/option-price-calculator.server";

/**
 * Adds CORS headers to a response to allow cross-origin requests.
 */
function withCors(response: Response): Response {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "X-API-Key, Content-Type");
  return response;
}

/**
 * Creates a Shopify admin GraphQL client using store's access token.
 * For REST API requests that don't have embedded app session context.
 */
function createShopifyAdmin(shop: string, accessToken: string) {
  return {
    graphql: async (query: string, options?: { variables?: Record<string, any> }) => {
      const response = await fetch(
        `https://${shop}/admin/api/2024-01/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": accessToken,
          },
          body: JSON.stringify({
            query,
            variables: options?.variables,
          }),
        }
      );
      return {
        json: () => response.json(),
      };
    },
  };
}

/**
 * Handles GET/OPTIONS requests. Only OPTIONS (CORS preflight) is valid.
 */
export async function loader({ request }: ActionFunctionArgs) {
  if (request.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }
  return withCors(
    json(
      {
        type: "about:blank",
        title: "Method Not Allowed",
        status: 405,
        detail: "Use POST to create a draft order.",
      },
      { status: 405 }
    )
  );
}

/**
 * Handles POST requests to create a Draft Order.
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    // Handle OPTIONS preflight for CORS
    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }));
    }

    // Only allow POST
    if (request.method !== "POST") {
      return withCors(
        json(
          {
            type: "about:blank",
            title: "Method Not Allowed",
            status: 405,
            detail: `Method ${request.method} is not allowed. Use POST to create a draft order.`,
          },
          { status: 405 }
        )
      );
    }

    // 1. Authentication
    const store = await authenticateApiKey(request);

    // 2. Rate limiting
    checkRateLimit(store.id);

    // 3. Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      throw json(
        {
          type: "about:blank",
          title: "Bad Request",
          status: 400,
          detail: "Invalid JSON in request body",
        },
        { status: 400 }
      );
    }

    const validation = DraftOrderWithOptionsSchema.safeParse(body);
    if (!validation.success) {
      throw json(
        {
          type: "about:blank",
          title: "Validation Failed",
          status: 400,
          detail: "Invalid request body",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { productId, width, height, quantity, options } = validation.data;
    const normalizedProductId = normalizeProductId(productId);

    // 4. Validate dimensions (business logic)
    const dimensionValidation = validateDimensions(width, height, quantity);
    if (!dimensionValidation.valid) {
      throw json(
        {
          type: "about:blank",
          title: "Bad Request",
          status: 400,
          detail: dimensionValidation.error || "Invalid dimensions",
        },
        { status: 400 }
      );
    }

    // 4a. Validate option selections if provided
    let validatedGroups: any[] | undefined;

    if (options && options.length > 0) {
      const validationResult = await validateOptionSelections(
        normalizedProductId,
        options,
        store.id
      );

      if (!validationResult.valid) {
        throw json(
          {
            type: "about:blank",
            title: "Bad Request",
            status: 400,
            detail: validationResult.error || "Invalid option selections",
          },
          { status: 400 }
        );
      }

      validatedGroups = validationResult.validatedGroups;
    }

    // 5. Look up product matrix
    const productMatrix = await lookupProductMatrix(
      normalizedProductId,
      store.id
    );
    if (!productMatrix) {
      throw json(
        {
          type: "about:blank",
          title: "Not Found",
          status: 404,
          detail: "No price matrix assigned to this product",
        },
        { status: 404 }
      );
    }

    // 6. Calculate price (with or without options)
    let unitPrice: number;
    let basePriceDollars: number;
    let basePriceCents: number;
    let priceBreakdown: any;

    try {
      basePriceDollars = calculatePrice(width, height, productMatrix.matrixData);
      basePriceCents = Math.round(basePriceDollars * 100);
    } catch (error) {
      console.error("Price calculation error:", error);
      throw json(
        {
          type: "about:blank",
          title: "Internal Server Error",
          status: 500,
          detail: "Failed to calculate price",
        },
        { status: 500 }
      );
    }

    // Build option metadata for Draft Order
    let optionMetadata: Array<{ optionGroupName: string; choiceLabel: string }> | undefined;

    // Calculate with options if provided
    if (options && options.length > 0 && validatedGroups) {
      // Build price modifiers from selections and validated groups
      const modifiers: PriceModifier[] = [];
      optionMetadata = [];

      for (const selection of options) {
        const group = validatedGroups.find((g: any) => g.id === selection.optionGroupId);
        if (group) {
          const choice = group.choices.find((c: any) => c.id === selection.choiceId);
          if (choice) {
            modifiers.push({
              type: choice.modifierType,
              value: choice.modifierValue,
              label: `${group.name}: ${choice.label}`,
            });
            optionMetadata.push({
              optionGroupName: group.name,
              choiceLabel: choice.label,
            });
          }
        }
      }

      priceBreakdown = calculatePriceWithOptions(basePriceCents, modifiers);
      unitPrice = priceBreakdown.totalCents / 100;
    } else {
      // No options: use base price
      unitPrice = basePriceDollars;
    }

    // 7. Get store's shop domain
    const storeRecord = await prisma.store.findUnique({
      where: { id: store.id },
      select: { shop: true },
    });

    if (!storeRecord) {
      throw json(
        {
          type: "about:blank",
          title: "Internal Server Error",
          status: 500,
          detail: "Store not found",
        },
        { status: 500 }
      );
    }

    // 8. Load offline session for permanent access token.
    // The embedded auth strategy (token exchange) stores short-lived tokens
    // in Store.accessToken, but offline sessions have permanent tokens.
    const offlineSession = await sessionStorage.loadSession(
      `offline_${storeRecord.shop}`
    );

    if (!offlineSession?.accessToken) {
      throw json(
        {
          type: "about:blank",
          title: "Internal Server Error",
          status: 500,
          detail: "Store access token not available",
        },
        { status: 500 }
      );
    }

    // 9. Create Shopify admin client
    const admin = createShopifyAdmin(
      storeRecord.shop,
      offlineSession.accessToken
    );

    // 10. Get product title from database
    const productMatrixRecord = await prisma.productMatrix.findUnique({
      where: { productId: normalizedProductId },
      select: { productTitle: true, matrixId: true },
    });

    if (!productMatrixRecord) {
      throw json(
        {
          type: "about:blank",
          title: "Not Found",
          status: 404,
          detail: "Product not found",
        },
        { status: 404 }
      );
    }

    // 11. Submit Draft Order via shared service
    const result = await submitDraftOrder({
      admin,
      storeId: store.id,
      matrixId: productMatrixRecord.matrixId,
      productId: normalizedProductId,
      productTitle: productMatrixRecord.productTitle,
      width,
      height,
      quantity,
      unitPrice,
      unit: productMatrix.unit,
      options: optionMetadata,
    });

    if (!result.success) {
      throw json(
        {
          type: "about:blank",
          title: "Internal Server Error",
          status: 500,
          detail: result.error || "Failed to create Draft Order in Shopify",
        },
        { status: 500 }
      );
    }

    // 12. Return success response with CORS and rate limit headers
    const rateLimitHeaders = getRateLimitHeaders(store.id);

    // Build response based on whether options were provided
    const responseBody: any = {
      draftOrderId: result.draftOrder!.id,
      name: result.draftOrder!.name,
      checkoutUrl: result.draftOrder!.invoiceUrl,
      total: result.draftOrder!.totalPrice,
      price: unitPrice,
      dimensions: {
        width,
        height,
        unit: productMatrix.unit,
      },
      quantity,
    };

    // Add breakdown if options were used
    if (priceBreakdown) {
      responseBody.basePrice = priceBreakdown.basePriceCents / 100;
      responseBody.optionModifiers = priceBreakdown.modifiers.map((m: any) => {
        // Split label on ": " to get group name and choice label
        const [groupName, choiceLabel] = m.label.split(": ");
        return {
          optionGroup: groupName,
          choice: choiceLabel,
          modifierType: m.type,
          modifierValue: m.originalValue,
          appliedAmount: m.appliedAmountCents / 100,
        };
      });
    }

    const response = json(responseBody, {
      status: 201,
      headers: rateLimitHeaders,
    });

    return withCors(response);
  } catch (error) {
    // Global error handler: add CORS to all error responses
    if (error instanceof Response) {
      return withCors(error);
    }

    // Unexpected error - return 500 with generic message
    console.error("Unexpected API error:", error);
    return withCors(
      json(
        {
          type: "about:blank",
          title: "Internal Server Error",
          status: 500,
          detail: "An unexpected error occurred",
        },
        { status: 500 }
      )
    );
  }
}
