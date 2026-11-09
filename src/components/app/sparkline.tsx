import { type KeyboardEvent, type PointerEvent, useEffect, useId, useRef, useState } from "react";
import { cx } from "@/utils/cx";

interface SparklinePoint {
    label: string;
    value: number;
}

interface SparklineProps {
    points: SparklinePoint[];
    /** Accessible summary of what the line shows. */
    label: string;
    unit: string;
}

const HEIGHT = 56;
const FALLBACK_WIDTH = 240;
const PAD_X = 6;
const PAD_TOP = 8;
const PAD_BOTTOM = 4;
const END_LABEL_SPACE = 28;
const READOUT_WIDTH = 120;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Single series sparkline as inline SVG: 2px line, a 10% area wash, an end dot
 * with a surface ring and a direct end label. Crosshair and readout on hover and
 * on keyboard focus (arrow keys, Home and End move between points).
 */
export const Sparkline = ({ points, label, unit }: SparklineProps) => {
    const readoutId = useId();
    const [width, setWidth] = useState(FALLBACK_WIDTH);
    const [active, setActive] = useState<number | null>(null);
    const ref = useRef<HTMLDivElement>(null);

    const last = points.length - 1;
    const max = Math.max(1, ...points.map((p) => p.value));
    const plotWidth = width - PAD_X * 2 - END_LABEL_SPACE;
    const baseline = HEIGHT - PAD_BOTTOM;
    const x = (i: number) => PAD_X + (last <= 0 ? 0 : (i / last) * plotWidth);
    const y = (v: number) => PAD_TOP + (1 - v / max) * (HEIGHT - PAD_TOP - PAD_BOTTOM);
    const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
    const area = last >= 0 ? `${line} L${x(last).toFixed(1)},${baseline} L${x(0).toFixed(1)},${baseline} Z` : "";
    const endPoint = points[last];
    const shownIndex = active ?? last;
    const shown = points[shownIndex];
    const readout = active === null ? undefined : points[active];
    const summary = `${label}. ${points.map((p) => `${p.label}: ${p.value}`).join(", ")}.`;

    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        const update = () => setWidth(Math.max(READOUT_WIDTH, Math.round(element.getBoundingClientRect().width) || FALLBACK_WIDTH));
        update();
        const observer = new ResizeObserver(update);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect || last < 0) return;
        setActive(clamp(Math.round(((event.clientX - rect.left - PAD_X) / plotWidth) * last), 0, last));
    }

    function handleLeave() {
        setActive(null);
    }

    function handleFocus() {
        setActive((value) => value ?? last);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (last < 0) return;
        const current = active ?? last;
        const next: Record<string, number | null> = {
            ArrowLeft: Math.max(0, current - 1),
            ArrowRight: Math.min(last, current + 1),
            Home: 0,
            End: last,
            Escape: null,
        };
        if (!(event.key in next)) return;
        event.preventDefault();
        setActive(next[event.key] ?? null);
    }

    return (
        <div className="relative">
            {/* A focusable group so keyboard users get the same readout as pointer users. */}
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
            <div
                ref={ref}
                role="group"
                aria-roledescription="sparkline"
                aria-label={summary}
                aria-describedby={readoutId}
                tabIndex={0}
                className="relative rounded-md outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2"
                onPointerMove={handlePointerMove}
                onPointerLeave={handleLeave}
                onFocus={handleFocus}
                onBlur={handleLeave}
                onKeyDown={handleKeyDown}
            >
                <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} aria-hidden="true" focusable="false" className="block max-w-full">
                    <line x1={PAD_X} x2={PAD_X + plotWidth} y1={baseline} y2={baseline} stroke="var(--viz-baseline)" strokeWidth={1} />
                    <path d={area} fill="var(--viz-series-1)" fillOpacity={0.1} />
                    <path d={line} fill="none" stroke="var(--viz-series-1)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    {active !== null && <line x1={x(active)} x2={x(active)} y1={PAD_TOP - 4} y2={baseline} stroke="var(--viz-gridline)" strokeWidth={1} />}
                    {shown && (
                        <circle cx={x(shownIndex)} cy={y(shown.value)} r={4} fill="var(--viz-series-1)" stroke="var(--color-bg-primary)" strokeWidth={2} />
                    )}
                    {endPoint && (
                        <text x={x(last) + 9} y={y(endPoint.value) + 4} className="fill-current text-xs font-medium text-secondary tabular-nums">
                            {endPoint.value}
                        </text>
                    )}
                </svg>
            </div>
            <p
                id={readoutId}
                className={cx(
                    "pointer-events-none absolute -top-9 rounded-md bg-primary px-2 py-1 text-xs shadow-md ring-1 ring-secondary",
                    !readout && "sr-only",
                )}
                style={active === null ? undefined : { left: clamp(x(active) - 40, 0, Math.max(0, width - READOUT_WIDTH)) }}
            >
                {readout ? (
                    <>
                        <strong className="font-semibold text-primary">
                            {readout.value} {unit}
                        </strong>{" "}
                        <span className="text-tertiary">{readout.label}</span>
                    </>
                ) : (
                    "Use arrow keys to read each point."
                )}
            </p>
        </div>
    );
};
