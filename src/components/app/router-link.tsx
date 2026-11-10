import { useContext } from "react";
import type { MouseEvent } from "react";
import type { LinkProps } from "@eylulg/ui/chrome";
import { OverlayTriggerStateContext } from "react-aria-components";
import { Link } from "react-router";

/** Chrome link backed by React Router. Inside the mobile menu drawer it also closes the drawer. */
export const RouterLink = ({ href, onClick, ...props }: LinkProps) => {
    const drawer = useContext(OverlayTriggerStateContext);

    function handleClick(event: MouseEvent<HTMLAnchorElement>) {
        onClick?.(event);
        drawer?.close();
    }

    return <Link to={href} onClick={handleClick} {...props} />;
};
