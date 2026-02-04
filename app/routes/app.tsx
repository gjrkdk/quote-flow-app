import { LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { AppProvider } from "@shopify/polaris";
import { authenticate } from "~/shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return {};
};

export default function App() {
  useLoaderData<typeof loader>();

  return (
    <AppProvider i18n={{}}>
      <ui-nav-menu>
        <Link to="/app" rel="home">
          Dashboard
        </Link>
        <Link to="/app/settings">Settings</Link>
      </ui-nav-menu>
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>App Error</h1>
      <p>
        {error instanceof Error
          ? error.message
          : "An unexpected error occurred"}
      </p>
      <a href="/app" style={{ marginTop: "1rem", display: "inline-block" }}>
        Go to Dashboard
      </a>
    </div>
  );
}
