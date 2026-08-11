import express from "express";
import { healthRouter } from "./routes/health.js";

export const app = express();

app.use(express.json());

// API surface is mounted under /api; nginx proxies /api/* to this app (same-origin for the browser).
app.use("/api", healthRouter);

app.use((_req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found" } });
});
