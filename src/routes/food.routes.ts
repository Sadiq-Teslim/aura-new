import { Router, Request, Response } from "express";
import multer from "multer";
import { analyzeFood } from "../services/logmeal.service";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /api/food/analyze
 * Analyze food image using Logmeal API
 */
router.post(
  "/analyze",
  upload.single("image"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: { message: "Image file is required", code: "MISSING_IMAGE" },
        });
      }

      const { userId } = req.body;
      const imageBuffer = req.file.buffer;

      const analysis = await analyzeFood(imageBuffer);

      // Optionally store food impact in user's reading
      if (userId && analysis.bpImpact === "high") {
        // You could add this to today's reading
        // For now, just return the analysis
      }

      res.json({
        success: true,
        data: analysis,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: { message: error.message, code: "FOOD_ANALYSIS_ERROR" },
      });
    }
  }
);

export default router;

