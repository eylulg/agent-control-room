import { Link } from "react-router";
import { PageHeader } from "@/components/app/page-header";

export const NotFoundPage = () => (
    <div className="flex flex-col gap-4">
        <PageHeader title="Page not found" description="That page does not exist in the control room." />
        <Link to="/" className="w-max text-sm font-semibold text-brand-secondary underline">
            Go to the overview
        </Link>
    </div>
);
