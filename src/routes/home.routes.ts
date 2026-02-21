import { Router, Request, Response } from "express";
import { dataStore } from "../store/supabase-store";
import { calculateCSS, getHealthContext } from "../utils/css-engine";
import { generateResponse } from "../services/groq.service";

const router = Router();

/**
 * GET /api/home/data
 * Get all data for home screen (Screen 7)
 */
router.get("/data", async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: { message: "User ID is required", code: "MISSING_USER_ID" },
      });
    }

    const user = await dataStore.getUser(userId as string);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: "User not found", code: "USER_NOT_FOUND" },
      });
    }

    const readings = await dataStore.getReadings(userId as string, 7);
    const baseline = await dataStore.getBaseline(userId as string);
    const medications = await dataStore.getMedications(userId as string);

    // Calculate CSS
    let css = { score: 0, trend: "stable" as "improving" | "stable" | "worsening" };
    if (baseline && readings.length > 0) {
      const cssResult = calculateCSS(readings, baseline);
      css = { score: cssResult.score, trend: cssResult.trend };
    }

    // Generate health pulse (plain language status)
    let healthPulse = "Welcome to Cor. Let's get your first reading.";
    if (readings.length > 0 && baseline) {
      const healthContext = getHealthContext(readings, baseline);
      try {
        const pulsePrompt = `Generate a short, warm, plain-language sentence (max 15 words) about the user's cardiovascular status this week. 
        CSS: ${css.score}/100, Trend: ${css.trend}, HRV change: ${healthContext.hrvDelta}%.
        Examples: "You've been steady this week" or "Your stress has been climbing" or "Your heart is showing signs of recovery".
        Respond ONLY with the sentence, no quotes, in ${user.preferredLanguage}.`;
        
        healthPulse = await generateResponse(
          pulsePrompt,
          user.preferredLanguage,
          healthContext as any
        );
      } catch (error) {
        // Fallback
        if (css.trend === "improving") {
          healthPulse = "Your cardiovascular health is improving this week.";
        } else if (css.trend === "worsening") {
          healthPulse = "Your stress has been climbing this week.";
        } else {
          healthPulse = "You've been steady this week.";
        }
      }
    }

    // Get recent activity summary
    const today = new Date().toISOString().split("T")[0];
    const todayReading = readings.find((r) => r.date === today);
    let recentActivity = "No activity data yet.";
    if (todayReading) {
      const sedentaryHours = todayReading.sedentaryHours;
      if (sedentaryHours > 8) {
        recentActivity = "You've been mostly sedentary today.";
      } else if (sedentaryHours > 4) {
        recentActivity = "You've had moderate activity today.";
      } else {
        recentActivity = "You've been active today.";
      }
    }

    // Get medication reminders
    const medicationReminders = medications
      .filter((m) => m.dailyReminder)
      .map((m) => ({
        name: m.name,
        time: m.reminderTime,
      }));

    // Get last reading
    const lastReading =
      readings.length > 0
        ? {
            date: readings[readings.length - 1].date,
            hrv: readings[readings.length - 1].hrv,
            heartRate: readings[readings.length - 1].heartRate,
          }
        : undefined;

    // Get today's tip (generate inline to avoid circular dependency)
    let todayTip = null;
    try {
      const { generateResponse } = await import("../services/groq.service");
      if (baseline && readings.length > 0) {
        const healthContext = getHealthContext(readings, baseline);
        const todayReading = readings[readings.length - 1];
        const tipPrompt = `Generate a short, actionable health tip (max 2 sentences) in ${user.preferredLanguage} based on:
        - CSS trend: ${healthContext.trend}
        - Sleep quality: ${todayReading.sleepQuality}/10
        - Sedentary hours: ${todayReading.sedentaryHours}
        
        Be specific. Examples: "Take a 10-minute walk after lunch" or "Aim for 7 hours of sleep tonight".
        Respond ONLY with the tip, no quotes.`;
        
        todayTip = await generateResponse(
          tipPrompt,
          user.preferredLanguage,
          healthContext as any,
          userId as string
        );
      }
    } catch {
      // Tip generation is optional
    }

    res.json({
      success: true,
      data: {
        healthPulse,
        hasMedicationReminder: medicationReminders.length > 0,
        medicationReminders,
        recentActivity,
        css,
        lastReading,
        todayTip, // Optional - can be null
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message, code: "HOME_DATA_ERROR" },
    });
  }
});

export default router;

