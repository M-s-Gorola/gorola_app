import { MINIMUM_AGE_YEARS } from "@gorola/shared";

export type AgeEvaluationResult =
  | { valid: true; isAdult: boolean }
  | { valid: false };

/**
 * Pure evaluation of date of birth against the 18+ threshold in Asia/Kolkata timezone.
 *
 * Requirements:
 * - Must strictly match YYYY-MM-DD.
 * - Real calendar date, year >= 1900, not in the future relative to Asia/Kolkata.
 * - Returns strictly { valid: true, isAdult } or { valid: false } (never echoes input date).
 */
export function evaluateDateOfBirth(
  dobIso: unknown,
  now: Date = new Date()
): AgeEvaluationResult {
  if (typeof dobIso !== "string") {
    return { valid: false };
  }

  // Strict format check: exactly YYYY-MM-DD
  const formatRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!formatRegex.test(dobIso)) {
    return { valid: false };
  }

  const parts = dobIso.split("-");
  const yearStr = parts[0];
  const monthStr = parts[1];
  const dayStr = parts[2];

  if (!yearStr || !monthStr || !dayStr) {
    return { valid: false };
  }

  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    return { valid: false };
  }

  if (year < 1900 || month < 1 || month > 12) {
    return { valid: false };
  }

  // Validate exact days in month for the given year (handles leap years)
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) {
    return { valid: false };
  }

  // Compute current date in Asia/Kolkata
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const todayStr = formatter.format(now); // "YYYY-MM-DD"

  // Future date check
  if (dobIso > todayStr) {
    return { valid: false };
  }

  const todayParts = todayStr.split("-");
  const todayYearStr = todayParts[0];
  const todayMonthStr = todayParts[1];
  const todayDayStr = todayParts[2];

  if (!todayYearStr || !todayMonthStr || !todayDayStr) {
    return { valid: false };
  }

  const todayYear = parseInt(todayYearStr, 10);
  const cutoffYear = todayYear - MINIMUM_AGE_YEARS;
  const cutoffStr = `${String(cutoffYear).padStart(4, "0")}-${todayMonthStr}-${todayDayStr}`;

  const isAdult = dobIso <= cutoffStr;

  return { valid: true, isAdult };
}
