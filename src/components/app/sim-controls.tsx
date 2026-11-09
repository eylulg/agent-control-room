import { PauseCircle, PlayCircle, SkipForward } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { useAppStore } from "@/state/store-context";

/** One button that swaps its label, so focus stays on it when the state flips. */
export const SimControls = () => {
    const sim = useAppStore((s) => s.sim);
    const play = useAppStore((s) => s.play);
    const pause = useAppStore((s) => s.pause);
    const step = useAppStore((s) => s.step);

    if (!sim) return null;

    return (
        <div className="flex items-center gap-1" role="group" aria-label="Simulation">
            <Button size="sm" color="secondary" iconLeading={sim.running ? PauseCircle : PlayCircle} onPress={sim.running ? pause : play}>
                <span className="sr-only sm:not-sr-only">{sim.running ? "Pause" : "Run"}</span>
            </Button>
            <Button size="sm" color="tertiary" iconLeading={SkipForward} aria-label="Step one tick" onPress={step} isDisabled={sim.running} />
        </div>
    );
};
