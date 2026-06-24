import Netra, { BaseTask, type TaskResult, type ProcessedFile } from "netra-sdk";
import { getResponse } from "../agent/index.js";
import { randomUUID } from "node:crypto";

class LoanAgentTask extends BaseTask {
  async run(
    message: string,
    sessionId?: string | null,
    files?: ProcessedFile[] | null,
  ): Promise<TaskResult> {
    const threadId = sessionId || randomUUID().replace(/-/g, "");

    console.log(`\n══ Simulation Turn [thread: ${threadId}] ══`);
    console.log(`  Message: "${message.slice(0, 200)}${message.length > 200 ? "..." : ""}"`);
    if (files && files.length > 0) {
      console.log(`  Files: ${files.length}`);
      for (const f of files) {
        console.log(`    - ${f.fileName} (${f.contentType}, description: ${f.description ?? "none"})`);
        console.log(`      data (base64): ${f.data ? `${f.data.slice(0, 100)}... (${f.data.length} chars total)` : "empty"}`);
      }
    } else {
      console.log(`  Files: none`);
    }

    Netra.setSessionId(threadId);

    const fileDicts = files
      ? files.map((f) => ({
          filename: f.fileName,
          mime_type: f.contentType,
          data: f.data,
        }))
      : [];

    let finalMessage: string;
    try {
      finalMessage = await getResponse(message, threadId, fileDicts);
    } catch (e: any) {
      finalMessage = `Error: ${e.message}`;
      console.error(`  Simulation error: ${e.message}`);
    }

    return {
      message: finalMessage,
      sessionId: threadId,
    };
  }
}

export async function runSimulation(datasetId: string) {
  return await Netra.simulation.runSimulation({
    name: "Loan Agent Simulation",
    datasetId: datasetId,
    task: new LoanAgentTask(),
  });
}
