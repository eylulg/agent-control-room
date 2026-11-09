import type { ComponentType } from "react";

const FORWARD_REF = Symbol.for("react.forward_ref");
const MEMO = Symbol.for("react.memo");

/** True for function, class, forwardRef and memo components, false for elements and other values. */
export const isReactComponent = (value: unknown): value is ComponentType<{ className?: string; "data-icon"?: string }> => {
    if (typeof value === "function") return true;
    if (typeof value !== "object" || value === null || !("$$typeof" in value)) return false;
    return value.$$typeof === FORWARD_REF || value.$$typeof === MEMO;
};
