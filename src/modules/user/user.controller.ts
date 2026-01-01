import type { Request, Response } from "express";
import { userService } from "./user.service";

type AuthRequest = Request & { userId?: string };

export const userController = {
  async getProfile(req: Request, res: Response) {
    const userId = (req as AuthRequest).userId;
    const profile = await userService.getProfile(userId);
    return res.status(200).json(profile);
  },

  async updateProfile(req: Request, res: Response) {
    const userId = (req as AuthRequest).userId;
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const files = (req as any).files;
    const file = (req as any).file;
    const result = await userService.updateProfile(userId, req.body, {
      files,
      file,
      baseUrl,
    });
    return res.status(200).json(result);
  },
};
