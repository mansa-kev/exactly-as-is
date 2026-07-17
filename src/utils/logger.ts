/**
 * Production-safe logging utility
 * Logs only in development mode to prevent exposing sensitive information in production
 */

const getIsDev = () => {
  try {
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) {
      return process.env.NODE_ENV !== 'production';
    }
  } catch (e) {}
  return process.env.NODE_ENV !== 'production'; 
};
const isDev = getIsDev();

export const logger = {
  log: (...args: any[]) => {
    if (isDev) console.log(...args);
  },
  error: (...args: any[]) => {
    if (isDev) console.error(...args);
  },
  warn: (...args: any[]) => {
    if (isDev) console.warn(...args);
  },
  info: (...args: any[]) => {
    if (isDev) console.info(...args);
  },
  debug: (...args: any[]) => {
    if (isDev) console.debug(...args);
  }
};
