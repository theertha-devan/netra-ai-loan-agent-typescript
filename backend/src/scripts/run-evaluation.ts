import Netra from "netra-sdk";
import { bootstrap } from "../bootstrap.js";
import { runEvaluation } from "../services/evaluation.js";

const datasetId = process.argv[2];

if (!datasetId) {
  console.error("Usage: npm run evaluation <dataset-id>");
  process.exit(1);
}

await bootstrap();

try {
  console.log(`Starting evaluation with dataset: ${datasetId}`);
  const result = await runEvaluation(datasetId);

  if (!result) {
    console.error("Evaluation returned no result");
    process.exit(1);
  }

  console.log("\nEvaluation complete:");
  console.log(JSON.stringify(result, null, 2));
} catch (error: any) {
  console.error("Evaluation failed:", error.message);
  process.exit(1);
} finally {
  await Netra.shutdown();
}
