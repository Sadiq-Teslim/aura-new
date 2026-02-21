// Core Health Data Types
export interface DailyReading {
  date: string;
  hrv: number;
  heartRate?: number;
  sedentaryHours: number;
  sleepQuality: number; // 0-10
  screenStressIndex?: number;
  foodImpact?: number;
}

export interface Baseline {
  hrv: number;
  sedentaryHours: number;
  sleepQuality: number;
  screenStressIndex?: number;
}

export interface CSSResult {
  score: number;
  trend: "improving" | "stable" | "worsening";
  worseningDays: number;
  shouldAlert: boolean;
  hrvDelta: number; // % change from baseline
}

export interface HealthContext {
  css: number;
  trend: "improving" | "stable" | "worsening";
  hrv: number;
  hrvBaseline: number;
  hrvDelta: number;
  sedentaryHours: number;
  sleepQuality: number;
  worseningDays: number;
  screenStressIndex?: number;
}

// User Types
export interface User {
  id: string;
  name: string;
  age: number;
  biologicalSex: "male" | "female" | "other";
  preferredLanguage: "en" | "pcm" | "yo" | "ig" | "ha" | "fr";
  hasHypertension?: boolean;
  medications?: string[];
  smokes?: boolean;
  drinksAlcohol?: boolean;
  activityLevel?: "low" | "moderate" | "high";
  averageSleepHours?: number;
  familyHistoryHeartDisease?: boolean;
  smartwatchConnected?: boolean;
  smartwatchType?: "apple" | "google" | "samsung" | "fitbit";
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingData {
  name: string;
  age: number;
  biologicalSex: "male" | "female" | "other";
  preferredLanguage: "en" | "pcm" | "yo" | "ig" | "ha" | "fr";
  hasHypertension?: boolean;
  medications?: string[];
  smokes?: boolean;
  drinksAlcohol?: boolean;
  activityLevel?: "low" | "moderate" | "high";
  averageSleepHours?: number;
  familyHistoryHeartDisease?: boolean;
  smartwatchConnected?: boolean;
  smartwatchType?: "apple" | "google" | "samsung" | "fitbit";
}

// Food Analysis Types
export interface FoodAnalysis {
  foodName: string;
  calories?: number;
  sodium?: number;
  bpImpact: "low" | "moderate" | "high";
  message: string;
}

// Medical Records Types
export interface MedicalRecord {
  id: string;
  userId: string;
  fileName: string;
  extractedData?: {
    diagnoses?: string[];
    medications?: string[];
    labResults?: Record<string, any>;
    bpReadings?: Array<{ date: string; systolic: number; diastolic: number }>;
  };
  uploadedAt: string;
}

// API Request/Response Types
export interface TranscribeRequest {
  audio: File;
}

export interface TranscribeResponse {
  text: string;
  language: string;
}

export interface RespondRequest {
  transcript: string;
  language: string;
  healthContext: HealthContext;
}

export interface RespondResponse {
  text: string;
  language: string;
}

export interface SpeakRequest {
  text: string;
  language: string;
}

export interface SleepExtractRequest {
  transcript: string;
  language: string;
}

export interface SleepExtractResponse {
  sleepQuality: number; // 0-10
  extractedInfo: string;
}

// Medication Types
export interface Medication {
  id: string;
  userId: string;
  name: string;
  affectsBP: boolean;
  dailyReminder: boolean;
  reminderTime?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MedicationLog {
  id: string;
  medicationId: string;
  userId: string;
  takenAt: string;
  date: string;
}

// Home Screen Types
export interface HomeScreenData {
  healthPulse: string; // Plain language status
  hasMedicationReminder: boolean;
  medicationReminders: Array<{
    name: string;
    time?: string;
  }>;
  recentActivity: string; // One-line summary
  css: {
    score: number;
    trend: "improving" | "stable" | "worsening";
  };
  lastReading?: {
    date: string;
    hrv: number;
    heartRate?: number;
  };
}

// Lifestyle Insights Types
export interface LifestyleInsight {
  summary: string; // Narrative paragraph
  recommendation: string; // Actionable advice
  weekStats: {
    sleepDisruptedNights: number;
    averageSedentaryHours: number;
    highSodiumMeals: number;
    averageCSS: number;
  };
}

// BP Check Types
export interface BPReadingResult {
  reading: {
    systolic: number;
    diastolic: number;
    hrv: number;
    heartRate?: number;
    date: string;
  };
  context: {
    comparedToAverage: "normal" | "elevated" | "lower";
    message: string;
    recommendation: string;
  };
  category: {
    category: string;
    risk: "low" | "moderate" | "high";
  };
}

