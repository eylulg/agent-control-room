import { useEffect } from "react";
import { useToast } from "@eylulg/ui/toast";
import { useNavigate } from "react-router";
import { useAppStore } from "@/state/store-context";

/** Turns the store's approval requests into library toasts. Screen readers get the same news from LiveRegion. */
export const ApprovalToasts = () => {
    const pending = useAppStore((s) => s.toasts);
    const drain = useAppStore((s) => s.dismissToast);
    const { toast } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        for (const item of pending) {
            toast({
                title: item.title,
                description: item.body,
                variant: "warning",
                action: { label: "Open approvals", onPress: () => void navigate("/approvals") },
            });
            drain(item.id);
        }
    }, [pending, drain, toast, navigate]);

    return null;
};
