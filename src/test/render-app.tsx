import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { App } from "@/app";
import { type CreateAppStoreOptions, createAppStore } from "@/state/store";

export const renderApp = (path = "/", options: CreateAppStoreOptions = {}) => {
    const store = createAppStore({ seed: "control-room", warmup: 40, autoStart: false, ...options });
    const utils = render(
        <MemoryRouter initialEntries={[path]}>
            <App store={store} />
        </MemoryRouter>,
    );
    return { store, ...utils };
};
