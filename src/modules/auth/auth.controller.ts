import type { Request, Response } from "express";

export const authController = {
  login: (_req: Request, res: Response) => {
    res.status(200).json({
      accessToken: "stub-token",
      user: { id: "stub", username: "stub", fullName: "Stub User", userType: "student" },
    });
  },

  register: (_req: Request, res: Response) => {
    res.status(201).json({
      accessToken: "stub-token",
      user: { id: "stub", username: "stub", fullName: "Stub User", userType: "student" },
    });
  },

  forgotPassword: (_req: Request, res: Response) => {
    res.status(200).json({ message: "Vui lòng kiểm tra email để đặt lại mật khẩu" });
  },
};
