import type { Request, Response } from "express";
import { libraryService } from "./library.service";

type AuthRequest = Request & { userId?: string };

export const libraryController = {
  async listBooks(req: Request, res: Response) {
    const result = await libraryService.listBooks(
      (req as AuthRequest).userId,
      req.query
    );
    return res.status(200).json(result);
  },

  async getBookDetail(req: Request, res: Response) {
    const result = await libraryService.getBookDetail(
      (req as AuthRequest).userId,
      req.params.id
    );
    return res.status(200).json(result);
  },

  async borrowBook(req: Request, res: Response) {
    const result = await libraryService.borrowBook(
      (req as AuthRequest).userId,
      req.params.id
    );
    return res.status(200).json(result);
  },
};
