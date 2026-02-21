import Groq from "groq-sdk";
import { FoodAnalysis } from "../types";

// Lazy Groq client (reuses the same pattern)
let groqClient: Groq | null = null;

function getGroqClient(): Groq {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY environment variable is not set");
    }
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

/**
 * Analyze food image using Groq Vision (Llama 4 Scout - multimodal)
 * Identifies the food, estimates calories and sodium, and assesses BP impact
 */
export async function analyzeFood(imageBuffer: Buffer): Promise<FoodAnalysis> {
  try {
    const groq = getGroqClient();

    // Convert image buffer to base64
    const base64Image = imageBuffer.toString("base64");
    const mimeType = "image/jpeg";

    const response = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
            {
              type: "text",
              text: `You are a food nutrition analysis expert. Analyze this food image carefully.

Identify the food/meal shown and estimate its nutritional content.

Return ONLY a valid JSON object (no markdown, no code blocks, no extra text) with exactly these fields:
{
  "foodName": "specific name of the food/meal",
  "calories": estimated total calories as a number,
  "sodium": estimated sodium in mg as a number,
  "potassium": estimated potassium in mg as a number,
  "bpImpact": "low" or "moderate" or "high",
  "details": "1-2 sentence description of the meal and its cardiovascular health impact"
}

Guidelines for bpImpact:
- "high": sodium > 1500mg, fried foods, processed meats, heavy salt
- "moderate": sodium 800-1500mg, mixed nutritional profile
- "low": sodium < 800mg, fruits, vegetables, lean protein, whole grains

If you see Nigerian/African food, name it properly (e.g. "Boiled Yam with Fried Egg", "Jollof Rice", "Amala with Ewedu", "Suya", "Pounded Yam with Egusi Soup").

IMPORTANT: Return ONLY the JSON object. No other text before or after it.`,
            },
          ],
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0].message.content || "{}";
    console.log("[Food Analysis] Raw response:", content);

    // Extract JSON from response (handle markdown code blocks if any)
    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    // Also handle case where response starts with text before JSON
    const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      jsonStr = braceMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    const sodium = parsed.sodium || 0;
    let bpImpact: "low" | "moderate" | "high" = parsed.bpImpact || "low";
    let message = "";

    if (bpImpact === "high" || sodium > 1500) {
      bpImpact = "high";
      message = `${parsed.foodName} is high in sodium (~${sodium}mg). This may elevate your blood pressure over the next few hours. Consider drinking water and reducing salt at your next meal.`;
    } else if (bpImpact === "moderate" || sodium > 800) {
      bpImpact = "moderate";
      message = `${parsed.foodName} has moderate sodium (~${sodium}mg). Be mindful of your salt intake for the rest of the day.`;
    } else {
      message = `${parsed.foodName} is a heart-friendly choice! Low sodium (~${sodium}mg) and good for your cardiovascular health.`;
    }

    if (parsed.details) {
      message += ` ${parsed.details}`;
    }

    return {
      foodName: parsed.foodName || "Unidentified food",
      calories: parsed.calories || 0,
      sodium,
      bpImpact,
      message,
    };
  } catch (error: any) {
    console.error("[Food Analysis] Primary model error:", error.message);

    // Try fallback with Maverick model
    try {
      return await analyzeFoodFallback(imageBuffer);
    } catch (fallbackError: any) {
      console.error(
        "[Food Analysis] Fallback model error:",
        fallbackError.message
      );
    }

    return {
      foodName: "Unable to identify",
      bpImpact: "low",
      message:
        "Could not analyze this food image. Please try again with a clearer photo, or use voice to describe your meal.",
    };
  }
}

/**
 * Fallback: use Maverick model (more capable but slower)
 */
async function analyzeFoodFallback(imageBuffer: Buffer): Promise<FoodAnalysis> {
  const groq = getGroqClient();
  const base64Image = imageBuffer.toString("base64");

  const response = await groq.chat.completions.create({
    model: "meta-llama/llama-4-maverick-17b-128e-instruct",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`,
            },
          },
          {
            type: "text",
            text: `Identify this food and estimate its nutritional content. Return ONLY valid JSON: {"foodName":"name","calories":number,"sodium":number,"bpImpact":"low"|"moderate"|"high","details":"brief description"}`,
          },
        ],
      },
    ],
    temperature: 0.3,
    max_tokens: 300,
  });

  const content = response.choices[0].message.content || "{}";
  console.log("[Food Analysis Fallback] Raw response:", content);

  let jsonStr = content.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }
  const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    jsonStr = braceMatch[0];
  }

  const parsed = JSON.parse(jsonStr);
  const sodium = parsed.sodium || 0;
  let bpImpact: "low" | "moderate" | "high" = parsed.bpImpact || "low";

  let message = parsed.details || "Food analyzed successfully.";
  if (sodium > 1500) {
    bpImpact = "high";
    message = `High sodium content (~${sodium}mg). Consider reducing salt intake.`;
  } else if (sodium > 800) {
    bpImpact = "moderate";
    message = `Moderate sodium (~${sodium}mg). Watch your salt for the rest of the day.`;
  }

  return {
    foodName: parsed.foodName || "Food item",
    calories: parsed.calories || 0,
    sodium,
    bpImpact,
    message,
  };
}
