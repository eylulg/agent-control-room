import type { LinkProps } from "@eylulg/ui/chrome";
import { Link } from "react-router";

/** Chrome link backed by React Router. */
export const RouterLink = ({ href, ...props }: LinkProps) => <Link to={href} {...props} />;
