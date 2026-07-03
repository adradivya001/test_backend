import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';

@Injectable()
export class CustomLogger implements LoggerService {
  private readonly winstonLogger: winston.Logger;

  constructor() {
    this.winstonLogger = winston.createLogger({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, context }) => {
              return `[DFO-Core] ${timestamp} [${context || 'Application'}] ${level}: ${message}`;
            }),
          ),
        }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
        }),
      ],
    });
  }

  log(message: any, context?: string) {
    this.winstonLogger.info(message, { context });
  }

  error(message: any, trace?: string, context?: string) {
    this.winstonLogger.error(message, { trace, context });
  }

  warn(message: any, context?: string) {
    this.winstonLogger.warn(message, { context });
  }

  debug(message: any, context?: string) {
    this.winstonLogger.debug(message, { context });
  }

  verbose(message: any, context?: string) {
    this.winstonLogger.verbose(message, { context });
  }
}
