import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

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
  if (!ai) {
    console.warn("Gemini API key not found");
    return null;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract infection prevention event details from the following clinical note.
      
      Note: "${text}"
      
      Return a JSON object with these fields (all optional):
      - infectionCategory: string (e.g., "Respiratory", "Urinary", "Skin/Soft Tissue", "GI", "Bloodstream", "Other")
      - infectionSite: string (specific site if mentioned)
      - onsetDate: string (ISO 8601 date YYYY-MM-DD, infer from context like "last Monday" relative to today)
      - organism: string (e.g., "E. coli", "MRSA")
      - notes: string (summary of the clinical situation)
      - status: "active" | "resolved" | "historical" (default to "active" if ongoing)
      - isolationType: array of strings (e.g., ["Contact", "Droplet", "Airborne"])
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            infectionCategory: { type: Type.STRING },
            infectionSite: { type: Type.STRING },
            onsetDate: { type: Type.STRING },
            organism: { type: Type.STRING },
            notes: { type: Type.STRING },
            status: { type: Type.STRING, enum: ["active", "resolved", "historical"] },
            isolationType: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) return null;
    
    return JSON.parse(jsonText) as IpEventExtraction;
  } catch (error) {
    console.error("Gemini extraction failed:", error);
    return null;
  }
}
