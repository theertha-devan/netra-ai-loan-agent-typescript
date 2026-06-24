import { ChatOpenAI } from "@langchain/openai";

let llm: ChatOpenAI;

if (process.env.OPENAI_API_KEY) {
  llm = new ChatOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    modelName: "gpt-4.1",
  });
} else if (process.env.LITELLM_API_KEY) {
  llm = new ChatOpenAI({
    apiKey: process.env.LITELLM_API_KEY,
    modelName: "gpt-4.1",
    configuration: {
      baseURL: "https://llm.keyvalue.systems",
    },
  });
} else {
  throw new Error(
    "No LLM API key found. Set OPENAI_API_KEY or LITELLM_API_KEY.",
  );
}

export { llm };
