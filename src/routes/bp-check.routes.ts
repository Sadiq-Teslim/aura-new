import { Router, Request, Response } from "express";
import { dataStore } from "../store/supabase-store";
import { estimateBPFromHRV, getBPCategory } from "../utils/bp-estimation";

const router = Router();

/**
 * POST /api/bp-check
 * Screen 8: BP Check - Manual reading with context
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const { userId, hrv, heartRate, feelingNote } = req.body;

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
    let baseline = await dataStore.getBaseline(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          message: "User not found",
          code: "USER_NOT_FOUND",
        },
      });
    }

    // If no baseline exists, create one automatically using current HRV
    if (!baseline) {
      baseline = {
        hrv: hrv, // Use current HRV as baseline
        sedentaryHours: 5,
        sleepQuality: 7,
      };
      // Save the auto-generated baseline
      await dataStore.setBaseline(userId, baseline);
    }

    // Estimate BP
    const estimate = estimateBPFromHRV(
      hrv,
      baseline.hrv,
      user.age,
      user.biologicalSex,
    );
    const category = getBPCategory(estimate.systolic, estimate.diastolic);

    // Get average BP from last 7 days for comparison
    const recentReadings = await dataStore.getBPReadings(userId, 7);
    let averageSystolic = estimate.systolic;
    let averageDiastolic = estimate.diastolic;
    let comparedToAverage: "normal" | "elevated" | "lower" = "normal";

    if (recentReadings.length > 0) {
      averageSystolic =
        recentReadings.reduce((sum, r) => sum + r.systolic, 0) /
        recentReadings.length;
      averageDiastolic =
        recentReadings.reduce((sum, r) => sum + r.diastolic, 0) /
        recentReadings.length;

      const systolicDiff = estimate.systolic - averageSystolic;
      if (systolicDiff > 5) {
        comparedToAverage = "elevated";
      } else if (systolicDiff < -5) {
        comparedToAverage = "lower";
      }
    }

    // Generate contextual message
    let message = "";
    let recommendation = "";

    if (comparedToAverage === "elevated") {
      message =
        "Your reading today is slightly elevated compared to your average this week. This is worth watching.";
      recommendation =
        "Monitor your stress levels and consider lifestyle adjustments.";
    } else if (comparedToAverage === "lower") {
      message =
        "Your reading today is lower than your average this week. Keep up the good work!";
      recommendation = "Continue maintaining your healthy habits.";
    } else {
      message = "Your reading today is consistent with your average this week.";
      recommendation = "You're maintaining a steady pattern.";
    }

    // Save BP reading
    const today = new Date().toISOString().split("T")[0];
    await dataStore.addBPReading({
      userId,
      date: today,
      systolic: estimate.systolic,
      diastolic: estimate.diastolic,
      hrv,
      heartRate,
      confidence: estimate.confidence,
      feelingNote,
    });

    // Also update the daily readings table so dashboard/history reflect new HR/HRV
    const existingReadings = await dataStore.getReadings(userId);
    const todayReading = existingReadings.find((r) => r.date === today);
    await dataStore.addReading(userId, {
      date: today,
      hrv,
      heartRate,
      sedentaryHours: todayReading?.sedentaryHours ?? 0,
      sleepQuality: todayReading?.sleepQuality ?? 7,
      screenStressIndex: todayReading?.screenStressIndex ?? undefined,
      foodImpact: todayReading?.foodImpact ?? undefined,
    });

    res.json({
      success: true,
      data: {
        reading: {
          systolic: estimate.systolic,
          diastolic: estimate.diastolic,
          hrv,
          heartRate,
          date: today,
        },
        context: {
          comparedToAverage,
          message,
          recommendation,
        },
        category,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message, code: "BP_CHECK_ERROR" },
    });
  }
});

export default router;
