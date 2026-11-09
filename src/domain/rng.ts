/**
 * Small seeded PRNG (mulberry32). The state is a single 32-bit integer, so the
 * whole simulation stays serialisable and replays identically for a seed.
 */
export interface Rng {
    next(): number;
    int(min: number, max: number): number;
    pick<T>(items: readonly T[]): T;
    chance(p: number): boolean;
    readonly state: number;
}

const hashSeed = (seed: string | number): number => {
    const text = String(seed);
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
};

export const createRng = (seed: string | number): Rng => {
    let a = hashSeed(seed);
    const next = () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
        next,
        int: (min, max) => min + Math.floor(next() * (max - min + 1)),
        pick: (items) => {
            const item = items[Math.floor(next() * items.length)];
            if (item === undefined) throw new Error("Cannot pick from an empty list");
            return item;
        },
        chance: (p) => next() < p,
        get state() {
            return a;
        },
    };
};
