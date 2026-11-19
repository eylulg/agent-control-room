import { useContext } from "react";
import type { MouseEvent } from "react";
import type { LinkProps } from "@eylulg/ui/chrome";
import { OverlayTriggerStateContext } from "react-aria-components";
import { Link } from "react-router";

/** Chrome link inside the mobile menu drawer. It also closes the drawer. */
export const DrawerLink = ({ href, onClick, ...props }: LinkProps) => {
    const drawer = useContext(OverlayTriggerStateContext);

    function handleClick(event: MouseEvent<HTMLAnchorElement>) {
        onClick?.(event);
        drawer?.close();
    }

    return <Link to={href} onClick={handleClick} {...props} />;
};
