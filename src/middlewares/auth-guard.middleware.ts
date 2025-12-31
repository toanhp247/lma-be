import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../utils/app-error";

export const authGuard: RequestHandler = (req, _res, next) => {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return next(new AppError(401, "AUTH_001", "Unauthorized"));

  const token = h.slice("Bearer ".length).trim();
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub?: string };
    (req as any).userId = payload.sub;
    return next();
  } catch {
    return next(new AppError(401, "AUTH_001", "Unauthorized"));
  }
};
