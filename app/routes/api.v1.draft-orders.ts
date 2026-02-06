/**
 * REST API Endpoint: POST /api/v1/draft-orders
 *
 * Creates a Shopify Draft Order with custom matrix-based pricing.
 * Requires API key authentication, validates input, enforces rate limits.
 */

import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticateApiKey } from "~/utils/api-auth.server";
import {
  DraftOrderSchema,
  normalizeProductId,
} from "~/validators/api.validators";
import { checkRateLimit, getRateLimitHeaders } from "~/utils/rate-limit.server";
import { lookupProductMatrix } from "~/services/product-matrix-lookup.server";
import {
  calculatePrice,
  validateDimensions,
} from "~/services/price-calculator.server";
import { prisma } from "~/db.server";
import { backOff } from "exponential-backoff";

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
 * Queries Shopify for the first variant of a product.
 */
async function getProductVariant(
  admin: any,
  productId: string
): Promise<string | null> {
  const response = await admin.graphql(
    `#graphql
      query GetProductVariant($productId: ID!) {
        product(id: $productId) {
          variants(first: 1) {
            edges {
              node {
                id
              }
            }
          }
        }
      }`,
    {
      variables: { productId },
    }
  );

  const data = await response.json();

  if (data.errors) {
    console.error("GraphQL errors:", data.errors);
    return null;
  }

  const variant = data.data?.product?.variants?.edges?.[0]?.node;
  return variant?.id || null;
}

/**
 * Formats a dimension value for display based on unit preference.
 */
function formatDimension(value: number, unit: string): string {
  return `${value}${unit}`;
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

    const validation = DraftOrderSchema.safeParse(body);
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

    const { productId, width, height, quantity } = validation.data;
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

    // 6. Calculate price
    let unitPrice: number;
    try {
      unitPrice = calculatePrice(width, height, productMatrix.matrixData);
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

    // 7. Get store's access token for Shopify API
    const storeWithToken = await prisma.store.findUnique({
      where: { id: store.id },
      select: { accessToken: true, shop: true },
    });

    if (!storeWithToken || !storeWithToken.accessToken) {
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

    // 8. Create Shopify admin client
    const admin = createShopifyAdmin(
      storeWithToken.shop,
      storeWithToken.accessToken
    );

    // 9. Get product variant (for local record keeping)
    const variantId = await getProductVariant(admin, normalizedProductId);
    if (!variantId) {
      throw json(
        {
          type: "about:blank",
          title: "Not Found",
          status: 404,
          detail: "Product variant not found",
        },
        { status: 404 }
      );
    }

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

    // 11. Format dimensions for display
    const widthDisplay = formatDimension(width, productMatrix.unit);
    const heightDisplay = formatDimension(height, productMatrix.unit);

    // 12. Create Draft Order via GraphQL with retry logic
    const draftOrderInput = {
      lineItems: [
        {
          title: productMatrixRecord.productTitle,
          quantity,
          originalUnitPrice: unitPrice,
          customAttributes: [
            { key: "Width", value: widthDisplay },
            { key: "Height", value: heightDisplay },
          ],
        },
      ],
      tags: ["price-matrix"],
    };

    let draftOrderResult: any;
    try {
      draftOrderResult = await backOff(
        async () => {
          const response = await admin.graphql(
            `#graphql
              mutation DraftOrderCreate($input: DraftOrderInput!) {
                draftOrderCreate(input: $input) {
                  draftOrder {
                    id
                    name
                    totalPrice
                    invoiceUrl
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }`,
            {
              variables: { input: draftOrderInput },
            }
          );

          const data = await response.json();

          // Check for GraphQL errors
          if (data.errors) {
            throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
          }

          // Check for userErrors (these should NOT be retried)
          if (
            data.data?.draftOrderCreate?.userErrors &&
            data.data.draftOrderCreate.userErrors.length > 0
          ) {
            const errors = data.data.draftOrderCreate.userErrors
              .map((e: any) => `${e.field}: ${e.message}`)
              .join(", ");
            throw new Error(`Draft Order creation failed: ${errors}`);
          }

          // Check if draftOrder exists in response
          if (!data.data?.draftOrderCreate?.draftOrder) {
            throw new Error("Draft Order not returned from Shopify");
          }

          return data.data.draftOrderCreate;
        },
        {
          numOfAttempts: 3,
          startingDelay: 1000,
          timeMultiple: 2,
          maxDelay: 5000,
          jitter: "full",
          retry: (error: any) => {
            // Only retry on rate limit errors (429)
            const is429 =
              error.message?.includes("429") ||
              error.message?.includes("RATE_LIMITED");
            return is429;
          },
        }
      );
    } catch (error) {
      console.error("Draft Order creation error:", error);
      throw json(
        {
          type: "about:blank",
          title: "Internal Server Error",
          status: 500,
          detail: "Failed to create Draft Order in Shopify",
        },
        { status: 500 }
      );
    }

    const draftOrder = draftOrderResult.draftOrder;

    // 13. Save local record in database
    try {
      await prisma.$transaction(async (tx) => {
        // Create Draft Order record
        await tx.draftOrderRecord.create({
          data: {
            storeId: store.id,
            matrixId: productMatrixRecord.matrixId,
            shopifyDraftOrderId: draftOrder.id,
            shopifyOrderName: draftOrder.name,
            productId: normalizedProductId,
            variantId,
            width,
            height,
            quantity,
            calculatedPrice: unitPrice,
            totalPrice: draftOrder.totalPrice,
          },
        });

        // Increment store counter
        await tx.store.update({
          where: { id: store.id },
          data: {
            totalDraftOrdersCreated: {
              increment: 1,
            },
          },
        });
      });
    } catch (error) {
      console.error("Failed to save Draft Order record:", error);
      // Draft Order was created in Shopify, but we failed to save locally
      // Return success anyway since the Draft Order exists
    }

    // 14. Return success response with CORS and rate limit headers
    const total = unitPrice * quantity;
    const rateLimitHeaders = getRateLimitHeaders(store.id);

    const response = json(
      {
        draftOrderId: draftOrder.id,
        name: draftOrder.name,
        checkoutUrl: draftOrder.invoiceUrl,
        total: draftOrder.totalPrice,
        price: unitPrice,
        dimensions: {
          width,
          height,
          unit: productMatrix.unit,
        },
        quantity,
      },
      {
        status: 201,
        headers: rateLimitHeaders,
      }
    );

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
