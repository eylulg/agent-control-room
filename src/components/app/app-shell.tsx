import { type ReactNode, useEffect } from "react";
import { BrandMark, ProjectSwitcher, AppShell as Shell, SidebarNav, SiteFooter, ThemeToggle, TopNav } from "@eylulg/ui/chrome";
import { ToastProvider } from "@eylulg/ui/toast";
import { BarChart3, CheckCheck, FileText, LayoutGrid, Route, Settings, ShieldCheck, Workflow } from "lucide-react";
import { matchPath, useLocation } from "react-router";
import { pendingApprovals } from "@/domain/selectors";
import { useAppStore } from "@/state/store-context";
import { ApprovalToasts } from "./approval-toasts";
import { HealthIndicator } from "./health-indicator";
import { LiveRegion } from "./live-region";
import { RouterLink } from "./router-link";
import { SimControls } from "./sim-controls";

interface AppShellProps {
    children: ReactNode;
}

const PROJECT_ID = "agent-control-room";
const TOAST_MS = 9000;

export const AppShell = ({ children }: AppShellProps) => {
    const location = useLocation();

    useEffect(() => {
        // React Router gives the first location the key "default". Only later navigations move focus.
        if (location.key === "default") return;
        document.getElementById("main")?.focus({ preventScroll: true });
        window.scrollTo(0, 0);
    }, [location.key]);

    return (
        <ToastProvider duration={TOAST_MS} placement="bottom-right">
            <Shell header={<Header />} sidebar={<SideNav />} footer={<SiteFooter currentId={PROJECT_ID} />}>
                {children}
            </Shell>
            <LiveRegion />
            <ApprovalToasts />
        </ToastProvider>
    );
};

const Header = () => (
    <TopNav
        productName="Agent control room"
        logo={<BrandMark />}
        LinkComponent={RouterLink}
        mobileMenu={<SideNav />}
        center={<SimControls />}
        actions={
            <>
                <HealthIndicator />
                <ProjectSwitcher currentId={PROJECT_ID} />
                <ThemeToggle />
            </>
        }
        compactActions={<ThemeToggle compact />}
    />
);

const SideNav = () => {
    const { pathname } = useLocation();
    const pending = useAppStore((s) => pendingApprovals(s.control).length);
    const openJobId = matchPath("/jobs/:jobId", pathname)?.params.jobId ?? "";
    // The job being viewed, otherwise the newest one.
    const jobId = useAppStore((s) => (s.control.jobs[openJobId] ? openJobId : s.control.jobOrder.at(-1)));
    const ticketId = useAppStore((s) => (jobId ? s.control.jobs[jobId]?.ticket.id : undefined));

    const items = [
        { href: "/", label: "Overview", icon: <BarChart3 aria-hidden="true" />, isCurrent: pathname === "/" },
        { href: "/queue", label: "Queue", icon: <LayoutGrid aria-hidden="true" />, isCurrent: pathname === "/queue" },
        ...(jobId && ticketId
            ? [{ href: `/jobs/${jobId}`, label: `Job ${ticketId}`, icon: <FileText aria-hidden="true" />, isCurrent: pathname.startsWith("/jobs/") }]
            : []),
        {
            href: "/approvals",
            label: "Approvals",
            icon: <CheckCheck aria-hidden="true" />,
            isCurrent: pathname === "/approvals",
            badge:
                pending > 0 ? (
                    <>
                        {pending}
                        <span className="sr-only"> pending</span>
                    </>
                ) : undefined,
        },
        { href: "/workflows", label: "Workflows", icon: <Workflow aria-hidden="true" />, isCurrent: pathname === "/workflows" },
        { href: "/routing", label: "Routing", icon: <Route aria-hidden="true" />, isCurrent: pathname === "/routing" },
        { href: "/guards", label: "Guards", icon: <ShieldCheck aria-hidden="true" />, isCurrent: pathname === "/guards" },
        { href: "/settings", label: "Settings", icon: <Settings aria-hidden="true" />, isCurrent: pathname === "/settings" },
    ];

    return (
        <div className="flex flex-col gap-4">
            <SidebarNav aria-label="Primary" LinkComponent={RouterLink} sections={[{ id: "pages", items }]} />
            <aside aria-label="About the simulation" className="mx-3 rounded-lg bg-secondary p-3 text-xs text-tertiary">
                A simulated agent runs in your browser. Swap in a real backend over server sent events.
            </aside>
        </div>
    );
};
