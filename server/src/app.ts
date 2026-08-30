import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

// Render (and most PaaS hosts) put the app behind a single reverse-proxy
// hop, so req.ip / X-Forwarded-For need this to resolve correctly. Without
// it, express-rate-limit's IP-based keying logs an
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR validation warning on every deploy
// (harmless on its own, but rate limiting falls back to less accurate
// keying without this).
app.set("trust proxy", 1);

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

// Serve the built client (production only — in local dev, Vite serves the
// client on its own port and client/dist doesn't exist).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname, "..", "..", "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api|uploads).*/, (_req, res) => {
    res.sendFile("index.html", { root: clientDist });
  });
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const message = err instanceof Error ? err.message : "Internal server error";
  res.status(500).json({ error: message });
});
