import { createAgent, createMiddleware, modelRetryMiddleware } from "langchain";
import { MemorySaver } from "@langchain/langgraph";
import { llm } from "./llm.js";
import { SYSTEM_PROMPT } from "./prompt.js";
import {
  verifyIdentity,
  calculateEmi,
  checkEligibility,
  fetchCreditReport,
  fetchFinancialProfile,
  generatePreApproval,
  searchLoanProducts,
} from "./tools.js";
import Netra, { ConversationType, SpanType } from "netra-sdk";
import { AIMessage, type BaseMessage, ToolMessage } from "@langchain/core/messages";

interface FileDict {
  filename: string;
  mime_type: string;
  data?: string;
}

const checkpointer = new MemorySaver();

function contentToString(
  content:
    | string
    | Array<{ type?: string; text?: string; [key: string]: unknown }>,
): string {
  if (typeof content === "string") return content;
  return content
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("");
}

const verifyAgentResponseMiddleware = createMiddleware({
  name: "verify_agent_response",
  afterAgent: async (state, _runtime) => {
    let eligibilityOutput: string | null = null;

    const messages = (state as any).messages || [];

    const toolCallIdToName: Record<string, string> = {};
    for (const message of messages) {
      if (message._getType() === "ai") {
        const aiMsg = message as AIMessage;
        if (aiMsg.tool_calls) {
          for (const tc of aiMsg.tool_calls) {
            if (tc.id) {
              toolCallIdToName[tc.id] = tc.name;
            }
          }
        }
      }
    }

    for (const message of messages) {
      if (message._getType() === "tool") {
        const toolMsg = message as ToolMessage;
        if (toolCallIdToName[toolMsg.tool_call_id] === "check_eligibility") {
          eligibilityOutput = toolMsg.content as string;
        }
      }
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage._getType() !== "ai") return;

    const aiMessageContent = contentToString(lastMessage.content);

    const lakhPattern =
      /\d+\.?\d*\s*(?:lakh|lakhs|L\b)|\d{1,3}(?:[,.]?\d{2,3})+/gi;
    const containsLakh = lakhPattern.test(aiMessageContent);

    if (containsLakh) {
      const verificationPrompt = `
You are verifying a loan agent's response for accuracy.

Tool Output from check_eligibility:
${eligibilityOutput}

Agent's Response:
${aiMessageContent}

Task: Check if the agent's response correctly uses the amounts from the tool output. 
Specifically verify:
1. The approved/maximum amount matches the tool output
2. Any amount figures in lakhs are correctly converted from the tool output
3. The agent hasn't invented or miscalculated any amounts

If the response is correct, return it as-is.
If incorrect, return a corrected version that accurately reflects the tool output data.
If there's no eligibility output, round the amount up to the nearest lakh.
Return ONLY the corrected response text, nothing else.
`;

      try {
        const correctedResponse = await llm.invoke([
          { role: "user", content: verificationPrompt },
        ]);
        const correctedText = contentToString(correctedResponse.content);

        console.log(
          `Amount verification - Original: ${aiMessageContent.slice(0, 100)}... | Corrected: ${correctedText.slice(0, 100)}...`,
        );

        const updatedMessages = [...messages];
        const lastAiMsg = lastMessage as AIMessage;
        updatedMessages[updatedMessages.length - 1] = new AIMessage({
          content: correctedText,
          tool_calls: lastAiMsg.tool_calls,
          usage_metadata: lastAiMsg.usage_metadata,
        });

        return { messages: updatedMessages } as any;
      } catch (e: any) {
        console.error(`Amount verification failed: ${e.message}`);
      }
    }
  },
});

const _agent = createAgent({
  model: llm,
  tools: [
    verifyIdentity,
    calculateEmi,
    checkEligibility,
    fetchCreditReport,
    fetchFinancialProfile,
    generatePreApproval,
    searchLoanProducts,
  ],
  systemPrompt: SYSTEM_PROMPT,
  checkpointer: checkpointer,
  middleware: [
    verifyAgentResponseMiddleware,
    modelRetryMiddleware({
      maxRetries: 5,
      maxDelayMs: 2000,
    }),
  ],
});

async function traceConversation(
  threadId: string,
  messages: BaseMessage[],
) {
  const span = Netra.startSpan("Generation Pipeline",  { asType: SpanType.GENERATION });
  span.start();

  try {
    span.withActive(() =>{
      Netra.setSessionId(threadId);
      Netra.setUserId("Demo");
      Netra.setTenantId("Nova");
  
      Netra.addConversation(ConversationType.INPUT, "System", SYSTEM_PROMPT);
  
      const toolCalls: Record<
        string,
        { name: string; args: Record<string, unknown>; output?: string }
      > = {};
  
      for (const message of messages) {
        const type = message.type;
        if (type === "human") {
          Netra.addConversation(
            ConversationType.INPUT,
            "User",
            contentToString(message.content),
          );
        } else if (type === "ai") {
          const aiMsg = message as AIMessage;
          const textContent = contentToString(aiMsg.content);
          if (textContent.length > 0) {
            Netra.addConversation(ConversationType.OUTPUT, "Ai", textContent);
  
            const responseSpan = Netra.startSpan(
              "Agent Response",
              {asType: SpanType.GENERATION},
            );
            responseSpan.start();
            try {
              responseSpan.setModel("gpt-4.1");
  
              if (aiMsg.usage_metadata) {
                responseSpan.setUsage([
                  {
                    model: "gpt-4.1",
                    units_used: aiMsg.usage_metadata.input_tokens,
                    usage_type: "input",
                  },
                  {
                    model: "gpt-4.1",
                    units_used: aiMsg.usage_metadata.output_tokens,
                    usage_type: "output",
                  },
                ]);
              }
              responseSpan.setAttribute("completion", textContent);
              responseSpan.setSuccess();
            } catch (e: any) {
              responseSpan.setError(e.message || String(e));
            } finally {
              responseSpan.end();
            }
          }
  
          if (aiMsg.tool_calls) {
            for (const tc of aiMsg.tool_calls) {
              if (tc.id) {
                toolCalls[tc.id] = { name: tc.name, args: tc.args };
                Netra.addConversation(
                  ConversationType.INPUT,
                  "Tool Call",
                  `${tc.name}(${JSON.stringify(tc.args)})`,
                );
              }
            }
          }
        } else if (type === "tool") {
          const toolMsg = message as ToolMessage;
          const tc = toolCalls[toolMsg.tool_call_id];
          if (tc) {
            tc.output = String(toolMsg.content);
  
            const toolSpan = Netra.startSpan(
              tc.name,
              {asType: SpanType.TOOL},
            );
            toolSpan.start();
            try {
              toolSpan.setAttribute("tool.name", tc.name);
              toolSpan.setAttribute("tool.args", JSON.stringify(tc.args));
              toolSpan.setAttribute("tool.output", String(toolMsg.content));
              toolSpan.setSuccess();
            } catch (e: any) {
              toolSpan.setError(e.message || String(e));
            } finally {
              toolSpan.end();
            }
  
            Netra.addConversation(
              ConversationType.OUTPUT,
              "Tool Output",
              String(toolMsg.content),
            );
          }
        }
      }
    })


    span.setSuccess();
  } catch (error: any) {
    console.error("Netra tracing failed:", error);
    span.setError(error.message || String(error));
  } finally {
    span.end();
  }
}

export async function getResponse(
  prompt: string,
  threadId: string,
  files: FileDict[] = [],
): Promise<string> {
  const parts: string[] = [];

  if (prompt) {
    parts.push(prompt);
  }

  if (files.length > 0) {
    for (const file of files) {
      parts.push(
        `I have uploaded a file named ${file.filename} with mimetype ${file.mime_type}`,
      );
    }
  }

  const userMessage = parts.join("\n") || "";

  console.log(`\n┌─ Agent Input [thread: ${threadId}]`);
  console.log(`│  User message sent to LLM:`);
  console.log(`│  "${userMessage.slice(0, 500)}${userMessage.length > 500 ? "..." : ""}"`);
  if (files.length > 0) {
    console.log(`│  Files attached: ${files.length}`);
    for (const file of files) {
      console.log(`│    • ${file.filename} (${file.mime_type}, data present: ${!!file.data}, size: ${file.data?.length ?? 0} chars)`);
    }
  }
  console.log(`└─`);

  const response = await _agent.invoke(
    {
      messages: [
        { role: "user", content: userMessage },
      ],
    },
    { configurable: { thread_id: threadId } },
  );

  const messages = response.messages;

  await traceConversation(threadId, messages);

  const lastMessage = messages[messages.length - 1];
  const agentResponse = contentToString(lastMessage.content);

  console.log(`\n┌─ Agent Output [thread: ${threadId}]`);
  console.log(`│  Response: "${agentResponse.slice(0, 300)}${agentResponse.length > 300 ? "..." : ""}"`);
  console.log(`│  Total messages in conversation: ${messages.length}`);
  console.log(`└─`);

  return agentResponse;
}
