import { Request, Response, NextFunction } from 'express';

// 基本的なHttpErrorクラス（必要に応じて拡張可能）
export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    Object.setPrototypeOf(this, HttpError.prototype); // Ensure instanceof works correctly
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Resource not found') {
    super(404, message);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class BadRequestError extends HttpError {
    constructor(message = 'Bad Request') {
        super(400, message);
        Object.setPrototypeOf(this, BadRequestError.prototype);
    }
}

export class ConflictError extends HttpError {
    constructor(message = 'Conflict') {
        super(409, message);
        Object.setPrototypeOf(this, ConflictError.prototype);
    }
}


/**
 * エラーハンドリングミドルウェア
 * すべての例外を一元的に捕捉し、必ずサーバーログにスタックトレースを出力する。
 * try-catchを各所に分散させず、ここで一括処理する。
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  // スタックトレースを必ずサーバーログに出力
  if (err.stack) {
    console.error('[Error]', err.stack);
  } else {
    console.error('[Error]', err.toString());
  }

  let statusCode = 500;
  let errorMessage = 'Internal Server Error';
  let errorDetails: string | undefined = undefined;

  if (err instanceof HttpError) {
    statusCode = err.status;
    errorMessage = err.message;
  } else if (err.name === 'SyntaxError') { // Handle JSON parsing errors specifically
      statusCode = 400;
      errorMessage = 'Invalid JSON payload received.';
  }
  // Add more specific error type checks if needed (e.g., database errors)

  // In development, send more details
  if (process.env.NODE_ENV === 'development' && !(err instanceof HttpError)) {
      errorDetails = err.stack || err.toString();
  }

  res.status(statusCode).json({
    message: errorMessage,
    // Avoid leaking stack traces in production
    ...(errorDetails && { details: errorDetails }),
  });
};
