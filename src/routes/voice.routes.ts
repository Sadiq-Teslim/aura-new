import { Router, Request, Response } from "express";
import multer from "multer";
import { transcribeAudio, generateResponse } from "../services/groq.service";
import { textToSpeech } from "../services/yarngpt.service";
import { getHealthContext } from "../utils/css-engine";
import { validate, respondValidation, speakValidation } from "../middleware/validation";
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
  }
);

/**
 * POST /api/voice/respond
 * Generate AI response using Groq Llama
 */
router.post(
  "/respond",
  validate(respondValidation),
  async (req: Request, res: Response) => {
    try {
      const { transcript, language, healthContext, userId } = req.body;

      // If userId provided, get actual health context from store
      let context: HealthContext;
      if (userId) {
        const readings = await dataStore.getReadings(userId);
        const baseline = await dataStore.getBaseline(userId);
        context = getHealthContext(readings, baseline || null) as HealthContext;
      } else {
        context = healthContext;
      }

      const responseText = await generateResponse(transcript, language, context);

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
  }
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
  }
);

export default router;

