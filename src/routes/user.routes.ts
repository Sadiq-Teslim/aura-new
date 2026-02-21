import { Router, Request, Response } from "express";
import { dataStore } from "../store/supabase-store";
import { OnboardingData } from "../types";

const router = Router();

/**
 * POST /api/users/onboard
 * Create new user with onboarding data
 */
router.post("/onboard", async (req: Request, res: Response) => {
  try {
    const onboardingData: OnboardingData = req.body;

    // Validate required fields
    if (!onboardingData.name || !onboardingData.age || !onboardingData.biologicalSex || !onboardingData.preferredLanguage) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Name, age, biological sex, and preferred language are required",
          code: "MISSING_REQUIRED_FIELDS",
        },
      });
    }

    const user = await dataStore.createUser({
      name: onboardingData.name,
      age: onboardingData.age,
      biologicalSex: onboardingData.biologicalSex,
      preferredLanguage: onboardingData.preferredLanguage,
      hasHypertension: onboardingData.hasHypertension,
      medications: onboardingData.medications,
      smokes: onboardingData.smokes,
      drinksAlcohol: onboardingData.drinksAlcohol,
      activityLevel: onboardingData.activityLevel,
      averageSleepHours: onboardingData.averageSleepHours,
      familyHistoryHeartDisease: onboardingData.familyHistoryHeartDisease,
      smartwatchConnected: onboardingData.smartwatchConnected,
      smartwatchType: onboardingData.smartwatchType,
    });

    res.status(201).json({
      success: true,
      data: { user },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message, code: "USER_CREATION_ERROR" },
    });
  }
});

/**
 * GET /api/users/:userId
 * Get user by ID
 */
router.get("/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const user = await dataStore.getUser(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: "User not found", code: "USER_NOT_FOUND" },
      });
    }

    res.json({
      success: true,
      data: { user },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message, code: "USER_FETCH_ERROR" },
    });
  }
});

/**
 * PUT /api/users/:userId
 * Update user
 */
router.put("/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    const updated = await dataStore.updateUser(userId, updates);

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: { message: "User not found", code: "USER_NOT_FOUND" },
      });
    }

    res.json({
      success: true,
      data: { user: updated },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message, code: "USER_UPDATE_ERROR" },
    });
  }
});

export default router;

