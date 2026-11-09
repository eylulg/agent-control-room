import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "@/app";
import { SseAgentSource } from "@/domain/source";
import { createAppStore } from "@/state/store";
import "@/styles/globals.css";

// ?stream=https://agent.example/events&commands=https://agent.example/commands connects to a real agent.
const params = new URLSearchParams(window.location.search);
const stream = params.get("stream");
const commands = params.get("commands");
const store = createAppStore(
    stream && commands
        ? { source: new SseAgentSource({ streamUrl: stream, commandUrl: commands }) }
        : { seed: params.get("seed") ?? undefined, warmup: 130, autoStart: true },
);

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <App store={store} />
        </BrowserRouter>
    </StrictMode>,
);
