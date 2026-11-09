import type { ReactNode } from "react";
import type { AppStore } from "./store";
import { StoreContext } from "./store-context";

export const AppStoreProvider = ({ store, children }: { store: AppStore; children: ReactNode }) => (
    <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
);
