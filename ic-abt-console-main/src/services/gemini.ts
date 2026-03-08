/**
 * Generate text content via the /api/generate proxy.
 *
 * The proxy (functions/api/generate.ts) forwards the request to the Gemini
 * API using GEMINI_API_KEY stored in Cloudflare Pages environment variables,
 * so the key is never exposed to the browser.
 *
 * @param prompt  The prompt string to send to the model.
 * @param model   The Gemini model ID (defaults to "gemini-2.0-flash").
 * @returns       The generated text response.
 */
export async function generateContent(
  prompt: string,
  model = "gemini-2.0-flash"
): Promise<string> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, model }),
  });
  if (!response.ok) throw new Error("AI generation failed");
  const data = await response.json() as { text?: string };
  return data.text ?? "";
}
