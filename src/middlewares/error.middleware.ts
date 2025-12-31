import type { ErrorRequestHandler } from "express";
import { AppError } from "../utils/app-error";

type ErrorBody = { message: string; code: string };

export const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    const body: ErrorBody = { message: err.message, code: err.code };
    return res.status(err.status).json(body);
  }

  const status = typeof err.status === "number" ? err.status : 500;

  const body: ErrorBody = {
    message: err.message || "Internal Server Error",
    code:
      status === 400 ? "VALIDATION_ERROR" :
      status === 401 ? "UNAUTHORIZED" :
      status === 404 ? "NOT_FOUND" :
      "INTERNAL_ERROR",
  };

  return res.status(status).json(body);
};
