import express from "express";
import pinoHttp from "pino-http";
import * as OpenApiValidator from "express-openapi-validator";
import path from "path";

import { logger } from "./utils/logger";
import { authRouter } from "./modules/auth/auth.router";
import { userRouter } from "./modules/user/user.router";
import { libraryRouter } from "./modules/library/library.router";
import { notFoundMiddleware } from "./middlewares/not-found.middleware";
import { errorMiddleware } from "./middlewares/error.middleware";

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(pinoHttp({ logger }));

  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // process.cwd() giúp chạy ổn cả dev/prod
  const apiSpecPath = path.join(process.cwd(), "openapi", "LMA-API-Mobile.yaml");

  app.use(
    "/v1",
    OpenApiValidator.middleware({
      apiSpec: apiSpecPath,
      validateRequests: true,
      validateResponses: true,
    })
  );

  app.use("/v1", authRouter);
  app.use("/v1", userRouter);
  app.use("/v1", libraryRouter);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
