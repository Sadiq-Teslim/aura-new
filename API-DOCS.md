# Cor Backend API Documentation

**Base URL:** `https://cor-api.onrender.com`

All responses follow a consistent envelope:

```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": { "message": "...", "code": "ERROR_CODE" } }
```

---

## Table of Contents

1. [Health Check](#1-health-check)
2. [Users](#2-users)
3. [Onboarding](#3-onboarding)
4. [First Reading (Baseline)](#4-first-reading-baseline)
5. [BP Check](#5-bp-check)
6. [Health Readings & Data](#6-health-readings--data)
7. [Food Analysis](#7-food-analysis)
8. [Voice Pipeline](#8-voice-pipeline)
9. [Medical Records](#9-medical-records)
10. [Medications](#10-medications)
11. [Home Dashboard](#11-home-dashboard)
12. [Lifestyle Insights](#12-lifestyle-insights)
13. [Utility (Trends, Reports, Sleep)](#13-utility)
14. [Daily Tip](#14-daily-tip)
15. [Settings](#15-settings)
16. [Pre-generated Audio](#16-pre-generated-audio)

---

## 1. Health Check

### `GET /health`

Quick liveness probe.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-21T22:00:00.000Z",
  "service": "Cor API"
}
```

---

## 2. Users

### `POST /api/users/onboard`

Create a new user with full onboarding data. This is the **first call** the frontend makes after completing the onboarding flow.

**Content-Type:** `application/json`

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | ✅ | User's name |
| `age` | `number` | ✅ | User's age |
| `biologicalSex` | `"male" \| "female" \| "other"` | ✅ | Biological sex |
| `preferredLanguage` | `"en" \| "pcm" \| "yo" \| "ig" \| "ha" \| "fr"` | ✅ | Language preference |
| `hasHypertension` | `boolean \| string` | ❌ | `"Yes"`, `"No"`, or `"Not sure"` |
| `medications` | `string \| string[]` | ❌ | Current medications |
| `smokes` | `boolean` | ❌ | Whether user smokes |
| `drinksAlcohol` | `boolean` | ❌ | Whether user drinks alcohol |
| `activityLevel` | `"low" \| "moderate" \| "high"` | ❌ | Activity level |
| `averageSleepHours` | `number` | ❌ | Average sleep hours per night |
| `familyHistoryHeartDisease` | `boolean` | ❌ | Family history of heart disease |
| `smartwatchConnected` | `boolean` | ❌ | Smartwatch connected |
| `smartwatchType` | `"apple" \| "google" \| "samsung" \| "fitbit"` | ❌ | Smartwatch type |
| `answers` | `Record<string, any>` | ❌ | Raw onboarding Q&A map for AI context |

**Example Request:**
```json
{
  "name": "Chidi",
  "age": 28,
  "biologicalSex": "male",
  "preferredLanguage": "en",
  "hasHypertension": "No",
  "medications": "No",
  "smokes": false,
  "drinksAlcohol": false,
  "activityLevel": "moderate",
  "averageSleepHours": 7
}
```

**Response `201`:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-here",
      "name": "Chidi",
      "age": 28,
      "biologicalSex": "male",
      "preferredLanguage": "en",
      "hasHypertension": false,
      "smokes": false,
      "drinksAlcohol": false,
      "activityLevel": "moderate",
      "averageSleepHours": 7,
      "createdAt": "2026-02-21T...",
      "updatedAt": "2026-02-21T..."
    }
  }
}
```

> ⚠️ **Save the `user.id`** — it is required for all subsequent API calls.

---

### `GET /api/users/:userId`

Get user profile by ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { /* full User object */ }
  }
}
```

---

### `PUT /api/users/:userId`

Update user profile fields. Pass only the fields you want to change.

**Request Body:** Any subset of User fields.

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { /* updated User object */ }
  }
}
```

---

## 3. Onboarding

### `POST /api/onboarding/answer`

Save an individual onboarding answer (for Groq AI context).

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | `string` | ✅ | User ID |
| `questionKey` | `string` | ✅ | Question identifier (e.g. `"name"`, `"age"`, `"highBP"`) |
| `answer` | `any` | ✅ | The user's answer |

**Response:**
```json
{ "success": true, "message": "Answer saved" }
```

---

### `GET /api/onboarding/answers?userId=<userId>`

Get all onboarding answers for a user.

**Query Params:** `userId` (required)

**Response:**
```json
{
  "success": true,
  "data": {
    "answers": [
      { "questionKey": "name", "answer": "Chidi", "rawAnswer": "Chidi" },
      { "questionKey": "age", "answer": "28", "rawAnswer": 28 }
    ]
  }
}
```

---

## 4. First Reading (Baseline)

### `POST /api/first-reading`

Establish the user's HRV baseline. Called once during onboarding (Screen 6).

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | `string` | ✅ | User ID |
| `hrv` | `number` | ✅ | HRV value in ms (from rPPG) |
| `heartRate` | `number` | ❌ | Heart rate in bpm |

**Example Request:**
```json
{ "userId": "uuid", "hrv": 52, "heartRate": 74 }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Your heart rate looks normal. Your HRV suggests low stress today.",
    "hrvStatus": "normal",
    "reading": {
      "hrv": 52,
      "heartRate": 74,
      "date": "2026-02-21"
    },
    "bpEstimate": {
      "systolic": 118,
      "diastolic": 76,
      "confidence": 0.72
    }
  }
}
```

`hrvStatus` is one of: `"normal"`, `"low"`, `"high"`.

---

## 5. BP Check

### `POST /api/bp-check`

Submit an HRV reading for BP estimation with contextual comparison against user's history.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | `string` | ✅ | User ID |
| `hrv` | `number` | ✅ | HRV value in ms |
| `heartRate` | `number` | ❌ | Heart rate in bpm |
| `feelingNote` | `string` | ❌ | How the user is feeling (e.g. `"Good"`, `"Okay"`, `"Off"`) |

**Example Request:**
```json
{ "userId": "uuid", "hrv": 46, "heartRate": 79, "feelingNote": "Okay" }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reading": {
      "systolic": 126,
      "diastolic": 82,
      "hrv": 46,
      "heartRate": 79,
      "date": "2026-02-21"
    },
    "context": {
      "comparedToAverage": "elevated",
      "message": "Your reading today is slightly elevated compared to your average this week.",
      "recommendation": "Monitor your stress levels and consider lifestyle adjustments."
    },
    "category": {
      "category": "Elevated",
      "risk": "moderate"
    }
  }
}
```

`comparedToAverage` is one of: `"normal"`, `"elevated"`, `"lower"`.

---

## 6. Health Readings & Data

### `POST /api/health/readings`

Submit a daily health reading (from rPPG or manual).

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | `string` | ✅ | User ID |
| `hrv` | `number` | ✅ | HRV value in ms |
| `heartRate` | `number` | ❌ | Heart rate in bpm |
| `date` | `string` | ❌ | `YYYY-MM-DD` (defaults to today) |
| `sedentaryHours` | `number` | ✅ | Hours spent sedentary |
| `sleepQuality` | `number` | ✅ | Sleep quality 0–10 |
| `screenStressIndex` | `number` | ❌ | Screen stress 0–1 |
| `foodImpact` | `number` | ❌ | Food impact 0–1 |

**Response:**
```json
{
  "success": true,
  "data": {
    "reading": { /* DailyReading */ },
    "bpEstimate": {
      "systolic": 120,
      "diastolic": 78,
      "confidence": 0.7,
      "category": "Normal",
      "risk": "low"
    }
  }
}
```

---

### `GET /api/health/readings?userId=<userId>&days=<days>`

Get health readings.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `userId` | `string` | ✅ | — | User ID |
| `days` | `number` | ❌ | all | Limit to last N days |

**Response:**
```json
{
  "success": true,
  "data": {
    "readings": [
      { "date": "2026-02-21", "hrv": 52, "heartRate": 74, "sedentaryHours": 5, "sleepQuality": 7 }
    ]
  }
}
```

---

### `POST /api/health/baseline`

Set or update the user's baseline.

**Request Body:**
```json
{
  "userId": "uuid",
  "baseline": {
    "hrv": 52,
    "sedentaryHours": 5,
    "sleepQuality": 7,
    "screenStressIndex": 0.3
  }
}
```

**Response:**
```json
{ "success": true, "data": { "baseline": { /* Baseline */ } } }
```

---

### `GET /api/health/baseline?userId=<userId>`

Get user's baseline.

**Response:**
```json
{ "success": true, "data": { "baseline": { "hrv": 52, "sedentaryHours": 5, "sleepQuality": 7 } } }
```

---

### `GET /api/health/css?userId=<userId>`

Calculate and return the Cardiovascular Stress Score.

**Response:**
```json
{
  "success": true,
  "data": {
    "css": {
      "score": 42,
      "trend": "worsening",
      "worseningDays": 3,
      "shouldAlert": false,
      "hrvDelta": -12.5
    },
    "healthContext": {
      "css": 42,
      "trend": "worsening",
      "hrv": 46,
      "hrvBaseline": 52,
      "hrvDelta": -12.5,
      "sedentaryHours": 7,
      "sleepQuality": 5,
      "worseningDays": 3
    }
  }
}
```

---

### `POST /api/health/alert`

Check if a proactive alert should fire. If yes, generates an AI-written alert message.

**Request Body:**
```json
{ "userId": "uuid" }
```

**Response (alert triggered):**
```json
{
  "success": true,
  "data": {
    "shouldAlert": true,
    "message": "Your cardiovascular stress has been elevated for 6 days...",
    "css": { /* CSSResult */ }
  }
}
```

**Response (no alert):**
```json
{ "success": true, "data": { "shouldAlert": false, "message": "No alert needed at this time" } }
```

---

### `POST /api/health/bp-estimate`

Estimate BP from HRV (standalone, without saving).

**Request Body:**
```json
{ "userId": "uuid", "hrv": 46 }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "systolic": 126,
    "diastolic": 82,
    "confidence": 0.68,
    "category": "Elevated",
    "risk": "moderate",
    "disclaimer": "This is an estimation based on HRV trends..."
  }
}
```

---

### `GET /api/health/alerts?userId=<userId>&days=<days>`

Get alert history.

| Param | Default |
|-------|---------|
| `days` | `30` |

**Response:**
```json
{
  "success": true,
  "data": {
    "alerts": [
      { "date": "2026-02-20", "hasAlerted": true, "createdAt": "..." }
    ]
  }
}
```

---

## 7. Food Analysis

### `POST /api/food/analyze`

Analyze a food image using Groq Vision (Llama 4 Scout/Maverick).

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `image` | `File` | ✅ | Food image (JPEG, PNG, WebP) |
| `userId` | `string` | ❌ | User ID (saves food log if provided) |

**Example (JavaScript):**
```javascript
const fd = new FormData();
fd.append('image', file);
fd.append('userId', 'uuid');
fetch('/api/food/analyze', { method: 'POST', body: fd });
```

**Response:**
```json
{
  "success": true,
  "data": {
    "foodName": "Jollof Rice with Chicken",
    "calories": 520,
    "sodium": 1800,
    "potassium": 450,
    "bpImpact": "high",
    "message": "This meal is high in sodium (1800mg). It may elevate your blood pressure..."
  }
}
```

`bpImpact` is one of: `"low"`, `"moderate"`, `"high"`.

---

### `POST /api/food/voice`

Log food via voice description. Audio is transcribed, then analyzed by AI.

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `audio` | `File` | ✅ | Audio file (webm, ogg, mp4, wav) |
| `userId` | `string` | ✅ | User ID |

**Response:** Same shape as `/api/food/analyze`.

---

## 8. Voice Pipeline

### `POST /api/voice/transcribe`

Transcribe audio to text using Groq Whisper.

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `audio` | `File` | ✅ | Audio file |

**Response:**
```json
{
  "success": true,
  "data": {
    "text": "How is my blood pressure today?",
    "language": "en"
  }
}
```

---

### `POST /api/voice/respond`

Generate an AI health response using Groq Llama.

**Content-Type:** `application/json`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `transcript` | `string` | ✅ | The user's spoken text |
| `language` | `string` | ✅ | Language code (`en`, `yo`, `ha`, etc.) |
| `healthContext` | `object` | ❌ | Manually provided health context |
| `userId` | `string` | ❌ | If provided, context is auto-fetched from DB |

**Example Request:**
```json
{
  "transcript": "How is my heart today?",
  "language": "en",
  "userId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "text": "Your heart has been steady this week. Your stress levels are slightly elevated...",
    "language": "en"
  }
}
```

---

### `POST /api/voice/speak`

Convert text to speech using YarnGPT. Returns raw audio bytes.

**Content-Type:** `application/json`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | `string` | ✅ | Text to convert to speech |
| `language` | `string` | ✅ | Language code |

**Response:** Binary audio data (`Content-Type: audio/mpeg`).

**Frontend usage:**
```javascript
const res = await fetch('/api/voice/speak', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: "Hello", language: "en" })
});
const arrayBuffer = await res.arrayBuffer();
// Decode and play with Web Audio API
```

---

## 9. Medical Records

### `POST /api/medical/upload`

Upload a medical record (PDF or image). Groq extracts structured data from text files.

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | `File` | ✅ | PDF, image, or text file |
| `userId` | `string` | ✅ | User ID |

**Response:**
```json
{
  "success": true,
  "data": {
    "record": {
      "id": "record_1708...",
      "userId": "uuid",
      "fileName": "results.pdf",
      "extractedData": {
        "diagnoses": ["Hypertension Stage 1"],
        "medications": ["Lisinopril 10mg"],
        "labResults": { "cholesterol": "220mg/dL" },
        "bpReadings": [{ "date": "2026-01-15", "systolic": 135, "diastolic": 88 }]
      },
      "uploadedAt": "2026-02-21T..."
    }
  }
}
```

---

### `GET /api/medical/records?userId=<userId>`

Get all medical records for a user.

**Response:**
```json
{
  "success": true,
  "data": {
    "records": [ /* array of MedicalRecord */ ]
  }
}
```

---

## 10. Medications

### `GET /api/medications?userId=<userId>`

Get all medications for a user.

**Response:**
```json
{
  "success": true,
  "data": {
    "medications": [
      {
        "id": "uuid",
        "userId": "uuid",
        "name": "Lisinopril 10mg",
        "affectsBP": true,
        "dailyReminder": true,
        "reminderTime": "20:00",
        "createdAt": "...",
        "updatedAt": "..."
      }
    ]
  }
}
```

---

### `POST /api/medications`

Add a new medication. The backend auto-detects if the medication affects BP.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | `string` | ✅ | User ID |
| `name` | `string` | ✅ | Medication name |
| `affectsBP` | `boolean` | ❌ | Override auto-detection |
| `dailyReminder` | `boolean` | ❌ | Enable daily reminder |
| `reminderTime` | `string` | ❌ | Reminder time (e.g. `"20:00"`) |

**Response:**
```json
{
  "success": true,
  "data": {
    "medication": { /* Medication object */ },
    "message": "This medication can raise blood pressure in some people. I'll factor this into your monitoring."
  }
}
```

---

### `PUT /api/medications/:medicationId`

Update a medication. Pass only the fields you want to change.

**Request Body:** Any subset of `{ name, affectsBP, dailyReminder, reminderTime }`.

---

### `DELETE /api/medications/:medicationId`

Delete a medication.

**Response:**
```json
{ "success": true, "message": "Medication deleted successfully" }
```

---

### `POST /api/medications/:medicationId/log`

Log that a medication was taken.

**Request Body:**
```json
{ "userId": "uuid" }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "log": {
      "id": "uuid",
      "medicationId": "uuid",
      "userId": "uuid",
      "takenAt": "2026-02-21T20:00:00.000Z",
      "date": "2026-02-21"
    }
  }
}
```

---

### `GET /api/medications/logs?userId=<userId>&days=<days>`

Get medication intake logs.

| Param | Default |
|-------|---------|
| `days` | `7` |

**Response:**
```json
{ "success": true, "data": { "logs": [ /* MedicationLog[] */ ] } }
```

---

## 11. Home Dashboard

### `GET /api/home/data?userId=<userId>`

Get all data needed for the home screen in a single call.

**Response:**
```json
{
  "success": true,
  "data": {
    "healthPulse": "Your stress has been climbing this week.",
    "hasMedicationReminder": true,
    "medicationReminders": [
      { "name": "Lisinopril 10mg", "time": "20:00" }
    ],
    "recentActivity": "You've been mostly sedentary today.",
    "css": {
      "score": 42,
      "trend": "worsening"
    },
    "lastReading": {
      "date": "2026-02-21",
      "hrv": 46,
      "heartRate": 79
    },
    "todayTip": "Take a 15-minute walk after lunch to reduce stress."
  }
}
```

`healthPulse` and `todayTip` are AI-generated in the user's preferred language.

---

## 12. Lifestyle Insights

### `GET /api/lifestyle/insights?userId=<userId>`

Get weekly lifestyle narrative and stats.

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": "This week your sleep was disrupted on 3 nights and you were largely sedentary...",
    "recommendation": "Try a 15-minute walk tomorrow morning and aim for bed by 10pm.",
    "weekStats": {
      "sleepDisruptedNights": 3,
      "averageSedentaryHours": 7.2,
      "highSodiumMeals": 4,
      "averageCSS": 42
    }
  }
}
```

`summary` and `recommendation` are AI-generated in the user's preferred language.

---

## 13. Utility

### `POST /api/utility/sleep/extract`

Extract sleep quality score from natural language input (e.g. voice response).

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `transcript` | `string` | ✅ | Natural language sleep description |
| `language` | `string` | ✅ | Language code |
| `userId` | `string` | ❌ | If provided, updates today's reading |

**Example Request:**
```json
{ "transcript": "I slept about 5 hours, kept waking up", "language": "en", "userId": "uuid" }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sleepQuality": 4,
    "extractedInfo": "5 hours with interruptions"
  }
}
```

---

### `GET /api/utility/trends?userId=<userId>&days=<days>`

Get CSS trend data for chart visualization.

| Param | Default |
|-------|---------|
| `days` | `7` |

**Response:**
```json
{
  "success": true,
  "data": {
    "trends": [
      {
        "date": "2026-02-15",
        "css": 35,
        "hrv": 54,
        "sedentaryHours": 4,
        "sleepQuality": 8,
        "trend": "stable"
      }
    ],
    "baseline": { "hrv": 52, "sedentaryHours": 5, "sleepQuality": 7 },
    "summary": {
      "bestDay": { "date": "2026-02-18", "css": 28, "hrv": 58, "..." : "..." },
      "worstDay": { "date": "2026-02-20", "css": 55, "hrv": 42, "..." : "..." },
      "averageCSS": 42
    }
  }
}
```

---

### `POST /api/utility/clinical-share`

Generate a clinical-grade PDF health report for sharing with a doctor.

**Content-Type:** `application/json`

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userId` | `string` | ✅ | User ID |
| `days` | `number` | ❌ | Report period (default `7`) |

**Response:** Binary PDF data (`Content-Type: application/pdf`).

**Frontend usage:**
```javascript
const res = await fetch('/api/utility/clinical-share', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: 'uuid', days: 7 })
});
const blob = await res.blob();
const url = URL.createObjectURL(blob);
window.open(url); // or trigger download
```

---

## 14. Daily Tip

### `GET /api/tip/today?userId=<userId>`

Get today's personalized health tip (AI-generated).

**Response:**
```json
{
  "success": true,
  "data": {
    "tip": "Take a 10-minute walk after lunch to help manage stress.",
    "category": "activity",
    "language": "en"
  }
}
```

`category` is one of: `"general"`, `"stress_management"`, `"sleep"`, `"activity"`, `"maintenance"`.

---

## 15. Settings

### `GET /api/settings/:userId`

Get user settings.

**Response:**
```json
{
  "success": true,
  "data": {
    "language": "en",
    "wakeWordEnabled": true,
    "smartwatchConnected": false,
    "smartwatchType": null,
    "notificationsEnabled": true
  }
}
```

---

### `PUT /api/settings/:userId`

Update user settings.

**Request Body:**

| Field | Type | Description |
|-------|------|-------------|
| `language` | `string` | Language code |
| `wakeWordEnabled` | `boolean` | Enable "Hey Cor" |
| `smartwatchConnected` | `boolean` | Smartwatch status |
| `smartwatchType` | `string` | Smartwatch type |
| `notificationsEnabled` | `boolean` | Push notifications |

**Response:**
```json
{
  "success": true,
  "data": {
    "settings": { /* updated settings */ }
  }
}
```

---

## 16. Pre-generated Audio

### `GET /api/audio/:category/:language/:filename`

Serve pre-generated audio files (onboarding questions, instructions, confirmations).

**Path Params:**

| Param | Valid Values |
|-------|-------------|
| `category` | `onboarding`, `instructions`, `confirmations` |
| `language` | `en`, `yo`, `ha`, `pcm`, `ig`, `fr` |
| `filename` | Audio filename (e.g. `q1_name.mp3`) |

**Response:** Binary audio file.

**Example:**
```
GET /api/audio/onboarding/yo/q1_name.mp3
```

---

## Data Models Reference

### User
```typescript
{
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
```

### DailyReading
```typescript
{
  date: string;           // YYYY-MM-DD
  hrv: number;            // HRV in ms
  heartRate?: number;     // BPM
  sedentaryHours: number; // Hours
  sleepQuality: number;   // 0-10
  screenStressIndex?: number; // 0-1
  foodImpact?: number;    // 0-1
}
```

### Baseline
```typescript
{
  hrv: number;
  sedentaryHours: number;
  sleepQuality: number;
  screenStressIndex?: number;
}
```

### CSSResult
```typescript
{
  score: number;          // 0-100 (lower = better)
  trend: "improving" | "stable" | "worsening";
  worseningDays: number;
  shouldAlert: boolean;
  hrvDelta: number;       // % change from baseline
}
```

### FoodAnalysis
```typescript
{
  foodName: string;
  calories?: number;
  sodium?: number;        // mg
  potassium?: number;     // mg
  bpImpact: "low" | "moderate" | "high";
  message: string;
}
```

### Medication
```typescript
{
  id: string;
  userId: string;
  name: string;
  affectsBP: boolean;
  dailyReminder: boolean;
  reminderTime?: string;  // "HH:MM"
  createdAt: string;
  updatedAt: string;
}
```

### MedicalRecord
```typescript
{
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
```

---

## Error Codes

| Code | Meaning |
|------|---------|
| `MISSING_REQUIRED_FIELDS` | Required fields missing from request |
| `MISSING_FIELDS` | Specific required fields missing |
| `MISSING_USER_ID` | `userId` not provided |
| `MISSING_IMAGE` | Image file not uploaded |
| `MISSING_AUDIO` | Audio file not uploaded |
| `MISSING_FILE` | File not uploaded |
| `USER_NOT_FOUND` | User ID not found in DB |
| `NOT_FOUND` | Requested resource not found |
| `BASELINE_NOT_FOUND` | No baseline set for user |
| `INSUFFICIENT_DATA` | Not enough data for analysis |
| `USER_CREATION_ERROR` | Failed to create user |
| `BP_CHECK_ERROR` | BP check processing failed |
| `FOOD_ANALYSIS_ERROR` | Food analysis failed |
| `FOOD_VOICE_ERROR` | Voice food logging failed |
| `TRANSCRIPTION_ERROR` | Audio transcription failed |
| `RESPONSE_GENERATION_ERROR` | AI response generation failed |
| `TTS_ERROR` | Text-to-speech failed |
| `PDF_GENERATION_ERROR` | Clinical report generation failed |

---

## Supported Languages

| Code | Language |
|------|----------|
| `en` | English |
| `pcm` | Nigerian Pidgin |
| `yo` | Yoruba |
| `ig` | Igbo |
| `ha` | Hausa |
| `fr` | French |

---

## CORS

The API allows requests from any origin (`*`). No authentication headers are required.

## Rate Limits

No rate limits are enforced. For production, implement rate limiting per IP/user.

## File Upload Limits

Maximum upload size: **10 MB** (JSON and file uploads).

