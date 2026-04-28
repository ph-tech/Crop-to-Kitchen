import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface CropAnalysis {
  crop_type: string;
  ripeness_index: number;
  days_to_spoilage: number;
}

export const analyzeCropImage = async (base64Image: string): Promise<CropAnalysis> => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `Analyze this crop photo and provide a JSON response with:
    1. crop_type: The name of the crop shown.
    2. ripeness_index: A float between 0.0 (unripe) and 1.0 (overripe).
    3. days_to_spoilage: Estimated days until the crop becomes unusable.
    Return ONLY JSON.`;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "image/jpeg", data: base64Image } }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          crop_type: { type: Type.STRING },
          ripeness_index: { type: Type.NUMBER },
          days_to_spoilage: { type: Type.INTEGER }
        },
        required: ["crop_type", "ripeness_index", "days_to_spoilage"]
      }
    }
  });

  try {
    const data = JSON.parse(response.text);
    return data as CropAnalysis;
  } catch (error) {
    console.error("AI Analysis Error:", error);
    throw new Error("Failed to parse AI response");
  }
};
