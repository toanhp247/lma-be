import { Router } from "express";
import { authController } from "./auth.controller";

export const authRouter = Router();

authRouter.post("/auth/login", authController.login);
authRouter.post("/auth/register", authController.register);
authRouter.post("/auth/forgot-password", authController.forgotPassword);
