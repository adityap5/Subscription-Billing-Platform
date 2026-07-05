type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogContext {
  [key: string]: unknown;
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = formatTimestamp();
  const contextStr = context && Object.keys(context).length > 0
    ? ` ${JSON.stringify(context)}`
    : '';
  return `[${timestamp}] [${level}] ${message}${contextStr}`;
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    console.debug(formatMessage('DEBUG', message, context));
  },

  info(message: string, context?: LogContext): void {
    console.info(formatMessage('INFO', message, context));
  },

  warn(message: string, context?: LogContext): void {
    console.warn(formatMessage('WARN', message, context));
  },

  error(message: string, context?: LogContext): void {
    console.error(formatMessage('ERROR', message, context));
  },
};
