/**
 * Production-safe logging utility
 * Logs only in development mode to prevent exposing sensitive information in production
 */
const getIsDev = () => {
    try {
        if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) {
            return process.env.NODE_ENV !== 'production';
        }
    }
    catch (e) { }
    return process.env.NODE_ENV !== 'production';
};
const isDev = getIsDev();
export const logger = {
    log: (...args) => {
        if (isDev)
            console.log(...args);
    },
    error: (...args) => {
        if (isDev)
            console.error(...args);
    },
    warn: (...args) => {
        if (isDev)
            console.warn(...args);
    },
    info: (...args) => {
        if (isDev)
            console.info(...args);
    },
    debug: (...args) => {
        if (isDev)
            console.debug(...args);
    }
};
