import { useEffect, useRef, useState } from "react";
import { AlertTriangle, X } from "@untitledui/icons";
import { Link } from "react-router";
import type { Toast } from "@/state/store";
import { useAppStore } from "@/state/store-context";

const TOAST_MS = 9000;

const ToastItem = ({ toast }: { toast: Toast }) => {
    const dismiss = useAppStore((s) => s.dismissToast);
    const [paused, setPaused] = useState(false);
    const remaining = useRef(TOAST_MS);

    useEffect(() => {
        if (paused) return;
        const started = Date.now();
        const timer = window.setTimeout(() => dismiss(toast.id), remaining.current);
        return () => {
            window.clearTimeout(timer);
            remaining.current -= Date.now() - started;
        };
    }, [paused, dismiss, toast.id]);

    return (
        <li
            className="pointer-events-auto flex w-full gap-3 rounded-xl bg-primary p-4 shadow-lg ring-1 ring-secondary"
            onPointerEnter={() => setPaused(true)}
            onPointerLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
        >
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-fg-warning-primary" />
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-primary">{toast.title}</p>
                <p className="mt-0.5 line-clamp-2 text-sm text-tertiary">{toast.body}</p>
                <Link
                    to={toast.href}
                    onClick={() => dismiss(toast.id)}
                    className="mt-2 inline-block rounded-xs text-sm font-semibold text-brand-secondary underline-offset-2 hover:underline"
                >
                    Open approvals
                </Link>
            </div>
            <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-fg-quaternary hover:bg-primary_hover hover:text-fg-quaternary_hover"
                aria-label={`Dismiss: ${toast.title}`}
            >
                <X aria-hidden="true" className="size-4" />
            </button>
        </li>
    );
};

/** Visual toasts for approval requests. Screen readers get the same news from LiveRegion. */
export const Toaster = () => {
    const toasts = useAppStore((s) => s.toasts);
    return (
        <section aria-label="Notifications" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 sm:left-auto sm:w-96">
            <ol className="flex flex-col gap-2">
                {toasts.map((toast) => (
                    <ToastItem key={toast.id} toast={toast} />
                ))}
            </ol>
        </section>
    );
};
