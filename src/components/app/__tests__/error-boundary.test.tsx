import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../error-boundary';

const Fragile = () => {
  const [broken, setBroken] = useState(false);
  if (broken) throw new Error('render failed');
  return <button onClick={() => setBroken(true)}>Break the page</button>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('replaces a page that throws with a way back and keeps the rest of the app', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <nav aria-label='Shell'>shell</nav>
        <main id='main' tabIndex={-1}>
          <ErrorBoundary>
            <Fragile />
          </ErrorBoundary>
        </main>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Break the page' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('This page stopped working');
    expect(screen.getByRole('navigation', { name: 'Shell' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the overview' })).toHaveAttribute('href', '/');

    await user.click(screen.getByRole('button', { name: 'Try this page again' }));

    expect(screen.getByRole('button', { name: 'Break the page' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveFocus();
  });
});
