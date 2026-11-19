import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { App } from '@/app';
import { createAppStore } from '@/state/store';

interface RenderAppOptions {
  seed?: string;
  warmup?: number;
}

/** Renders the whole app at a path on a paused, seeded simulator and waits for the lazy page. */
export const renderApp = async (
  path = '/',
  { seed = 'control-room', warmup = 40 }: RenderAppOptions = {},
) => {
  const store = createAppStore({ seed, warmup });
  const utils = render(
    <MemoryRouter initialEntries={[path]}>
      <App store={store} />
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { level: 1 });
  return { store, ...utils };
};
