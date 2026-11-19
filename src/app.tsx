import { type ReactNode, Suspense, lazy } from "react";
import { Route, Routes, useLocation } from "react-router";
import { AppShell } from "@/components/app/app-shell";
import { ErrorBoundary } from "@/components/app/error-boundary";
import { OverviewPage } from "@/pages/overview";
import { RouteProvider } from "@/providers/router-provider";
import { AppStoreProvider } from "@/state/context";
import type { AppStore } from "@/state/store";
import { WorkflowEditorProvider } from "@/state/workflow-provider";

interface AppProps {
    store: AppStore;
}

const QueuePage = lazy(() => import("@/pages/queue").then((m) => ({ default: m.QueuePage })));
const JobDetailPage = lazy(() => import("@/pages/job-detail").then((m) => ({ default: m.JobDetailPage })));
const ApprovalsPage = lazy(() => import("@/pages/approvals").then((m) => ({ default: m.ApprovalsPage })));
const RoutingPage = lazy(() => import("@/pages/routing").then((m) => ({ default: m.RoutingPage })));
const GuardsPage = lazy(() => import("@/pages/guards").then((m) => ({ default: m.GuardsPage })));
const SettingsPage = lazy(() => import("@/pages/settings").then((m) => ({ default: m.SettingsPage })));
const WorkflowsPage = lazy(() => import("@/pages/workflows").then((m) => ({ default: m.WorkflowsPage })));
const NotFoundPage = lazy(() => import("@/pages/not-found").then((m) => ({ default: m.NotFoundPage })));

/** A page that throws shows a way back instead of unmounting the shell, and a new route starts clean. */
const PageBoundary = ({ children }: { children: ReactNode }) => {
    const { pathname } = useLocation();
    return (
        <ErrorBoundary key={pathname}>
            <Suspense fallback={<p className="min-h-[60vh] text-sm text-tertiary">Loading page</p>}>{children}</Suspense>
        </ErrorBoundary>
    );
};

/** Everything below the router, so tests can wrap it in a MemoryRouter. The overview ships in the first bundle so the landing page never shifts when it arrives; the other pages load as their own chunks. */
export const App = ({ store }: AppProps) => (
    <AppStoreProvider store={store}>
        <RouteProvider>
            <WorkflowEditorProvider>
                <AppShell>
                    <PageBoundary>
                        <Routes>
                            <Route path="/" element={<OverviewPage />} />
                            <Route path="/queue" element={<QueuePage />} />
                            <Route path="/jobs/:jobId" element={<JobDetailPage />} />
                            <Route path="/approvals" element={<ApprovalsPage />} />
                            <Route path="/workflows" element={<WorkflowsPage />} />
                            <Route path="/routing" element={<RoutingPage />} />
                            <Route path="/guards" element={<GuardsPage />} />
                            <Route path="/settings" element={<SettingsPage />} />
                            <Route path="*" element={<NotFoundPage />} />
                        </Routes>
                    </PageBoundary>
                </AppShell>
            </WorkflowEditorProvider>
        </RouteProvider>
    </AppStoreProvider>
);
