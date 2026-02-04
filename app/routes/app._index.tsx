import { ActionFunctionArgs, LoaderFunctionArgs, json } from "@remix-run/node";
import { useLoaderData, useSubmit, useActionData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  Button,
  InlineStack,
  Banner,
  TextField,
  Modal,
  Toast,
  Frame,
} from "@shopify/polaris";
import { useEffect, useState } from "react";
import { authenticate } from "~/shopify.server";
import { ensureStoreExists } from "~/hooks/afterInstall.server";
import { prisma } from "~/db.server";
import { generateApiKey, hashApiKey, getApiKeyPrefix } from "~/utils/api-key.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Ensure store exists and get store data
  const { store, isNewInstall, apiKey } = await ensureStoreExists(
    session.shop,
    session.accessToken
  );

  return json({
    store: {
      id: store.id,
      shop: store.shop,
      apiKeyPrefix: store.apiKeyPrefix,
      onboardingCompleted: store.onboardingCompleted,
    },
    newApiKey: isNewInstall ? apiKey : null,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "dismiss-welcome") {
    await prisma.store.update({
      where: { shop: session.shop },
      data: { onboardingCompleted: true },
    });

    return json({ success: true, message: "Welcome dismissed" });
  }

  if (intent === "regenerate-key") {
    const newApiKey = generateApiKey();
    const apiKeyHash = hashApiKey(newApiKey);
    const apiKeyPrefix = getApiKeyPrefix(newApiKey);

    await prisma.store.update({
      where: { shop: session.shop },
      data: {
        apiKeyHash,
        apiKeyPrefix,
      },
    });

    return json({
      success: true,
      message: "API key regenerated",
      newApiKey,
    });
  }

  return json({ success: false, message: "Invalid action" });
};

export default function Index() {
  const { store, newApiKey } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();

  const [showApiKey, setShowApiKey] = useState(false);
  const [currentApiKey, setCurrentApiKey] = useState(newApiKey);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Handle action results
  useEffect(() => {
    if (actionData?.success) {
      showToast(actionData.message);

      if (actionData.newApiKey) {
        setCurrentApiKey(actionData.newApiKey);
        setShowApiKey(true);
        setShowRegenerateModal(false);
      }
    }
  }, [actionData]);

  // Show new API key on first install
  useEffect(() => {
    if (newApiKey) {
      setShowApiKey(true);
    }
  }, [newApiKey]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastActive(true);
  };

  const handleDismissWelcome = () => {
    const formData = new FormData();
    formData.append("intent", "dismiss-welcome");
    submit(formData, { method: "post" });
  };

  const handleCopyApiKey = () => {
    if (currentApiKey) {
      navigator.clipboard.writeText(currentApiKey);
      showToast("API key copied to clipboard");
    }
  };

  const handleRegenerateKey = () => {
    const formData = new FormData();
    formData.append("intent", "regenerate-key");
    submit(formData, { method: "post" });
  };

  const maskedKey = store.apiKeyPrefix
    ? `${store.apiKeyPrefix}${"*".repeat(60)}`
    : "No API key";

  return (
    <Frame>
      <Page title="Dashboard">
        <Layout>
          {/* Welcome Card */}
          {!store.onboardingCompleted && (
            <Layout.Section>
              <Banner
                title="You're all set! Here's how to get started"
                onDismiss={handleDismissWelcome}
              >
                <BlockStack gap="200">
                  <Text as="p">
                    Welcome to Price Matrix! Follow these steps to start offering dimension-based pricing:
                  </Text>
                  <BlockStack gap="100">
                    <Text as="p">1. Create your first pricing matrix below</Text>
                    <Text as="p">2. Copy your API key from the section below</Text>
                    <Text as="p">
                      3. Add the widget to your storefront{" "}
                      <a
                        href="https://docs.example.com"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        (see docs)
                      </a>
                    </Text>
                  </BlockStack>
                </BlockStack>
              </Banner>
            </Layout.Section>
          )}

          {/* API Key Section */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    API Key
                  </Text>
                  <Text as="p" tone="subdued">
                    Use this key to authenticate API requests from your storefront.
                  </Text>
                </BlockStack>

                {currentApiKey ? (
                  <BlockStack gap="300">
                    <Banner tone="warning">
                      <Text as="p">
                        Save this key now - you won't be able to see it again! If you lose it, you'll need to regenerate a new one.
                      </Text>
                    </Banner>
                    <TextField
                      label="Your API Key"
                      value={currentApiKey}
                      readOnly
                      autoComplete="off"
                      labelHidden
                    />
                    <InlineStack gap="200">
                      <Button onClick={handleCopyApiKey}>Copy Key</Button>
                      <Button onClick={() => setShowApiKey(false)}>
                        Hide Key
                      </Button>
                    </InlineStack>
                  </BlockStack>
                ) : (
                  <BlockStack gap="300">
                    <TextField
                      label="Your API Key"
                      value={showApiKey && currentApiKey ? currentApiKey : maskedKey}
                      readOnly
                      autoComplete="off"
                      labelHidden
                    />
                    <InlineStack gap="200">
                      <Button onClick={() => setShowRegenerateModal(true)}>
                        Regenerate Key
                      </Button>
                    </InlineStack>
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Matrices Empty State */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Pricing Matrices
                  </Text>
                  <Text as="p" tone="subdued">
                    No pricing matrices yet. Create your first matrix to start offering dimension-based pricing on your products.
                  </Text>
                </BlockStack>
                <InlineStack align="start">
                  <Button variant="primary">Create Matrix</Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Regenerate Modal */}
        <Modal
          open={showRegenerateModal}
          onClose={() => setShowRegenerateModal(false)}
          title="Regenerate API Key"
          primaryAction={{
            content: "Regenerate",
            onAction: handleRegenerateKey,
            destructive: true,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setShowRegenerateModal(false),
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="200">
              <Text as="p">
                This will generate a new API key and invalidate your current key.
              </Text>
              <Text as="p" tone="critical">
                Any storefront using the old key will stop working until you update it with the new key.
              </Text>
            </BlockStack>
          </Modal.Section>
        </Modal>

        {/* Toast Notification */}
        {toastActive && (
          <Toast
            content={toastMessage}
            onDismiss={() => setToastActive(false)}
            duration={3000}
          />
        )}
      </Page>
    </Frame>
  );
}
