// Catches faults nobody handled: JavaScript crashes and promise errors nobody caught.
// Started once from App.tsx. The normal React Native handling still runs after ours.
import { keepCrash, logFault, moveKeptCrash } from './faultStore';

type Handler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsType = { getGlobalHandler: () => Handler; setGlobalHandler: (h: Handler) => void };
type Hermes = {
  enablePromiseRejectionTracker?: (o: { allRejections: boolean; onUnhandled: (id: number, e: unknown) => void; onHandled: () => void }) => void;
};

let started = false;

export function startFaultCapture(): void {
  if (started) return;
  started = true;
  moveKeptCrash();

  const g = globalThis as unknown as { ErrorUtils?: ErrorUtilsType; HermesInternal?: Hermes };

  const eu = g.ErrorUtils;
  if (eu) {
    const previous = eu.getGlobalHandler();
    eu.setGlobalHandler((error, isFatal) => {
      if (isFatal) keepCrash(error);
      else logFault('crash', error);
      previous(error, isFatal);
    });
  }

  // Release builds have no promise tracker of their own; development keeps React Native's red box.
  if (!__DEV__) {
    g.HermesInternal?.enablePromiseRejectionTracker?.({
      allRejections: true,
      onUnhandled: (_id, e) => logFault('crash', e),
      onHandled: () => undefined,
    });
  }
}
