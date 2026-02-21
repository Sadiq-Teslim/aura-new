import { Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";

export const validate = (validations: any[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    res.status(400).json({
      success: false,
      error: {
        message: "Validation failed",
        code: "VALIDATION_ERROR",
        details: errors.array(),
      },
    });
  };
};

// Common validation rules
export const readingValidation = [
  body("hrv").isNumeric().withMessage("HRV must be a number"),
  body("sedentaryHours")
    .isNumeric()
    .withMessage("Sedentary hours must be a number"),
  body("sleepQuality")
    .isNumeric()
    .isInt({ min: 0, max: 10 })
    .withMessage("Sleep quality must be between 0 and 10"),
  body("date").optional().isISO8601().withMessage("Date must be ISO8601 format"),
];

export const respondValidation = [
  body("transcript").isString().notEmpty().withMessage("Transcript is required"),
  body("language").isString().notEmpty().withMessage("Language is required"),
  body("healthContext").isObject().withMessage("Health context is required"),
];

export const speakValidation = [
  body("text").isString().notEmpty().withMessage("Text is required"),
  body("language").isString().notEmpty().withMessage("Language is required"),
];

