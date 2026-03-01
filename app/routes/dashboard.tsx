import { Suspense } from "react";
import {
  Await,
  useLoaderData,
  useRouteError,
  useRevalidator,
  useFetcher,
} from "react-router";
import type { ActionFunctionArgs } from "react-router";
import {
  Page,
  Layout,
  Card,
  DataTable,
  SkeletonBodyText,
  Banner,
  Button,
  Badge,
  InlineStack,
  Text,
  BlockStack,
} from "@shopify/polaris";

import { getInventory, claimStock } from "~/models/inventory.server";

// TYPES
type Item = { id: string; name: string; stock: number };

// LOADER (Task 1: Streaming)
// In React Router v7, defer() is gone. Instead, return a plain object containing an unawaited Promise.
// React Router detects the Promise automatically and streams it — the page shell renders at 0ms, data arrives ~3s later.
export function loader() {
  return {
    inventory: getInventory(),
  };
}

// ACTION (Task 2: Mutation)
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const id = formData.get("id");

  if (typeof id !== "string") {
    return { error: "Invalid item ID" };
  }

  try {
    const updated = await claimStock(id);
    return { success: true, item: updated };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

// CLAIM BUTTON (Task 2: Optimistic UI)
function ClaimButton({ item }: { item: Item }) {
  const fetcher = useFetcher<{ error?: string; success?: boolean }>();

  const isSubmitting = fetcher.state !== "idle";

  const optimisticStock =
    isSubmitting && fetcher.formData?.get("id") === item.id
      ? item.stock - 1
      : item.stock;

  const isOutOfStock = optimisticStock <= 0;

  return (
    <BlockStack gap="100">
      <InlineStack gap="300" align="center" blockAlign="center">
        <Text as="span" variant="bodyMd">
          {optimisticStock}
        </Text>
        {isOutOfStock ? (
          <Badge tone="critical">Out of stock</Badge>
        ) : (
          <Badge tone="success">In stock</Badge>
        )}
        <fetcher.Form method="post">
          <input type="hidden" name="id" value={item.id} />
          <Button
            submit
            size="slim"
            disabled={isSubmitting || isOutOfStock}
            loading={isSubmitting}
          >
            Claim One
          </Button>
        </fetcher.Form>
      </InlineStack>
      {fetcher.data?.error && (
        <Text as="span" tone="critical" variant="bodySm">
          {fetcher.data.error}
        </Text>
      )}
    </BlockStack>
  );
}

// INVENTORY TABLE
function InventoryTable({ items }: { items: Item[] }) {
  const rows = items.map((item) => [
    item.id,
    item.name,
    <ClaimButton key={item.id} item={item} />,
  ]);

  return (
    <DataTable
      columnContentTypes={["text", "text", "text"]}
      headings={["ID", "Name", "Stock / Action"]}
      rows={rows}
    />
  );
}

// SKELETON (shown while streaming)
function InventorySkeleton() {
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          Loading inventory…
        </Text>
        <SkeletonBodyText lines={4} />
      </BlockStack>
    </Card>
  );
}

// INLINE AWAIT ERROR
function InventoryError() {
  const { revalidate } = useRevalidator();

  return (
    <Banner
      title="Failed to load inventory"
      tone="critical"
      action={{
        content: "Retry",
        onAction: revalidate,
      }}
    >
      <p>The inventory API returned an error. Please retry — it succeeds ~80% of the time.</p>
    </Banner>
  );
}

// DEFAULT EXPORT
export default function Dashboard() {
  const { inventory } = useLoaderData<typeof loader>();

  return (
    <Page title="Inventory Dashboard">
      <Layout>
        <Layout.Section>
          <Suspense fallback={<InventorySkeleton />}>
            <Await resolve={inventory} errorElement={<InventoryError />}>
              {(items) => (
                <Card>
                  <InventoryTable items={items as Item[]} />
                </Card>
              )}
            </Await>
          </Suspense>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

// ROUTE-LEVEL ERROR BOUNDARY (Task 3)
export function ErrorBoundary() {
  const error = useRouteError();
  const { revalidate } = useRevalidator();

  const message =
    error instanceof Error ? error.message : "An unexpected error occurred.";

  return (
    <Page title="Inventory Dashboard">
      <Layout>
        <Layout.Section>
          <Banner
            title="Something went wrong"
            tone="critical"
            action={{
              content: "Retry",
              onAction: revalidate,
            }}
          >
            <p>{message}</p>
          </Banner>
        </Layout.Section>
      </Layout>
    </Page>
  );
}