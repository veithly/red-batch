/**
 * Optional, additive agent narration via an OpenAI-compatible endpoint.
 *
 * This is never the source of truth for affected-order matching, approval, the
 * order-state mutation, or verification — that logic is deterministic. The model
 * only phrases the Batch Containment Agent's reasoning in one short paragraph.
 * Any failure (no key, timeout, network error) falls back to deterministic text.
 */
export async function narrate(prompt: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const base = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.OPENAI_DEFAULT_MODEL || process.env.OPENAI_MODEL_DEFAULT || "gpt-4o-mini";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are the Batch Containment Agent inside a product-safety case system. Write ONE concise paragraph (max 55 words) describing your reasoning. Be factual and operational. Do not invent numbers; only use the facts given. No markdown, no lists.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 160,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content?.trim();
    return text && text.length > 0 ? text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
