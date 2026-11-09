export type Sizes = "sm" | "md" | "lg";

export type BadgeColors = "gray" | "brand" | "error" | "warning" | "success" | "slate" | "sky" | "blue" | "indigo" | "purple" | "pink" | "orange";

type ExtractColorKeys<T> = T extends { styles: infer C } ? keyof C : never;
export type BadgeTypeToColorMap<T> = {
    [K in keyof T]: ExtractColorKeys<T[K]>;
};

export const badgeTypes = {
    pillColor: "pill-color",
    badgeColor: "color",
    badgeModern: "modern",
} as const;

export type BadgeTypes = (typeof badgeTypes)[keyof typeof badgeTypes];
