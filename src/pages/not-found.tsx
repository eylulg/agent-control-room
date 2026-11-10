import { Link } from "react-router";
import { PageHeader } from "@/components/app/page-header";
import { inlineLink } from "@/components/app/styles";

export const NotFoundPage = () => (
    <div className="flex flex-col gap-4">
        <PageHeader title="Page not found" description="That page does not exist in the control room." />
        <Link to="/" className={inlineLink}>
            Go to the overview
        </Link>
    </div>
);
