import { Request, Response, NextFunction } from "express";

export interface ApiError extends Error {
    statusCode?: number;
    code?: string;
}

export function errorHandler(
    err: ApiError,
    req: Request,
    res: Response,
    next: NextFunction
) {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error(`[ERROR] ${req.method} ${req.path}:`, err);

    res.status(statusCode).json({
        success: false,
        error: {
            message,
            code: err.code || "INTERNAL_ERROR",
            ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
        },
    });
}

export function notFoundHandler(req: Request, res: Response) {
    res.status(404).json({
        success: false,
        error: {
            message: `Route ${req.method} ${req.path} not found`,
            code: "NOT_FOUND",
        },
    });
}

