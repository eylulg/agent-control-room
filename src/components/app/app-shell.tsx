import { type ReactNode, Suspense, lazy, useEffect } from 'react';
import {
  BrandMark,
  ProjectSwitcher,
  AppShell as Shell,
  SiteFooter,
  ThemeToggle,
  TopNav,
} from '@eylulg/ui/chrome';
import { ToastProvider } from '@eylulg/ui/toast';
import { useLocation } from 'react-router';
import { ApprovalToasts } from './approval-toasts';
import { HealthIndicator } from './health-indicator';
import { LiveRegion } from './live-region';
import { RouterLink } from './router-link';
import { SideNav } from './side-nav';
import { SimControls } from './sim-controls';

interface AppShellProps {
  children: ReactNode;
}

// The drawer link reads a React Aria context that drags the dialog code with it, so it loads only when the drawer opens.
const MobileNav = lazy(() => import('./mobile-nav').then((m) => ({ default: m.MobileNav })));

const PROJECT_ID = 'agent-control-room';
const TOAST_MS = 9000;

export const AppShell = ({ children }: AppShellProps) => {
  const location = useLocation();

  useEffect(() => {
    // React Router gives the first location the key "default". Only later navigations move focus.
    if (location.key === 'default') return;
    document.getElementById('main')?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [location.key]);

  return (
    <ToastProvider duration={TOAST_MS} placement='bottom-right'>
      <Shell
        header={<Header />}
        sidebar={<SideNav LinkComponent={RouterLink} />}
        footer={<SiteFooter currentId={PROJECT_ID} />}
      >
        {children}
      </Shell>
      <LiveRegion />
      <ApprovalToasts />
    </ToastProvider>
  );
};

const Header = () => (
  <TopNav
    productName='Agent workflows'
    logo={<BrandMark />}
    LinkComponent={RouterLink}
    mobileMenu={
      <Suspense fallback={null}>
        <MobileNav />
      </Suspense>
    }
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
