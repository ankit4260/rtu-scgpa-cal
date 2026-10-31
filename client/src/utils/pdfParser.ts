import * as pdfjsLib from "pdfjs-dist";
import { lookupCredits } from "./calculator";
import type { SubjectItem } from "./calculator";

// Set worker source for Vite / modern browser
if (typeof window !== "undefined") {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  } catch (err) {
    console.warn("Could not set CDN workerSrc, fallback to bundled worker", err);
  }
}

export interface ParsePdfResult {
  subjects: SubjectItem[];
  rawText: string;
  studentName?: string;
  rollNo?: string;
  enrollmentNo?: string;
  collegeName?: string;
  semesterName?: string;
}

export async function parseRTUPdf(file: File): Promise<ParsePdfResult> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;

  let fullText = "";

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Group items by vertical position (Y) to reconstruct lines accurately
    const lineMap: Record<number, { x: number; str: string }[]> = {};

    for (const item of textContent.items) {
      if ("str" in item && item.str.trim()) {
        const y = Math.round(item.transform[5]);
        const x = Math.round(item.transform[4]);
        if (!lineMap[y]) lineMap[y] = [];
        lineMap[y].push({ x, str: item.str });
      }
    }

    // Sort lines from top (higher Y) to bottom
    const sortedY = Object.keys(lineMap)
      .map(Number)
      .sort((a, b) => b - a);

    const pageLines: string[] = [];
    for (const y of sortedY) {
      const lineItems = lineMap[y].sort((a, b) => a.x - b.x);
      const lineStr = lineItems.map((i) => i.str).join(" ");
      pageLines.push(lineStr);
    }

    fullText += pageLines.join("\n") + "\n";
  }

  // Regex matching RTU result format (same as backend uploadController)
  // Format: <title> <code> <mid> [<end>] [*] <grade>
  const regex = /^(?<title>.+?)\s+(?<code>\d?[A-Z]{2,3}\d*-?\d*#?)\s+(?<mid>\d+)(?:\s+(?<end>\d+))?\s*\*?\s*(?<grade>[A-F]\+*)\s*$/gm;

  const matches = [...fullText.matchAll(regex)];
  let subjects: SubjectItem[] = [];

  if (matches.length > 0) {
    subjects = matches.map((m, idx) => {
      const code = m.groups?.code?.trim() || `SUB-${idx + 1}`;
      const name = m.groups?.title?.trim() || `Subject ${idx + 1}`;
      const grade = m.groups?.grade?.trim().toUpperCase() || "A";
      const credits = lookupCredits(code);

      return {
        id: `extracted-${idx}-${code}`,
        code,
        name,
        grade,
        credits,
      };
    });
  } else {
    // Secondary fallback: relaxed regex for marksheets where columns might have tabs or varied spacing
    const fallbackRegex = /(?<title>[A-Za-z0-9\s,&()/-]{4,50})\s+(?<code>\d?[A-Z]{2,3}\d+[-\w#]*)\s+.*?\s+(?<grade>[A-F]\+{0,2})/g;
    const fallbackMatches = [...fullText.matchAll(fallbackRegex)];

    subjects = fallbackMatches.map((m, idx) => {
      const code = m.groups?.code?.trim() || `SUB-${idx + 1}`;
      const name = m.groups?.title?.trim() || `Subject ${idx + 1}`;
      const grade = m.groups?.grade?.trim().toUpperCase() || "A";
      const credits = lookupCredits(code);

      return {
        id: `fallback-${idx}-${code}`,
        code,
        name,
        grade,
        credits,
      };
    });
  }

  // Extract student details if present
  const nameMatch = fullText.match(/Name\s*:\s*([A-Za-z\s]+)/i);
  const rollMatch = fullText.match(/Roll\s*No\.?\s*:\s*([A-Z0-9]+)/i);
  const enrollMatch = fullText.match(/Enrollment\s*No\.?\s*:\s*([A-Z0-9/]+)/i);
  const collegeMatch = fullText.match(/College\s*:\s*([A-Za-z0-9\s,.-]+)/i);
  const semMatch = fullText.match(/(B\.Tech\.?\s+[I|V|X]+|Semester\s+[0-9IVX]+)/i);

  return {
    subjects,
    rawText: fullText,
    studentName: nameMatch?.[1]?.trim(),
    rollNo: rollMatch?.[1]?.trim(),
    enrollmentNo: enrollMatch?.[1]?.trim(),
    collegeName: collegeMatch?.[1]?.trim(),
    semesterName: semMatch?.[0]?.trim(),
  };
}
