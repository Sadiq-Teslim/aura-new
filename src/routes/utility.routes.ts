import { Router, Request, Response } from "express";
import { extractSleepQuality } from "../services/groq.service";
import { dataStore } from "../store/supabase-store";
import { calculateCSS } from "../utils/css-engine";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const router = Router();

/**
 * POST /api/utility/sleep/extract
 * Extract sleep quality from natural language response
 */
router.post("/sleep/extract", async (req: Request, res: Response) => {
  try {
    const { transcript, language, userId } = req.body;

    if (!transcript || !language) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Transcript and language are required",
          code: "MISSING_FIELDS",
        },
      });
    }

    const result = await extractSleepQuality(transcript, language);

    // Optionally update today's reading if userId provided
    if (userId) {
      const readings = await dataStore.getReadings(userId);
      const today = new Date().toISOString().split("T")[0];
      const todayReading = readings.find((r) => r.date === today);

      if (todayReading) {
        todayReading.sleepQuality = result.sleepQuality;
        // Re-add to update
        await dataStore.addReading(userId, todayReading);
      }
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message, code: "SLEEP_EXTRACTION_ERROR" },
    });
  }
});

/**
 * GET /api/utility/trends
 * Get trend data for visualization
 */
router.get("/trends", async (req: Request, res: Response) => {
  try {
    const { userId, days = "7" } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: { message: "User ID is required", code: "MISSING_USER_ID" },
      });
    }

    const readings = await dataStore.getReadings(userId as string, parseInt(days as string));
    const baseline = await dataStore.getBaseline(userId as string);

    if (!baseline) {
      return res.status(404).json({
        success: false,
        error: { message: "Baseline not found", code: "BASELINE_NOT_FOUND" },
      });
    }

    // Calculate CSS for each day
    const trends = readings.map((reading, index) => {
      const readingsUpToThisPoint = readings.slice(0, index + 1);
      const css = calculateCSS(readingsUpToThisPoint, baseline);
      return {
        date: reading.date,
        css: css.score,
        hrv: reading.hrv,
        sedentaryHours: reading.sedentaryHours,
        sleepQuality: reading.sleepQuality,
        trend: css.trend,
      };
    });

    res.json({
      success: true,
      data: {
        trends,
        baseline,
        summary: {
          bestDay: trends.reduce((best, current) =>
            current.css < best.css ? current : best
          ),
          worstDay: trends.reduce((worst, current) =>
            current.css > worst.css ? current : worst
          ),
          averageCSS: Math.round(
            trends.reduce((sum, t) => sum + t.css, 0) / trends.length
          ),
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message, code: "TRENDS_FETCH_ERROR" },
    });
  }
});

/**
 * POST /api/utility/clinical-share
 * Generate clinical share report PDF
 */
router.post("/clinical-share", async (req: Request, res: Response) => {
  try {
    const { userId, days = "7" } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: { message: "User ID is required", code: "MISSING_USER_ID" },
      });
    }

    const user = await dataStore.getUser(userId);
    const readings = await dataStore.getReadings(userId, parseInt(days));
    const baseline = await dataStore.getBaseline(userId);
    const medicalRecords = await dataStore.getMedicalRecords(userId);

    if (!user || !baseline) {
      return res.status(404).json({
        success: false,
        error: { message: "User or baseline not found", code: "NOT_FOUND" },
      });
    }

    // Generate PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // US Letter size
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = 750;
    const lineHeight = 20;
    const margin = 50;

    // Title
    page.drawText("Cor Health Report", {
      x: margin,
      y,
      size: 24,
      font: boldFont,
    });
    y -= 40;

    // User info
    page.drawText(`Patient: ${user.name}`, {
      x: margin,
      y,
      size: 12,
      font,
    });
    y -= lineHeight;
    page.drawText(`Age: ${user.age} | Sex: ${user.biologicalSex}`, {
      x: margin,
      y,
      size: 12,
      font,
    });
    y -= lineHeight;
    page.drawText(
      `Report Date: ${new Date().toLocaleDateString()}`,
      {
        x: margin,
        y,
        size: 12,
        font,
      }
    );
    y -= 30;

    // CSS Summary
    if (readings.length > 0) {
      const { calculateCSS } = await import("../utils/css-engine");
      const css = calculateCSS(readings, baseline);
      page.drawText("Cardiovascular Stress Score Summary", {
        x: margin,
        y,
        size: 14,
        font: boldFont,
      });
      y -= lineHeight;
      page.drawText(`Current CSS: ${css.score}/100`, {
        x: margin,
        y,
        size: 12,
        font,
      });
      y -= lineHeight;
      page.drawText(`Trend: ${css.trend}`, {
        x: margin,
        y,
        size: 12,
        font,
      });
      y -= lineHeight;
      page.drawText(`Consecutive worsening days: ${css.worseningDays}`, {
        x: margin,
        y,
        size: 12,
        font,
      });
      y -= 30;
    }

    // Recent readings
    if (readings.length > 0) {
      page.drawText("Recent Readings", {
        x: margin,
        y,
        size: 14,
        font: boldFont,
      });
      y -= lineHeight;

      readings.slice(-7).forEach((reading) => {
        if (y < 100) {
          // New page if needed
          const newPage = pdfDoc.addPage([612, 792]);
          y = 750;
        }
        page.drawText(
          `${reading.date}: HRV ${reading.hrv}ms, Sleep ${reading.sleepQuality}/10, Sedentary ${reading.sedentaryHours}h`,
          {
            x: margin,
            y,
            size: 10,
            font,
          }
        );
        y -= lineHeight;
      });
      y -= 20;
    }

    // Medical records summary
    if (medicalRecords.length > 0) {
      page.drawText("Medical Records", {
        x: margin,
        y,
        size: 14,
        font: boldFont,
      });
      y -= lineHeight;
      medicalRecords.forEach((record) => {
        if (y < 100) {
          const newPage = pdfDoc.addPage([612, 792]);
          y = 750;
        }
        page.drawText(`${record.fileName} - ${record.uploadedAt}`, {
          x: margin,
          y,
          size: 10,
          font,
        });
        y -= lineHeight;
      });
    }

    // Disclaimer
    y = 50;
    page.drawText(
      "This report is for informational purposes only and does not constitute medical advice.",
      {
        x: margin,
        y,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5),
      }
    );

    const pdfBytes = await pdfDoc.save();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="cor-report-${userId}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message, code: "PDF_GENERATION_ERROR" },
    });
  }
});

export default router;

