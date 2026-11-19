import type { PointerEvent as ReactPointerEvent } from 'react';

interface Tracking {
  /** Pointer travel in screen pixels before a drag counts as one. Zero for a handle that acts at once. */
  threshold?: number;
  onStart?: () => void;
  /** Total travel since the pointer went down, in screen pixels, once per animation frame. */
  onMove: (dx: number, dy: number, event: { clientX: number; clientY: number }) => void;
  /** `moved` is false for a plain click. */
  onEnd: (moved: boolean, event: { clientX: number; clientY: number }) => void;
}

/**
 * Follows a pointer after it went down on something, through window listeners so it keeps working when the pointer
 * leaves the element. Moves are coalesced to one call per animation frame, whatever the pointer's event rate.
 */
export const trackPointer = (
  down: ReactPointerEvent,
  { threshold = 4, onStart, onMove, onEnd }: Tracking,
): void => {
  const originX = down.clientX;
  const originY = down.clientY;
  let latest = { clientX: originX, clientY: originY };
  let moved = threshold === 0;
  let frame = 0;
  if (moved) onStart?.();

  const flush = () => {
    frame = 0;
    const dx = latest.clientX - originX;
    const dy = latest.clientY - originY;
    if (!moved && Math.hypot(dx, dy) < threshold) return;
    if (!moved) {
      moved = true;
      onStart?.();
    }
    onMove(dx, dy, latest);
  };

  const handleMove = (event: PointerEvent) => {
    latest = { clientX: event.clientX, clientY: event.clientY };
    if (frame === 0) frame = window.requestAnimationFrame(flush);
  };

  const finish = (event: PointerEvent) => {
    window.removeEventListener('pointermove', handleMove);
    window.removeEventListener('pointerup', finish);
    window.removeEventListener('pointercancel', finish);
    if (frame !== 0) {
      window.cancelAnimationFrame(frame);
      latest = { clientX: event.clientX, clientY: event.clientY };
      flush();
    }
    onEnd(moved, latest);
  };

  window.addEventListener('pointermove', handleMove);
  window.addEventListener('pointerup', finish);
  window.addEventListener('pointercancel', finish);
};
