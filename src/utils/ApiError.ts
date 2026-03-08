import { IApiError } from "../types/Api";

export class ApiError extends Error implements IApiError {
  public statusCode: number;


  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}
