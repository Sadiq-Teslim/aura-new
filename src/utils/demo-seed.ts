import { DailyReading, Baseline } from "../types";
import { dataStore } from "../store/supabase-store";

/**
 * Demo seeded data for hackathon presentation
 * Pre-loads 6 days of worsening data to trigger alerts
 */
export const DEMO_READINGS: DailyReading[] = [
  { date: "2026-02-15", hrv: 52, sedentaryHours: 5, sleepQuality: 8 },
  { date: "2026-02-16", hrv: 49, sedentaryHours: 6, sleepQuality: 7 },
  { date: "2026-02-17", hrv: 47, sedentaryHours: 7, sleepQuality: 6 },
  { date: "2026-02-18", hrv: 44, sedentaryHours: 7, sleepQuality: 5 },
  { date: "2026-02-19", hrv: 41, sedentaryHours: 8, sleepQuality: 5 },
  { date: "2026-02-20", hrv: 38, sedentaryHours: 9, sleepQuality: 4 },
  // Live rPPG reading on demo day (~35ms HRV) will trigger the alert
];

export const DEMO_BASELINE: Baseline = {
  hrv: 55,
  sedentaryHours: 5,
  sleepQuality: 8,
};

/**
 * Seed demo data for a user
 * Call this during onboarding or demo setup
 */
export async function seedDemoData(userId: string): Promise<void> {
  // Set baseline
  await dataStore.setBaseline(userId, DEMO_BASELINE);

  // Add historical readings
  for (const reading of DEMO_READINGS) {
    await dataStore.addReading(userId, reading);
  }
}

