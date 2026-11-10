import { Badge } from "@eylulg/ui/badge";
import type { JobKind, JobStatus } from "@/domain/types";
import { KIND_LABEL, STATUS_META } from "@/utils/format";

interface StatusBadgeProps {
    status: JobStatus;
    size?: "sm" | "md";
}

interface KindBadgeProps {
    kind: JobKind;
}

export const StatusBadge = ({ status, size = "sm" }: StatusBadgeProps) => (
    <Badge dot size={size} color={STATUS_META[status].color}>
        {STATUS_META[status].label}
    </Badge>
);

export const KindBadge = ({ kind }: KindBadgeProps) => (
    <Badge size="sm" color="gray">
        {KIND_LABEL[kind]}
    </Badge>
);
