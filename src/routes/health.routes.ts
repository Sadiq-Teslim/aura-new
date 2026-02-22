import { Router, Request, Response } from "express";
import { calculateCSS, getHealthContext } from "../utils/css-engine";
import { validate, readingValidation } from "../middleware/validation";
import { dataStore } from "../store/supabase-store";
import { DailyReading, Baseline } from "../types";
import { estimateBPFromHRV, getBPCategory } from "../utils/bp-estimation";
import { supabase } from "../config/supabase";

const router = Router();

/**
 * POST /api/health/readings
 * Add a new health reading (from rPPG camera or manual input)
 * Automatically estimates BP from HRV if baseline exists
 */
router.post(
  "/readings",
  validate(readingValidation),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: { message: "User ID is required", code: "MISSING_USER_ID" },
        });
      }

      const reading: DailyReading = {
        date: req.body.date || new Date().toISOString().split("T")[0],
        hrv: req.body.hrv,
        heartRate: req.body.heartRate,
        sedentaryHours: req.body.sedentaryHours,
        sleepQuality: req.body.sleepQuality,
        screenStressIndex: req.body.screenStressIndex,
        foodImpact: req.body.foodImpact,
      };

      await dataStore.addReading(userId, reading);

      // Estimate BP from HRV if user and baseline exist
      let bpEstimate = null;
      try {
        const user = await dataStore.getUser(userId);
        const baseline = await dataStore.getBaseline(userId);
        if (user && baseline) {
          const estimate = estimateBPFromHRV(
            reading.hrv,
            baseline.hrv,
            user.age,
            user.biologicalSex
          );
          const category = getBPCategory(
            estimate.systolic,
            estimate.diastolic
          );
          bpEstimate = { ...estimate, ...category };
        }
      } catch (error) {
        // BP estimation is optional - don't fail if it doesn't work
        console.warn("BP estimation failed:", error);
      }

      res.json({
        success: true,
        data: {
          reading,
          ...(bpEstimate && { bpEstimate }),
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: { message: error.message, code: "READING_SAVE_ERROR" },
      });
    }
  }
);

/**
 * GET /api/health/readings
 * Get user's health readings
 */
router.get("/readings", async (req: Request, res: Response) => {
  try {
    const { userId, days } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: { message: "User ID is required", code: "MISSING_USER_ID" },
      });
    }

    const readings = await dataStore.getReadings(
      userId as string,
      days ? parseInt(days as string) : undefined
    );

    res.json({
      success: true,
      data: { readings },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message, code: "READING_FETCH_ERROR" },
    });
  }
});

/**
 * POST /api/health/baseline
 * Set or update user baseline
 */
router.post("/baseline", async (req: Request, res: Response) => {
  try {
    const { userId, baseline } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: { message: "User ID is required", code: "MISSING_USER_ID" },
      });
    }

    const baselineData: Baseline = {
      hrv: baseline.hrv,
      sedentaryHours: baseline.sedentaryHours,
      sleepQuality: baseline.sleepQuality,
      screenStressIndex: baseline.screenStressIndex,
    };

    await dataStore.setBaseline(userId, baselineData);

    res.json({
      success: true,
      data: { baseline: baselineData },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message, code: "BASELINE_SAVE_ERROR" },
    });
  }
});

/**
 * GET /api/health/baseline
 * Get user baseline
 */
router.get("/baseline", async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: { message: "User ID is required", code: "MISSING_USER_ID" },
      });
    }

    const baseline = await dataStore.getBaseline(userId as string);

    if (!baseline) {
      return res.status(404).json({
        success: false,
        error: { message: "Baseline not found", code: "BASELINE_NOT_FOUND" },
      });
    }

    res.json({
      success: true,
      data: { baseline },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message, code: "BASELINE_FETCH_ERROR" },
    });
  }
});

/**
 * GET /api/health/css
 * Calculate and return CSS score
 */
router.get("/css", async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: { message: "User ID is required", code: "MISSING_USER_ID" },
      });
    }

    const readings = await dataStore.getReadings(userId as string);
    const baseline = await dataStore.getBaseline(userId as string);

    if (!baseline) {
      return res.status(404).json({
        success: false,
        error: {
          message: "Baseline not found. Please set baseline first.",
          code: "BASELINE_NOT_FOUND",
        },
      });
    }

    const cssResult = calculateCSS(readings, baseline);
    const healthContext = getHealthContext(readings, baseline);

    res.json({
      success: true,
      data: {
        css: cssResult,
        healthContext,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message, code: "CSS_CALCULATION_ERROR" },
    });
  }
});

/**
 * POST /api/health/alert
 * Check if alert should trigger and generate alert message
 */
router.post("/alert", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: { message: "User ID is required", code: "MISSING_USER_ID" },
      });
    }

    const readings = await dataStore.getReadings(userId as string);
    const baseline = await dataStore.getBaseline(userId as string);
    const user = await dataStore.getUser(userId);
    const hasAlerted = await dataStore.getHasAlertedToday(userId);

    if (!baseline || !user) {
      return res.status(404).json({
        success: false,
        error: {
          message: "Baseline or user not found",
          code: "NOT_FOUND",
        },
      });
    }

    const cssResult = calculateCSS(readings, baseline);

    if (!cssResult.shouldAlert) {
      return res.json({
        success: true,
        data: {
          shouldAlert: false,
          message: "No alert needed at this time",
        },
      });
    }

    if (hasAlerted) {
      return res.json({
        success: true,
        data: {
          shouldAlert: true,
          alreadyAlerted: true,
          message: "Alert already sent today",
        },
      });
    }

    // Import here to avoid circular dependency
    const { generateProactiveAlert } = await import("../services/groq.service");
    const healthContext = getHealthContext(readings, baseline);

    const alertMessage = await generateProactiveAlert(
      user.preferredLanguage,
      healthContext as any
    );

    // Mark as alerted
    await dataStore.setHasAlertedToday(userId, true);

    res.json({
      success: true,
      data: {
        shouldAlert: true,
        message: alertMessage,
        css: cssResult,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message, code: "ALERT_GENERATION_ERROR" },
    });
  }
});

/**
 * POST /api/health/bp-estimate
 * Estimate BP from HRV reading
 */
router.post("/bp-estimate", async (req: Request, res: Response) => {
  try {
    const { userId, hrv } = req.body;

    if (!userId || !hrv) {
      return res.status(400).json({
        success: false,
        error: {
          message: "User ID and HRV are required",
          code: "MISSING_FIELDS",
        },
      });
    }

    const user = await dataStore.getUser(userId);
    const baseline = await dataStore.getBaseline(userId);

    if (!user || !baseline) {
      return res.status(404).json({
        success: false,
        error: {
          message: "User or baseline not found",
          code: "NOT_FOUND",
        },
      });
    }

    const estimate = estimateBPFromHRV(
      hrv,
      baseline.hrv,
      user.age,
      user.biologicalSex
    );
    const category = getBPCategory(estimate.systolic, estimate.diastolic);

    res.json({
      success: true,
      data: {
        ...estimate,
        ...category,
        disclaimer:
          "This is an estimation based on HRV trends, not a direct measurement. For clinical accuracy, please use a validated blood pressure monitor.",
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message, code: "BP_ESTIMATION_ERROR" },
    });
  }
});

/**
 * GET /api/health/alerts
 * Get alert history for user
 */
router.get("/alerts", async (req: Request, res: Response) => {
  try {
    const { userId, days = "30" } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: { message: "User ID is required", code: "MISSING_USER_ID" },
      });
    }

    // Get daily alerts from database
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days as string));

    const { data, error } = await supabase
      .from("daily_alerts")
      .select("*")
      .eq("user_id", userId)
      .eq("has_alerted", true)
      .gte("date", cutoffDate.toISOString().split("T")[0])
      .order("date", { ascending: false });

    if (error) throw new Error(`Failed to get alerts: ${error.message}`);

    const alerts = (data || []).map((a) => ({
      date: a.date,
      hasAlerted: a.has_alerted,
      createdAt: a.created_at,
    }));

    res.json({
      success: true,
      data: { alerts },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message, code: "ALERTS_FETCH_ERROR" },
    });
  }
});

/**
 * GET /api/health/bp-readings
 * Get user's BP reading history
 */
router.get("/bp-readings", async (req: Request, res: Response) => {
  try {
    const { userId, days } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: { message: "User ID is required", code: "MISSING_USER_ID" },
      });
    }

    const readings = await dataStore.getBPReadings(
      userId as string,
      days ? parseInt(days as string) : undefined
    );

    res.json({
      success: true,
      data: { readings },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message, code: "BP_READINGS_FETCH_ERROR" },
    });
  }
});

export default router;
