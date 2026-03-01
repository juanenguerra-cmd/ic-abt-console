import { GoogleGenAI } from "@google/genai";

interface Env {
  GEMINI_API_KEY: string;
}

interface RequestBody {
  prompt?: string;
  model?: string;
}

const CORS_HEADERS = {
  "Content-Type": "application/json",
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: RequestBody;
  try {
    body = await context.request.json<RequestBody>();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  if (!body.prompt || body.prompt.trim() === "") {
    return new Response(JSON.stringify({ error: "prompt is required" }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  try {
    if (!context.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is not configured in Cloudflare Pages environment variables");
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: CORS_HEADERS,
      });
    }
    const ai = new GoogleGenAI({ apiKey: context.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: body.model ?? "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: body.prompt }] }],
    });
    return new Response(JSON.stringify({ text: response.text }), {
      status: 200,
      headers: CORS_HEADERS,
    });
  } catch (err) {
    console.error("Gemini API error:", err);
    return new Response(JSON.stringify({ error: "AI generation failed" }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
};
