import Netra from "netra-sdk";
import { getResponse } from "../agent/index.js";
import { randomUUID } from "node:crypto";

export async function runEvaluation(datasetId: string) {
  const dataset = await Netra.evaluation.getDataset(datasetId);

  if (!dataset) {
    throw new Error("Dataset not found");
  }

  return await Netra.evaluation.runTestSuite(
    "Nova Single Turn",
    dataset as any,
    async (message: string) =>
      await getResponse(message, randomUUID().replace(/-/g, "")),
  );
}
