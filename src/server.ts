// Load environment variables FIRST, before any other imports
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";

// Routes
import voiceRoutes from "./routes/voice.routes";
import healthRoutes from "./routes/health.routes";
import foodRoutes from "./routes/food.routes";
import medicalRoutes from "./routes/medical.routes";
import userRoutes from "./routes/user.routes";
import utilityRoutes from "./routes/utility.routes";
import homeRoutes from "./routes/home.routes";
import medicationRoutes from "./routes/medication.routes";
import bpCheckRoutes from "./routes/bp-check.routes";
import lifestyleRoutes from "./routes/lifestyle.routes";
import onboardingRoutes from "./routes/onboarding.routes";
import firstReadingRoutes from "./routes/first-reading.routes";
import audioRoutes from "./routes/audio.routes";
import tipRoutes from "./routes/tip.routes";
import settingsRoutes from "./routes/settings.routes";

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware - configure helmet to allow audio cross-origin
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        mediaSrc: ["'self'", "blob:", "data:", "*"],
      },
    },
  }),
);

// Additional CORS headers for audio routes (must come after helmet)
app.use("/api/audio", (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

// CORS configuration - strip trailing slashes and handle multiple origins
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim().replace(/\/$/, ""))
  : [];

const corsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }
    // Check if origin is in allowed list (also strip trailing slash from incoming origin)
    const normalizedOrigin = origin.replace(/\/$/, "");
    if (
      allowedOrigins.length === 0 ||
      allowedOrigins.includes(normalizedOrigin)
    ) {
      return callback(null, true);
    }
    // For development, also allow localhost origins
    if (
      normalizedOrigin.includes("localhost") ||
      normalizedOrigin.includes("127.0.0.1")
    ) {
      return callback(null, true);
    }
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Cor API is running",
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/voice", voiceRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/food", foodRoutes);
app.use("/api/medical", medicalRoutes);
app.use("/api/users", userRoutes);
app.use("/api/utility", utilityRoutes);
app.use("/api/home", homeRoutes);
app.use("/api/medications", medicationRoutes);
app.use("/api/bp-check", bpCheckRoutes);
app.use("/api/lifestyle", lifestyleRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/first-reading", firstReadingRoutes);
app.use("/api/audio", audioRoutes);
app.use("/api/tip", tipRoutes);
app.use("/api/settings", settingsRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Cor Backend API",
    version: "1.0.0",
    endpoints: {
      voice: "/api/voice",
      health: "/api/health",
      food: "/api/food",
      medical: "/api/medical",
      users: "/api/users",
      utility: "/api/utility",
      home: "/api/home",
      medications: "/api/medications",
      bpCheck: "/api/bp-check",
      lifestyle: "/api/lifestyle",
      onboarding: "/api/onboarding",
      firstReading: "/api/first-reading",
      audio: "/api/audio",
      tip: "/api/tip",
      settings: "/api/settings",
    },
  });
});

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Production optimizations
if (process.env.NODE_ENV === "production") {
  // Trust proxy for rate limiting and security
  app.set("trust proxy", 1);

  // Disable powered-by header
  app.disable("x-powered-by");
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Cor API server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);

  // Check for required environment variables
  const requiredEnvVars = ["GROQ_API_KEY", "YARNGPT_API_KEY"];
  const missing = requiredEnvVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.warn(`⚠️  Missing environment variables: ${missing.join(", ")}`);
    console.warn("   Some features may not work without these keys.");
  } else {
    console.log("✅ All required environment variables are set");
  }
});

export default app;
