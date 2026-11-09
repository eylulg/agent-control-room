import { PauseCircle, PlayCircle, SkipForward } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { useAppStore } from "@/state/store-context";

export const SimControls = () => {
    const sim = useAppStore((s) => s.sim);
    const play = useAppStore((s) => s.play);
    const pause = useAppStore((s) => s.pause);
    const step = useAppStore((s) => s.step);
    if (!sim) return null;
    return (
        <div className="flex items-center gap-1" role="group" aria-label="Simulation">
            {sim.running ? (
                <Button size="sm" color="secondary" iconLeading={PauseCircle} onPress={pause}>
                    <span className="sr-only sm:not-sr-only">Pause</span>
                </Button>
            ) : (
                <Button size="sm" color="secondary" iconLeading={PlayCircle} onPress={play}>
                    <span className="sr-only sm:not-sr-only">Run</span>
                </Button>
            )}
            <Button size="sm" color="tertiary" iconLeading={SkipForward} aria-label="Step one tick" onPress={step} isDisabled={sim.running} />
        </div>
    );
};
