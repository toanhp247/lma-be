import { Router } from "express";
import { libraryController } from "./library.controller";
import { authGuard } from "../../middlewares/auth-guard.middleware";

export const libraryRouter = Router();

libraryRouter.get("/books", authGuard, libraryController.listBooks);
libraryRouter.get("/books/:id", authGuard, libraryController.getBookDetail);
libraryRouter.post("/books/:id/borrow", authGuard, libraryController.borrowBook);
