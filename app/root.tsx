import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import { AppProvider, Page, Card, BlockStack, Text, Button, InlineStack } from "@shopify/polaris";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

function Document({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta
          name="shopify-api-key"
          content={process.env.SHOPIFY_API_KEY || ""}
        />
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <Document>
      <Outlet />
    </Document>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  const isAuthError =
    isRouteErrorResponse(error) &&
    (error.status === 401 || error.status === 403);

  const title = isAuthError
    ? "Authentication Error"
    : "Something went wrong";

  const description = isAuthError
    ? "We couldn't verify your session. This usually happens when your session has expired or the app needs to be reinstalled."
    : "We encountered an unexpected error. This usually resolves by trying again.";

  return (
    <Document>
      <AppProvider i18n={{}}>
        <Page title={title}>
          <BlockStack gap="500">
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  {title}
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  {description}
                </Text>
                {!isAuthError && error instanceof Error && (
                  <Text variant="bodySm" as="p" tone="subdued">
                    Error: {error.message}
                  </Text>
                )}
                <InlineStack gap="300">
                  <Button url="/auth/login" variant="primary">
                    Try installing again
                  </Button>
                  <Button
                    variant="plain"
                    url="mailto:support@example.com"
                    external
                  >
                    Contact support
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Page>
      </AppProvider>
    </Document>
  );
}
