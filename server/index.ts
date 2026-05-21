import express from "express";
import agentsRouter from "./routes/agents.js";
import datalensRouter from "./routes/datalens.js";
import { closeDB } from "./db/index.js";

const DEFAULT_PORT = 3999;
const parsedPort = Number.parseInt(process.env.PORT ?? "", 10);
const PORT =
  Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535
    ? parsedPort
    : DEFAULT_PORT;

const app = express();

// DuckDB returns BigInt for integer types — convert to Number in JSON responses
app.set("json replacer", (_key: string, value: unknown) =>
  typeof value === "bigint" ? Number(value) : value
);

// ── Middleware ────────────────────────────────────────────────────────────────

// CORS — allow the Vite dev server (any origin for local dev)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

app.use(express.json({ limit: "1mb" }));

// ── Routes ────────────────────────────────────────────────────────────────────

app.use("/api/agents", agentsRouter);
app.use("/api/datalens", datalensRouter);

app.get("/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ── Start ─────────────────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  console.log(`[server] Listening on http://localhost:${PORT}`);
  console.log(`[server] Agents API: http://localhost:${PORT}/api/agents`);
});

function shutdown() {
  console.log("[server] Shutting down...");
  const forceExitTimer = setTimeout(() => {
    closeDB();
    process.exit(1);
  }, 5000);

  server.close(() => {
    clearTimeout(forceExitTimer);
    closeDB();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
