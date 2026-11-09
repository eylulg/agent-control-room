import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

export interface SparklinePoint {
    label: string;
    value: number;
}

interface SparklineProps {
    points: SparklinePoint[];
    /** Accessible summary of what the line shows. */
    label: string;
    unit: string;
    height?: number;
}

const PAD_X = 6;
const PAD_TOP = 8;
const PAD_BOTTOM = 4;
const END_LABEL_SPACE = 28;

/**
 * Single series sparkline as inline SVG. 2px line, a 10% area wash, an end dot
 * with a surface ring and a direct end label. Crosshair and readout on hover and
 * on keyboard focus (arrow keys move between points).
 */
export const Sparkline = ({ points, label, unit, height = 56 }: SparklineProps) => {
    const ref = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(240);
    const [active, setActive] = useState<number | null>(null);
    const readoutId = useId();

    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        const update = () => setWidth(Math.max(120, Math.round(element.getBoundingClientRect().width) || 240));
        update();
        const observer = new ResizeObserver(update);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    const max = Math.max(1, ...points.map((p) => p.value));
    const plotWidth = width - PAD_X * 2 - END_LABEL_SPACE;
    const x = (i: number) => PAD_X + (points.length <= 1 ? 0 : (i / (points.length - 1)) * plotWidth);
    const y = (v: number) => PAD_TOP + (1 - v / max) * (height - PAD_TOP - PAD_BOTTOM);
    const baseline = height - PAD_BOTTOM;

    const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
    const area = points.length ? `${line} L${x(points.length - 1).toFixed(1)},${baseline} L${x(0).toFixed(1)},${baseline} Z` : "";
    const last = points.length - 1;
    const shown = active ?? null;

    const pickFromPointer = (clientX: number) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect || points.length === 0) return;
        const ratio = (clientX - rect.left - PAD_X) / plotWidth;
        setActive(Math.min(last, Math.max(0, Math.round(ratio * last))));
    };

    const onKeyDown = (event: KeyboardEvent) => {
        if (points.length === 0) return;
        const current = active ?? last;
        if (event.key === "ArrowLeft") setActive(Math.max(0, current - 1));
        else if (event.key === "ArrowRight") setActive(Math.min(last, current + 1));
        else if (event.key === "Home") setActive(0);
        else if (event.key === "End") setActive(last);
        else if (event.key === "Escape") setActive(null);
        else return;
        event.preventDefault();
    };

    const summary = `${label}. ${points.map((p) => `${p.label}: ${p.value}`).join(", ")}.`;

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
                onPointerMove={(event) => pickFromPointer(event.clientX)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive((value) => value ?? last)}
                onBlur={() => setActive(null)}
                onKeyDown={onKeyDown}
            >
                <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false" className="block max-w-full">
                    <line x1={PAD_X} x2={PAD_X + plotWidth} y1={baseline} y2={baseline} stroke="var(--viz-baseline)" strokeWidth={1} />
                    <path d={area} fill="var(--viz-series-1)" fillOpacity={0.1} />
                    <path d={line} fill="none" stroke="var(--viz-series-1)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    {shown !== null && <line x1={x(shown)} x2={x(shown)} y1={PAD_TOP - 4} y2={baseline} stroke="var(--viz-gridline)" strokeWidth={1} />}
                    {points.length > 0 && (
                        <>
                            <circle
                                cx={x(shown ?? last)}
                                cy={y(points[shown ?? last].value)}
                                r={4}
                                fill="var(--viz-series-1)"
                                stroke="var(--color-bg-primary)"
                                strokeWidth={2}
                            />
                            <text
                                x={x(last) + 9}
                                y={y(points[last].value) + 4}
                                className="fill-current text-xs font-medium text-secondary"
                                style={{ fontVariantNumeric: "tabular-nums" }}
                            >
                                {points[last].value}
                            </text>
                        </>
                    )}
                </svg>
            </div>
            <p
                id={readoutId}
                className={`pointer-events-none absolute -top-9 rounded-md bg-primary px-2 py-1 text-xs shadow-md ring-1 ring-secondary ${shown === null ? "sr-only" : ""}`}
                style={shown !== null ? { left: Math.min(Math.max(0, x(shown) - 40), Math.max(0, width - 120)) } : undefined}
            >
                {shown !== null && points[shown] ? (
                    <>
                        <strong className="font-semibold text-primary">
                            {points[shown].value} {unit}
                        </strong>{" "}
                        <span className="text-tertiary">{points[shown].label}</span>
                    </>
                ) : (
                    "Use arrow keys to read each point."
                )}
            </p>
        </div>
    );
};
