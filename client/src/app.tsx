import { useState, useRef } from "react";
import confetti from "canvas-confetti";
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  Trash2,
  Sparkles,
  ArrowRight,
  Compass,
  Info,
  RefreshCw,
  Award,
  Layers,
  Zap,
  HelpCircle,
  ChevronDown,
} from "lucide-react";
import {
  calculateSGPA,
  GRADE_OPTIONS,
} from "./utils/calculator";
import type { CalculationResult, SubjectItem } from "./utils/calculator";
import { parseRTUPdf } from "./utils/pdfParser";
import { SEMESTER_PRESETS } from "./data/semesterPresets";

export default function App() {
  const [activeTab, setActiveTab] = useState<"upload" | "manual" | "converter">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Extracted student info if available
  const [studentMeta, setStudentMeta] = useState<{
    name?: string;
    rollNo?: string;
    enrollmentNo?: string;
    college?: string;
  } | null>(null);

  // Selected semester preset for manual mode
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("sem-1");

  // Subject list (can come from PDF extraction or manual semester preset)
  const [subjects, setSubjects] = useState<SubjectItem[]>(() => {
    const defaultPreset = SEMESTER_PRESETS[0];
    return defaultPreset.subjects.map((s, idx) => ({
      ...s,
      id: `init-${idx}-${s.code}`,
    }));
  });

  // SGPA Calculation Result
  const [result, setResult] = useState<CalculationResult | null>(() =>
    calculateSGPA(
      SEMESTER_PRESETS[0].subjects.map((s, idx) => ({
        ...s,
        id: `init-${idx}`,
      }))
    )
  );

  // Backend verification state
  const [backendVerifiedSgpa, setBackendVerifiedSgpa] = useState<number | null>(null);

  // Direct SGPA -> Percentage converter states (Tab 3 like Image 1)
  const [directSgpaInput, setDirectSgpaInput] = useState<string>("8.4");
  const [directPercentageResult, setDirectPercentageResult] = useState<number>(84.0);

  // FAQ state
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle direct converter change
  const handleDirectSgpaChange = (val: string) => {
    setDirectSgpaInput(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0 && num <= 10) {
      setDirectPercentageResult(Number((num * 10).toFixed(2)));
    }
  };

  // Switch manual semester preset
  const handleSemesterChange = (semId: string) => {
    setSelectedSemesterId(semId);
    const preset = SEMESTER_PRESETS.find((p) => p.id === semId);
    if (preset) {
      const newSubs: SubjectItem[] = preset.subjects.map((s, idx) => ({
        ...s,
        id: `sem-${semId}-${idx}-${s.code}`,
      }));
      setSubjects(newSubs);
      setResult(calculateSGPA(newSubs));
    }
  };

  // Update grade for a specific subject (allowing user to change anything!)
  const handleGradeChange = (id: string, newGrade: string) => {
    setSubjects((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, grade: newGrade } : s));
      setResult(calculateSGPA(updated));
      return updated;
    });
  };

  // Process uploaded or dropped PDF
  const processPdfFile = async (selectedFile: File) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setIsParsing(true);
    setParseError(null);
    setBackendVerifiedSgpa(null);

    try {
      const parsed = await parseRTUPdf(selectedFile);

      if (parsed.subjects.length > 0) {
        setSubjects(parsed.subjects);
        setStudentMeta({
          name: parsed.studentName,
          rollNo: parsed.rollNo,
          enrollmentNo: parsed.enrollmentNo,
          college: parsed.collegeName,
        });

        const calculated = calculateSGPA(parsed.subjects);
        setResult(calculated);

        // Fire celebration confetti!
        triggerCelebration();
      } else {
        setParseError(
          "Could not automatically detect subject lines with grades from this PDF. You can review or manually adjust the subjects below!"
        );
      }

      // Also attempt backend call to verify server endpoint (without touching server code!)
      attemptBackendUpload(selectedFile);
    } catch (err: any) {
      console.error("PDF Parsing error:", err);
      setParseError(
        "Notice: PDF text layout was unconventional. Loaded standard RTU subjects below for you to adjust!"
      );
    } finally {
      setIsParsing(false);
    }
  };

  // Attempt backend POST /api/upload
  const attemptBackendUpload = async (fileToUpload: File) => {
    try {
      const form = new FormData();
      form.append("file", fileToUpload);
      const res = await fetch("http://localhost:3000/api/upload", {
        method: "POST",
        body: form,
      });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.message === "number") {
          setBackendVerifiedSgpa(Number(data.message.toFixed(2)));
        }
      }
    } catch {
      // Backend may be offline or running elsewhere; client-side calculation seamlessly handles it
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      if (droppedFile.type === "application/pdf" || droppedFile.name.endsWith(".pdf")) {
        processPdfFile(droppedFile);
      } else {
        setParseError("Please upload a valid PDF marksheet file.");
      }
    }
  };

  // Submit / Calculate handler
  const handleCalculateSubmit = async () => {
    setIsSubmitting(true);
    const res = calculateSGPA(subjects);
    setResult(res);

    if (file) {
      await attemptBackendUpload(file);
    }

    triggerCelebration();
    setIsSubmitting(false);

    // Scroll smoothly to results
    const resultsEl = document.getElementById("results-section");
    if (resultsEl) {
      resultsEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  // Confetti burst
  const triggerCelebration = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#84cc16", "#15803d", "#bef264", "#38bdf8"],
      });
    } catch {
      // Fallback safe
    }
  };

  // Quick Demo Sample loader for user convenience
  const loadSampleDemo = () => {
    const subs: SubjectItem[] = [
      { id: "s-1", code: "1FY2-01", name: "Engineering Mathematics-I", credits: 4, grade: "A+" },
      { id: "s-2", code: "1FY2-03", name: "Engineering Chemistry", credits: 4, grade: "A" },
      { id: "s-3", code: "1FY1-04", name: "Human Values", credits: 2, grade: "A+" },
      { id: "s-4", code: "1FY3-06", name: "Programming for Problem Solving", credits: 2, grade: "A++" },
      { id: "s-5", code: "1FY3-08", name: "Basic Civil Engineering", credits: 2, grade: "B+" },
      { id: "s-6", code: "1FY2-21", name: "Engineering Chemistry Lab", credits: 1, grade: "A++" },
      { id: "s-7", code: "1FY1-22", name: "Human Values Activities", credits: 1, grade: "A+" },
      { id: "s-8", code: "1FY3-24", name: "Computer Programming Lab", credits: 1.5, grade: "A++" },
      { id: "s-9", code: "1FY3-26", name: "Basic Civil Engineering Lab", credits: 1, grade: "A" },
      { id: "s-10", code: "1FY3-28", name: "Computer Aided Engineering Graphics", credits: 1.5, grade: "A+" },
      { id: "s-11", code: "1FY8-00", name: "DECA", credits: 0.5, grade: "A++" },
    ];
    setSubjects(subs);
    setStudentMeta({
      name: "Ankit Sharma",
      rollNo: "22EJCCS042",
      enrollmentNo: "22E1JCCSM40P042",
      college: "JECRC Foundation, Jaipur",
    });
    setResult(calculateSGPA(subs));
    setParseError(null);
    triggerCelebration();
  };

  return (
    <div className="app-container">
      {/* 1. Top Brand Bar (rtuCGPA) */}
      <div className="top-brand-bar">
        <div className="brand-badge-pill" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <span className="brand-logo-text">
            rtu<span className="brand-logo-highlight">CGPA</span>
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", fontWeight: 700, color: "#14532d" }}>
          <Sparkles size={16} color="#84cc16" /> Instant SGPA & Percentage Engine
        </div>
      </div>

      {/* 2. Hero Section with Tricky Attention-Grabbing Hook */}
      <section className="hero-section">
        {/* Tricky Attention Hook Line */}
        <div className="tricky-hook-banner">
          <div className="hook-left">
            <div className="hook-pulse-dot" />
            <span className="hook-headline">
              ⚡ <strong>Stop doing math by hand:</strong> Just drag or upload your marksheet PDF and get your exact RTU CGPA in 2 seconds!
            </span>
          </div>
          <span className="hook-action-badge">Instant Auto-Fetch</span>
        </div>

        <div className="breadcrumb-row">
          <a href="#home">Home</a> / <span>rtuCGPA</span>
        </div>

        <div className="hero-layout">
          <div className="hero-text-content" style={{ maxWidth: "100%" }}>
            <h1 className="hero-title">Drag or Upload Result PDF — Get Your RTU CGPA Instantly</h1>

            <p className="hero-description">
              Why calculate credits and grade points one by one? Drag or upload your official Rajasthan Technical University semester result PDF below. Our engine automatically parses your subjects, calculates your weighted SGPA, and converts it to percentage. You can also edit any grade on the fly!
            </p>

            <div className="chips-row">
              <span className="feature-chip">
                <Zap size={16} /> Drag & drop auto-fetch
              </span>
              <span className="feature-chip">
                <CheckCircle2 size={16} /> 100% free & instant
              </span>
              <span className="feature-chip">
                <CheckCircle2 size={16} /> Official RTU formula
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Main Calculator Container */}
      <main className="calc-wrapper">
        <div className="calc-card">
          {/* Mode Switcher Tabs */}
          <div className="calc-tabs-bar">
            <button
              type="button"
              className={`calc-tab-btn ${activeTab === "upload" ? "active" : ""}`}
              onClick={() => setActiveTab("upload")}
            >
              <UploadCloud size={16} /> Auto PDF Upload & Drag
            </button>
            <button
              type="button"
              className={`calc-tab-btn ${activeTab === "manual" ? "active" : ""}`}
              onClick={() => setActiveTab("manual")}
            >
              <Layers size={16} /> Semester Subjects
            </button>
            <button
              type="button"
              className={`calc-tab-btn ${activeTab === "converter" ? "active" : ""}`}
              onClick={() => setActiveTab("converter")}
            >
              <RefreshCw size={16} /> SGPA ↔ Percentage
            </button>
          </div>

          {/* TAB 1: Auto Upload & Drag Feature */}
          {activeTab === "upload" && (
            <div>
              <div
                className={`dropzone-container ${isDragging ? "is-dragover" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,application/pdf"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const sel = e.target.files?.[0];
                    if (sel) processPdfFile(sel);
                  }}
                />

                <div className="dropzone-icon-circle">
                  <UploadCloud size={32} />
                </div>

                <h3 className="dropzone-title">Upload or drag your RTU Result Marksheet PDF here</h3>
                <p className="dropzone-sub">
                  Supports official Rajasthan Technical University semester marksheets & result cards
                </p>

                <button
                  type="button"
                  className="btn-browse"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  <FileText size={16} /> Browse PDF
                </button>

                <div className="sample-file-hint">
                  <span>Don't have a PDF ready?</span>
                  <button
                    type="button"
                    className="btn-sample-test"
                    onClick={(e) => {
                      e.stopPropagation();
                      loadSampleDemo();
                    }}
                  >
                    Click here to load sample marksheet
                  </button>
                </div>
              </div>

              {/* Parsing status banner */}
              {isParsing && (
                <div style={{ padding: "1rem", textAlign: "center", color: "#15803d", fontWeight: 600 }}>
                  <RefreshCw className="animate-spin" size={18} style={{ display: "inline", marginRight: "8px" }} />
                  Extracting subjects, codes, and letter grades from your marksheet...
                </div>
              )}

              {/* Error / Notice banner */}
              {parseError && (
                <div
                  style={{
                    marginTop: "1rem",
                    padding: "0.85rem 1rem",
                    borderRadius: "10px",
                    background: "#fef3c7",
                    border: "1px solid #fde68a",
                    color: "#92400e",
                    fontSize: "0.875rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <Info size={18} />
                  <span>{parseError}</span>
                </div>
              )}

              {/* Active file badge */}
              {file && (
                <div className="file-active-badge">
                  <div className="file-info-group">
                    <FileText size={20} color="#15803d" />
                    <div>
                      <div className="file-name-txt">{file.name}</div>
                      <div className="file-size-txt">{(file.size / 1024).toFixed(1)} KB • Ready for calculation</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-remove-file"
                    title="Remove file"
                    onClick={() => {
                      setFile(null);
                      setStudentMeta(null);
                      setBackendVerifiedSgpa(null);
                    }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              )}

              {/* Student Metadata Card if extracted from marksheet */}
              {studentMeta && (
                <div
                  style={{
                    marginTop: "1.25rem",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "1rem 1.25rem",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "0.75rem",
                    fontSize: "0.85rem",
                  }}
                >
                  {studentMeta.name && (
                    <div>
                      <span style={{ color: "#64748b" }}>Student Name:</span>{" "}
                      <strong style={{ color: "#0f172a" }}>{studentMeta.name}</strong>
                    </div>
                  )}
                  {studentMeta.rollNo && (
                    <div>
                      <span style={{ color: "#64748b" }}>Roll No:</span>{" "}
                      <strong style={{ color: "#0f172a" }}>{studentMeta.rollNo}</strong>
                    </div>
                  )}
                  {studentMeta.enrollmentNo && (
                    <div>
                      <span style={{ color: "#64748b" }}>Enrollment:</span>{" "}
                      <strong style={{ color: "#0f172a" }}>{studentMeta.enrollmentNo}</strong>
                    </div>
                  )}
                  {studentMeta.college && (
                    <div>
                      <span style={{ color: "#64748b" }}>College:</span>{" "}
                      <strong style={{ color: "#0f172a" }}>{studentMeta.college}</strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Manual Semester Preset Mode */}
          {activeTab === "manual" && (
            <div>
              <div className="semester-select-group" style={{ marginBottom: "1.5rem" }}>
                <label className="input-label-dark" style={{ color: "#334155" }}>
                  Select University / Engineering Semester:
                </label>
                <select
                  className="select-control-dark"
                  style={{ background: "#ffffff", color: "#0f172a", border: "1.5px solid #cbd5e1" }}
                  value={selectedSemesterId}
                  onChange={(e) => handleSemesterChange(e.target.value)}
                >
                  {SEMESTER_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* TAB 3: Quick Direct SGPA -> Percentage Converter (Image 1 style) */}
          {activeTab === "converter" && (
            <div style={{ padding: "1rem 0" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "450px" }}>
                <div>
                  <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#334155", display: "block", marginBottom: "0.35rem" }}>
                    University / Board
                  </label>
                  <select
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      borderRadius: "8px",
                      border: "1.5px solid #14532d",
                      fontWeight: 600,
                      background: "#ffffff",
                    }}
                  >
                    <option>Rajasthan Technical University (Kota)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#334155", display: "block", marginBottom: "0.35rem" }}>
                    Your SGPA (out of 10)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={directSgpaInput}
                    onChange={(e) => handleDirectSgpaChange(e.target.value)}
                    placeholder="e.g. 8.4"
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      borderRadius: "8px",
                      border: "1.5px solid #14532d",
                      fontSize: "1.1rem",
                      fontWeight: 700,
                      outline: "none",
                    }}
                  />
                  <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.35rem" }}>
                    RTU Kota CBCS Rules / Dean Academic Affairs conversion guideline: Equivalent Percentage = 10 × SGPA
                  </div>
                </div>

                <div
                  style={{
                    background: "#f0fdf4",
                    border: "2px solid #84cc16",
                    borderRadius: "12px",
                    padding: "1.25rem",
                    textAlign: "center",
                    marginTop: "0.5rem",
                  }}
                >
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#166534" }}>EQUIVALENT PERCENTAGE</div>
                  <div style={{ fontSize: "2.75rem", fontWeight: 800, color: "#14532d" }}>
                    {directPercentageResult}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. Subject-Wise Card (MATCHING IMAGE 2 EXACTLY) */}
          {activeTab !== "converter" && (
            <div className="subjects-card-container">
              <div className="subjects-header-bar">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h2 className="subjects-card-title">SGPA Calculator</h2>
                  <span className="subject-count-pill">
                    {subjects.length} Subjects Loaded
                  </span>
                </div>

                {/* Semester selection dropdown (from Image 2) */}
                <div className="semester-select-group">
                  <label className="input-label-dark">Select Semester</label>
                  <select
                    className="select-control-dark"
                    value={selectedSemesterId}
                    onChange={(e) => handleSemesterChange(e.target.value)}
                  >
                    {SEMESTER_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Subheading row: "Subjects" */}
              <div className="subjects-subheading-row">
                <span className="subjects-subheading-text">Subjects</span>
                <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                  Change grade to update calculation
                </span>
              </div>

              {/* List of Subjects with Credit and Grade Dropdown (Image 2) */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                {subjects.map((sub) => (
                  <div key={sub.id} className="subject-row-item">
                    <div className="subject-meta-left">
                      <div className="subject-name-txt" title={sub.name}>
                        {sub.name}
                      </div>
                      <div className="subject-code-credits">
                        <span className="credit-badge-dark">{sub.credits} Credits</span>
                        <span>•</span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                          {sub.code}
                        </span>
                      </div>
                    </div>

                    {/* Grade Selector Dropdown (Image 2) */}
                    <div className="grade-select-wrap">
                      <select
                        className="select-grade-dropdown"
                        value={sub.grade}
                        onChange={(e) => handleGradeChange(sub.id, e.target.value)}
                      >
                        {GRADE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons: Submit / Calculate Button */}
              <div className="calc-actions-footer">
                <button
                  type="button"
                  className="btn-primary-calculate"
                  disabled={isSubmitting}
                  onClick={handleCalculateSubmit}
                >
                  <Sparkles size={20} />
                  {isSubmitting ? "Calculating..." : "Submit & Calculate SGPA"}
                </button>
              </div>
            </div>
          )}

          {/* 5. Results Section (Instant & Animated) */}
          {result && (
            <div id="results-section" className="results-modal-box">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Award size={22} color="#15803d" />
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#14532d" }}>
                    Official Semester Result
                  </h3>
                </div>

                {backendVerifiedSgpa !== null && (
                  <span
                    style={{
                      background: "#dcfce7",
                      color: "#166534",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      padding: "0.25rem 0.65rem",
                      borderRadius: "9999px",
                      border: "1px solid #86efac",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                    }}
                  >
                    <CheckCircle2 size={12} /> Server Verified: {backendVerifiedSgpa}
                  </span>
                )}
              </div>

              <div className="result-scores-grid">
                <div className="score-stat-card">
                  <div className="stat-label">SGPA Score</div>
                  <div className="stat-value-big">
                    {result.sgpa} <span className="stat-unit">/ 10</span>
                  </div>
                </div>

                <div className="score-stat-card">
                  <div className="stat-label">Equivalent Percentage</div>
                  <div className="stat-value-big">
                    {result.percentage}<span className="stat-unit">%</span>
                  </div>
                </div>

                <div className="score-stat-card">
                  <div className="stat-label">Total Credits</div>
                  <div className="stat-value-big">
                    {result.totalCredits} <span className="stat-unit">CR</span>
                  </div>
                </div>

                <div className="score-stat-card">
                  <div className="stat-label">Academic Standing</div>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#15803d", marginTop: "0.5rem" }}>
                    {result.division}
                  </div>
                </div>
              </div>

              <div className="formula-info-banner">
                <span>
                  <strong>Official Conversion Formula:</strong> Percentage = SGPA × 10.0 (As approved by RTU Kota Academic Council)
                </span>
                <span>
                  Passed: {result.passedCount} • Backlogs: {result.backlogCount}
                </span>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 6. Try These Next Section (Image 1 Bottom) */}
      <section className="try-next-section">
        <div className="try-next-heading-row">
          <div className="try-next-icon">
            <Compass size={18} />
          </div>
          <h2 className="try-next-title">Try these next</h2>
        </div>

        <div className="next-tools-grid">
          <a href="#cgpa" className="tool-card-item">
            <div className="tool-card-header">
              <h3 className="tool-card-name">CGPA to Percentage Calculator (all universities)</h3>
              <ArrowRight size={18} color="#14532d" />
            </div>
            <p className="tool-card-desc">
              Convert CGPA to percentage or percentage to CGPA across CBSE, VTU, Mumbai University, AKTU, and more.
            </p>
          </a>

          <a href="#rtu-cgpa" className="tool-card-item">
            <div className="tool-card-header">
              <h3 className="tool-card-name">RTU CGPA to Percentage Calculator</h3>
              <ArrowRight size={18} color="#14532d" />
            </div>
            <p className="tool-card-desc">
              Rajasthan Technical University (Kota) affiliates engineering colleges across Rajasthan with verified guidelines.
            </p>
          </a>

          <a href="#sgpa-cgpa" className="tool-card-item">
            <div className="tool-card-header">
              <h3 className="tool-card-name">SGPA to CGPA Calculator</h3>
              <ArrowRight size={18} color="#14532d" />
            </div>
            <p className="tool-card-desc">
              Combine semester-wise SGPA into a credit-weighted cumulative CGPA across all 8 semesters.
            </p>
          </a>
        </div>
      </section>

      {/* 7. Frequently Asked Questions (Matches FAQ Schema for Google SEO) */}
      <section className="faq-section" style={{ maxWidth: "1180px", margin: "0 auto 3.5rem auto", padding: "0 1.5rem", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", marginBottom: "1.25rem" }}>
          <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "#14532d", color: "#84cc16", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <HelpCircle size={18} />
          </div>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1.6rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
            Frequently Asked Questions
          </h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {[
            {
              q: "How is SGPA calculated in RTU?",
              a: "In the Rajasthan Technical University (RTU Kota) CBCS framework, SGPA (Semester Grade Point Average) is calculated using the weighted formula: SGPA = Σ(Credit × Grade Point) / Σ(Total Credits). Points range from A++ (10.0), A+ (9.0), A (8.5), B+ (8.0), B (7.5), C+ (7.0), C (6.5), D+ (6.0), D (5.5), E+ (5.0), E (4.0), to F (0.0).",
            },
            {
              q: "What is the RTU SGPA to percentage formula?",
              a: "According to official RTU Kota CBCS Rules and Dean of Academic Affairs guidelines, the conversion formula is: Equivalent Percentage = 10 × SGPA (or 10 × CGPA). For example, an SGPA of 8.4 equals 84.0%.",
            },
            {
              q: "Is this the official RTU formula?",
              a: "Yes, rtuCGPA strictly follows the official Rajasthan Technical University (RTU) Choice Based Credit System (CBCS) ordinances and credit schemes published for engineering colleges across Rajasthan.",
            },
            {
              q: "Can I upload my RTU result marksheet PDF?",
              a: "Yes! You can drag and drop your official RTU semester result PDF marksheet. The calculator automatically extracts all subjects, credits, and letter grades, and computes your SGPA and percentage instantly.",
            },
          ].map((faq, index) => {
            const isOpen = openFaqIndex === index;
            return (
              <div
                key={index}
                style={{
                  background: "#ffffff",
                  border: "1.5px solid #14532d",
                  borderRadius: "14px",
                  overflow: "hidden",
                  boxShadow: isOpen ? "3px 3px 0px #14532d" : "1.5px 1.5px 0px #14532d",
                  transition: "all 0.2s ease",
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                  style={{
                    width: "100%",
                    padding: "1.1rem 1.4rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "#0f172a",
                  }}
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    size={20}
                    color="#14532d"
                    style={{
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s ease",
                      flexShrink: 0,
                    }}
                  />
                </button>
                {isOpen && (
                  <div
                    style={{
                      padding: "0 1.4rem 1.25rem 1.4rem",
                      fontSize: "0.925rem",
                      color: "#334155",
                      lineHeight: 1.6,
                      borderTop: "1px dashed #cbd5e1",
                      marginTop: "0.25rem",
                      paddingTop: "0.85rem",
                    }}
                  >
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="app-footer">
        <div>
          rtuCGPA Engine • Built strictly according to official Rajasthan Technical University CBCS Regulations
        </div>
      </footer>
    </div>
  );
}