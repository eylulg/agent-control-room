import { type ReactNode, useEffect } from "react";

export const PageHeader = ({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) => {
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

export const Card = ({
    title,
    children,
    className = "",
    headingLevel = 2,
    actions,
}: {
    title?: string;
    children: ReactNode;
    className?: string;
    headingLevel?: 2 | 3;
    actions?: ReactNode;
}) => {
    const Heading = headingLevel === 2 ? "h2" : "h3";
    return (
        <section className={`min-w-0 rounded-xl bg-primary p-4 shadow-xs ring-1 ring-secondary sm:p-5 ${className}`} aria-label={title}>
            {(title || actions) && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    {title && <Heading className="text-md font-semibold text-primary">{title}</Heading>}
                    {actions}
                </div>
            )}
            {children}
        </section>
    );
};
