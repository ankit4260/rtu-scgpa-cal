import gradePointsRaw from "../data/grade_points.json";
import creditsRaw from "../data/credits_final.json";

export interface SubjectItem {
  id: string;
  code: string;
  name: string;
  grade: string;
  credits: number;
}

export const GRADE_POINTS: Record<string, number> = gradePointsRaw;
export const CREDITS_DATA: Record<string, number> = creditsRaw;

export const GRADE_OPTIONS = [
  { label: "Select Grade", value: "" },
  { label: "A++ (10.0)", value: "A++" },
  { label: "A+ (9.0)", value: "A+" },
  { label: "A (8.5)", value: "A" },
  { label: "B+ (8.0)", value: "B+" },
  { label: "B (7.5)", value: "B" },
  { label: "C+ (7.0)", value: "C+" },
  { label: "C (6.5)", value: "C" },
  { label: "D+ (6.0)", value: "D+" },
  { label: "D (5.5)", value: "D" },
  { label: "E+ (5.0)", value: "E+" },
  { label: "E (4.0)", value: "E" },
  { label: "F (0.0)", value: "F" },
];

export function lookupCredits(code: string): number {
  const cleanCode = code.replace(/#$/, "").trim();
  if (cleanCode.startsWith("FEC")) return 0.5;
  if (CREDITS_DATA[cleanCode] !== undefined) {
    return CREDITS_DATA[cleanCode];
  }
  // Try partial code lookup
  for (const key of Object.keys(CREDITS_DATA)) {
    if (key.startsWith(cleanCode) || cleanCode.startsWith(key)) {
      return CREDITS_DATA[key];
    }
  }
  // Default for labs vs lectures if not mapped
  if (/lab|graphics|activities|sodeca|deca/i.test(code)) return 1.0;
  return 3.0;
}

export interface CalculationResult {
  sgpa: number;
  percentage: number;
  totalCredits: number;
  totalPoints: number;
  passedCount: number;
  backlogCount: number;
  division: string;
}

export function calculateSGPA(subjects: SubjectItem[]): CalculationResult | null {
  if (!subjects || subjects.length === 0) return null;

  let totalNumerator = 0;
  let totalCredits = 0;
  let validCount = 0;
  let backlogCount = 0;

  for (const sub of subjects) {
    const grade = sub.grade?.trim().toUpperCase();
    if (!grade || GRADE_POINTS[grade] === undefined) {
      continue;
    }

    const points = GRADE_POINTS[grade];
    const credit = sub.credits > 0 ? sub.credits : 3;

    totalNumerator += credit * points;
    totalCredits += credit;
    validCount++;

    if (grade === "F") {
      backlogCount++;
    }
  }

  if (totalCredits === 0 || validCount === 0) return null;

  const rawSgpa = totalNumerator / totalCredits;
  const sgpa = Number(rawSgpa.toFixed(2));
  // RTU CBCS conversion rule: Percentage = SGPA * 10.0
  const percentage = Number((sgpa * 10).toFixed(2));

  let division = "Pass Class";
  if (sgpa >= 7.5) division = "First Division with Distinction";
  else if (sgpa >= 6.5) division = "First Division";
  else if (sgpa >= 5.0) division = "Second Division";
  else if (backlogCount > 0) division = `${backlogCount} Backlog(s)`;

  return {
    sgpa,
    percentage,
    totalCredits: Number(totalCredits.toFixed(1)),
    totalPoints: Number(totalNumerator.toFixed(2)),
    passedCount: validCount - backlogCount,
    backlogCount,
    division,
  };
}
