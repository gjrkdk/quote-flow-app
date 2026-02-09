import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher } from "@remix-run/react";
import {
  Page,
  Box,
  Card,
  EmptyState,
  IndexTable,
  Text,
  Modal,
  BlockStack,
  InlineStack,
  Button,
} from "@shopify/polaris";
import { useState, useCallback, useEffect, useRef } from "react";
import { authenticate } from "~/shopify.server";
import { prisma } from "~/db.server";
import { listOptionGroups, deleteOptionGroup } from "~/services/option-group.server";

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

  if (intent === "delete") {
    // Find store
    const store = await prisma.store.findUnique({
      where: { shop: session.shop },
    });

    if (!store) {
      return json({ error: "Store not found" }, { status: 404 });
    }

    // Delete option group (cascade handles choices and product assignments)
    const result = await deleteOptionGroup(groupId, store.id);

    if (!result) {
      return json({ error: "Option group not found or unauthorized" }, { status: 404 });
    }

    return json({ success: true });
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

  // Refs for focus management
  const rowRefs = useRef<Map<string, HTMLSpanElement>>(new Map());

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
      } else {
        // Option group was successfully deleted - focus on the first group in the list
        const firstGroup = optionGroups[0];
        if (firstGroup) {
          const rowElement = rowRefs.current.get(firstGroup.id);
          if (rowElement) {
            rowElement.focus();
          }
        }
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

  // Table view when option groups exist
  const rowMarkup = optionGroups.map((group, index) => (
    <IndexTable.Row
      id={group.id}
      key={group.id}
      position={index}
      onClick={() => handleRowClick(group.id)}
    >
      <IndexTable.Cell>
        <span
          ref={(el) => {
            if (el) {
              rowRefs.current.set(group.id, el);
            } else {
              rowRefs.current.delete(group.id);
            }
          }}
          tabIndex={-1}
          style={{ outline: "none" }}
        >
          <Text as="span" fontWeight="semibold">
            {group.name}
          </Text>
        </span>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {group.requirement === "required" ? "Required" : "Optional"}
      </IndexTable.Cell>
      <IndexTable.Cell>
        {group.choiceCount} {group.choiceCount === 1 ? "choice" : "choices"}
      </IndexTable.Cell>
      <IndexTable.Cell>
        {group.productCount} {group.productCount === 1 ? "product" : "products"}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <div onClick={(e) => e.stopPropagation()}>
          <InlineStack gap="300">
            <Button
              variant="plain"
              size="slim"
              onClick={() => navigate(`/app/option-groups/${group.id}/edit`)}
            >
              Edit
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
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Option Groups"
      primaryAction={{
        content: "Create option group",
        onAction: () => navigate("/app/option-groups/new"),
      }}
    >
      <Box paddingInline={{ xs: "200", md: "400" }}>
        <Card padding="0">
          <IndexTable
            resourceName={{ singular: "option group", plural: "option groups" }}
            itemCount={optionGroups.length}
            headings={[
              { title: "Name" },
              { title: "Type" },
              { title: "Choices" },
              { title: "Used by" },
              { title: "Actions" },
            ]}
            selectable={false}
            condensed
          >
            {rowMarkup}
          </IndexTable>
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
