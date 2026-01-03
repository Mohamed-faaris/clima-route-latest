// Logging utility for frontend with configurable levels
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    FATAL = 4,
    OFF = 5
}

class Logger {
    private currentLevel: LogLevel;

    constructor() {
        // Determine log level: prefer Vite `VITE_LOG_LEVEL` via `import.meta.env`.
        // Fallback: `INFO` for development, `ERROR` for production.
        const explicitLevel = (import.meta.env as any)?.VITE_LOG_LEVEL as string | undefined;
        const nodeEnv = (import.meta.env as any)?.MODE || process.env.NODE_ENV;
        let envLevel = explicitLevel;
        if (!envLevel) {
            if (nodeEnv === 'production') {
                envLevel = 'ERROR';
            } else {
                envLevel = 'INFO';
            }
        }
        console.log('Log level set to:', envLevel);
        this.currentLevel = LogLevel[envLevel as keyof typeof LogLevel] ?? LogLevel.INFO;
    }

    // Return current numeric log level
    getLevel(): LogLevel {
        return this.currentLevel;
    }

    // Set log level at runtime. Accepts either a LogLevel or a string name (case-insensitive).
    setLevel(level: LogLevel | string): void {
        if (typeof level === 'number') {
            this.currentLevel = level;
            this.info('Log level changed', { level: LogLevel[level] });
            return;
        }
        const parsed = this.parseLevel(level as string);
        if (parsed !== undefined) {
            this.currentLevel = parsed;
            this.info('Log level changed', { level: level.toUpperCase() });
        } else {
            this.warn('Attempted to set unknown log level', { input: level });
        }
    }

    private parseLevel(level: string): LogLevel | undefined {
        const key = level.trim().toUpperCase();
        if ((LogLevel as any)[key] !== undefined) {
            return (LogLevel as any)[key] as LogLevel;
        }
        return undefined;
    }

    private shouldLog(level: LogLevel): boolean {
        return level >= this.currentLevel;
    }

    private formatMessage(level: string, message: string, ...args: any[]): string {
        const timestamp = new Date().toISOString();
        const formattedArgs = args.length > 0 ? ` ${JSON.stringify(args)}` : '';
        return `[${timestamp}] [${level}] ${message}${formattedArgs}`;
    }

    debug(message: string, ...args: any[]): void {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.debug(this.formatMessage('DEBUG', message, ...args));
        }
    }

    info(message: string, ...args: any[]): void {
        if (this.shouldLog(LogLevel.INFO)) {
            console.info(this.formatMessage('INFO', message, ...args));
        }
    }

    warn(message: string, ...args: any[]): void {
        if (this.shouldLog(LogLevel.WARN)) {
            console.warn(this.formatMessage('WARN', message, ...args));
        }
    }

    error(message: string, ...args: any[]): void {
        if (this.shouldLog(LogLevel.ERROR)) {
            console.error(this.formatMessage('ERROR', message, ...args));
        }
    }

    fatal(message: string, ...args: any[]): void {
        if (this.shouldLog(LogLevel.FATAL)) {
            console.error(this.formatMessage('FATAL', message, ...args));
        }
    }

    // API-specific logging methods
    apiRequest(method: string, url: string, data?: any): void {
        this.info(`[API] ${method} ${url}`, data ? { data } : undefined);
    }

    apiSuccess(method: string, url: string, response?: any): void {
        this.debug(`[API] ${method} ${url} - SUCCESS`, response ? { response } : undefined);
    }

    apiError(method: string, url: string, error: any): void {
        this.error(`[API] ${method} ${url} - ERROR`, { error: error.message || error });
    }

    // Crash logging
    crash(error: Error, context?: any): void {
        this.fatal('Application crash detected', {
            error: error.message,
            stack: error.stack,
            context
        });
    }
}

// Global logger instance
export const logger = new Logger();

// Global error handler for crashes
window.addEventListener('error', (event) => {
    logger.crash(event.error, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
    });
});

window.addEventListener('unhandledrejection', (event) => {
    logger.crash(new Error(event.reason), {
        type: 'unhandledrejection'
    });
});

// Expose runtime log-level API on `window` for debugging and runtime control.
declare global {
    interface Window {
        setLogLevel?: (level: string | LogLevel) => void;
        getLogLevel?: () => string;
        __logger?: Logger;
    }
}

window.setLogLevel = (level: string | LogLevel) => {
    try {
        logger.setLevel(level);
    } catch (e) {
        console.warn('setLogLevel failed', e);
    }
};

window.getLogLevel = () => {
    const lv = logger.getLevel();
    return LogLevel[lv] ?? String(lv);
};

// Provide direct access for advanced debugging
window.__logger = logger;

export default logger;