// Requires @google/genai >= 1.0.0
// Uses the GoogleGenAI client introduced in @google/genai ^1.x.
// Do NOT use the older @google-cloud/aiplatform or @google/generative-ai patterns;
// those use a different client instantiation and generateContent() call signature.
import { GoogleGenAI } from "@google/genai";

// process.env.GEMINI_API_KEY is injected at build time by vite.config.ts → define.
const API_KEY = process.env.GEMINI_API_KEY as string | undefined;

function getClient(): GoogleGenAI {
  if (!API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to your .env.local file."
    );
  }
  return new GoogleGenAI({ apiKey: API_KEY });
}

/**
 * Generate text content via the Gemini API.
 *
 * Call signature follows @google/genai ^1.x:
 *   ai.models.generateContent({ model, contents })
 *
 * @param prompt  The prompt string to send to the model.
 * @param model   The Gemini model ID (defaults to "gemini-2.0-flash").
 * @returns       The generated text response.
 */
export async function generateContent(
  prompt: string,
  model = "gemini-2.0-flash"
): Promise<string> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });
  return response.text ?? "";
}
