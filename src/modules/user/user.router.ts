import { Router } from "express";
import { userController } from "./user.controller";
import { authGuard } from "../../middlewares/auth-guard.middleware";

export const userRouter = Router();

userRouter.get("/users/me", authGuard, userController.getProfile);
userRouter.put("/users/me", authGuard, userController.updateProfile);
