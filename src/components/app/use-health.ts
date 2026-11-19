import { useEffect, useState } from 'react';
import { isIdleWaitingOnOperator } from '@/domain/selectors';
import { HEARTBEAT_EVERY } from '@/domain/simulator';
import type { AppState } from '@/state/store';
import { useAppStore } from '@/state/store-context';
import { formatClock } from '@/utils/format';

export type Health = {
  state: 'healthy' | 'idle' | 'stale' | 'paused' | 'connecting' | 'error';
  label: string;
};

interface HealthInput extends Pick<
  AppState,
  'connected' | 'connection' | 'lastEventAt' | 'heartbeat' | 'sim'
> {
  lastHeartbeat: number | null;
  heartbeatTick: number;
  idle: boolean;
  now: number;
}

/** Missed heartbeats before a real agent counts as stale. */
const MISSED_HEARTBEATS = 2;

export const deriveHealth = (input: HealthInput): Health => {
  const {
    connected,
    connection,
    lastEventAt,
    heartbeat,
    sim,
    lastHeartbeat,
    heartbeatTick,
    idle,
    now,
  } = input;
  if (!connected) {
    return connection === 'error'
      ? { state: 'error', label: 'Cannot reach the agent, retrying' }
      : { state: 'connecting', label: 'Connecting' };
  }
  if (sim && !sim.running) return { state: 'paused', label: 'Simulation paused' };
  if (!sim && connection !== 'open') {
    return {
      state: 'stale',
      label: `Reconnecting, last event ${lastEventAt === null ? 'unknown' : formatClock(lastEventAt)}`,
    };
  }
  if (lastHeartbeat === null) return { state: 'stale', label: 'Waiting for heartbeat' };
  const lastSeen = heartbeat.at ?? lastEventAt;
  const missed = sim
    ? sim.tick - heartbeatTick > HEARTBEAT_EVERY * MISSED_HEARTBEATS
    : lastSeen !== null && now - lastSeen > heartbeat.gapMs * MISSED_HEARTBEATS;
  if (missed) return { state: 'stale', label: `No heartbeat since ${formatClock(lastHeartbeat)}` };
  if (idle) return { state: 'idle', label: 'Idle, waiting on you' };
  return { state: 'healthy', label: `Healthy, last heartbeat ${formatClock(lastHeartbeat)}` };
};

export const useHealth = (): Health => {
  const health = useAppStore((s) => s.control.health);
  const idle = useAppStore((s) => isIdleWaitingOnOperator(s.control));
  const sim = useAppStore((s) => s.sim);
  const connected = useAppStore((s) => s.connected);
  const connection = useAppStore((s) => s.connection);
  const lastEventAt = useAppStore((s) => s.lastEventAt);
  const heartbeat = useAppStore((s) => s.heartbeat);
  const [now, setNow] = useState(() => Date.now());

  // A real agent goes quiet without sending anything, so staleness needs a clock of its own.
  useEffect(() => {
    if (sim) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [sim]);

  return deriveHealth({
    connected,
    connection,
    lastEventAt,
    heartbeat,
    sim,
    lastHeartbeat: health.lastHeartbeat,
    heartbeatTick: health.tick,
    idle,
    now,
  });
};
