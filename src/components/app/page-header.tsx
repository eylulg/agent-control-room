import { type ReactNode, useEffect } from "react";
import { cx } from "@/utils/cx";
import { surface } from "./styles";

interface PageHeaderProps {
    title: string;
    description?: ReactNode;
    actions?: ReactNode;
}

interface CardProps {
    title?: string;
    children: ReactNode;
    className?: string;
    actions?: ReactNode;
}

export const PageHeader = ({ title, description, actions }: PageHeaderProps) => {
    useEffect(() => {
        document.title = `${title} | Agent control room`;
    }, [title]);

    return (
        <div className="flex flex-col gap-3 border-b border-secondary pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
                <h1 className="text-display-xs font-semibold text-primary">{title}</h1>
                {description && <p className="mt-1 text-md text-tertiary">{description}</p>}
            </div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
    );
};

export const Card = ({ title, children, className, actions }: CardProps) => (
    <section className={cx("min-w-0", surface, className)} aria-label={title}>
        {(title || actions) && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                {title && <h2 className="text-md font-semibold text-primary">{title}</h2>}
                {actions}
            </div>
        )}
        {children}
    </section>
);
