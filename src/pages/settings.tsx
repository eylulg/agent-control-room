import { type FormEvent, useState } from "react";
import { Button } from "@eylulg/ui/button";
import { Input } from "@eylulg/ui/input";
import { Select, SelectItem } from "@eylulg/ui/select";
import type { Key } from "react-aria-components";
import { PageHeader } from "@/components/app/page-header";
import { Panel } from "@/components/app/panel";
import { DEFAULT_SEED } from "@/domain/simulator";
import { useAppStore } from "@/state/store-context";

interface SeedFormProps {
    seed: string;
    onReset: (seed: string) => void;
}

const SPEEDS = [0.5, 1, 2, 4, 8];

export const SettingsPage = () => {
    const sim = useAppStore((s) => s.sim);
    const setSpeed = useAppStore((s) => s.setSpeed);
    const reset = useAppStore((s) => s.reset);
    const play = useAppStore((s) => s.play);
    const pause = useAppStore((s) => s.pause);
    const step = useAppStore((s) => s.step);
    const [status, setStatus] = useState("");

    function handleSpeed(key: Key | null) {
        if (key !== null) setSpeed(Number(key));
    }

    function handleReset(seed: string) {
        reset(seed);
        setStatus(`World reset with seed "${seed.trim() || DEFAULT_SEED}".`);
    }

    if (!sim) {
        return <PageHeader title="Settings" description="Connected to a live agent. Simulation settings are not available." />;
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Settings" description="The agent here is a seeded simulator. The same seed and the same answers always replay the same day." />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Panel title="Simulation">
                    <div className="flex flex-col gap-4">
                        <Select label="Speed" hint="Simulated minutes per real second." selectedKey={String(sim.speed)} onSelectionChange={handleSpeed}>
                            {SPEEDS.map((speed) => (
                                <SelectItem key={speed} id={String(speed)}>{`${speed} ticks per second`}</SelectItem>
                            ))}
                        </Select>
                        <p className="text-sm text-secondary">
                            {sim.running ? "Running" : "Paused"} at tick {sim.tick}.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Button size="sm" onPress={sim.running ? pause : play}>
                                {sim.running ? "Pause simulation" : "Run simulation"}
                            </Button>
                            <Button size="sm" variant="secondary" onPress={step} isDisabled={sim.running}>
                                Step the simulation one tick
                            </Button>
                        </div>
                    </div>
                </Panel>
                <Panel title="Seed">
                    <SeedForm key={sim.seed} seed={sim.seed} onReset={handleReset} />
                    <p role="status" className="mt-3 text-sm font-medium text-secondary empty:hidden">
                        {status}
                    </p>
                </Panel>
            </div>
        </div>
    );
};

const SeedForm = ({ seed: initialSeed, onReset }: SeedFormProps) => {
    const [seed, setSeed] = useState(initialSeed);

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        onReset(seed);
    }

    return (
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <Input label="Seed" value={seed} onChange={setSeed} hint="Any text. Leave empty for the default seed." />
            <div>
                <Button type="submit" size="sm" variant="destructive">
                    Reset world
                </Button>
            </div>
        </form>
    );
};
