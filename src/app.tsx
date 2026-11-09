import { Route, Routes } from "react-router";
import { AppShell } from "@/components/app/app-shell";
import { ApprovalsPage } from "@/pages/approvals";
import { GuardsPage } from "@/pages/guards";
import { JobDetailPage } from "@/pages/job-detail";
import { NotFoundPage } from "@/pages/not-found";
import { OverviewPage } from "@/pages/overview";
import { QueuePage } from "@/pages/queue";
import { RoutingPage } from "@/pages/routing";
import { SettingsPage } from "@/pages/settings";
import { RouteProvider } from "@/providers/router-provider";
import { AppStoreProvider } from "@/state/context";
import type { AppStore } from "@/state/store";

/** Everything below the router, so tests can wrap it in a MemoryRouter. */
export const App = ({ store }: { store: AppStore }) => (
    <AppStoreProvider store={store}>
        <RouteProvider>
            <AppShell>
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
            </AppShell>
        </RouteProvider>
    </AppStoreProvider>
);
