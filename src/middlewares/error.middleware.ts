import { Request, Response, NextFunction } from 'express';
import ApiError from '../utils/apiError';

export default function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors
    });
  }

  console.error(err.stack);
  return res.status(500).json({
    success: false,
    message: 'Internal Server Error'
  });
}