import { EventEmitter } from 'node:events';

// In-process pub/sub for "the seat map of show X changed".
// Browsers subscribe over Server-Sent Events and refresh their seat map instantly.
const emitter = new EventEmitter();
emitter.setMaxListeners(0);

export function notifySeats(showId) {
  emitter.emit(`show:${showId}`);
}

export function onSeatsChanged(showId, listener) {
  const key = `show:${showId}`;
  emitter.on(key, listener);
  return () => emitter.off(key, listener);
}
