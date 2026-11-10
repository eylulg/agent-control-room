import type { ReactNode } from "react";
import { Card, CardBody, CardHeader } from "@eylulg/ui/card";

interface PanelProps {
    title?: string;
    children: ReactNode;
    className?: string;
    actions?: ReactNode;
}

/** A titled card section: the library Card with a level 2 heading and a body. */
export const Panel = ({ title, children, className, actions }: PanelProps) => (
    <Card className={className}>
        {title && <CardHeader title={title} actions={actions} headingLevel={2} />}
        <CardBody>{children}</CardBody>
    </Card>
);
