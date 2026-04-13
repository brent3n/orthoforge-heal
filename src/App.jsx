import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import * as XLSX from "xlsx";

// ─── Color Palette ───────────────────────────────────────────
const COLORS = {
  bg: "#0d1117",
  bgCard: "#161b22",
  headerBg: "#ffffff",
  headerBorder: "#30b8c9",
  accent: "#30b8c9",
  text: "#e6edf3",
  textMuted: "#8b949e",
  textDark: "#24292f",
  gridLine: "#21262d",
  stageEmpty: "#2d333b",

  // Stage colors — same across all regions for a given stage
  stage1: "#30b8c9",   // teal
  stage2: "#f59e0b",   // amber/gold
  stage3: "#8b5cf6",   // purple
  stage4: "#10b981",   // emerald green

  // Percentile reference lines — all same muted color
  percentile: "#6e7681",

  // Patient line — distinct bright color
  patient: "#00d4ff",
  patientProjected: "#00d4ff",
};

const STAGE_COLORS = [COLORS.stage1, COLORS.stage2, COLORS.stage3, COLORS.stage4];

// ─── Percentile curve generator ──────────────────────────────
function generatePercentileCurve(percentile, maxWeeks = 30) {
  const weeksTo90 = { 10: 28, 50: 20, 75: 16, 90: 11 };
  const target = weeksTo90[percentile];
  const points = [];
  for (let w = 0; w <= maxWeeks; w++) {
    const t = w / target;
    const val = 100 * (1 - Math.exp(-2.3 * t));
    points.push({ week: w, value: Math.min(Math.max(val, 0), 100) });
  }
  return points;
}

// ─── Date helpers ────────────────────────────────────────────
function parseDate(str) {
  if (!str) return null;
  const parts = str.split("/");
  if (parts.length !== 3) return null;
  let [m, d, y] = parts.map(Number);
  if (y < 100) y += 2000;
  return new Date(y, m - 1, d);
}

function formatDate(date) {
  if (!date) return "—";
  return `${date.getMonth() + 1}/${date.getDate()}/${String(date.getFullYear()).slice(-2)}`;
}

function addWeeks(date, weeks) {
  if (!date) return null;
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

// ─── Parse uploaded file ─────────────────────────────────────
function parseFileData(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const metadata = {};
  const timeData = [];
  let inData = false;
  let headers = [];
  for (const line of lines) {
    if (line === "[METADATA]") { inData = false; continue; }
    if (line === "[DATA]") { inData = true; continue; }
    if (!inData) {
      const [key, ...rest] = line.split(",");
      if (key && rest.length) metadata[key.trim()] = rest.join(",").trim();
    } else {
      const parts = line.split(",").map((s) => s.trim());
      if (!headers.length) { headers = parts; continue; }
      const row = {};
      headers.forEach((h, i) => {
        const val = parts[i];
        row[h] = isNaN(Number(val)) ? val : Number(val);
      });
      timeData.push(row);
    }
  }
  return { metadata, timeData, headers };
}

// ─── Determine active stage and progress for a region ────────
function getRegionStageInfo(row, prefix) {
  const stages = [
    row[`${prefix}_S1`] || 0,
    row[`${prefix}_S2`] || 0,
    row[`${prefix}_S3`] || 0,
    row[`${prefix}_S4`] || 0,
  ];
  // Find first incomplete stage
  for (let i = 0; i < 4; i++) {
    if (stages[i] < 100) {
      return { activeStage: i, progress: stages[i], color: STAGE_COLORS[i], overall: (stages[0] + stages[1] + stages[2] + stages[3]) / 4 };
    }
  }
  // All complete
  return { activeStage: 3, progress: 100, color: STAGE_COLORS[3], overall: 100 };
}

// ─── Donut Chart (colored by current healing stage) ──────────
function DonutChart({ currentRow }) {
  const cx = 165;
  const cy = 130;
  const outerR = 90;
  const innerR = 38;

  const antInfo = getRegionStageInfo(currentRow, "Anterior");
  const latInfo = getRegionStageInfo(currentRow, "Lateral");
  const posInfo = getRegionStageInfo(currentRow, "Posterior");
  const medInfo = getRegionStageInfo(currentRow, "Medial");

  const regions = [
    { name: "Anterior", info: antInfo, startAngle: -Math.PI / 4, endAngle: Math.PI / 4 },
    { name: "Lateral", info: latInfo, startAngle: Math.PI / 4, endAngle: (3 * Math.PI) / 4 },
    { name: "Posterior", info: posInfo, startAngle: (3 * Math.PI) / 4, endAngle: (5 * Math.PI) / 4 },
    { name: "Medial", info: medInfo, startAngle: (5 * Math.PI) / 4, endAngle: (7 * Math.PI) / 4 },
  ];

  function arcPath(startA, endA, rOuter, rInner) {
    const x1o = cx + rOuter * Math.sin(startA);
    const y1o = cy - rOuter * Math.cos(startA);
    const x2o = cx + rOuter * Math.sin(endA);
    const y2o = cy - rOuter * Math.cos(endA);
    const x1i = cx + rInner * Math.sin(endA);
    const y1i = cy - rInner * Math.cos(endA);
    const x2i = cx + rInner * Math.sin(startA);
    const y2i = cy - rInner * Math.cos(startA);
    const large = endA - startA > Math.PI ? 1 : 0;
    return `M${x1o},${y1o} A${rOuter},${rOuter} 0 ${large} 1 ${x2o},${y2o} L${x1i},${y1i} A${rInner},${rInner} 0 ${large} 0 ${x2i},${y2i} Z`;
  }

  const dividerAngles = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];

  return (
    <svg width="100%" height="100%" viewBox="0 0 330 260" preserveAspectRatio="xMidYMid meet">
      {regions.map((r, i) => (
        <path key={`bg-${i}`} d={arcPath(r.startAngle, r.endAngle, outerR, innerR)} fill="#2d333b" opacity={0.6} />
      ))}
      {regions.map((r, i) => {
        const fillPct = r.info.overall;
        if (fillPct <= 0) return null;
        const totalAngle = r.endAngle - r.startAngle;
        const filledAngle = r.startAngle + totalAngle * Math.min(fillPct / 100, 1);
        return (
          <path key={`fill-${i}`} d={arcPath(r.startAngle, filledAngle, outerR, innerR)} fill={r.info.color} style={{ transition: "all 0.6s ease-out" }} />
        );
      })}
      <circle cx={cx} cy={cy} r={innerR - 2} fill={COLORS.bg} />
      {dividerAngles.map((angle, i) => {
        const x1 = cx + (innerR - 6) * Math.sin(angle);
        const y1 = cy - (innerR - 6) * Math.cos(angle);
        const x2 = cx + (outerR + 6) * Math.sin(angle);
        const y2 = cy - (outerR + 6) * Math.cos(angle);
        return <line key={`div-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e6edf3" strokeWidth={2} />;
      })}
      <text x="165" y="22" textAnchor="middle" fontSize="13" fontWeight="600" fill={COLORS.text} fontFamily="DM Sans, sans-serif">Anterior</text>
      <text x="165" y="248" textAnchor="middle" fontSize="13" fontWeight="600" fill={COLORS.text} fontFamily="DM Sans, sans-serif">Posterior</text>
      <text x="38" y="134" textAnchor="middle" fontSize="13" fontWeight="600" fill={COLORS.text} fontFamily="DM Sans, sans-serif">Medial</text>
      <text x="292" y="134" textAnchor="middle" fontSize="13" fontWeight="600" fill={COLORS.text} fontFamily="DM Sans, sans-serif">Lateral</text>
    </svg>
  );
}

// ─── Stage Progress Bar ──────────────────────────────────────
function StageBar({ label, stages }) {
  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: 16, flex: 1, minHeight: 24 }}>
      <div style={{ width: 90, textAlign: "right", color: COLORS.text, fontWeight: 700, fontSize: 14, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "flex-end" }}>{label}</div>
      <div style={{ display: "flex", gap: 4, flex: 1 }}>
        {[1, 2, 3, 4].map((stage) => {
          const val = stages[stage - 1] || 0;
          const isComplete = val >= 100;
          const stageColor = STAGE_COLORS[stage - 1];
          return (
            <div key={stage} style={{ flex: 1, borderRadius: 4, position: "relative", overflow: "hidden", background: COLORS.stageEmpty, border: `1px solid ${val > 0 ? stageColor : "#3a424d"}` }}>
              {val > 0 && (
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min(val, 100)}%`, background: isComplete ? stageColor : `linear-gradient(90deg, ${stageColor}cc, ${stageColor}66)`, transition: "width 0.6s ease-out" }} />
              )}
              <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: isComplete ? "#fff" : val > 0 ? "#ddd" : COLORS.textMuted, fontSize: 12, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                Stage {stage}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Custom Chart Dot ────────────────────────────────────────
function ChartDot({ cx: dotCx, cy: dotCy, payload, currentWeek }) {
  if (payload.week !== currentWeek) return null;
  return (
    <g>
      <circle cx={dotCx} cy={dotCy} r={8} fill={COLORS.patient} opacity={0.3} />
      <circle cx={dotCx} cy={dotCy} r={5} fill={COLORS.patient} stroke="#fff" strokeWidth={2} />
    </g>
  );
}

// ─── 5 Sample Patients ──────────────────────────────────────

const PATIENTS = {
  "sarah_johnson": `[METADATA]
PatientName,Sarah Johnson
DateOfBirth,12/25/94
PatientID,OFI-2019-0042
Gender,Female
Clinician,Dr. Physician
Location,Clinic 5 - GR MI
ExamDate,12/16/19
FractureDate,10/1/19
FractureLocation,Left Wrist
Fixation,Cast
FractureType,Simple
FractureGap,1.5mm
LastExam,12/1/19

[DATA]
Week,Anterior_S1,Anterior_S2,Anterior_S3,Anterior_S4,Lateral_S1,Lateral_S2,Lateral_S3,Lateral_S4,Posterior_S1,Posterior_S2,Posterior_S3,Posterior_S4,Medial_S1,Medial_S2,Medial_S3,Medial_S4,Overall_Pct
0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
1,18,0,0,0,10,0,0,0,5,0,0,0,2,0,0,0,2
2,40,0,0,0,22,0,0,0,12,0,0,0,6,0,0,0,5
3,65,0,0,0,38,0,0,0,20,0,0,0,12,0,0,0,8
4,85,0,0,0,55,0,0,0,30,0,0,0,20,0,0,0,12
5,100,8,0,0,72,0,0,0,40,0,0,0,30,0,0,0,16
6,100,22,0,0,88,0,0,0,50,0,0,0,42,0,0,0,20
7,100,40,0,0,100,10,0,0,58,0,0,0,55,0,0,0,25
8,100,60,0,0,100,28,0,0,65,0,0,0,68,0,0,0,30
9,100,80,0,0,100,48,0,0,72,0,0,0,80,0,0,0,36
10,100,95,0,0,100,65,0,0,78,0,0,0,90,0,0,0,42
11,100,100,12,0,100,80,0,0,84,0,0,0,100,8,0,0,48
12,100,100,30,0,100,92,0,0,90,0,0,0,100,22,0,0,54
13,100,100,50,0,100,100,10,0,95,0,0,0,100,40,0,0,60
14,100,100,70,0,100,100,28,0,100,8,0,0,100,58,0,0,65
15,100,100,85,0,100,100,48,0,100,20,0,0,100,74,0,0,70
16,100,100,95,0,100,100,65,0,100,35,0,0,100,88,0,0,74
17,100,100,100,10,100,100,80,0,100,50,0,0,100,96,0,0,78
18,100,100,100,28,100,100,90,5,100,64,0,0,100,100,10,0,81
19,100,100,100,48,100,100,96,18,100,76,0,0,100,100,28,0,84
20,100,100,100,68,100,100,100,35,100,85,5,0,100,100,48,0,87
21,100,100,100,82,100,100,100,55,100,92,18,0,100,100,65,0,90
22,100,100,100,92,100,100,100,72,100,96,35,0,100,100,80,0,92
23,100,100,100,98,100,100,100,85,100,100,52,5,100,100,90,5,94
24,100,100,100,100,100,100,100,94,100,100,68,18,100,100,96,18,96
25,100,100,100,100,100,100,100,100,100,100,82,35,100,100,100,35,97
26,100,100,100,100,100,100,100,100,100,100,92,55,100,100,100,55,98
27,100,100,100,100,100,100,100,100,100,100,98,75,100,100,100,75,99
28,100,100,100,100,100,100,100,100,100,100,100,90,100,100,100,90,99
29,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100`,

  "michael_chen": `[METADATA]
PatientName,Michael Chen
DateOfBirth,03/14/72
PatientID,OFI-2019-0087
Gender,Male
Clinician,Dr. Adams
Location,Clinic 2 - Detroit MI
ExamDate,12/16/19
FractureDate,08/20/19
FractureLocation,Right Tibia
Fixation,Surgical Implant
FractureType,Comminuted
FractureGap,3.2mm
LastExam,12/1/19

[DATA]
Week,Anterior_S1,Anterior_S2,Anterior_S3,Anterior_S4,Lateral_S1,Lateral_S2,Lateral_S3,Lateral_S4,Posterior_S1,Posterior_S2,Posterior_S3,Posterior_S4,Medial_S1,Medial_S2,Medial_S3,Medial_S4,Overall_Pct
0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
1,8,0,0,0,5,0,0,0,3,0,0,0,2,0,0,0,1
2,18,0,0,0,12,0,0,0,7,0,0,0,4,0,0,0,3
3,30,0,0,0,20,0,0,0,12,0,0,0,8,0,0,0,4
4,44,0,0,0,30,0,0,0,18,0,0,0,12,0,0,0,7
5,58,0,0,0,40,0,0,0,25,0,0,0,18,0,0,0,9
6,70,0,0,0,50,0,0,0,32,0,0,0,24,0,0,0,11
7,80,0,0,0,60,0,0,0,40,0,0,0,30,0,0,0,13
8,88,0,0,0,68,0,0,0,48,0,0,0,36,0,0,0,15
9,94,0,0,0,76,0,0,0,55,0,0,0,42,0,0,0,17
10,100,5,0,0,82,0,0,0,62,0,0,0,48,0,0,0,19
11,100,14,0,0,88,0,0,0,68,0,0,0,54,0,0,0,20
12,100,24,0,0,93,0,0,0,74,0,0,0,60,0,0,0,22
13,100,35,0,0,97,0,0,0,80,0,0,0,66,0,0,0,24
14,100,46,0,0,100,8,0,0,85,0,0,0,72,0,0,0,26
15,100,56,0,0,100,18,0,0,90,0,0,0,78,0,0,0,28
16,100,65,0,0,100,28,0,0,94,0,0,0,84,0,0,0,31
17,100,74,0,0,100,38,0,0,97,0,0,0,89,0,0,0,34
18,100,82,0,0,100,48,0,0,100,5,0,0,93,0,0,0,37
19,100,88,0,0,100,58,0,0,100,14,0,0,96,0,0,0,40
20,100,94,0,0,100,68,0,0,100,24,0,0,100,4,0,0,43
21,100,98,0,0,100,76,0,0,100,34,0,0,100,14,0,0,47
22,100,100,8,0,100,84,0,0,100,44,0,0,100,24,0,0,50
23,100,100,18,0,100,90,0,0,100,54,0,0,100,34,0,0,53
24,100,100,30,0,100,95,0,0,100,62,0,0,100,44,0,0,56
25,100,100,42,0,100,100,8,0,100,70,0,0,100,54,0,0,59
26,100,100,54,0,100,100,20,0,100,78,0,0,100,64,0,0,63
27,100,100,65,0,100,100,32,0,100,84,0,0,100,72,0,0,66
28,100,100,75,0,100,100,44,0,100,90,0,0,100,80,0,0,69
29,100,100,84,0,100,100,56,0,100,94,0,0,100,86,0,0,73`,

  "elena_rodriguez": `[METADATA]
PatientName,Elena Rodriguez
DateOfBirth,07/08/89
PatientID,OFI-2019-0123
Gender,Female
Clinician,Dr. Patel
Location,Clinic 8 - Ann Arbor MI
ExamDate,12/16/19
FractureDate,09/10/19
FractureLocation,Left Femur
Fixation,Surgical Implant
FractureType,Spiral
FractureGap,2.0mm
LastExam,12/1/19

[DATA]
Week,Anterior_S1,Anterior_S2,Anterior_S3,Anterior_S4,Lateral_S1,Lateral_S2,Lateral_S3,Lateral_S4,Posterior_S1,Posterior_S2,Posterior_S3,Posterior_S4,Medial_S1,Medial_S2,Medial_S3,Medial_S4,Overall_Pct
0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
1,12,0,0,0,8,0,0,0,10,0,0,0,5,0,0,0,2
2,28,0,0,0,18,0,0,0,24,0,0,0,12,0,0,0,5
3,48,0,0,0,32,0,0,0,40,0,0,0,22,0,0,0,9
4,68,0,0,0,48,0,0,0,58,0,0,0,34,0,0,0,13
5,85,0,0,0,62,0,0,0,74,0,0,0,48,0,0,0,17
6,96,0,0,0,76,0,0,0,88,0,0,0,60,0,0,0,20
7,100,12,0,0,88,0,0,0,98,0,0,0,72,0,0,0,24
8,100,28,0,0,96,0,0,0,100,10,0,0,82,0,0,0,27
9,100,46,0,0,100,10,0,0,100,24,0,0,90,0,0,0,31
10,100,62,0,0,100,24,0,0,100,40,0,0,96,0,0,0,35
11,100,76,0,0,100,40,0,0,100,56,0,0,100,8,0,0,40
12,100,88,0,0,100,56,0,0,100,70,0,0,100,22,0,0,46
13,100,96,0,0,100,70,0,0,100,82,0,0,100,38,0,0,52
14,100,100,10,0,100,82,0,0,100,92,0,0,100,54,0,0,58
15,100,100,26,0,100,92,0,0,100,98,0,0,100,68,0,0,63
16,100,100,44,0,100,98,0,0,100,100,10,0,100,80,0,0,68
17,100,100,60,0,100,100,12,0,100,100,26,0,100,90,0,0,73
18,100,100,76,0,100,100,28,0,100,100,42,0,100,98,0,0,78
19,100,100,88,0,100,100,46,0,100,100,58,0,100,100,10,0,82
20,100,100,96,0,100,100,62,0,100,100,72,0,100,100,28,0,86
21,100,100,100,12,100,100,76,0,100,100,84,0,100,100,46,0,89
22,100,100,100,30,100,100,88,8,100,100,92,8,100,100,62,0,92
23,100,100,100,50,100,100,96,22,100,100,98,22,100,100,76,5,94
24,100,100,100,70,100,100,100,40,100,100,100,40,100,100,88,18,96
25,100,100,100,86,100,100,100,60,100,100,100,60,100,100,96,35,97
26,100,100,100,96,100,100,100,78,100,100,100,78,100,100,100,55,98
27,100,100,100,100,100,100,100,92,100,100,100,92,100,100,100,76,99
28,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,92,99
29,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100`,

  "james_williams": `[METADATA]
PatientName,James Williams
DateOfBirth,11/02/55
PatientID,OFI-2019-0156
Gender,Male
Clinician,Dr. Singh
Location,Clinic 1 - Lansing MI
ExamDate,12/16/19
FractureDate,09/24/19
FractureLocation,Right Hip
Fixation,Surgical Implant
FractureType,Oblique
FractureGap,2.8mm
LastExam,12/1/19

[DATA]
Week,Anterior_S1,Anterior_S2,Anterior_S3,Anterior_S4,Lateral_S1,Lateral_S2,Lateral_S3,Lateral_S4,Posterior_S1,Posterior_S2,Posterior_S3,Posterior_S4,Medial_S1,Medial_S2,Medial_S3,Medial_S4,Overall_Pct
0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
1,6,0,0,0,4,0,0,0,3,0,0,0,2,0,0,0,1
2,14,0,0,0,10,0,0,0,7,0,0,0,5,0,0,0,2
3,24,0,0,0,18,0,0,0,12,0,0,0,8,0,0,0,4
4,36,0,0,0,26,0,0,0,18,0,0,0,12,0,0,0,6
5,48,0,0,0,36,0,0,0,24,0,0,0,16,0,0,0,8
6,60,0,0,0,46,0,0,0,32,0,0,0,22,0,0,0,10
7,70,0,0,0,55,0,0,0,40,0,0,0,28,0,0,0,12
8,78,0,0,0,64,0,0,0,48,0,0,0,34,0,0,0,14
9,85,0,0,0,72,0,0,0,55,0,0,0,40,0,0,0,16
10,90,0,0,0,78,0,0,0,62,0,0,0,46,0,0,0,17
11,95,0,0,0,84,0,0,0,68,0,0,0,52,0,0,0,19
12,98,0,0,0,88,0,0,0,74,0,0,0,58,0,0,0,20
13,100,6,0,0,92,0,0,0,80,0,0,0,64,0,0,0,21
14,100,14,0,0,96,0,0,0,85,0,0,0,70,0,0,0,23
15,100,22,0,0,98,0,0,0,89,0,0,0,75,0,0,0,24
16,100,30,0,0,100,6,0,0,93,0,0,0,80,0,0,0,26
17,100,38,0,0,100,14,0,0,96,0,0,0,85,0,0,0,27
18,100,46,0,0,100,22,0,0,98,0,0,0,89,0,0,0,28
19,100,54,0,0,100,30,0,0,100,6,0,0,92,0,0,0,30
20,100,62,0,0,100,38,0,0,100,14,0,0,95,0,0,0,32
21,100,70,0,0,100,46,0,0,100,22,0,0,98,0,0,0,34
22,100,76,0,0,100,54,0,0,100,30,0,0,100,6,0,0,37
23,100,82,0,0,100,62,0,0,100,38,0,0,100,14,0,0,40
24,100,88,0,0,100,70,0,0,100,46,0,0,100,22,0,0,43
25,100,92,0,0,100,76,0,0,100,54,0,0,100,30,0,0,46
26,100,96,0,0,100,82,0,0,100,62,0,0,100,38,0,0,49
27,100,98,0,0,100,88,0,0,100,68,0,0,100,46,0,0,52
28,100,100,6,0,100,92,0,0,100,74,0,0,100,54,0,0,55
29,100,100,14,0,100,96,0,0,100,80,0,0,100,60,0,0,58`,

  "aisha_patel": `[METADATA]
PatientName,Aisha Patel
DateOfBirth,04/19/15
PatientID,OFI-2019-0201
Gender,Female
Clinician,Dr. Nakamura
Location,Clinic 3 - Kalamazoo MI
ExamDate,12/16/19
FractureDate,10/15/19
FractureLocation,Left Radius
Fixation,Splint
FractureType,Greenstick
FractureGap,0.5mm
LastExam,12/1/19

[DATA]
Week,Anterior_S1,Anterior_S2,Anterior_S3,Anterior_S4,Lateral_S1,Lateral_S2,Lateral_S3,Lateral_S4,Posterior_S1,Posterior_S2,Posterior_S3,Posterior_S4,Medial_S1,Medial_S2,Medial_S3,Medial_S4,Overall_Pct
0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
1,25,0,0,0,20,0,0,0,15,0,0,0,12,0,0,0,5
2,55,0,0,0,45,0,0,0,35,0,0,0,28,0,0,0,10
3,82,0,0,0,68,0,0,0,58,0,0,0,48,0,0,0,16
4,100,15,0,0,90,0,0,0,78,0,0,0,68,0,0,0,22
5,100,38,0,0,100,12,0,0,94,0,0,0,85,0,0,0,28
6,100,62,0,0,100,32,0,0,100,10,0,0,96,0,0,0,34
7,100,84,0,0,100,55,0,0,100,28,0,0,100,12,0,0,41
8,100,98,0,0,100,76,0,0,100,48,0,0,100,30,0,0,47
9,100,100,18,0,100,92,0,0,100,68,0,0,100,50,0,0,54
10,100,100,42,0,100,100,14,0,100,84,0,0,100,70,0,0,61
11,100,100,66,0,100,100,36,0,100,96,0,0,100,86,0,0,68
12,100,100,86,0,100,100,60,0,100,100,16,0,100,98,0,0,75
13,100,100,98,0,100,100,80,0,100,100,38,0,100,100,18,0,81
14,100,100,100,16,100,100,94,5,100,100,60,0,100,100,42,0,86
15,100,100,100,38,100,100,100,22,100,100,80,8,100,100,64,5,90
16,100,100,100,62,100,100,100,46,100,100,94,24,100,100,82,18,93
17,100,100,100,82,100,100,100,68,100,100,100,46,100,100,95,38,96
18,100,100,100,96,100,100,100,86,100,100,100,68,100,100,100,60,98
19,100,100,100,100,100,100,100,96,100,100,100,86,100,100,100,82,99
20,100,100,100,100,100,100,100,100,100,100,100,98,100,100,100,96,100
21,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100,100`,
};

const PATIENT_LIST = [
  { id: "sarah_johnson", label: "Sarah Johnson — Left Wrist, Simple, F/25" },
  { id: "michael_chen", label: "Michael Chen — Right Tibia, Comminuted, M/52" },
  { id: "elena_rodriguez", label: "Elena Rodriguez — Left Femur, Spiral, F/34" },
  { id: "james_williams", label: "James Williams — Right Hip, Oblique, M/68" },
  { id: "aisha_patel", label: "Aisha Patel — Left Radius, Greenstick, F/8" },
];

// ─── Main Application ────────────────────────────────────────
export default function App() {
  const [patientData, setPatientData] = useState(null);
  const [timeData, setTimeData] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fileName, setFileName] = useState("");
  const [selectedPatient, setSelectedPatient] = useState("sarah_johnson");
  const intervalRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleFileLoaded = useCallback((text, name) => {
    const { metadata, timeData: td } = parseFileData(text);
    setPatientData(metadata);
    setTimeData(td);
    setCurrentIndex(0);
    setFileName(name);
    setIsPlaying(false);
  }, []);

  // Load selected sample patient
  useEffect(() => {
    if (PATIENTS[selectedPatient]) {
      handleFileLoaded(PATIENTS[selectedPatient], `${selectedPatient}.csv`);
    }
  }, [selectedPatient, handleFileLoaded]);

  const handleFileUpload = useCallback((file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext === "csv" || ext === "txt") {
      const reader = new FileReader();
      reader.onload = (e) => { setSelectedPatient(""); handleFileLoaded(e.target.result, file.name); };
      reader.readAsText(file);
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const csv = XLSX.utils.sheet_to_csv(ws);
        setSelectedPatient("");
        handleFileLoaded(csv, file.name);
      };
      reader.readAsArrayBuffer(file);
    }
  }, [handleFileLoaded]);

  useEffect(() => {
    if (isPlaying && timeData.length > 0) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= timeData.length - 1) { setIsPlaying(false); return prev; }
          return prev + 1;
        });
      }, 800);
    }
    return () => clearInterval(intervalRef.current);
  }, [isPlaying, timeData.length]);

  const currentRow = timeData[currentIndex] || {};
  const prevRow = currentIndex > 0 ? timeData[currentIndex - 1] : null;

  // Compute dynamic dates based on fracture date + current week
  const fractureDate = patientData ? parseDate(patientData.FractureDate) : null;
  const currentExamDate = fractureDate ? formatDate(addWeeks(fractureDate, currentRow.Week ?? 0)) : patientData?.ExamDate || "—";
  const lastExamDate = prevRow && fractureDate ? formatDate(addWeeks(fractureDate, prevRow.Week ?? 0)) : (currentIndex === 0 ? "—" : patientData?.LastExam || "—");

  // Chart data
  const chartData = useMemo(() => {
    const maxWeeks = 30;
    const p10 = generatePercentileCurve(10, maxWeeks);
    const p50 = generatePercentileCurve(50, maxWeeks);
    const p75 = generatePercentileCurve(75, maxWeeks);
    const p90 = generatePercentileCurve(90, maxWeeks);
    const merged = [];
    for (let w = 0; w <= maxWeeks; w++) {
      const patientRow = timeData.find((r) => r.Week === w);
      const inRange = w <= (currentRow.Week ?? 0);
      const projected = !inRange && w > (currentRow.Week ?? 0);
      let projVal = null;
      if (projected && currentRow.Overall_Pct != null && currentRow.Week > 0) {
        const rate = currentRow.Overall_Pct / currentRow.Week;
        projVal = Math.min(currentRow.Overall_Pct + rate * (w - currentRow.Week), 100);
      }
      merged.push({
        week: w,
        p10: p10[w]?.value ?? 100, p50: p50[w]?.value ?? 100,
        p75: p75[w]?.value ?? 100, p90: p90[w]?.value ?? 100,
        patient: inRange && patientRow ? patientRow.Overall_Pct : null,
        projected: projected ? projVal : (w === (currentRow.Week ?? 0) ? currentRow.Overall_Pct : null),
      });
    }
    return merged;
  }, [timeData, currentIndex, currentRow]);

  const playFromStart = () => { setCurrentIndex(0); setIsPlaying(true); };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: COLORS.bg, height: "100vh", overflow: "hidden", color: COLORS.text, boxSizing: "border-box" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${COLORS.bg}; margin: 0; }
        input[type="range"] { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 3px; background: #2d333b; outline: none; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 50%; background: ${COLORS.accent}; cursor: pointer; border: 2px solid #fff; }
        .recharts-cartesian-grid-horizontal line, .recharts-cartesian-grid-vertical line { stroke: ${COLORS.gridLine} !important; }
        select { font-family: 'DM Sans', sans-serif; }
        .app-inner { padding: 20px 24px; height: 100%; display: flex; flex-direction: column; min-height: 0; }
        @media (max-width: 639px) { .app-inner { padding: 12px; } }
        @media (max-height: 799px) { .app-inner { padding: 10px 16px; } }
        .compact-mb { margin-bottom: 20px; }
        @media (max-height: 799px) { .compact-mb { margin-bottom: 10px; } }
        .chart-card { padding: 20px 16px 12px 8px; }
        @media (max-height: 799px) { .chart-card { padding: 12px 8px 8px 8px; } }
        .patient-grid { grid-template-columns: repeat(6, 1fr); }
        @media (max-width: 899px) { .patient-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 599px) { .patient-grid { grid-template-columns: repeat(2, 1fr); } }
      `}</style>

      <div className="app-inner" style={{ maxWidth: 1280, margin: "0 auto" }}>
        {/* ─── PATIENT HEADER ──────────────────────────── */}
        <div className="compact-mb" style={{ background: COLORS.headerBg, borderRadius: 10, borderTop: `4px solid ${COLORS.headerBorder}`, padding: "16px 20px", boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}>
          {patientData ? (
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
              {/* Real logo from PDF */}
              <img src="./orthoforge-logo.png" alt="OrthoForge" style={{ width: 76, height: 76, objectFit: "contain", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="patient-grid" style={{ display: "grid", gap: "8px 24px" }}>
                  {[
                    ["Patient Name", patientData.PatientName],
                    ["Patient ID", patientData.PatientID],
                    ["Date of Birth", patientData.DateOfBirth],
                    ["Gender", patientData.Gender],
                    ["Clinician", patientData.Clinician],
                    ["Date", currentExamDate],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textDark, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
                      <div style={{ fontSize: 14, color: COLORS.textDark, fontFamily: "'JetBrains Mono', monospace" }}>{val || "—"}</div>
                    </div>
                  ))}
                </div>
                <div style={{ height: 1, background: "#e0e0e0", margin: "10px 0" }} />
                <div className="patient-grid" style={{ display: "grid", gap: "8px 24px" }}>
                  {[
                    ["Fracture Date", patientData.FractureDate],
                    ["Location", patientData.FractureLocation],
                    ["Fixation", patientData.Fixation],
                    ["Fracture Type", patientData.FractureType],
                    ["Fracture Gap", patientData.FractureGap],
                    ["Last Exam", lastExamDate],
                  ].map(([label, val]) => (
                    <div key={label + "2"}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textDark, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
                      <div style={{ fontSize: 14, color: COLORS.textDark, fontFamily: "'JetBrains Mono', monospace" }}>{val || "—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <img src="./orthoforge-logo.png" alt="OrthoForge" style={{ width: 76, height: 76, objectFit: "contain" }} />
              <div style={{ color: COLORS.textDark, fontSize: 16, fontWeight: 600 }}>OrthoForge — Select or load a patient file</div>
            </div>
          )}
        </div>

        {/* ─── PATIENT SELECTOR (with import option) ──── */}
        <div className="compact-mb" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: COLORS.bgCard, borderRadius: 8, border: "1px solid #2d333b" }}>
          <span style={{ color: COLORS.textMuted, fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>Select Patient:</span>
          <select
            value={selectedPatient}
            onChange={(e) => {
              if (e.target.value === "__import__") {
                fileInputRef.current?.click();
                // Reset select back to current patient so it doesn't stick on "Import"
                e.target.value = selectedPatient;
              } else {
                setSelectedPatient(e.target.value);
              }
            }}
            style={{ flex: 1, maxWidth: 500, padding: "8px 12px", background: "#2d333b", color: COLORS.text, border: "1px solid #444c56", borderRadius: 6, fontSize: 13, cursor: "pointer", outline: "none" }}
          >
            {selectedPatient === "" && <option value="">— Custom File —</option>}
            {PATIENT_LIST.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
            <option disabled style={{ borderTop: "1px solid #555" }}>────────────────────</option>
            <option value="__import__">📂 Import from file...</option>
          </select>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.txt"
            style={{ display: "none" }}
            onChange={(e) => { handleFileUpload(e.target.files[0]); e.target.value = ""; }}
          />
        </div>

        {/* ─── TITLE ───────────────────────────────────── */}
        <h1 style={{ fontSize: 22, fontWeight: 700, color: COLORS.accent, marginBottom: 16, letterSpacing: 0.5 }}>
          Orthoforge Healing Analysis V2
        </h1>

        {/* ─── MAIN CHART ──────────────────────────────── */}
        <div className="chart-card" style={{ background: COLORS.bgCard, borderRadius: 10, marginBottom: 0, border: "1px solid #2d333b", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 60, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.gridLine} />
              <XAxis dataKey="week" stroke={COLORS.textMuted} tick={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} label={{ value: "Weeks", position: "insideBottom", offset: -4, fontSize: 12, fill: COLORS.textMuted }} />
              <YAxis domain={[0, 100]} stroke={COLORS.textMuted} tick={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }} label={{ value: "%", position: "insideTopLeft", offset: 10, fontSize: 14, fill: COLORS.textMuted }} />

              {/* Percentile lines — ALL same muted color, all solid */}
              <Line type="monotone" dataKey="p10" stroke={COLORS.percentile} strokeWidth={1.2} dot={false} strokeOpacity={0.5} />
              <Line type="monotone" dataKey="p50" stroke={COLORS.percentile} strokeWidth={1.2} dot={false} strokeOpacity={0.65} />
              <Line type="monotone" dataKey="p75" stroke={COLORS.percentile} strokeWidth={1.2} dot={false} strokeOpacity={0.8} />
              <Line type="monotone" dataKey="p90" stroke={COLORS.percentile} strokeWidth={1.2} dot={false} strokeOpacity={0.95} />

              {/* Patient projected trajectory — dashed */}
              <Line type="monotone" dataKey="projected" stroke={COLORS.patientProjected} strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls={false} strokeOpacity={0.5} />

              {/* Patient actual — bright, thick, distinct */}
              <Line type="monotone" dataKey="patient" stroke={COLORS.patient} strokeWidth={3.5} dot={<ChartDot currentWeek={currentRow.Week ?? 0} />} connectNulls={false} activeDot={false} />

              {currentRow.Week != null && (
                <ReferenceLine x={currentRow.Week} stroke={COLORS.patient} strokeDasharray="3 3" strokeOpacity={0.3} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 20, paddingRight: 20, marginTop: 4 }}>
            {[
              { label: "90th", opacity: 0.95 },
              { label: "75th", opacity: 0.8 },
              { label: "50th", opacity: 0.65 },
              { label: "10th", opacity: 0.5 },
            ].map((p) => (
              <div key={p.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="20" height="6" viewBox="0 0 20 6"><line x1="0" y1="3" x2="20" y2="3" stroke={COLORS.percentile} strokeWidth={1.5} strokeOpacity={p.opacity} /></svg>
                <span style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>{p.label}</span>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="20" height="6" viewBox="0 0 20 6"><line x1="0" y1="3" x2="20" y2="3" stroke={COLORS.patient} strokeWidth={3} /></svg>
              <span style={{ fontSize: 11, color: COLORS.patient, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>Patient</span>
            </div>
          </div>
        </div>

        {/* ─── PLAYBACK CONTROLS ───────────────────────── */}
        <div className="compact-mb" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, padding: "12px 20px", background: COLORS.bgCard, borderRadius: 8, border: "1px solid #2d333b" }}>
          <button onClick={playFromStart} style={{ padding: "8px 16px", background: COLORS.accent, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>▶ Play</button>
          <button onClick={() => setIsPlaying(!isPlaying)} style={{ padding: "8px 16px", background: isPlaying ? "#e53e3e" : "#3a424d", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>{isPlaying ? "⏸ Pause" : "⏯ Resume"}</button>
          <div style={{ flex: 1 }}>
            <input type="range" min={0} max={Math.max(timeData.length - 1, 0)} value={currentIndex} onChange={(e) => { setIsPlaying(false); setCurrentIndex(Number(e.target.value)); }} style={{ width: "100%" }} />
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: COLORS.patient, minWidth: 120, textAlign: "right" }}>
            Week {currentRow.Week ?? 0} &nbsp;|&nbsp; {Math.round(currentRow.Overall_Pct ?? 0)}%
          </div>
        </div>

        {/* ─── STAGES + DONUT ──────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, flex: 1, minHeight: 0 }}>
          <div style={{ background: COLORS.bgCard, borderRadius: 10, padding: 24, border: "1px solid #2d333b", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{ display: "flex", gap: 20, marginBottom: 8, paddingLeft: 106 }}>
              {["Stage 1", "Stage 2", "Stage 3", "Stage 4"].map((s, i) => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, background: STAGE_COLORS[i] }} />
                  <span style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>{s}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 8 }}>
              <StageBar label="Anterior" stages={[currentRow.Anterior_S1 ?? 0, currentRow.Anterior_S2 ?? 0, currentRow.Anterior_S3 ?? 0, currentRow.Anterior_S4 ?? 0]} />
              <StageBar label="Lateral" stages={[currentRow.Lateral_S1 ?? 0, currentRow.Lateral_S2 ?? 0, currentRow.Lateral_S3 ?? 0, currentRow.Lateral_S4 ?? 0]} />
              <StageBar label="Posterior" stages={[currentRow.Posterior_S1 ?? 0, currentRow.Posterior_S2 ?? 0, currentRow.Posterior_S3 ?? 0, currentRow.Posterior_S4 ?? 0]} />
              <StageBar label="Medial" stages={[currentRow.Medial_S1 ?? 0, currentRow.Medial_S2 ?? 0, currentRow.Medial_S3 ?? 0, currentRow.Medial_S4 ?? 0]} />
            </div>
          </div>
          <div style={{ background: COLORS.bgCard, borderRadius: 10, padding: 24, border: "1px solid #2d333b", display: "flex", minHeight: 0 }}>
            <DonutChart currentRow={currentRow} />
          </div>
        </div>

        <div style={{ textAlign: "center", padding: "24px 0 12px", color: COLORS.textMuted, fontSize: 12 }}>
          OrthoForge Healing Analysis • Clinical Evaluation Dashboard
        </div>
      </div>
    </div>
  );
}
