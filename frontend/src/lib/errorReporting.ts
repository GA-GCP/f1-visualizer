import { createLogger } from './logger';

const log = createLogger('app');

/**
 * Routes errors that escape React to the same logger as everything else.
 *
 * There were no window-level handlers at all, so an error thrown outside a
 * render — in a promise chain, an event handler, or a timer — reached nothing
 * but the browser console.
 */
export function installGlobalErrorHandlers(): () => void {
    const onError = (event: ErrorEvent) => {
        log.error('Uncaught error', event.error ?? event.message);
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
        log.error('Unhandled promise rejection', event.reason);
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
        window.removeEventListener('error', onError);
        window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
}

/** React 19 root error hooks, so render-time errors reach the same place. */
export const reactErrorHandlers = {
    onUncaughtError: (error: unknown, errorInfo: { componentStack?: string | null }) => {
        log.error('Uncaught render error', error, errorInfo.componentStack);
    },
    onCaughtError: (error: unknown, errorInfo: { componentStack?: string | null }) => {
        log.error('Render error caught by a boundary', error, errorInfo.componentStack);
    },
};
