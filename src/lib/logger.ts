import winston from 'winston';
import { config } from '../config';

const { combine, timestamp, errors, colorize, printf, json } = winston.format;

export function toText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function formatLogLine(info: Record<string, unknown>): string {
  const { timestamp: ts, level, message, stack, ...meta } = info;
  const text = typeof stack === 'string' ? stack : toText(message);
  const metaStr = Object.keys(meta).length > 0 ? ` ${toText(meta)}` : '';
  return `[${toText(ts)}] ${toText(level)}: ${text}${metaStr}`;
}

const developmentFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  colorize(),
  printf((info) => formatLogLine(info)),
);

const productionFormat = combine(timestamp(), errors({ stack: true }), json());

export const logger = winston.createLogger({
  level: config.logging.level,
  format: config.isProduction ? productionFormat : developmentFormat,
  defaultMeta: { service: 'whatsapp-chatbot' },
  transports: [new winston.transports.Console()],
  silent: config.isTest,
});

export type Logger = typeof logger;
