import { Router, Request, Response } from "express";
import multer from "multer";
import { analyzeFood } from "../services/logmeal.service";
import { dataStore } from "../store/supabase-store";
import { transcribeAudio } from "../services/groq.service";

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

      // Personalize the message based on user's BP if available
      let personalizedMessage = analysis.message || analysis.details || "";
      if (userId) {
        try {
          const user = await dataStore.getUser(userId);
          const bpReadings = await dataStore.getBPReadings(userId, 7);
          
          if (bpReadings.length > 0 && user) {
            const latestBP = bpReadings[0];
            const avgSystolic = bpReadings.reduce((sum, r) => sum + r.systolic, 0) / bpReadings.length;
            const avgDiastolic = bpReadings.reduce((sum, r) => sum + r.diastolic, 0) / bpReadings.length;
            
            // Determine user's BP status
            const isHypertensive = avgSystolic >= 130 || avgDiastolic >= 80;
            const isHighRisk = avgSystolic >= 140 || avgDiastolic >= 90;
            
            // Generate personalized message
            if (analysis.bpImpact === "high") {
              if (isHighRisk) {
                personalizedMessage = `⚠️ ${user.name}, with your recent BP averaging ${Math.round(avgSystolic)}/${Math.round(avgDiastolic)} mmHg, this high-sodium meal could significantly elevate your blood pressure. Consider a lighter alternative or drink extra water to help flush the sodium.`;
              } else if (isHypertensive) {
                personalizedMessage = `${user.name}, given your elevated BP trend (avg ${Math.round(avgSystolic)}/${Math.round(avgDiastolic)}), this meal's sodium content may worsen your readings. Try to balance with potassium-rich foods today.`;
              } else {
                personalizedMessage = `This meal is high in sodium. While your BP is currently stable (${latestBP.systolic}/${latestBP.diastolic}), frequent high-sodium meals can lead to elevated blood pressure over time.`;
              }
            } else if (analysis.bpImpact === "moderate") {
              if (isHypertensive) {
                personalizedMessage = `${user.name}, this meal has moderate BP impact. With your readings averaging ${Math.round(avgSystolic)}/${Math.round(avgDiastolic)}, consider reducing portions or avoiding added salt.`;
              } else {
                personalizedMessage = `This meal has moderate sodium content. Your recent BP (${latestBP.systolic}/${latestBP.diastolic}) is in a healthy range - keep maintaining balanced meals.`;
              }
            } else {
              if (isHypertensive) {
                personalizedMessage = `Great choice, ${user.name}! This heart-healthy meal can help with your BP management. Your readings have been averaging ${Math.round(avgSystolic)}/${Math.round(avgDiastolic)} - meals like this can help bring that down.`;
              } else {
                personalizedMessage = `Excellent choice! This meal supports healthy blood pressure. Your recent reading of ${latestBP.systolic}/${latestBP.diastolic} is great - keep it up!`;
              }
            }
          }
        } catch (e) {
          // User data not available, use default message
          console.warn("Could not personalize food impact:", e);
        }

        const today = new Date().toISOString().split("T")[0];
        await dataStore.addFoodLog({
          userId,
          date: today,
          foodName: analysis.foodName,
          calories: analysis.calories,
          sodium: analysis.sodium,
          bpImpact: analysis.bpImpact,
          method: "camera",
        });

        // Update today's reading with food impact
        const readings = await dataStore.getReadings(userId);
        const todayReading = readings.find((r) => r.date === today);
        if (todayReading) {
          // Convert bpImpact to foodImpact score (0-1)
          const foodImpact =
            analysis.bpImpact === "high"
              ? 0.8
              : analysis.bpImpact === "moderate"
              ? 0.4
              : 0.1;
          todayReading.foodImpact = foodImpact;
          await dataStore.addReading(userId, todayReading);
        }
      }

      res.json({
        success: true,
        data: {
          ...analysis,
          message: personalizedMessage,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: { message: error.message, code: "FOOD_ANALYSIS_ERROR" },
      });
    }
  }
);

/**
 * POST /api/food/voice
 * Screen 9: Log food via voice description
 */
router.post(
  "/voice",
  upload.single("audio"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: { message: "Audio file is required", code: "MISSING_AUDIO" },
        });
      }

      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: { message: "User ID is required", code: "MISSING_USER_ID" },
        });
      }

      // Transcribe voice description
      const audioFile = new File([req.file.buffer], req.file.originalname, {
        type: req.file.mimetype,
      });
      const { text, language } = await transcribeAudio(audioFile);

      // Use Groq to extract food info from description
      const user = await dataStore.getUser(userId);
      const { generateResponse } = await import("../services/groq.service");
      const { getHealthContext } = await import("../utils/css-engine");
      const readings = await dataStore.getReadings(userId);
      const baseline = await dataStore.getBaseline(userId);
      const healthContext = getHealthContext(readings, baseline || null) as any;

      const extractionPrompt = `Extract food information from this description: "${text}"

Return JSON with:
{
  "foodName": "name of food",
  "calories": number (estimate),
  "sodium": number in mg (estimate),
  "bpImpact": "low" | "moderate" | "high"
}`;

      const extracted = await generateResponse(
        extractionPrompt,
        language,
        healthContext,
        userId
      );

      // Parse extracted data
      let analysis;
      try {
        const parsed = JSON.parse(extracted);
        const sodium = parsed.sodium || 0;
        let bpImpact: "low" | "moderate" | "high" = "low";
        let message = "Food logged successfully.";

        if (sodium > 2000) {
          bpImpact = "high";
        } else if (sodium > 1000) {
          bpImpact = "moderate";
        }

        // Get user's BP readings for personalization
        const bpReadings = await dataStore.getBPReadings(userId, 7);
        
        if (bpReadings.length > 0 && user) {
          const latestBP = bpReadings[0];
          const avgSystolic = bpReadings.reduce((sum, r) => sum + r.systolic, 0) / bpReadings.length;
          const avgDiastolic = bpReadings.reduce((sum, r) => sum + r.diastolic, 0) / bpReadings.length;
          
          const isHypertensive = avgSystolic >= 130 || avgDiastolic >= 80;
          const isHighRisk = avgSystolic >= 140 || avgDiastolic >= 90;
          
          if (bpImpact === "high") {
            if (isHighRisk) {
              message = `⚠️ ${user.name}, with your BP averaging ${Math.round(avgSystolic)}/${Math.round(avgDiastolic)}, this high-sodium meal (${sodium}mg) could significantly elevate your blood pressure. Consider a lighter alternative.`;
            } else if (isHypertensive) {
              message = `${user.name}, this meal is high in sodium (${sodium}mg). Given your elevated BP trend (${Math.round(avgSystolic)}/${Math.round(avgDiastolic)}), try to balance with potassium-rich foods.`;
            } else {
              message = `This meal is high in sodium (${sodium}mg). Your BP is currently healthy (${latestBP.systolic}/${latestBP.diastolic}), but frequent high-sodium meals can elevate it over time.`;
            }
          } else if (bpImpact === "moderate") {
            if (isHypertensive) {
              message = `${user.name}, this meal has moderate sodium (${sodium}mg). With your BP at ${Math.round(avgSystolic)}/${Math.round(avgDiastolic)}, consider reducing portions.`;
            } else {
              message = `Moderate sodium content (${sodium}mg). Your BP is healthy at ${latestBP.systolic}/${latestBP.diastolic} - just be mindful of salt intake today.`;
            }
          } else {
            if (isHypertensive) {
              message = `Great choice, ${user.name}! This heart-healthy meal can help manage your BP (currently ${Math.round(avgSystolic)}/${Math.round(avgDiastolic)}).`;
            } else {
              message = `Excellent choice! This supports healthy BP. Your reading of ${latestBP.systolic}/${latestBP.diastolic} is great - keep it up!`;
            }
          }
        } else {
          // Default messages without personalization
          if (bpImpact === "high") {
            message = `This meal is high in sodium (${sodium}mg). It may elevate your blood pressure. Consider drinking water and reducing salt at your next meal.`;
          } else if (bpImpact === "moderate") {
            message = `This meal contains moderate sodium (${sodium}mg). Be mindful of your salt intake for the rest of the day.`;
          }
        }

        analysis = {
          foodName: parsed.foodName || "Unknown food",
          calories: parsed.calories || 0,
          sodium,
          bpImpact,
          message,
        };
      } catch {
        // Fallback
        analysis = {
          foodName: text.substring(0, 50),
          bpImpact: "low" as const,
          message: "Food logged. Unable to analyze sodium content from description.",
        };
      }

      // Store food log
      const today = new Date().toISOString().split("T")[0];
      await dataStore.addFoodLog({
        userId,
        date: today,
        foodName: analysis.foodName,
        calories: analysis.calories,
        sodium: analysis.sodium,
        bpImpact: analysis.bpImpact,
        method: "voice",
      });

      // Update today's reading
      const readings2 = await dataStore.getReadings(userId);
      const todayReading = readings2.find((r) => r.date === today);
      if (todayReading) {
        const foodImpact =
          analysis.bpImpact === "high"
            ? 0.8
            : analysis.bpImpact === "moderate"
            ? 0.4
            : 0.1;
        todayReading.foodImpact = foodImpact;
        await dataStore.addReading(userId, todayReading);
      }

      res.json({
        success: true,
        data: analysis,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: { message: error.message, code: "FOOD_VOICE_ERROR" },
      });
    }
  }
);

export default router;

