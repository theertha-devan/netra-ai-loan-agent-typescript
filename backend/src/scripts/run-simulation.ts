import Netra from "netra-sdk";
import { bootstrap } from "../bootstrap.js";
import { runSimulation } from "../services/simulation.js";

const datasetId = process.argv[2];

if (!datasetId) {
  console.error("Usage: npm run simulation <dataset-id>");
  process.exit(1);
}

await bootstrap();

try {
  console.log(`Starting simulation with dataset: ${datasetId}`);
  const result = await runSimulation(datasetId);

  if (!result) {
    console.error("Simulation returned no result");
    process.exit(1);
  }

  console.log("\nSimulation complete:");
  console.log(JSON.stringify(result, null, 2));
} catch (error: any) {
  console.error("Simulation failed:", error.message);
  process.exit(1);
} finally {
  await Netra.shutdown();
}
