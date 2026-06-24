import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import Netra from "netra-sdk";
import { randomUUID } from "node:crypto";
import { getResponse } from "./agent/index.js";
import type { ChatRequest } from "./schema/chat-request.js";
import { runSimulation } from "./services/simulation.js";
import { runEvaluation } from "./services/evaluation.js";
import { bootstrap } from "./bootstrap.js";

await bootstrap();

process.on("SIGTERM", async () => {
  await Netra.shutdown();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await Netra.shutdown();
  process.exit(0);
});

const app = new Hono();

app.use(
  "*",
  cors({
    origin: ["http://localhost:3001", "http://127.0.0.1:3001"],
    allowMethods: ["POST", "GET", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    maxAge: 600,
  }),
);

app.options("*", (c) => c.text("", 200));

app.get("/", (c) => c.json({ status: "ok" }));

app.post("/chat", async (c) => {
  try {
    const body = await c.req.json<ChatRequest>();

    const existingThreadId =
      body.thread_id && body.thread_id.trim().length > 0
        ? body.thread_id
        : null;

    const threadId = (existingThreadId ?? randomUUID()).replace(/-/g, "");

    console.log(`\n━━━ /chat [thread: ${threadId}] ━━━`);
    console.log(`  Prompt: "${body.prompt?.slice(0, 200)}${body.prompt?.length > 200 ? "..." : ""}"`);
    console.log(`  Thread (existing): ${existingThreadId ?? "new"}`);
    if (body.files && body.files.length > 0) {
      console.log(`  Files received: ${body.files.length}`);
      for (const f of body.files) {
        console.log(`    - ${f.filename} (${f.mime_type}, data: ${f.data ? `${f.data.length} chars` : "empty"})`);
      }
    } else {
      console.log(`  Files: none`);
    }

    Netra.setSessionId(threadId);

    const files = body.files
      ? body.files.map((f) => ({
          filename: f.filename,
          mime_type: f.mime_type,
          data: f.data,
        }))
      : [];

    const responseText = await getResponse(body.prompt, threadId, files);

    return c.json({
      response: responseText,
      thread_id: threadId,
    });
  } catch (err) {
    console.error(err);
    return c.json({ error: "An error occurred" }, 500);
  }
});

app.post("/simulation/:dataset_id", async (c) => {
  try {
    const datasetId = c.req.param("dataset_id");
    const result = await runSimulation(datasetId);
    if (!result) {
      throw new Error("Simulation failed");
    }
    return c.json(result);
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message || "An error occurred" }, 500);
  }
});

app.post("/single-turn/:dataset_id", async (c) => {
  try {
    const datasetId = c.req.param("dataset_id");
    const result = await runEvaluation(datasetId);
    if (!result) {
      throw new Error("Evaluation failed");
    }
    return c.json(result);
  } catch (err: any) {
    console.error(err);
    return c.json({ error: err.message || "An error occurred" }, 500);
  }
});

serve(
  {
    fetch: app.fetch,
    port: 8001,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
