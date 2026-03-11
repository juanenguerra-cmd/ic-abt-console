/**
 * geminiService.ts — structured AI extraction helpers
 *
 * All Gemini calls are routed through the /api/generate server-side proxy so
 * that the GEMINI_API_KEY secret is never exposed in the browser bundle.
 * The proxy is implemented in the backend (Cloud Functions / Cloudflare Worker).
 * See gemini.ts for the low-level proxy fetch helper.
 */
import { sanitizeField } from "../utils/sanitizePrompt";

export interface IpEventExtraction {
  infectionCategory?: string;
  infectionSite?: string;
  onsetDate?: string;
  organism?: string;
  notes?: string;
  status?: "active" | "resolved" | "historical";
  isolationType?: string[];
}

export async function extractIpEventFromText(text: string): Promise<IpEventExtraction | null> {
  try {
    const safeText = sanitizeField(text, 2000);
    const prompt = `Extract infection prevention event details from the following clinical note and return ONLY a valid JSON object (no markdown, no prose).

Note: "${safeText}"

Return a JSON object with these optional fields:
- infectionCategory: string (e.g., "Respiratory", "Urinary", "Skin/Soft Tissue", "GI", "Bloodstream", "Other")
- infectionSite: string (specific site if mentioned)
- onsetDate: string (ISO 8601 date YYYY-MM-DD; infer from context such as "last Monday" relative to today)
- organism: string (e.g., "E. coli", "MRSA")
- notes: string (summary of the clinical situation)
- status: "active" | "resolved" | "historical"
- isolationType: array of strings (e.g., ["Contact", "Droplet", "Airborne"])`;

    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, model: "gemini-2.0-flash" }),
    });

    if (!response.ok) {
      console.warn("Gemini extraction unavailable (proxy returned", response.status, ")");
      return null;
    }

    const data = await response.json() as { text?: string };
    const jsonText = data.text;
    if (!jsonText) return null;

    // Strip optional markdown code fences before parsing
    const clean = jsonText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    return JSON.parse(clean) as IpEventExtraction;
  } catch (error) {
    console.error("Gemini extraction failed:", error);
    return null;
  }
}
