import { hostname } from 'node:os';
import pino from 'pino';

const redactPaths = [
    'token',
    'authorization',
    'cookie',
    'headers',
    'request.headers',
    'req.headers',
    'config',
    'response.headers',
    'response.body',
    'response.data',
    'res.headers',
    'res.body',
    'res.data',
    'err.config',
    'err.response.headers',
    'err.response.body',
    'err.response.data',
    'error.config',
    'error.response.headers',
    'error.response.body',
    'error.response.data',
];

const logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    messageKey: 'message',
    timestamp: pino.stdTimeFunctions.isoTime,
    base: {
        service: 'powercord-bot',
        environment: process.env.POWERCORD_ENV ?? process.env.NODE_ENV,
        version: process.env.IMAGE_TAG ?? process.env.npm_package_version,
        pid: process.pid,
        hostname: hostname(),
    },
    formatters: {
        level(label, number) {
            return {
                level: label,
                severity: label.toUpperCase(),
                level_value: number,
            };
        },
    },
    serializers: {
        err: pino.stdSerializers.err,
    },
    redact: {
        paths: redactPaths,
        remove: true,
    },
});

export type AppLogger = pino.Logger;

export default logger;
