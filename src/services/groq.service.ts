import Groq from "groq-sdk";
import { HealthContext } from "../types";
import { dataStore } from "../store/supabase-store";

// Lazy initialization of Groq client to ensure env vars are loaded
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
 * Transcribe audio using Groq Whisper
 */
export async function transcribeAudio(audioFile: File): Promise<{
  text: string;
  language: string;
}> {
  try {
    const groq = getGroqClient();
    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-large-v3-turbo",
      response_format: "verbose_json",
    });

    return {
      text: transcription.text,
      language: (transcription as any).language || "en",
    };
  } catch (error: any) {
    throw new Error(`Groq transcription failed: ${error.message}`);
  }
}

/**
 * Generate AI response using Groq Llama
 * Now includes user's onboarding answers and medical records for context
 */
export async function generateResponse(
  transcript: string,
  language: string,
  healthContext: HealthContext,
  userId?: string,
): Promise<string> {
  try {
    // Get additional context if userId provided
    let additionalContext = "";
    if (userId) {
      const onboardingAnswers = await dataStore.getOnboardingAnswers(userId);
      const medicalRecords = await dataStore.getMedicalRecords(userId);
      const medications = await dataStore.getMedications(userId);

      if (onboardingAnswers.length > 0) {
        additionalContext += "\n\nUser's onboarding information:\n";
        onboardingAnswers.forEach((a) => {
          additionalContext += `- ${a.questionKey}: ${a.answerText}\n`;
        });
      }

      if (medicalRecords.length > 0) {
        additionalContext += "\n\nMedical records:\n";
        medicalRecords.forEach((r) => {
          if (r.extractedData) {
            if (r.extractedData.diagnoses?.length) {
              additionalContext += `- Diagnoses: ${r.extractedData.diagnoses.join(", ")}\n`;
            }
            if (r.extractedData.medications?.length) {
              additionalContext += `- Medications from records: ${r.extractedData.medications.join(", ")}\n`;
            }
          }
        });
      }

      if (medications.length > 0) {
        additionalContext += `\n\nCurrent medications: ${medications.map((m) => m.name).join(", ")}\n`;
      }
    }

    const systemPrompt = `You are Cor, the AI health companion built into the Cor mobile health app for African professionals. You speak like a knowledgeable friend, never a doctor.

ABOUT THE COR APP — YOU MUST KNOW AND REFERENCE THESE FEATURES:
Cor is a mobile health app that monitors and manages cardiovascular health. Here are its features that you MUST guide users to use:

1. CAMERA-BASED BP MEASUREMENT: Users measure blood pressure by placing their FINGER firmly over the phone's REAR CAMERA. The app uses photoplethysmography (rPPG) to detect heart rate, HRV, and estimate blood pressure from the camera feed. Steps: open BP Check from the home screen, place finger over rear camera covering the lens completely, hold still for 30 seconds, get results (systolic/diastolic BP, heart rate, HRV).

2. FOOD LOGGER: Users log meals by taking a photo with the camera OR describing food via text. The app analyzes the food's BP impact (high/moderate/low).

3. HEY COR VOICE ASSISTANT: This is YOU — the voice-activated AI companion. Users ask health questions and get personalized advice.

4. WAKE WORD: Users say "Hey Cor" to activate voice assistant hands-free. The mic toggle on the home screen enables/disables this.

5. HEALTH TRENDS & CSS: The app tracks a Cardiovascular Stress Score (CSS, 0-100) combining HRV, BP trends, sleep quality, and lifestyle factors.

6. MEDICATION TRACKING: Users log their medications and get reminders.

7. PROACTIVE ALERTS: The app sends health alerts when cardiovascular stress trends worsen.

CRITICAL RULES:
- When users want to measure/check BP, ALWAYS tell them: "Open BP Check, place your finger over the rear camera, hold still for 30 seconds, and I'll show you your reading"
- When users ask about food impact, guide them to the Food Logger
- When users ask what you/Cor can do, explain ALL the features above
- Always respond in the EXACT same language the user spoke (detected: ${language})
- If language is Yoruba, respond fully in Yoruba
- If language is Nigerian Pidgin, respond fully in Pidgin
- Never use clinical jargon or give medical diagnoses
- Be warm, specific, and actionable
- Reference the user's ACTUAL data when answering questions about their health
- Maximum 3 sentences per response
- You ARE the app — refer to "Cor" features and guide users to use them

Current user health context:
- Cardiovascular Stress Score (CSS): ${healthContext.css} / 100
- CSS trend: ${healthContext.trend} (improving / stable / worsening)
- HRV today: ${healthContext.hrv}ms (personal baseline: ${healthContext.hrvBaseline}ms)
- HRV change from baseline: ${healthContext.hrvDelta}%
- Sedentary hours today: ${healthContext.sedentaryHours}
- Sleep quality last night: ${healthContext.sleepQuality} / 10
- Consecutive worsening days: ${healthContext.worseningDays}
- Screen stress index: ${healthContext.screenStressIndex || 0}${(healthContext as any).additionalData || ""}${additionalContext}`;

    const groq = getGroqClient();
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: transcript,
        },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    return response.choices[0].message.content || "";
  } catch (error: any) {
    throw new Error(`Groq response generation failed: ${error.message}`);
  }
}

/**
 * Extract sleep quality from natural language response
 */
export async function extractSleepQuality(
  transcript: string,
  language: string,
): Promise<{ sleepQuality: number; extractedInfo: string }> {
  try {
    const systemPrompt = `You are a health data extraction assistant. Extract sleep quality information from the user's natural language response.

The user is speaking in ${language}. Respond in the same language.

Extract:
1. Sleep quality score (0-10, where 10 is perfect sleep)
2. A brief summary of what the user said about their sleep

Return ONLY a JSON object with this structure:
{
  "sleepQuality": <number 0-10>,
  "summary": "<brief summary in user's language>"
}`;

    const groq = getGroqClient();
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: transcript,
        },
      ],
      temperature: 0.3,
      max_tokens: 150,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content || "{}";
    const parsed = JSON.parse(content);

    return {
      sleepQuality: Math.max(0, Math.min(10, parsed.sleepQuality || 5)),
      extractedInfo:
        parsed.summary || "No specific sleep information extracted",
    };
  } catch (error: any) {
    // Fallback to neutral score if extraction fails
    return {
      sleepQuality: 5,
      extractedInfo: "Could not extract sleep information",
    };
  }
}

/**
 * Generate proactive alert message
 */
export async function generateProactiveAlert(
  language: string,
  healthContext: HealthContext,
): Promise<string> {
  try {
    const systemPrompt = `You are Cor, a proactive cardiovascular health companion.

The user's cardiovascular stress has been worsening for ${healthContext.worseningDays} consecutive days. 
Their CSS score is ${healthContext.css}/100, which indicates elevated risk.

Generate a proactive, warm, non-alarming alert message in ${language} that:
- Acknowledges the pattern you've observed
- Explains what it means in simple terms
- Provides 1-3 specific, actionable recommendations
- Never diagnoses or uses clinical jargon
- Maximum 4 sentences

Be warm, supportive, and actionable.`;

    const groq = getGroqClient();
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content:
            "Generate a proactive health alert based on my current trends.",
        },
      ],
      temperature: 0.7,
      max_tokens: 250,
    });

    return response.choices[0].message.content || "";
  } catch (error: any) {
    throw new Error(`Proactive alert generation failed: ${error.message}`);
  }
}
