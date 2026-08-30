import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./utils/env.js";
import { uploadsDir } from "./middleware/upload.middleware.js";
import { authRouter } from "./routes/auth.routes.js";
import { adminRouter } from "./routes/admin.routes.js";
import { teacherRouter } from "./routes/teacher.routes.js";
import { pupilRouter } from "./routes/pupil.routes.js";
import { parentRouter } from "./routes/parent.routes.js";

export const app = express();

app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use("/uploads", express.static(uploadsDir));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/teacher", teacherRouter);
app.use("/api/pupil", pupilRouter);
app.use("/api/parent", parentRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const message = err instanceof Error ? err.message : "Internal server error";
  res.status(500).json({ error: message });
});
