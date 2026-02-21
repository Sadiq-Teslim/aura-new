import { Router, Request, Response } from "express";
import multer from "multer";
import { MedicalRecord } from "../types";
import { dataStore } from "../store/supabase-store";
import { generateResponse } from "../services/groq.service";
import { getHealthContext } from "../utils/css-engine";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /api/medical/upload
 * Upload medical records and extract relevant data
 */
router.post(
  "/upload",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: { message: "File is required", code: "MISSING_FILE" },
        });
      }

      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: { message: "User ID is required", code: "MISSING_USER_ID" },
        });
      }

      // Extract text from PDF/image using Groq (or OCR service)
      // For now, we'll use Groq to extract structured data
      const fileBuffer = req.file.buffer;
      const fileName = req.file.originalname;

      // Convert to text (simplified - in production use proper PDF parser)
      // For demo, we'll extract using Groq's vision capabilities if available
      // Otherwise, return a placeholder

      const record: MedicalRecord = {
        id: `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        fileName,
        extractedData: {
          // In production, use Groq or OCR to extract:
          // diagnoses, medications, lab results, BP readings
          diagnoses: [],
          medications: [],
          labResults: {},
          bpReadings: [],
        },
        uploadedAt: new Date().toISOString(),
      };

      // Try to extract data using Groq if it's text-based
      if (req.file.mimetype === "text/plain" || fileName.endsWith(".txt")) {
        try {
          const text = fileBuffer.toString("utf-8");
          const user = await dataStore.getUser(userId);
          const readings = await dataStore.getReadings(userId);
          const baseline = await dataStore.getBaseline(userId);
          const healthContext = getHealthContext(
            readings,
            baseline || null
          ) as any;

          // Use Groq to extract structured medical data
          const extractionPrompt = `Extract medical information from this text. Return JSON with:
{
  "diagnoses": ["list of diagnoses"],
  "medications": ["list of medications"],
  "labResults": {"key": "value"},
  "bpReadings": [{"date": "YYYY-MM-DD", "systolic": number, "diastolic": number}]
}`;

          const extracted = await generateResponse(
            extractionPrompt + "\n\n" + text.substring(0, 2000),
            user?.preferredLanguage || "en",
            healthContext
          );

          // Parse extracted data (simplified - in production use proper JSON parsing)
          try {
            const parsed = JSON.parse(extracted);
            record.extractedData = {
              diagnoses: parsed.diagnoses || [],
              medications: parsed.medications || [],
              labResults: parsed.labResults || {},
              bpReadings: parsed.bpReadings || [],
            };
          } catch {
            // If parsing fails, keep default empty structure
          }
        } catch (error) {
          console.error("Failed to extract medical data:", error);
        }
      }

      await dataStore.addMedicalRecord(userId, record);

      res.json({
        success: true,
        data: { record },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: { message: error.message, code: "MEDICAL_RECORD_ERROR" },
      });
    }
  }
);

/**
 * GET /api/medical/records
 * Get user's medical records
 */
router.get("/records", async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: { message: "User ID is required", code: "MISSING_USER_ID" },
      });
    }

    const records = await dataStore.getMedicalRecords(userId as string);

    res.json({
      success: true,
      data: { records },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message, code: "MEDICAL_RECORD_FETCH_ERROR" },
    });
  }
});

export default router;

