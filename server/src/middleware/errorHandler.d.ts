import { Request, Response, NextFunction } from 'express';
export declare class HttpError extends Error {
    status: number;
    constructor(status: number, message: string);
}
export declare class NotFoundError extends HttpError {
    constructor(message?: string);
}
export declare class BadRequestError extends HttpError {
    constructor(message?: string);
}
export declare class ConflictError extends HttpError {
    constructor(message?: string);
}
export declare const errorHandler: (err: Error, req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=errorHandler.d.ts.map