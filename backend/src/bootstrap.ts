import Netra, { NetraInstruments } from "netra-sdk";
import { initDb } from "./db/index.js";

export async function bootstrap() {
  await Netra.init({
    appName: "Nova Agent TS",
    headers: `x-api-key=${process.env.NETRA_API_KEY}`,
    debugMode: true,
    environment: process.env.ENVIRONMENT || "dev",
    blockInstruments: new Set([
      NetraInstruments.LANGCHAIN,
      NetraInstruments.LANGGRAPH,
      NetraInstruments.OPENAI,
      NetraInstruments.GROQ,
      NetraInstruments.HTTP,
    ]),
  });

  initDb();
}
