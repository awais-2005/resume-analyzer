import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { ApiError } from '../utils/ApiError';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      stack: err.stack || "N/A",
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    const messages: Record<string, string> = {
      LIMIT_FILE_SIZE: 'File size exceeds the 10MB limit',
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field',
      LIMIT_FILE_COUNT: 'Too many files uploaded',
    };
    res.status(400).json({
      success: false,
      error: messages[err.code] || err.message,
      stack: err.stack || "N/A",
    });
    return;
  }

  if (err.message === 'Only PDF, DOC, and DOCX files are allowed') {
    res.status(400).json({
      success: false,
      error: err.message,
      stack: err.stack || "N/A",
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    success: false,
    error: err.message,
    stack: err.stack || "N/A",
  });
}
