import { type ReactNode, useEffect, useRef, useState } from "react";
import { BarChartSquare02, CheckDone01, LayoutGrid01, Menu01, Route, Settings01, Shield01, X } from "@untitledui/icons";
import { NavLink, useLocation } from "react-router";
import { pendingApprovals } from "@/domain/selectors";
import { useAppStore } from "@/state/store-context";
import { cx } from "@/utils/cx";
import { HealthIndicator } from "./health-indicator";
import { LiveRegion } from "./live-region";
import { SimControls } from "./sim-controls";
import { ThemeToggle } from "./theme-toggle";
import { Toaster } from "./toaster";

interface AppShellProps {
    children: ReactNode;
}

interface NavItemsProps {
    onNavigate?: () => void;
}

const NAV = [
    { to: "/", label: "Overview", icon: BarChartSquare02, end: true },
    { to: "/queue", label: "Queue", icon: LayoutGrid01, end: false },
    { to: "/approvals", label: "Approvals", icon: CheckDone01, end: false },
    { to: "/routing", label: "Routing", icon: Route, end: false },
    { to: "/guards", label: "Guards", icon: Shield01, end: false },
    { to: "/settings", label: "Settings", icon: Settings01, end: false },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cx(
        "flex items-center gap-3 rounded-md px-3 py-2 text-md font-semibold transition",
        isActive ? "bg-tertiary text-secondary_hover" : "text-secondary hover:bg-primary_hover hover:text-secondary_hover",
    );

export const AppShell = ({ children }: AppShellProps) => {
    const location = useLocation();
    // The menu belongs to the path it was opened on, so any navigation closes it.
    const [menuOpenAt, setMenuOpenAt] = useState<string | null>(null);
    const mainRef = useRef<HTMLElement>(null);

    const menuOpen = menuOpenAt === location.pathname;

    useEffect(() => {
        // React Router gives the first location the key "default". Only later navigations move focus.
        if (location.key === "default") return;
        mainRef.current?.focus({ preventScroll: true });
        window.scrollTo(0, 0);
    }, [location.key]);

    function handleMenuToggle() {
        setMenuOpenAt(menuOpen ? null : location.pathname);
    }

    function handleNavigate() {
        setMenuOpenAt(null);
    }

    return (
        <div className="min-h-dvh bg-secondary">
            <a
                href="#main"
                className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary shadow-md focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
            >
                Skip to content
            </a>
            <div className="lg:flex">
                <aside className="hidden w-64 shrink-0 border-r border-secondary bg-primary lg:block">
                    <div className="sticky top-0 flex h-dvh flex-col gap-6 p-4">
                        <Brand />
                        <nav aria-label="Primary">
                            <NavItems />
                        </nav>
                        <p className="mt-auto rounded-lg bg-secondary p-3 text-xs text-tertiary">
                            A simulated agent runs in your browser. Swap in a real backend over server sent events.
                        </p>
                    </div>
                </aside>

                <div className="min-w-0 flex-1">
                    <header className="sticky top-0 z-30 border-b border-secondary bg-primary">
                        <div className="flex items-center gap-2 px-4 py-3 sm:px-6">
                            <button
                                type="button"
                                className="flex size-9 items-center justify-center rounded-md text-fg-quaternary hover:bg-primary_hover lg:hidden"
                                aria-expanded={menuOpen}
                                aria-controls="mobile-nav"
                                aria-label={menuOpen ? "Close menu" : "Open menu"}
                                onClick={handleMenuToggle}
                            >
                                {menuOpen ? <X aria-hidden="true" className="size-5" /> : <Menu01 aria-hidden="true" className="size-5" />}
                            </button>
                            <div className="lg:hidden">
                                <Brand />
                            </div>
                            <div className="hidden min-w-0 flex-1 lg:block">
                                <HealthIndicator />
                            </div>
                            <div className="ml-auto flex items-center gap-1">
                                <div className="lg:hidden">
                                    <HealthIndicator compact />
                                </div>
                                <SimControls />
                                <ThemeToggle />
                            </div>
                        </div>
                        {menuOpen && (
                            <nav id="mobile-nav" aria-label="Primary" className="border-t border-secondary px-4 py-3 lg:hidden">
                                <NavItems onNavigate={handleNavigate} />
                            </nav>
                        )}
                    </header>
                    <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto w-full max-w-7xl px-4 py-6 outline-none sm:px-6 lg:px-8">
                        {children}
                    </main>
                </div>
            </div>
            <LiveRegion />
            <Toaster />
        </div>
    );
};

const NavItems = ({ onNavigate }: NavItemsProps) => {
    const pending = useAppStore((s) => pendingApprovals(s.control).length);

    return (
        <ul className="flex flex-col gap-0.5">
            {NAV.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                    <NavLink to={to} end={end} onClick={onNavigate} className={navLinkClass}>
                        <Icon aria-hidden="true" className="size-5 shrink-0 text-fg-quaternary" />
                        <span className="flex-1">{label}</span>
                        {to === "/approvals" && pending > 0 && (
                            <span className="rounded-full bg-brand-solid px-2 py-0.5 text-xs font-semibold text-primary_on-brand">
                                {pending}
                                <span className="sr-only"> pending</span>
                            </span>
                        )}
                    </NavLink>
                </li>
            ))}
        </ul>
    );
};

const Brand = () => (
    <p className="flex items-center gap-2 text-md font-semibold text-primary">
        <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-md bg-brand-solid text-xs font-bold text-primary_on-brand">
            AC
        </span>
        <span className="max-[419px]:sr-only">Agent control room</span>
    </p>
);
