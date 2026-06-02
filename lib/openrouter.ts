import modelsConfig from './models.json';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** Required when role is 'tool' */
  tool_call_id?: string;
}

export interface OpenRouterTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface OpenRouterToolOptions {
  tools?: OpenRouterTool[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
}

export interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
}

export interface ModelConfig {
  id: string;
  name: string;
  description: string;
  maxTokens: number;
  temperature: number;
  supportsTools: boolean;
  supportsStructuredOutput: boolean;
  supportsReasoning: boolean;
}

// ─────────────────────────────────────────────
// Thinking Mode Prompt
// Injected as a system message when isThinking is true.
// Governs how the model reasons before producing output.
// ─────────────────────────────────────────────

const THINKING_PROMPT_MODIFIER = `You are operating in CastAI reasoning mode.

Before responding, follow these internal steps:
1. Understand the user's intent clearly.
2. Verify that the requested action is relevant, safe, and within scope.
3. Consider application policies and any applicable permission constraints.
4. Validate that all required information is present and well-formed.
5. Produce a structured, concise, and final response.

Do not reveal internal reasoning steps.
Return only the final result.`;

// ─────────────────────────────────────────────
// Main Router
// ─────────────────────────────────────────────

/**
 * OpenRouter API Service Utility
 *
 * Routes completions through OpenRouter using sequential fallback logic.
 *
 * @param messages     - The message history to send.
 * @param customModel  - Override the primary model for this specific call.
 * @param isThinking   - When true: prepends a governance reasoning prompt and
 *                       lowers temperature to 0.2 for deterministic output.
 *                       This is a call-site concern — not stored in model config.
 * @param toolOptions  - Optional tool definitions and tool_choice for future
 *                       tool-calling support (Policy Engine, Execution Gateway, etc.)
 */
export const fetchOpenRouterCompletion = async (
  messages: OpenRouterMessage[],
  customModel?: string,
  isThinking?: boolean,
  toolOptions?: OpenRouterToolOptions
): Promise<string> => {

  // ── API Key ────────────────────────────────
  const apiKey = process.env.OpenRouter;

  if (!apiKey) {
    throw new Error(
      '[CastAI Router] OpenRouter API Key ("OpenRouter") is not configured. Check your .env.local file.'
    );
  }

  // ── 1. Build candidate queue ───────────────
  // Primary model first, then fallbacks in order.
  const candidates: string[] = [];

  if (customModel) {
    candidates.push(customModel);
  } else {
    candidates.push(modelsConfig.primaryModelId);
  }

  modelsConfig.fallbacks.forEach((fallbackId) => {
    if (!candidates.includes(fallbackId)) {
      candidates.push(fallbackId);
    }
  });

  // ── 2. Resolve messages ────────────────────
  // If thinking mode is active, prepend the governance reasoning prompt
  // as the first system message so the model reasons before responding.
  const resolvedMessages: OpenRouterMessage[] = isThinking
    ? [{ role: 'system', content: THINKING_PROMPT_MODIFIER }, ...messages]
    : messages;

  // ── 3. Sequential fallback loop ────────────
  const baseUrl = 'https://openrouter.ai/api/v1/chat/completions';
  let lastError: Error | null = null;

  for (const modelId of candidates) {
    const modelConfig = modelsConfig.models.find((m) => m.id === modelId) as ModelConfig | undefined;

    // Thinking mode → 0.2 (deterministic). Conversational → model default or 0.7.
    const temperature = isThinking ? 0.2 : (modelConfig?.temperature ?? 0.7);
    const maxTokens = modelConfig?.maxTokens ?? 1000;

    // Skip models that don't support tools when tool options are provided
    if (toolOptions?.tools?.length && modelConfig && !modelConfig.supportsTools) {
      console.warn(
        `[CastAI Router] Skipping "${modelId}" — tool calls requested but model does not support tools.`
      );
      continue;
    }

    console.log(
      `[CastAI Router] Attempting → "${modelId}" | temp=${temperature} | thinking=${!!isThinking} | tools=${!!toolOptions?.tools?.length}`
    );

    try {
      const body: Record<string, unknown> = {
        model: modelId,
        messages: resolvedMessages,
        temperature,
        max_tokens: maxTokens,
      };

      // Attach tool definitions when provided (forward-compatible)
      if (toolOptions?.tools?.length) {
        body.tools = toolOptions.tools;
        body.tool_choice = toolOptions.toolChoice ?? 'auto';
      }

      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
          'X-Title': 'CastTalk',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data: OpenRouterResponse = await response.json();
      const choice = data.choices?.[0];

      // Handle tool call responses (future Execution Gateway hook)
      if (choice?.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
        const toolCall = choice.message.tool_calls[0];
        console.log(`[CastAI Router] Tool call requested → "${toolCall.function.name}"`);
        // Return a serialized representation for the caller to dispatch
        return JSON.stringify({ __toolCall: true, ...toolCall });
      }

      const content = choice?.message?.content;

      if (!content) {
        throw new Error('Response did not contain message content.');
      }

      console.log(`[CastAI Router] Resolved by → "${modelId}"`);
      return content;

    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;
      console.warn(
        `[CastAI Router] "${modelId}" failed → ${err.message}. Trying next candidate...`
      );
    }
  }

  // ── 4. All candidates exhausted ───────────
  const finalErrorMessage = lastError?.message ?? 'Unknown routing error';
  throw new Error(
    `[CastAI Router] All model candidates exhausted. Last error: ${finalErrorMessage}`
  );
};
