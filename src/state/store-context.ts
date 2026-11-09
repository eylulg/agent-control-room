import { createContext, useContext } from "react";
import { useStore } from "zustand";
import type { AppState, AppStore } from "./store";

export const StoreContext = createContext<AppStore | null>(null);

export function useAppStore<T>(selector: (state: AppState) => T): T {
    const store = useContext(StoreContext);
    if (!store) throw new Error("useAppStore must be used inside AppStoreProvider");
    return useStore(store, selector);
}
