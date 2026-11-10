import { Button } from "@eylulg/ui/button";
import { IconButton } from "@eylulg/ui/icon-button";
import { Pause, Play, SkipForward } from "lucide-react";
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
            <Button size="sm" variant="secondary" iconLeading={sim.running ? Pause : Play} onPress={sim.running ? pause : play}>
                {sim.running ? "Pause" : "Run"}
            </Button>
            <IconButton size="sm" variant="tertiary" icon={SkipForward} aria-label="Step one tick" onPress={step} isDisabled={sim.running} />
        </div>
    );
};
