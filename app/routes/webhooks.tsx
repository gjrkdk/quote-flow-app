import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { prisma } from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, admin, payload } = await authenticate.webhook(
    request
  );

  console.log(`Received ${topic} webhook for shop ${shop}`);

  // Store GDPR request for audit trail
  if (
    topic === "CUSTOMERS_DATA_REQUEST" ||
    topic === "CUSTOMERS_REDACT" ||
    topic === "SHOP_REDACT"
  ) {
    await prisma.gdprRequest.create({
      data: {
        shop,
        type: topic,
        payload: payload as any,
      },
    });
  }

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
      // Log the data request - in production, you would collect customer data here
      console.log(
        `Customer data request for shop ${shop}:`,
        JSON.stringify(payload, null, 2)
      );
      // TODO: Implement customer data collection and delivery
      break;

    case "CUSTOMERS_REDACT":
      // Log the redaction request - in production, you would delete customer data here
      console.log(
        `Customer redaction request for shop ${shop}:`,
        JSON.stringify(payload, null, 2)
      );
      // TODO: Implement customer data deletion
      await prisma.gdprRequest.updateMany({
        where: {
          shop,
          type: "CUSTOMERS_REDACT",
          processedAt: null,
        },
        data: {
          processedAt: new Date(),
        },
      });
      break;

    case "SHOP_REDACT":
      // Delete all store data when shop requests data deletion
      console.log(
        `Shop redaction request for shop ${shop}:`,
        JSON.stringify(payload, null, 2)
      );

      // Delete store record
      await prisma.store.deleteMany({
        where: { shop },
      });

      // Mark GDPR request as processed
      await prisma.gdprRequest.updateMany({
        where: {
          shop,
          type: "SHOP_REDACT",
          processedAt: null,
        },
        data: {
          processedAt: new Date(),
        },
      });

      console.log(`Deleted all data for shop ${shop}`);
      break;

    case "APP_UNINSTALLED":
      // Log app uninstall - optionally clean up data
      console.log(
        `App uninstalled for shop ${shop}:`,
        JSON.stringify(payload, null, 2)
      );
      // Note: We keep the data in case they reinstall, but mark as uninstalled
      // In production, you might want to implement a cleanup job
      break;

    default:
      console.log(`Unhandled webhook topic: ${topic}`);
  }

  return new Response("Webhook processed", { status: 200 });
};
