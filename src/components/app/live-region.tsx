import { useAppStore } from "@/state/store-context";

/** Announces important agent events to screen readers. Visually hidden. */
export const LiveRegion = () => {
    const announcement = useAppStore((s) => s.announcement);

    return (
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" data-testid="live-region">
            {announcement}
        </div>
    );
};
