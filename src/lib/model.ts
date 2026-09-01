import OpenAI from "openai";

import type { Branch } from "./types";

/**
 * The model client.
 *
 * The package is called "openai" but the provider is whatever OPENAI_BASE_URL
 * points at - OpenRouter, a local Ollama, or OpenAI itself. Most providers copied
 * OpenAI's request shape, so switching between them is a change of two variables.
 */
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

const SYSTEM_PROMPT = [
  "You answer a single yes-or-no question about a piece of text.",
  "First work out the answer in the reasoning field - quote the relevant part of",
  "the text, and do any counting or arithmetic there explicitly.",
  "Then give the verdict in the answer field, which must be exactly YES or NO.",
  'Reply with JSON only, shaped {"reasoning": "...", "answer": "YES"}.',
].join(" ");

export type Decision = {
  branch: Branch;
  /** The model's own account of why - shown in the run so a verdict is auditable. */
  reasoning: string;
};

/**
 * Ask one node's question about one piece of input, and return which branch to take.
 *
 * The model is asked to reason before deciding rather than answering in a single
 * token. That is not politeness: a question like "three or more years in total"
 * needs the model to find two separate periods, add them, and judge a boundary.
 * Given no room to work, it answers from impression and gets arithmetic wrong -
 * which it did, on exactly this kind of question, before this was changed.
 *
 * The verdict is still strictly two-valued. Reasoning buys accuracy; it does not
 * buy the model permission to answer "it depends".
 */
export async function askYesNo(question: string, input: string): Promise<Decision> {
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "openai/gpt-4o-mini",
    // Deterministic: the same input should take the same branch every run.
    temperature: 0,
    // Room to think, still bounded. The reasoning field is short by instruction.
    max_tokens: 300,
    // Ask the provider to guarantee syntactically valid JSON, so the parse below
    // is about meaning rather than about the model's punctuation.
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Question: ${question}\n\nText to judge:\n${input}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";

  let parsed: { reasoning?: unknown; answer?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Model returned text that is not JSON: ${JSON.stringify(raw.slice(0, 200))}`);
  }

  // Forgiving about shape, strict about meaning: whitespace, casing and a stray
  // full stop are fine, but "Yes, probably" is not an answer this can act on.
  const verdict = String(parsed.answer ?? "").trim().toUpperCase().replace(/[^A-Z]/g, "");
  const reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning : "";

  if (verdict === "YES") return { branch: "yes", reasoning };
  if (verdict === "NO") return { branch: "no", reasoning };

  throw new Error(
    `Model answered ${JSON.stringify(parsed.answer)} for "${question}" - expected exactly YES or NO`,
  );
}
