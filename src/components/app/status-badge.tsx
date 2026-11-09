import { Badge } from "@/components/base/badges/badges";
import type { JobKind, JobStatus } from "@/domain/types";
import { KIND_LABEL, STATUS_META } from "@/utils/format";

export const StatusBadge = ({ status, size = "sm" }: { status: JobStatus; size?: "sm" | "md" }) => (
    <Badge type="pill-color" size={size} color={STATUS_META[status].color}>
        {STATUS_META[status].label}
    </Badge>
);

export const KindBadge = ({ kind }: { kind: JobKind }) => (
    <Badge type="color" size="sm" color="gray">
        {KIND_LABEL[kind]}
    </Badge>
);
