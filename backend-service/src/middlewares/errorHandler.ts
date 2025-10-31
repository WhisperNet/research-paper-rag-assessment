import { logger } from '../config/logger';

export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function errorHandler() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (err: any, req: any, res: any, _next: any) => {
    const requestId = (req as any).id;
    if (err instanceof AppError) {
      logger.warn({ err, requestId }, 'AppError');
      res.status(err.status).json({
        success: false,
        error: { code: err.code, message: err.message, details: err.details },
        requestId,
      });
      return;
    }
    logger.error({ err, requestId }, 'Unhandled error');
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
      requestId,
    });
  };
}
