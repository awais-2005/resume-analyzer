import { NextFunction, Request, Response } from "express";

export default function requestLogger(req: Request, res: Response, next: NextFunction): void {
    console.log(`${req.method} ${req.url} ${new Date().toISOString()}`);
    next();
}