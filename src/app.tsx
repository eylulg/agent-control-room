import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router";
import { AppShell } from "@/components/app/app-shell";
import { RouteProvider } from "@/providers/router-provider";
import { AppStoreProvider } from "@/state/context";
import type { AppStore } from "@/state/store";

interface AppProps {
    store: AppStore;
}

const OverviewPage = lazy(() => import("@/pages/overview").then((m) => ({ default: m.OverviewPage })));
const QueuePage = lazy(() => import("@/pages/queue").then((m) => ({ default: m.QueuePage })));
const JobDetailPage = lazy(() => import("@/pages/job-detail").then((m) => ({ default: m.JobDetailPage })));
const ApprovalsPage = lazy(() => import("@/pages/approvals").then((m) => ({ default: m.ApprovalsPage })));
const RoutingPage = lazy(() => import("@/pages/routing").then((m) => ({ default: m.RoutingPage })));
const GuardsPage = lazy(() => import("@/pages/guards").then((m) => ({ default: m.GuardsPage })));
const SettingsPage = lazy(() => import("@/pages/settings").then((m) => ({ default: m.SettingsPage })));
const NotFoundPage = lazy(() => import("@/pages/not-found").then((m) => ({ default: m.NotFoundPage })));

/** Everything below the router, so tests can wrap it in a MemoryRouter. Each page loads as its own chunk. */
export const App = ({ store }: AppProps) => (
    <AppStoreProvider store={store}>
        <RouteProvider>
            <AppShell>
                <Suspense fallback={<p className="text-sm text-tertiary">Loading page</p>}>
                    <Routes>
                        <Route path="/" element={<OverviewPage />} />
                        <Route path="/queue" element={<QueuePage />} />
                        <Route path="/jobs/:jobId" element={<JobDetailPage />} />
                        <Route path="/approvals" element={<ApprovalsPage />} />
                        <Route path="/routing" element={<RoutingPage />} />
                        <Route path="/guards" element={<GuardsPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                </Suspense>
            </AppShell>
        </RouteProvider>
    </AppStoreProvider>
);
