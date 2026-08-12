import express from "express";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { habitsRouter } from "./routes/habits.js";
import { trackingRouter } from "./routes/tracking.js";
import { errorHandler } from "./middleware/errorHandler.js";

export const app = express();

app.use(express.json());

// API surface is mounted under /api; nginx proxies /api/* to this app (same-origin for the browser).
app.use("/api", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/habits", habitsRouter);
app.use("/api", trackingRouter);

// 404 fallback (uniform shape; unknown route is not found).
app.use((_req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found" } });
});

// Central error handler — must be last.
app.use(errorHandler);
