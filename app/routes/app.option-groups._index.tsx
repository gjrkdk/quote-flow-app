import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher } from "@remix-run/react";
import {
  Page,
  Box,
  Card,
  EmptyState,
  Text,
  Modal,
  BlockStack,
  InlineStack,
  Button,
  ResourceList,
  ResourceItem,
} from "@shopify/polaris";
import { useState, useCallback, useEffect } from "react";
import { authenticate } from "~/shopify.server";
import { prisma } from "~/db.server";
import { listOptionGroups, deleteOptionGroup, duplicateOptionGroup } from "~/services/option-group.server";

interface OptionGroup {
  id: string;
  name: string;
  requirement: string;
  choiceCount: number;
  productCount: number;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Find the store
  const store = await prisma.store.findUnique({
    where: { shop: session.shop },
  });

  if (!store) {
    return json({ optionGroups: [] });
  }

  // Query option groups with counts
  const groups = await listOptionGroups(store.id);

  // Serialize data: map to interface format
  const serialized: OptionGroup[] = groups.map((group) => ({
    id: group.id,
    name: group.name,
    requirement: group.requirement,
    choiceCount: group._count.choices,
    productCount: group._count.products,
  }));

  return json({ optionGroups: serialized });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const groupId = formData.get("groupId");

  if (!groupId || typeof groupId !== "string") {
    return json({ error: "Option group ID is required" }, { status: 400 });
  }

  // Find store
  const store = await prisma.store.findUnique({
    where: { shop: session.shop },
  });

  if (!store) {
    return json({ error: "Store not found" }, { status: 404 });
  }

  if (intent === "delete") {
    // Delete option group (cascade handles choices and product assignments)
    const result = await deleteOptionGroup(groupId, store.id);

    if (!result) {
      return json({ error: "Option group not found or unauthorized" }, { status: 404 });
    }

    return json({ success: true });
  }

  if (intent === "duplicate") {
    // Duplicate option group with all choices
    const duplicate = await duplicateOptionGroup(groupId, store.id);

    if (!duplicate) {
      return json({ error: "Option group not found or unauthorized" }, { status: 404 });
    }

    // Redirect to the new option group's edit page
    return redirect(`/app/option-groups/${duplicate.id}/edit`);
  }

  return json({ error: "Invalid intent" }, { status: 400 });
};

export default function OptionGroupsIndex() {
  const { optionGroups } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher<typeof action>();

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<OptionGroup | null>(null);
  const [deletedGroupId, setDeletedGroupId] = useState<string | null>(null);

  const handleRowClick = useCallback(
    (groupId: string) => {
      navigate(`/app/option-groups/${groupId}/edit`);
    },
    [navigate]
  );

  const handleDeleteClick = useCallback((group: OptionGroup) => {
    setGroupToDelete(group);
    setDeleteModalOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!groupToDelete) return;

    const formData = new FormData();
    formData.append("intent", "delete");
    formData.append("groupId", groupToDelete.id);
    fetcher.submit(formData, { method: "post" });

    setDeleteModalOpen(false);
    setDeletedGroupId(groupToDelete.id);
    setGroupToDelete(null);
  }, [groupToDelete, fetcher]);

  const handleDuplicateClick = useCallback(
    (groupId: string) => {
      const formData = new FormData();
      formData.append("intent", "duplicate");
      formData.append("groupId", groupId);
      fetcher.submit(formData, { method: "post" });
    },
    [fetcher]
  );

  // Focus management after delete
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data && deletedGroupId) {
      if (optionGroups.length === 0) {
        // No option groups remain - focus on create button in empty state
        setTimeout(() => {
          const emptyStateButton = document.getElementById(
            "create-group-btn"
          ) as HTMLButtonElement;
          if (emptyStateButton) {
            emptyStateButton.focus();
          }
        }, 100);
      }

      setDeletedGroupId(null);
    }
  }, [fetcher.state, fetcher.data, deletedGroupId, optionGroups]);

  // Empty state when no option groups
  if (optionGroups.length === 0) {
    return (
      <Page title="Option Groups">
        <EmptyState
          heading="Create your first option group"
          action={{
            content: "Create option group",
            onAction: () => navigate("/app/option-groups/new"),
            id: "create-group-btn",
          }}
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>
            Option groups let customers choose add-ons like material, finish, or size.
            Create groups with choices and assign them to products.
          </p>
        </EmptyState>
      </Page>
    );
  }

  // Resource list view when option groups exist
  return (
    <Page
      title="Option Groups"
      primaryAction={{
        content: "Create option group",
        onAction: () => navigate("/app/option-groups/new"),
      }}
    >
      <Box paddingInline={{ xs: "200", md: "400" }}>
        <Card>
          <ResourceList
            resourceName={{ singular: "option group", plural: "option groups" }}
            items={optionGroups}
            renderItem={(group) => (
              <ResourceItem
                id={group.id}
                onClick={() => handleRowClick(group.id)}
              >
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text as="h3" variant="headingSm" fontWeight="bold">
                      {group.name}
                    </Text>
                    <InlineStack gap="400">
                      <Text as="span" variant="bodySm" tone="subdued">
                        {group.requirement === "required" ? "Required" : "Optional"}
                      </Text>
                      <Text as="span" variant="bodySm" tone="subdued">
                        {group.choiceCount} {group.choiceCount === 1 ? "choice" : "choices"}
                      </Text>
                      <Text as="span" variant="bodySm" tone="subdued">
                        {group.productCount} {group.productCount === 1 ? "product" : "products"}
                      </Text>
                    </InlineStack>
                  </BlockStack>
                  <div onClick={(e) => e.stopPropagation()}>
                    <InlineStack gap="200">
                      <Button
                        variant="plain"
                        size="slim"
                        onClick={() => handleDuplicateClick(group.id)}
                      >
                        Duplicate
                      </Button>
                      <Button
                        variant="plain"
                        size="slim"
                        tone="critical"
                        onClick={() => handleDeleteClick(group)}
                      >
                        Delete
                      </Button>
                    </InlineStack>
                  </div>
                </InlineStack>
              </ResourceItem>
            )}
          />
        </Card>
      </Box>

      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete option group"
        primaryAction={{
          content: "Delete",
          onAction: handleDeleteConfirm,
          destructive: true,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setDeleteModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="200">
            <Text as="p">
              This will permanently delete the option group "{groupToDelete?.name}".
            </Text>
            {groupToDelete && groupToDelete.productCount > 0 && (
              <Text as="p" tone="critical">
                This option group is assigned to {groupToDelete.productCount}{" "}
                {groupToDelete.productCount === 1 ? "product" : "products"}. It will be removed from all products.
              </Text>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
