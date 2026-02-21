import { supabase } from "../config/supabase";
import { User, DailyReading, Baseline, MedicalRecord } from "../types";

/**
 * Supabase database store
 * Replaces in-memory storage with persistent PostgreSQL database
 */
class SupabaseStore {
  // User operations
  async createUser(
    userData: Omit<User, "id" | "createdAt" | "updatedAt">
  ): Promise<User> {
    const { data, error } = await supabase
      .from("users")
      .insert({
        name: userData.name,
        age: userData.age,
        biological_sex: userData.biologicalSex,
        preferred_language: userData.preferredLanguage,
        has_hypertension: userData.hasHypertension,
        medications: userData.medications,
        smokes: userData.smokes,
        drinks_alcohol: userData.drinksAlcohol,
        activity_level: userData.activityLevel,
        average_sleep_hours: userData.averageSleepHours,
        family_history_heart_disease: userData.familyHistoryHeartDisease,
        smartwatch_connected: userData.smartwatchConnected,
        smartwatch_type: userData.smartwatchType,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create user: ${error.message}`);

    return this.mapUserFromDb(data);
  }

  async getUser(userId: string): Promise<User | null> {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null; // Not found
      throw new Error(`Failed to get user: ${error.message}`);
    }

    return data ? this.mapUserFromDb(data) : null;
  }

  async updateUser(
    userId: string,
    updates: Partial<User>
  ): Promise<User | null> {
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.age !== undefined) updateData.age = updates.age;
    if (updates.biologicalSex !== undefined)
      updateData.biological_sex = updates.biologicalSex;
    if (updates.preferredLanguage !== undefined)
      updateData.preferred_language = updates.preferredLanguage;
    if (updates.hasHypertension !== undefined)
      updateData.has_hypertension = updates.hasHypertension;
    if (updates.medications !== undefined)
      updateData.medications = updates.medications;
    if (updates.smokes !== undefined) updateData.smokes = updates.smokes;
    if (updates.drinksAlcohol !== undefined)
      updateData.drinks_alcohol = updates.drinksAlcohol;
    if (updates.activityLevel !== undefined)
      updateData.activity_level = updates.activityLevel;
    if (updates.averageSleepHours !== undefined)
      updateData.average_sleep_hours = updates.averageSleepHours;
    if (updates.familyHistoryHeartDisease !== undefined)
      updateData.family_history_heart_disease =
        updates.familyHistoryHeartDisease;
    if (updates.smartwatchConnected !== undefined)
      updateData.smartwatch_connected = updates.smartwatchConnected;
    if (updates.smartwatchType !== undefined)
      updateData.smartwatch_type = updates.smartwatchType;

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") return null; // Not found
      throw new Error(`Failed to update user: ${error.message}`);
    }

    return data ? this.mapUserFromDb(data) : null;
  }

  // Reading operations
  async addReading(userId: string, reading: DailyReading): Promise<void> {
    const { error } = await supabase.from("readings").upsert(
      {
        user_id: userId,
        date: reading.date,
        hrv: reading.hrv,
        heart_rate: reading.heartRate,
        sedentary_hours: reading.sedentaryHours,
        sleep_quality: reading.sleepQuality,
        screen_stress_index: reading.screenStressIndex,
        food_impact: reading.foodImpact,
      },
      { onConflict: "user_id,date" }
    );

    if (error) throw new Error(`Failed to add reading: ${error.message}`);
  }

  async getReadings(
    userId: string,
    days?: number
  ): Promise<DailyReading[]> {
    let query = supabase
      .from("readings")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: true });

    if (days) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      query = query.gte("date", cutoffDate.toISOString().split("T")[0]);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to get readings: ${error.message}`);

    return (data || []).map((r) => ({
      date: r.date,
      hrv: r.hrv,
      heartRate: r.heart_rate,
      sedentaryHours: r.sedentary_hours,
      sleepQuality: r.sleep_quality,
      screenStressIndex: r.screen_stress_index,
      foodImpact: r.food_impact,
    }));
  }

  // Baseline operations
  async setBaseline(userId: string, baseline: Baseline): Promise<void> {
    const { error } = await supabase
      .from("baselines")
      .upsert(
        {
          user_id: userId,
          hrv: baseline.hrv,
          sedentary_hours: baseline.sedentaryHours,
          sleep_quality: baseline.sleepQuality,
          screen_stress_index: baseline.screenStressIndex,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (error) throw new Error(`Failed to set baseline: ${error.message}`);
  }

  async getBaseline(userId: string): Promise<Baseline | null> {
    const { data, error } = await supabase
      .from("baselines")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null; // Not found
      throw new Error(`Failed to get baseline: ${error.message}`);
    }

    return data
      ? {
          hrv: data.hrv,
          sedentaryHours: data.sedentary_hours,
          sleepQuality: data.sleep_quality,
          screenStressIndex: data.screen_stress_index,
        }
      : null;
  }

  // Medical records
  async addMedicalRecord(
    userId: string,
    record: MedicalRecord
  ): Promise<void> {
    const { error } = await supabase.from("medical_records").insert({
      id: record.id,
      user_id: userId,
      file_name: record.fileName,
      extracted_data: record.extractedData,
      uploaded_at: record.uploadedAt,
    });

    if (error) throw new Error(`Failed to add medical record: ${error.message}`);
  }

  async getMedicalRecords(userId: string): Promise<MedicalRecord[]> {
    const { data, error } = await supabase
      .from("medical_records")
      .select("*")
      .eq("user_id", userId)
      .order("uploaded_at", { ascending: false });

    if (error) throw new Error(`Failed to get medical records: ${error.message}`);

    return (data || []).map((r) => ({
      id: r.id,
      userId: r.user_id,
      fileName: r.file_name,
      extractedData: r.extracted_data,
      uploadedAt: r.uploaded_at,
    }));
  }

  // Alert tracking
  async setHasAlertedToday(userId: string, value: boolean): Promise<void> {
    const today = new Date().toISOString().split("T")[0];
    const { error } = await supabase
      .from("daily_alerts")
      .upsert(
        {
          user_id: userId,
          date: today,
          has_alerted: value,
        },
        { onConflict: "user_id,date" }
      );

    if (error) throw new Error(`Failed to set alert flag: ${error.message}`);
  }

  async getHasAlertedToday(userId: string): Promise<boolean> {
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("daily_alerts")
      .select("has_alerted")
      .eq("user_id", userId)
      .eq("date", today)
      .single();

    if (error) {
      if (error.code === "PGRST116") return false; // Not found = not alerted
      throw new Error(`Failed to get alert flag: ${error.message}`);
    }

    return data?.has_alerted || false;
  }

  // Medications
  async getMedications(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from("medications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`Failed to get medications: ${error.message}`);
    return (data || []).map((m) => ({
      id: m.id,
      userId: m.user_id,
      name: m.name,
      affectsBP: m.affects_bp,
      dailyReminder: m.daily_reminder,
      reminderTime: m.reminder_time,
      createdAt: m.created_at,
      updatedAt: m.updated_at,
    }));
  }

  async addMedication(medication: any): Promise<any> {
    const { data, error } = await supabase
      .from("medications")
      .insert({
        user_id: medication.userId,
        name: medication.name,
        affects_bp: medication.affectsBP,
        daily_reminder: medication.dailyReminder,
        reminder_time: medication.reminderTime,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add medication: ${error.message}`);
    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      affectsBP: data.affects_bp,
      dailyReminder: data.daily_reminder,
      reminderTime: data.reminder_time,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async updateMedication(medicationId: string, updates: any): Promise<any> {
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.affectsBP !== undefined) updateData.affects_bp = updates.affectsBP;
    if (updates.dailyReminder !== undefined)
      updateData.daily_reminder = updates.dailyReminder;
    if (updates.reminderTime !== undefined)
      updateData.reminder_time = updates.reminderTime;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("medications")
      .update(updateData)
      .eq("id", medicationId)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Failed to update medication: ${error.message}`);
    }

    return data
      ? {
          id: data.id,
          userId: data.user_id,
          name: data.name,
          affectsBP: data.affects_bp,
          dailyReminder: data.daily_reminder,
          reminderTime: data.reminder_time,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        }
      : null;
  }

  async deleteMedication(medicationId: string): Promise<void> {
    const { error } = await supabase
      .from("medications")
      .delete()
      .eq("id", medicationId);

    if (error) throw new Error(`Failed to delete medication: ${error.message}`);
  }

  async logMedication(medicationId: string, userId: string): Promise<any> {
    const { data, error } = await supabase
      .from("medication_logs")
      .insert({
        medication_id: medicationId,
        user_id: userId,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to log medication: ${error.message}`);
    return {
      id: data.id,
      medicationId: data.medication_id,
      userId: data.user_id,
      takenAt: data.taken_at,
      date: data.date,
    };
  }

  async getMedicationLogs(userId: string, days: number): Promise<any[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data, error } = await supabase
      .from("medication_logs")
      .select("*")
      .eq("user_id", userId)
      .gte("date", cutoffDate.toISOString().split("T")[0])
      .order("taken_at", { ascending: false });

    if (error) throw new Error(`Failed to get medication logs: ${error.message}`);
    return (data || []).map((l) => ({
      id: l.id,
      medicationId: l.medication_id,
      userId: l.user_id,
      takenAt: l.taken_at,
      date: l.date,
    }));
  }

  // BP Readings
  async addBPReading(reading: any): Promise<void> {
    const { error } = await supabase.from("bp_readings").upsert(
      {
        user_id: reading.userId,
        date: reading.date,
        systolic: reading.systolic,
        diastolic: reading.diastolic,
        hrv: reading.hrv,
        heart_rate: reading.heartRate,
        confidence: reading.confidence,
        method: reading.method || "hrv_based",
        feeling_note: reading.feelingNote,
      },
      { onConflict: "user_id,date" }
    );

    if (error) throw new Error(`Failed to add BP reading: ${error.message}`);
  }

  async getBPReadings(userId: string, days?: number): Promise<any[]> {
    let query = supabase
      .from("bp_readings")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false });

    if (days) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      query = query.gte("date", cutoffDate.toISOString().split("T")[0]);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to get BP readings: ${error.message}`);
    return (data || []).map((r) => ({
      id: r.id,
      userId: r.user_id,
      date: r.date,
      systolic: r.systolic,
      diastolic: r.diastolic,
      hrv: r.hrv,
      heartRate: r.heart_rate,
      confidence: r.confidence,
      method: r.method,
      feelingNote: r.feeling_note,
      createdAt: r.created_at,
    }));
  }

  // Food Logs
  async addFoodLog(log: any): Promise<void> {
    const { error } = await supabase.from("food_logs").insert({
      user_id: log.userId,
      date: log.date,
      food_name: log.foodName,
      calories: log.calories,
      sodium: log.sodium,
      bp_impact: log.bpImpact,
      method: log.method,
      image_url: log.imageUrl,
    });

    if (error) throw new Error(`Failed to add food log: ${error.message}`);
  }

  async getFoodLogs(userId: string, days: number): Promise<any[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data, error } = await supabase
      .from("food_logs")
      .select("*")
      .eq("user_id", userId)
      .gte("date", cutoffDate.toISOString().split("T")[0])
      .order("created_at", { ascending: false });

    if (error) throw new Error(`Failed to get food logs: ${error.message}`);
    return (data || []).map((f) => ({
      id: f.id,
      userId: f.user_id,
      date: f.date,
      foodName: f.food_name,
      calories: f.calories,
      sodium: f.sodium,
      bpImpact: f.bp_impact,
      method: f.method,
      imageUrl: f.image_url,
      createdAt: f.created_at,
    }));
  }

  // Onboarding Answers
  async saveOnboardingAnswer(
    userId: string,
    questionKey: string,
    answerText: string,
    answerValue: any
  ): Promise<void> {
    const { error } = await supabase.from("onboarding_answers").upsert(
      {
        user_id: userId,
        question_key: questionKey,
        answer_text: answerText,
        answer_value: answerValue,
      },
      { onConflict: "user_id,question_key" }
    );

    if (error)
      throw new Error(`Failed to save onboarding answer: ${error.message}`);
  }

  async getOnboardingAnswers(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from("onboarding_answers")
      .select("*")
      .eq("user_id", userId);

    if (error)
      throw new Error(`Failed to get onboarding answers: ${error.message}`);
    return (data || []).map((a) => ({
      id: a.id,
      userId: a.user_id,
      questionKey: a.question_key,
      answerText: a.answer_text,
      answerValue: a.answer_value,
      createdAt: a.created_at,
    }));
  }

  // Helper: Map database user to User type
  private mapUserFromDb(data: any): User {
    return {
      id: data.id,
      name: data.name,
      age: data.age,
      biologicalSex: data.biological_sex,
      preferredLanguage: data.preferred_language,
      hasHypertension: data.has_hypertension,
      medications: data.medications || [],
      smokes: data.smokes,
      drinksAlcohol: data.drinks_alcohol,
      activityLevel: data.activity_level,
      averageSleepHours: data.average_sleep_hours,
      familyHistoryHeartDisease: data.family_history_heart_disease,
      smartwatchConnected: data.smartwatch_connected,
      smartwatchType: data.smartwatch_type,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}

// Singleton instance
export const dataStore = new SupabaseStore();

