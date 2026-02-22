import { Router, Request, Response } from "express";
import multer from "multer";
import { transcribeAudio, generateResponse } from "../services/groq.service";
import { textToSpeech } from "../services/yarngpt.service";
import { getHealthContext } from "../utils/css-engine";
import {
  validate,
  respondValidation,
  speakValidation,
} from "../middleware/validation";
import { dataStore } from "../store/supabase-store";
import { HealthContext } from "../types";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /api/voice/transcribe
 * Transcribe audio to text using Groq Whisper
 */
router.post(
  "/transcribe",
  upload.single("audio"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: { message: "Audio file is required", code: "MISSING_AUDIO" },
        });
      }

      // Convert buffer to File-like object for Groq SDK
      const audioFile = new File([req.file.buffer], req.file.originalname, {
        type: req.file.mimetype,
      });

      const result = await transcribeAudio(audioFile);

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: { message: error.message, code: "TRANSCRIPTION_ERROR" },
      });
    }
  },
);

/**
 * POST /api/voice/respond
 * Generate AI response using Groq Llama
 * Includes comprehensive user health context for personalized responses
 */
router.post(
  "/respond",
  validate(respondValidation),
  async (req: Request, res: Response) => {
    try {
      const { transcript, language, healthContext, userId } = req.body;

      // Build comprehensive context if userId provided
      let context: HealthContext;
      let additionalData = "";

      if (userId) {
        const readings = await dataStore.getReadings(userId);
        const baseline = await dataStore.getBaseline(userId);
        context = getHealthContext(readings, baseline || null) as HealthContext;

        // Get BP readings for trend context
        const bpReadings = await dataStore.getBPReadings(userId, 7);
        if (bpReadings.length > 0) {
          const avgSystolic =
            bpReadings.reduce((sum, r) => sum + r.systolic, 0) /
            bpReadings.length;
          const avgDiastolic =
            bpReadings.reduce((sum, r) => sum + r.diastolic, 0) /
            bpReadings.length;
          const latestBP = bpReadings[0];

          additionalData += `\nBP Data (last 7 days):
- Latest reading: ${latestBP.systolic}/${latestBP.diastolic} mmHg
- 7-day average: ${Math.round(avgSystolic)}/${Math.round(avgDiastolic)} mmHg
- Total readings this week: ${bpReadings.length}`;

          // Determine BP trend
          if (bpReadings.length >= 3) {
            const firstThree = bpReadings.slice(-3);
            const lastThree = bpReadings.slice(0, 3);
            const firstAvg =
              firstThree.reduce((sum, r) => sum + r.systolic, 0) / 3;
            const lastAvg =
              lastThree.reduce((sum, r) => sum + r.systolic, 0) / 3;
            const bpTrend =
              lastAvg > firstAvg + 5
                ? "increasing"
                : lastAvg < firstAvg - 5
                  ? "decreasing"
                  : "stable";
            additionalData += `\n- BP trend: ${bpTrend}`;
          }
        }

        // Get food logs for dietary context
        try {
          const { data: foodLogs } = await (
            await import("../config/supabase")
          ).supabase
            .from("food_logs")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(5);

          if (foodLogs && foodLogs.length > 0) {
            additionalData += `\n\nRecent meals:`;
            foodLogs.forEach((log: any) => {
              additionalData += `\n- ${log.food_name}: ${log.bp_impact} impact${log.sodium ? `, ${log.sodium}mg sodium` : ""}`;
            });
          }
        } catch (e) {
          // Food logs not available
        }

        // Add the additional data to context
        (context as any).additionalData = additionalData;
      } else {
        context = healthContext;
      }

      const responseText = await generateResponse(
        transcript,
        language,
        context,
        userId,
      );

      res.json({
        success: true,
        data: {
          text: responseText,
          language,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: { message: error.message, code: "RESPONSE_GENERATION_ERROR" },
      });
    }
  },
);

/**
 * POST /api/voice/speak
 * Convert text to speech using YarnGPT
 */
router.post(
  "/speak",
  validate(speakValidation),
  async (req: Request, res: Response) => {
    try {
      const { text, language } = req.body;

      const audioBuffer = await textToSpeech(text, language);

      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", audioBuffer.length);
      res.send(audioBuffer);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: { message: error.message, code: "TTS_ERROR" },
      });
    }
  },
);

export default router;
