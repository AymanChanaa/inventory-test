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

## Task 2 — Optimistic UI

The whole thing runs on a single `useFetcher()` hook. No `useState`, no manual stock tracking.

While the request is in-flight, `fetcher.formData` still holds the values we submitted. So instead of storing the "pending" stock somewhere, I just compute it on the fly:

```tsx
const isSubmitting = fetcher.state !== "idle";

const optimisticStock =
  isSubmitting && fetcher.formData?.get("id") === item.id
    ? item.stock - 1  // shown instantly on click
    : item.stock;     // back to real value when idle
```

The moment the user clicks, `fetcher.state` flips to `"submitting"` and the UI shows `stock - 1` with zero delay. No extra code needed.

**Rollback** is also automatic. When the action returns an error, React Router revalidates the loader — which re-fetches the real stock from the server. Since the optimistic value is just a derived calculation (not stored state), it disappears naturally once `isSubmitting` goes back to `false`.

**Double-submit prevention** is handled by disabling the button whenever `fetcher.state !== "idle"`. Simple and effective.

---

## Task 3 — Error Boundary & Retry

There are two layers of error handling here, each catching a different type of failure.

**Layer 1** — The loader returns an unawaited Promise, which React Router streams to the client. If that Promise rejects (the 20% failure case), `<Await>` catches it and renders `<InventoryError>` in place of the table. The page shell stays completely untouched.

**Layer 2** — The exported `ErrorBoundary` function is React Router's convention for route-level error catching. It handles anything that throws outside the streamed Promise (e.g. a sync error in the loader). Same idea — the layout stays visible, only the content area shows the error.

**Retry without page refresh** — Both error components use `useRevalidator`:

```tsx
const { revalidate } = useRevalidator();
```

Calling `revalidate()` tells React Router to re-run the loader for the current route. No URL change, no browser reload, no lost state. The skeleton appears again while the new request is in-flight, and either the data loads or the error shows again.