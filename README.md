# Inventory Dashboard — Royal Apps Remix Assessment

## Quick Start

```bash
npx create-react-router@latest inventory-test
cd inventory-test
npm install @shopify/polaris
# Copy the files from this repo into the project
npm run dev
# Visit http://localhost:5173/dashboard
```

---

## Task 2 — Optimistic UI Implementation

### How it works

The `ClaimButton` component uses a single `useFetcher()` hook, which is the
Remix-native way to submit data without triggering a full navigation.

**Optimistic stock calculation (0ms feedback):**

```tsx
const isSubmitting = fetcher.state !== "idle";

const optimisticStock =
  isSubmitting && fetcher.formData?.get("id") === item.id
    ? item.stock - 1   // shown instantly while request is in-flight
    : item.stock;       // real server value when idle
```

While the network request is in-flight, `fetcher.formData` contains the form
values we submitted. We read the `id` from it to confirm this fetcher belongs
to *this* item, then subtract 1 from the server's last-known stock count. This
gives the user instant visual feedback with **zero `useState` calls**.

**Rollback on error:**

No manual rollback code is needed. When the action returns `{ error: "Out of
stock" }`, Remix automatically revalidates the loader. The loader re-fetches
the real server state and the component re-renders with the actual stock count,
effectively rolling back the optimistic update. The error message from
`fetcher.data.error` is displayed inline beneath the button.

**Double-submit prevention:**

```tsx
<Button
  submit
  disabled={isSubmitting || isOutOfStock}
  loading={isSubmitting}
>
  Claim One
</Button>
```

The button is disabled whenever `fetcher.state !== "idle"`, so a second click
is impossible while the first request is pending.

---

## Task 3 — Error Boundary & Retry Logic

### Two layers of error containment

**Layer 1 — `<Await errorElement>` (handles the deferred promise rejection)**

Because the loader uses `defer()`, the `getInventory` promise can reject *after*
the page has already rendered. React's `<Await>` catches that rejection and
renders the `errorElement` prop — an `<InventoryError>` component with a Polaris
`Banner` and a Retry button — **without unmounting the page shell**.

**Layer 2 — exported `ErrorBoundary` (handles all other route errors)**

Any error that escapes the loader/action outside of the deferred promise (e.g.
a sync throw in the loader before `defer()`) is caught here. It renders the
same `Page` shell with a `Banner`, so the navigation/header always stays visible.

### Retry without a full page refresh

```tsx
const { revalidate } = useRevalidator();

// Used as the Banner's action:
action={{ content: "Retry", onAction: revalidate }}
```

`useRevalidator().revalidate()` tells Remix to re-run the current route's
loader and re-render — exactly like a soft navigation but with no URL change
and no browser reload. The user sees the skeleton appear again while the new
fetch attempt resolves.