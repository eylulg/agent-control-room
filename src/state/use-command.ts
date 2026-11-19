import { useEffect, useRef, useState } from 'react';
import type { OperatorCommand } from '@/domain/types';
import { useAppStore } from './store-context';

/**
 * Sends operator commands. Requests still in flight are aborted on unmount, and an
 * aborted request never writes state. Resolves to true when the agent accepted the command.
 */
export const useCommand = () => {
  const send = useAppStore((s) => s.send);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(new Set<AbortController>());

  useEffect(() => {
    const controllers = inFlight.current;
    return () => {
      for (const controller of controllers) controller.abort();
    };
  }, []);

  async function run(command: OperatorCommand): Promise<boolean> {
    const controller = new AbortController();
    inFlight.current.add(controller);
    try {
      await send(command, controller.signal);
      if (controller.signal.aborted) return false;
      setError(null);
      return true;
    } catch (caught) {
      if (!controller.signal.aborted)
        setError(
          caught instanceof Error ? caught.message : 'The request failed. Try again in a moment.',
        );
      return false;
    } finally {
      inFlight.current.delete(controller);
    }
  }

  return { run, error };
};
