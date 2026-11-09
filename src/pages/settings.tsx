import { type ChangeEvent, type FormEvent, useState } from "react";
import { Card, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { NativeSelect } from "@/components/base/select/select-native";
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

    function handleSpeed(event: ChangeEvent<HTMLSelectElement>) {
        setSpeed(Number(event.target.value));
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
                <Card title="Simulation">
                    <div className="flex flex-col gap-4">
                        <NativeSelect
                            label="Speed"
                            hint="Simulated minutes per real second."
                            value={String(sim.speed)}
                            onChange={handleSpeed}
                            options={SPEEDS.map((speed) => ({ label: `${speed} ticks per second`, value: String(speed) }))}
                        />
                        <p className="text-sm text-secondary">
                            {sim.running ? "Running" : "Paused"} at tick {sim.tick}.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Button size="sm" onPress={sim.running ? pause : play}>
                                {sim.running ? "Pause simulation" : "Run simulation"}
                            </Button>
                            <Button size="sm" color="secondary" onPress={step} isDisabled={sim.running}>
                                Step the simulation one tick
                            </Button>
                        </div>
                    </div>
                </Card>
                <Card title="Seed">
                    <SeedForm key={sim.seed} seed={sim.seed} onReset={handleReset} />
                    <p role="status" className="mt-3 text-sm font-medium text-secondary empty:hidden">
                        {status}
                    </p>
                </Card>
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
                <Button type="submit" size="sm" color="secondary-destructive">
                    Reset world
                </Button>
            </div>
        </form>
    );
};
