import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useNavigate, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  TextField,
  Select,
  Banner,
  BlockStack,
  Text,
  InlineStack,
  Button,
  Checkbox,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "~/shopify.server";
import { prisma } from "~/db.server";
import { OptionGroupCreateSchema } from "~/validators/option-group.validators";
import { createOptionGroup } from "~/services/option-group.server";
import { ZodError } from "zod";

interface Choice {
  label: string;
  modifierType: "FIXED" | "PERCENTAGE";
  modifierValue: number;
  isDefault: boolean;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const formData = await request.formData();
  const dataStr = formData.get("data");

  if (!dataStr || typeof dataStr !== "string") {
    return json({ error: "Invalid form data" }, { status: 400 });
  }

  try {
    const data = JSON.parse(dataStr);
    const validated = OptionGroupCreateSchema.parse(data);

    // Find store
    const store = await prisma.store.findUnique({
      where: { shop: session.shop },
      select: { id: true },
    });

    if (!store) {
      return json({ error: "Store not found" }, { status: 404 });
    }

    // Create option group
    const optionGroup = await createOptionGroup(store.id, validated);

    // Redirect to edit page
    return redirect(`/app/option-groups/${optionGroup.id}/edit`);
  } catch (error) {
    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];
      return json(
        { error: firstIssue.message },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: message }, { status: 400 });
  }
};

export default function NewOptionGroup() {
  const navigate = useNavigate();
  const fetcher = useFetcher<typeof action>();

  const [name, setName] = useState("");
  const [requirement, setRequirement] = useState<"REQUIRED" | "OPTIONAL">("OPTIONAL");
  const [choices, setChoices] = useState<Choice[]>([
    { label: "", modifierType: "FIXED", modifierValue: 0, isDefault: false },
  ]);

  const isSubmitting = fetcher.state === "submitting" || fetcher.state === "loading";
  const actionData = fetcher.data;

  // Add choice
  const addChoice = useCallback(() => {
    if (choices.length >= 20) return;
    setChoices((prev) => [
      ...prev,
      { label: "", modifierType: "FIXED", modifierValue: 0, isDefault: false },
    ]);
  }, [choices.length]);

  // Remove choice
  const removeChoice = useCallback((index: number) => {
    setChoices((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // Update choice field
  const updateChoice = useCallback((index: number, field: keyof Choice, value: any) => {
    setChoices((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(() => {
    const data = {
      name,
      requirement,
      choices,
    };

    fetcher.submit(
      { data: JSON.stringify(data) },
      { method: "post" }
    );
  }, [name, requirement, choices, fetcher]);

  return (
    <Page
      title="Create option group"
      backAction={{ onAction: () => navigate("/app/option-groups") }}
    >
      <Layout>
        {/* Error banner */}
        {actionData && "error" in actionData && (
          <Layout.Section>
            <Banner tone="critical">
              {actionData.error}
            </Banner>
          </Layout.Section>
        )}

        {/* Group details card */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <TextField
                label="Group name"
                value={name}
                onChange={setName}
                autoComplete="off"
                maxLength={100}
                placeholder="e.g., Material, Size, Finish"
                requiredIndicator
                helpText="Choose a descriptive name for this option group"
              />

              <Select
                label="Requirement"
                options={[
                  { label: "Optional - customers can skip", value: "OPTIONAL" },
                  { label: "Required - customers must select", value: "REQUIRED" },
                ]}
                value={requirement}
                onChange={(value) => setRequirement(value as "REQUIRED" | "OPTIONAL")}
                helpText={
                  requirement === "OPTIONAL"
                    ? "Customers can skip this option. You can set a default choice below."
                    : "Customers must select one of the choices for this option."
                }
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Choices card */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">
                  Choices
                </Text>
                <Button
                  onClick={addChoice}
                  disabled={choices.length >= 20}
                >
                  Add choice
                </Button>
              </InlineStack>

              {choices.length >= 20 && (
                <Banner tone="warning">
                  Maximum 20 choices per group.
                </Banner>
              )}

              <BlockStack gap="300">
                {choices.map((choice, index) => (
                  <Card key={index}>
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text as="p" variant="bodyMd" fontWeight="semibold">
                          Choice {index + 1}
                        </Text>
                        {choices.length > 1 && (
                          <Button
                            variant="plain"
                            tone="critical"
                            onClick={() => removeChoice(index)}
                          >
                            Remove
                          </Button>
                        )}
                      </InlineStack>

                      <TextField
                        label="Label"
                        value={choice.label}
                        onChange={(value) => updateChoice(index, "label", value)}
                        autoComplete="off"
                        maxLength={100}
                        placeholder="e.g., Premium Glass, Standard Glass"
                        requiredIndicator
                      />

                      <Select
                        label="Modifier type"
                        options={[
                          { label: "Fixed amount (e.g., +$5.00)", value: "FIXED" },
                          { label: "Percentage (e.g., +10%)", value: "PERCENTAGE" },
                        ]}
                        value={choice.modifierType}
                        onChange={(value) =>
                          updateChoice(index, "modifierType", value as "FIXED" | "PERCENTAGE")
                        }
                      />

                      <TextField
                        label="Modifier value"
                        type="number"
                        value={String(choice.modifierValue)}
                        onChange={(value) => {
                          const parsed = parseInt(value, 10);
                          updateChoice(index, "modifierValue", isNaN(parsed) ? 0 : parsed);
                        }}
                        autoComplete="off"
                        helpText={
                          choice.modifierType === "FIXED"
                            ? "Enter amount in cents (500 = $5.00). Negative values allowed for discounts."
                            : "Enter percentage in basis points (1000 = 10%). Negative values allowed for discounts."
                        }
                      />

                      {requirement === "OPTIONAL" && (
                        <Checkbox
                          label="Set as default choice"
                          checked={choice.isDefault}
                          onChange={(checked) => updateChoice(index, "isDefault", checked)}
                          helpText="Optional groups can have one default choice pre-selected"
                        />
                      )}
                    </BlockStack>
                  </Card>
                ))}
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Action buttons */}
        <Layout.Section>
          <InlineStack gap="300" align="end">
            <Button onClick={() => navigate("/app/option-groups")}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={isSubmitting}
              disabled={!name.trim() || choices.length === 0 || isSubmitting}
            >
              Create option group
            </Button>
          </InlineStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
