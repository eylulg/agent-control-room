import { type FormEvent, useState } from "react";
import { Card, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { NativeSelect } from "@/components/base/select/select-native";
import { useAppStore } from "@/state/store-context";

const SPEEDS = [0.5, 1, 2, 4, 8];

export const SettingsPage = () => {
    const sim = useAppStore((s) => s.sim);
    const setSpeed = useAppStore((s) => s.setSpeed);
    const reset = useAppStore((s) => s.reset);
    const play = useAppStore((s) => s.play);
    const pause = useAppStore((s) => s.pause);
    const step = useAppStore((s) => s.step);
    const [seed, setSeed] = useState(sim?.seed ?? "");
    const [status, setStatus] = useState("");

    if (!sim) {
        return (
            <div className="flex flex-col gap-6">
                <PageHeader title="Settings" description="Connected to a live agent. Simulation settings are not available." />
            </div>
        );
    }

    const onReset = (event: FormEvent) => {
        event.preventDefault();
        reset(seed);
        setStatus(`World reset with seed "${seed.trim() || "control-room"}".`);
    };

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
                            onChange={(event) => setSpeed(Number(event.target.value))}
                            options={SPEEDS.map((speed) => ({ label: `${speed} ticks per second`, value: String(speed) }))}
                        />
                        <p className="text-sm text-secondary">
                            {sim.running ? "Running" : "Paused"} at tick {sim.tick}.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Button size="sm" onPress={sim.running ? pause : play}>
                                {sim.running ? "Pause" : "Run"}
                            </Button>
                            <Button size="sm" color="secondary" onPress={step} isDisabled={sim.running}>
                                Step one tick
                            </Button>
                        </div>
                    </div>
                </Card>
                <Card title="Seed">
                    <form className="flex flex-col gap-4" onSubmit={onReset}>
                        <Input label="Seed" value={seed} onChange={setSeed} hint="Any text. Leave empty for the default seed." />
                        <div>
                            <Button type="submit" size="sm" color="secondary-destructive">
                                Reset world
                            </Button>
                        </div>
                        <p role="status" className="text-sm font-medium text-secondary empty:hidden">
                            {status}
                        </p>
                    </form>
                </Card>
            </div>
        </div>
    );
};
