import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { HttpStatus } from '../utils/HttpStatus';
import { log } from '../utils/log';

export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  // Throws ApiError for unknown routes
  log("404 -- Route not found");
  throw new ApiError(HttpStatus.NOT_FOUND, `Route not found: ${req.originalUrl}`);
}
