import { Component, type ReactNode } from "react";
import { Button } from "@eylulg/ui/button";
import { Link } from "react-router";
import { PageHeader } from "./page-header";
import { inlineLink } from "./styles";

interface ErrorBoundaryProps {
    children: ReactNode;
}

interface ErrorBoundaryState {
    failed: boolean;
}

/** Keeps a failure in one page from unmounting the shell. The shell stays, and the visitor can retry or leave. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { failed: false };

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { failed: true };
    }

    handleRetry = () => {
        this.setState({ failed: false }, () => document.getElementById("main")?.focus({ preventScroll: true }));
    };

    render() {
        if (!this.state.failed) return this.props.children;
        return (
            <div role="alert" className="flex flex-col items-start gap-4">
                <PageHeader title="This page stopped working" description="Something went wrong while showing it. The rest of the app still works." />
                <div className="flex flex-wrap items-center gap-3">
                    <Button size="sm" onPress={this.handleRetry}>
                        Try this page again
                    </Button>
                    <Link to="/" className={inlineLink}>
                        Go to the overview
                    </Link>
                </div>
            </div>
        );
    }
}
