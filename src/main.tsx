import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { z } from 'zod/mini';
import { App } from '@/app';
import '@/index.css';
import { loadWorld, sessionStorageOrNull } from '@/state/persist';
import { type AppStore, createAppStore } from '@/state/store';

const WARMUP_TICKS = 130;

// ?stream=https://agent.example/events&commands=https://agent.example/commands connects to a real agent.
const params = z
  .catch(
    z.object({
      stream: z.optional(z.url()),
      commands: z.optional(z.url()),
      seed: z.optional(z.string().check(z.maxLength(64))),
    }),
    {},
  )
  .parse(Object.fromEntries(new URLSearchParams(window.location.search)));

const storage = sessionStorageOrNull();
const saved = storage ? loadWorld(storage) : null;

const mount = (store: AppStore) => {
  const root = document.getElementById('root');
  if (!root) throw new Error('The page is missing its #root element');

  createRoot(root).render(
    <StrictMode>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <App store={store} />
      </BrowserRouter>
    </StrictMode>,
  );
};

if (params.stream && params.commands) {
  const { stream, commands } = params;
  // The stream client and its event checker load only when an agent is connected, so the demo skips them.
  void import('@/domain/sse-source').then(({ SseAgentSource }) =>
    mount(
      createAppStore({ source: new SseAgentSource({ streamUrl: stream, commandUrl: commands }) }),
    ),
  );
} else {
  mount(
    createAppStore({
      seed: params.seed,
      warmup: WARMUP_TICKS,
      autoStart: true,
      storage: storage ?? undefined,
      // A seed in the address wins over the saved world.
      restore:
        saved && (params.seed === undefined || params.seed === saved.seed) ? saved : undefined,
    }),
  );
}
