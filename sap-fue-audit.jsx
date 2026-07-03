import { useState, useMemo } from "react";

// ── Design tokens ────────────────────────────────────────────────────────────
// Palette: audit-room green (#0B4D2E) deep, sage (#2D7A4F), amber alert (#E8A020),
//          paper (#FAFAF7), ink (#1A1A1A), mist (#E8EDE8), risk-red (#C0392B)
// Signature: a live "compliance meter" — a circular gauge that fills as the audit progresses,
//            turning from red → amber → green based on FUE accuracy score.

const T = {
  deep: "#0B4D2E",
  sage: "#2D7A4F",
  mid: "#3D9E6A",
  amber: "#E8A020",
  amberLight: "#FEF3DC",
  paper: "#FAFAF7",
  ink: "#1A1A1A",
  mist: "#E8EDE8",
  steel: "#6B7B6E",
  risk: "#C0392B",
  riskLight: "#FDECEA",
  ok: "#1A6B3A",
  okLight: "#E8F5ED",
  white: "#FFFFFF",
};

// ── FUE weight definitions ───────────────────────────────────────────────────
const USER_TYPES = [
  {
    id: "professional",
    label: "Professional User",
    weight: 1.0,
    description: "Full system access — finance, procurement, HR admin, configuration, reporting",
    examples: ["Finance managers", "SAP configurators", "Procurement officers", "HR administrators"],
    tcodes: ["FB01", "ME21N", "PA30", "SE38", "SM30"],
    riskLevel: "high",
  },
  {
    id: "limited",
    label: "Limited Professional",
    weight: 0.5,
    description: "Restricted departmental access — runs specific transactions, limited reporting",
    examples: ["Department heads", "Team leads", "Senior analysts with restricted scope"],
    tcodes: ["ME23N", "FB03", "PA20", "MM60"],
    riskLevel: "medium",
  },
  {
    id: "functional",
    label: "Functional User",
    weight: 0.3,
    description: "Task-specific workflows — data entry, approvals, single-area operations",
    examples: ["Data entry clerks", "Warehouse operators", "Approvers", "Branch coordinators"],
    tcodes: ["MIGO", "VL02N", "IW31", "CO11N"],
    riskLevel: "medium",
  },
  {
    id: "employee",
    label: "Employee Self-Service",
    weight: 0.1,
    description: "Self-service portal only — payslips, leave requests, expense claims",
    examples: ["All staff on ESS/MSS", "Agents checking payslips", "Leave requesters"],
    tcodes: ["ESS", "MSS", "CATS", "PR05"],
    riskLevel: "low",
  },
  {
    id: "developer",
    label: "Developer / Basis",
    weight: 2.0,
    description: "Technical access — development, transport management, system administration",
    examples: ["ABAP developers", "Basis administrators", "Security admins"],
    tcodes: ["SE80", "STMS", "SU01", "SM21", "DB02"],
    riskLevel: "high",
  },
];

const RISK_FLAGS = [
  { id: "inactive", label: "Users inactive > 90 days", weight: 0.25, type: "waste" },
  { id: "shared", label: "Shared / generic accounts", weight: 0.5, type: "compliance" },
  { id: "overclass", label: "Over-classified users (wrong type)", weight: 0.3, type: "cost" },
  { id: "indirect", label: "Indirect access via 3rd-party systems", weight: 1.0, type: "compliance" },
  { id: "terminated", label: "Terminated employees still active", weight: 1.0, type: "compliance" },
  { id: "service", label: "Service / batch / interface accounts", weight: 0.3, type: "compliance" },
];

const PHASES = [
  { id: "scope", label: "Scope & Inventory", icon: "📋" },
  { id: "classify", label: "User Classification", icon: "👥" },
  { id: "risks", label: "Risk Assessment", icon: "⚠️" },
  { id: "calculate", label: "FUE Calculation", icon: "🧮" },
  { id: "report", label: "Audit Report", icon: "📊" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n, d = 1) { return Number(n).toFixed(d); }
function pct(a, b) { return b === 0 ? 0 : Math.round((a / b) * 100); }

function ComplianceMeter({ score }) {
  // score 0–100
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 75 ? T.mid : score >= 45 ? T.amber : T.risk;
  const label = score >= 75 ? "LOW RISK" : score >= 45 ? "REVIEW NEEDED" : "HIGH RISK";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={130} height={130} viewBox="0 0 130 130">
        <circle cx={65} cy={65} r={r} fill="none" stroke={T.mist} strokeWidth={10} />
        <circle cx={65} cy={65} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 65 65)"
          style={{ transition: "stroke-dasharray 0.8s ease, stroke 0.5s ease" }}
        />
        <text x={65} y={60} textAnchor="middle" fontSize={22} fontWeight={800} fill={color}>{score}</text>
        <text x={65} y={78} textAnchor="middle" fontSize={9} fontWeight={700} fill={T.steel} letterSpacing={1}>/100</text>
      </svg>
      <span style={{ fontSize: 10, fontWeight: 800, color, letterSpacing: "0.1em" }}>{label}</span>
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{
      background: T.white, borderRadius: 12, padding: 24,
      border: `1px solid ${T.mist}`, boxShadow: "0 2px 8px rgba(11,77,46,0.06)",
      ...style,
    }}>{children}</div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 800, color: T.steel, letterSpacing: "0.1em", marginBottom: 6 }}>{children}</div>;
}

function Tag({ children, color = T.deep }) {
  return (
    <span style={{
      background: color + "18", color, border: `1px solid ${color}40`,
      borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700,
    }}>{children}</span>
  );
}

function RiskBadge({ level }) {
  const map = { high: [T.risk, "HIGH"], medium: [T.amber, "MEDIUM"], low: [T.ok, "LOW"] };
  const [c, l] = map[level] || [T.steel, level];
  return <Tag color={c}>{l} RISK</Tag>;
}

function NumInput({ value, onChange, min = 0, max = 9999 }) {
  return (
    <input
      type="number" min={min} max={max} value={value}
      onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))}
      style={{
        width: 90, border: `1.5px solid ${T.mist}`, borderRadius: 7,
        padding: "8px 10px", fontSize: 15, fontWeight: 700, color: T.ink,
        textAlign: "center", outline: "none", background: T.paper,
      }}
    />
  );
}

function Btn({ children, onClick, variant = "primary", disabled, style }) {
  const styles = {
    primary: { background: T.deep, color: T.white },
    secondary: { background: T.white, color: T.deep, border: `1.5px solid ${T.deep}` },
    amber: { background: T.amber, color: T.white },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      border: "none", borderRadius: 8, padding: "10px 22px",
      fontWeight: 700, fontSize: 13, cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1, transition: "opacity 0.15s",
      ...styles[variant], ...style,
    }}>{children}</button>
  );
}

// ── AI Analysis ──────────────────────────────────────────────────────────────
async function fetchAIAnalysis(auditData) {
  const prompt = `You are a senior SAP licensing consultant specializing in FUE (Functional User Equivalent) audits.

Analyze this internal FUE audit data and respond ONLY with a JSON object (no markdown, no extra text):
{
  "complianceScore": number (0-100, based on risk flags and classification accuracy),
  "executiveSummary": "2-3 sentence summary of audit findings",
  "topRisks": [
    { "risk": "risk description", "impact": "financial or compliance impact", "priority": "Critical|High|Medium" }
  ],
  "costSavings": "estimated savings opportunity in narrative form",
  "recommendations": [
    { "action": "specific action", "timeline": "Immediate|30 days|90 days", "effort": "Low|Medium|High" }
  ],
  "auditReadiness": "Ready|Needs Work|Not Ready",
  "auditReadinessNote": "one sentence explanation"
}

Audit data:
- Organisation: ${auditData.orgName}
- Licensed FUEs (contracted): ${auditData.licensedFUEs}
- Calculated FUEs from audit: ${fmt(auditData.calculatedFUEs)}
- Total users inventoried: ${auditData.totalUsers}
- User breakdown: ${JSON.stringify(auditData.userCounts)}
- Risk flags identified: ${JSON.stringify(auditData.riskFlags)}
- Buffer applied: ${auditData.buffer}%
- Total FUEs with buffer: ${fmt(auditData.totalWithBuffer)}
- FUE variance (calculated vs licensed): ${fmt(auditData.variance)} FUEs (${auditData.variance > 0 ? "OVER-licensed" : "UNDER-licensed"})`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  const raw = data.content?.find(b => b.type === "text")?.text || "{}";
  return JSON.parse(raw.replace(/```json|```/g, "").trim());
}

// ── Phase Components ─────────────────────────────────────────────────────────

function PhaseScope({ state, setState }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card>
        <Label>ORGANISATION NAME</Label>
        <input value={state.orgName} onChange={e => setState(s => ({ ...s, orgName: e.target.value }))}
          placeholder="e.g. Prestige Real Estate Group"
          style={{
            width: "100%", border: `1.5px solid ${T.mist}`, borderRadius: 8,
            padding: "10px 14px", fontSize: 14, color: T.ink, boxSizing: "border-box",
          }} />
      </Card>

      <Card>
        <Label>SAP SYSTEM DETAILS</Label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {[
            ["SAP System", "system", "e.g. S/4HANA 2023"],
            ["Audit Period", "period", "e.g. FY2026 Q2"],
            ["Licensed FUEs (contracted)", "licensedFUEs", "e.g. 180"],
            ["Contract Renewal Date", "renewalDate", "e.g. Dec 2026"],
          ].map(([label, key, ph]) => (
            <div key={key}>
              <Label>{label.toUpperCase()}</Label>
              <input value={state[key] || ""} placeholder={ph}
                onChange={e => setState(s => ({ ...s, [key]: key === "licensedFUEs" ? (parseInt(e.target.value) || 0) : e.target.value }))}
                style={{
                  width: "100%", border: `1.5px solid ${T.mist}`, borderRadius: 8,
                  padding: "9px 12px", fontSize: 13, color: T.ink, boxSizing: "border-box",
                }} />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <Label>AUDIT SCOPE CHECKLIST</Label>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: T.steel, lineHeight: 1.6 }}>
          Confirm which data sources have been pulled before proceeding.
        </p>
        {[
          "SAP SU01 user list exported",
          "Last login dates extracted (SM20 / STAD)",
          "Role assignments reviewed (SU10 / SUIM)",
          "HR system headcount cross-referenced",
          "Terminated employee list obtained from HR",
          "Third-party integrations / indirect access inventoried",
          "Service accounts and batch users identified",
        ].map((item, i) => (
          <label key={i} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, cursor: "pointer" }}>
            <input type="checkbox"
              checked={state.checklist?.[i] || false}
              onChange={e => setState(s => ({
                ...s, checklist: { ...s.checklist, [i]: e.target.checked }
              }))}
              style={{ width: 16, height: 16, accentColor: T.deep }} />
            <span style={{ fontSize: 13, color: T.ink }}>{item}</span>
          </label>
        ))}
        <div style={{ marginTop: 12, padding: "8px 14px", background: T.mist, borderRadius: 8 }}>
          <span style={{ fontSize: 12, color: T.steel }}>
            {Object.values(state.checklist || {}).filter(Boolean).length} / 7 items confirmed
          </span>
        </div>
      </Card>
    </div>
  );
}

function PhaseClassify({ state, setState }) {
  const updateCount = (id, val) => setState(s => ({ ...s, userCounts: { ...s.userCounts, [id]: val } }));

  const total = USER_TYPES.reduce((sum, t) => sum + (state.userCounts?.[t.id] || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <p style={{ margin: "0 0 4px", fontSize: 13, color: T.steel, lineHeight: 1.6 }}>
          Enter the <strong>actual count</strong> of users per type based on your SU01 export and role analysis — not job titles.
          Cross-reference T-code access patterns to confirm classification.
        </p>
      </Card>

      {USER_TYPES.map(ut => {
        const count = state.userCounts?.[ut.id] || 0;
        const fues = count * ut.weight;
        return (
          <Card key={ut.id} style={{ borderLeft: `4px solid ${ut.riskLevel === "high" ? T.risk : ut.riskLevel === "medium" ? T.amber : T.mid}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 800, fontSize: 15, color: T.ink }}>{ut.label}</span>
                  <Tag color={T.deep}>× {ut.weight} FUE</Tag>
                  <RiskBadge level={ut.riskLevel} />
                </div>
                <p style={{ margin: "0 0 10px", fontSize: 12, color: T.steel, lineHeight: 1.5 }}>{ut.description}</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {ut.examples.map(ex => (
                    <span key={ex} style={{ fontSize: 11, background: T.mist, color: T.steel, padding: "2px 8px", borderRadius: 4 }}>{ex}</span>
                  ))}
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: T.steel }}>
                  <strong>Common T-codes:</strong> {ut.tcodes.join(", ")}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 120 }}>
                <Label>USER COUNT</Label>
                <NumInput value={count} onChange={v => updateCount(ut.id, v)} />
                {count > 0 && (
                  <div style={{ fontSize: 12, color: T.deep, fontWeight: 700 }}>= {fmt(fues)} FUEs</div>
                )}
              </div>
            </div>
          </Card>
        );
      })}

      <Card style={{ background: T.deep, border: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: T.white, fontWeight: 700, fontSize: 15 }}>Total Users Inventoried</span>
          <span style={{ color: T.amber, fontWeight: 800, fontSize: 22 }}>{total.toLocaleString()}</span>
        </div>
      </Card>
    </div>
  );
}

function PhaseRisks({ state, setState }) {
  const toggle = (id) => setState(s => ({
    ...s, riskFlags: { ...s.riskFlags, [id]: { ...s.riskFlags?.[id], active: !s.riskFlags?.[id]?.active } }
  }));
  const setCount = (id, val) => setState(s => ({
    ...s, riskFlags: { ...s.riskFlags, [id]: { ...s.riskFlags?.[id], count: val } }
  }));

  const typeColors = { waste: T.amber, compliance: T.risk, cost: T.mid };
  const typeLabels = { waste: "WASTE", compliance: "COMPLIANCE", cost: "COST SAVING" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <p style={{ margin: 0, fontSize: 13, color: T.steel, lineHeight: 1.6 }}>
          Identify risk conditions found during your review. Toggle each flag that applies and enter the number of affected users.
          These directly impact your compliance score and audit readiness rating.
        </p>
      </Card>

      {RISK_FLAGS.map(rf => {
        const flag = state.riskFlags?.[rf.id] || {};
        const active = flag.active || false;
        const count = flag.count || 0;
        const color = typeColors[rf.type];

        return (
          <Card key={rf.id} style={{
            border: active ? `2px solid ${color}` : `1px solid ${T.mist}`,
            background: active ? color + "08" : T.white,
            transition: "all 0.2s",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                <button onClick={() => toggle(rf.id)} style={{
                  width: 24, height: 24, borderRadius: 6, border: `2px solid ${active ? color : T.mist}`,
                  background: active ? color : T.white, cursor: "pointer", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center", color: T.white,
                  fontSize: 14, fontWeight: 900,
                }}>{active ? "✓" : ""}</button>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: T.ink }}>{rf.label}</span>
                    <Tag color={color}>{typeLabels[rf.type]}</Tag>
                  </div>
                  <span style={{ fontSize: 11, color: T.steel }}>Weight: ×{rf.weight} FUE per affected user</span>
                </div>
              </div>
              {active && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <Label>AFFECTED USERS</Label>
                  <NumInput value={count} onChange={v => setCount(rf.id, v)} />
                  {count > 0 && (
                    <span style={{ fontSize: 11, color, fontWeight: 700 }}>
                      {fmt(count * rf.weight)} FUE exposure
                    </span>
                  )}
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function PhaseCalculate({ state, setState, results }) {
  const { calculatedFUEs, riskExposure, totalWithBuffer, variance, byType } = results;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* FUE Breakdown */}
      <Card>
        <Label>FUE BREAKDOWN BY USER TYPE</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {byType.filter(b => b.count > 0).map(b => (
            <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 13, color: T.ink, flex: 1 }}>{b.label}</span>
              <span style={{ fontSize: 12, color: T.steel, width: 80, textAlign: "right" }}>{b.count} users × {b.weight}</span>
              <div style={{ width: 120, height: 6, background: T.mist, borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  width: `${pct(b.fues, calculatedFUEs)}%`, height: "100%",
                  background: T.deep, borderRadius: 3,
                }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: T.deep, width: 60, textAlign: "right" }}>
                {fmt(b.fues)}
              </span>
            </div>
          ))}
          {byType.every(b => b.count === 0) && (
            <p style={{ color: T.steel, fontSize: 13 }}>No users entered yet. Complete the Classification phase first.</p>
          )}
        </div>
        <div style={{ borderTop: `1px solid ${T.mist}`, paddingTop: 12, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 700, color: T.ink }}>Base FUEs</span>
          <span style={{ fontWeight: 800, fontSize: 18, color: T.deep }}>{fmt(calculatedFUEs)}</span>
        </div>
      </Card>

      {/* Growth buffer */}
      <Card>
        <Label>GROWTH BUFFER</Label>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: T.steel }}>
          Add a buffer for new hires, role changes, and seasonal peaks. Recommended: 10–15%.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <input type="range" min={0} max={30} value={state.buffer || 10}
            onChange={e => setState(s => ({ ...s, buffer: parseInt(e.target.value) }))}
            style={{ flex: 1, accentColor: T.deep }} />
          <span style={{ fontWeight: 800, fontSize: 18, color: T.deep, minWidth: 50 }}>{state.buffer || 10}%</span>
        </div>
        <div style={{ marginTop: 8, fontSize: 13, color: T.steel }}>
          Buffer adds: <strong style={{ color: T.deep }}>{fmt(calculatedFUEs * ((state.buffer || 10) / 100))} FUEs</strong>
        </div>
      </Card>

      {/* Risk exposure */}
      {riskExposure > 0 && (
        <Card style={{ borderLeft: `4px solid ${T.risk}` }}>
          <Label>RISK EXPOSURE</Label>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: T.steel }}>FUE exposure from risk flags identified</span>
            <span style={{ fontWeight: 800, fontSize: 18, color: T.risk }}>+{fmt(riskExposure)} FUEs</span>
          </div>
        </Card>
      )}

      {/* Summary vs licensed */}
      <Card style={{ background: T.deep, border: "none" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, textAlign: "center" }}>
          {[
            ["Calculated FUEs", fmt(totalWithBuffer), T.amber],
            ["Licensed FUEs", state.licensedFUEs || "—", T.white],
            ["Variance", `${variance > 0 ? "+" : ""}${fmt(variance)}`, variance > 5 ? T.risk : variance < -5 ? T.amber : T.mid],
          ].map(([label, val, color]) => (
            <div key={label}>
              <div style={{ fontSize: 10, color: "#94A3A0", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 24, fontWeight: 900, color }}>{val}</div>
            </div>
          ))}
        </div>
        {Math.abs(variance) > 5 && (
          <div style={{ marginTop: 14, padding: "10px 14px", background: "rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 13, color: "#CBD5E1" }}>
            {variance > 5
              ? `⚠ You are using ${fmt(variance)} more FUEs than licensed. Exposure to SAP audit findings.`
              : `ℹ You have ${fmt(Math.abs(variance))} unused FUEs. Potential to renegotiate contract downward.`}
          </div>
        )}
      </Card>
    </div>
  );
}

function PhaseReport({ state, results, aiResult, loadingAI, runAI }) {
  const { calculatedFUEs, totalWithBuffer, variance } = results;
  const priorityColors = { Critical: T.risk, High: T.amber, Medium: T.mid };
  const effortColors = { Low: T.ok, Medium: T.amber, High: T.risk };
  const timelineColors = { Immediate: T.risk, "30 days": T.amber, "90 days": T.mid };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header summary */}
      <Card style={{ background: "linear-gradient(135deg, #0B4D2E 0%, #2D7A4F 100%)", border: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 10, color: "#94C4A8", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6 }}>
              SAP FUE INTERNAL AUDIT REPORT
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.white, marginBottom: 4 }}>
              {state.orgName || "Your Organisation"}
            </div>
            <div style={{ fontSize: 12, color: "#94C4A8" }}>
              {state.system || "SAP System"} · {state.period || "Current Period"} · {state.licensedFUEs || "—"} FUEs licensed
            </div>
          </div>
          <ComplianceMeter score={aiResult?.complianceScore || 0} />
        </div>
      </Card>

      {/* Run AI Analysis */}
      {!aiResult && (
        <Card style={{ textAlign: "center", padding: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: T.ink, marginBottom: 8 }}>Generate AI Audit Analysis</div>
          <p style={{ color: T.steel, fontSize: 13, margin: "0 0 20px", lineHeight: 1.6 }}>
            Claude will analyze your audit data, score your compliance posture, identify top risks,
            estimate cost savings, and generate prioritized recommendations.
          </p>
          <Btn onClick={runAI} disabled={loadingAI} variant="amber">
            {loadingAI ? "Analyzing audit data…" : "Run AI Analysis"}
          </Btn>
        </Card>
      )}

      {/* AI Results */}
      {aiResult && (
        <>
          {/* Executive Summary */}
          <Card>
            <Label>EXECUTIVE SUMMARY</Label>
            <p style={{ margin: 0, fontSize: 14, color: T.ink, lineHeight: 1.7 }}>{aiResult.executiveSummary}</p>
            <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{
                padding: "8px 16px", borderRadius: 8,
                background: aiResult.auditReadiness === "Ready" ? T.okLight : aiResult.auditReadiness === "Needs Work" ? T.amberLight : T.riskLight,
                color: aiResult.auditReadiness === "Ready" ? T.ok : aiResult.auditReadiness === "Needs Work" ? T.amber : T.risk,
              }}>
                <span style={{ fontWeight: 800, fontSize: 12 }}>SAP AUDIT READINESS: {aiResult.auditReadiness?.toUpperCase()}</span>
                <div style={{ fontSize: 11, marginTop: 3 }}>{aiResult.auditReadinessNote}</div>
              </div>
            </div>
          </Card>

          {/* Top Risks */}
          <Card>
            <Label>TOP RISKS IDENTIFIED</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {aiResult.topRisks?.map((r, i) => (
                <div key={i} style={{
                  display: "flex", gap: 12, padding: "12px 14px",
                  background: T.paper, borderRadius: 8, alignItems: "flex-start",
                }}>
                  <span style={{
                    background: priorityColors[r.priority] || T.steel,
                    color: T.white, borderRadius: 5, padding: "2px 8px",
                    fontSize: 10, fontWeight: 800, flexShrink: 0, marginTop: 2,
                  }}>{r.priority?.toUpperCase()}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: T.ink, marginBottom: 3 }}>{r.risk}</div>
                    <div style={{ fontSize: 12, color: T.steel }}>{r.impact}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Cost savings */}
          <Card style={{ borderLeft: `4px solid ${T.mid}` }}>
            <Label>COST OPTIMISATION OPPORTUNITY</Label>
            <p style={{ margin: 0, fontSize: 14, color: T.ink, lineHeight: 1.6 }}>{aiResult.costSavings}</p>
          </Card>

          {/* Recommendations */}
          <Card>
            <Label>PRIORITISED RECOMMENDATIONS</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {aiResult.recommendations?.map((r, i) => (
                <div key={i} style={{
                  display: "flex", gap: 14, padding: "12px 16px",
                  background: T.paper, borderRadius: 8, alignItems: "center", flexWrap: "wrap",
                }}>
                  <span style={{
                    background: T.deep, color: T.amber,
                    width: 26, height: 26, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 800, fontSize: 12, flexShrink: 0,
                  }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 13, color: T.ink, fontWeight: 500 }}>{r.action}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Tag color={timelineColors[r.timeline] || T.steel}>{r.timeline}</Tag>
                    <Tag color={effortColors[r.effort] || T.steel}>{r.effort} effort</Tag>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* FUE Summary table */}
          <Card>
            <Label>FUE RECONCILIATION SUMMARY</Label>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <tbody>
                {[
                  ["Base FUEs calculated", fmt(calculatedFUEs)],
                  [`Growth buffer (${state.buffer || 10}%)`, fmt(calculatedFUEs * ((state.buffer || 10) / 100))],
                  ["Total FUEs required", fmt(totalWithBuffer)],
                  ["Licensed FUEs (contracted)", state.licensedFUEs || "—"],
                  ["Net variance", `${variance > 0 ? "+" : ""}${fmt(variance)} ${variance > 0 ? "(OVER)" : "(UNDER)"}`],
                ].map(([label, val], i) => (
                  <tr key={label} style={{ borderTop: i > 0 ? `1px solid ${T.mist}` : "none" }}>
                    <td style={{ padding: "9px 0", color: T.steel }}>{label}</td>
                    <td style={{
                      padding: "9px 0", textAlign: "right", fontWeight: 700,
                      color: label.includes("variance") ? (variance > 5 ? T.risk : variance < -5 ? T.amber : T.ok) : T.ink,
                    }}>{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Btn onClick={runAI} variant="secondary" style={{ alignSelf: "flex-start" }}>↺ Re-run Analysis</Btn>
        </>
      )}
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [phase, setPhase] = useState(0);
  const [state, setState] = useState({
    orgName: "", system: "", period: "", licensedFUEs: 0, renewalDate: "",
    checklist: {}, userCounts: {}, riskFlags: {}, buffer: 10,
  });
  const [aiResult, setAIResult] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);

  // Live calculations
  const results = useMemo(() => {
    const byType = USER_TYPES.map(ut => ({
      ...ut,
      count: state.userCounts?.[ut.id] || 0,
      fues: (state.userCounts?.[ut.id] || 0) * ut.weight,
    }));
    const calculatedFUEs = byType.reduce((s, b) => s + b.fues, 0);
    const riskExposure = RISK_FLAGS.reduce((s, rf) => {
      const flag = state.riskFlags?.[rf.id] || {};
      return flag.active ? s + (flag.count || 0) * rf.weight : s;
    }, 0);
    const buffer = state.buffer || 10;
    const totalWithBuffer = calculatedFUEs * (1 + buffer / 100);
    const variance = totalWithBuffer - (state.licensedFUEs || 0);
    const totalUsers = byType.reduce((s, b) => s + b.count, 0);
    return { byType, calculatedFUEs, riskExposure, totalWithBuffer, variance, totalUsers };
  }, [state]);

  async function runAI() {
    setLoadingAI(true);
    try {
      const data = await fetchAIAnalysis({
        orgName: state.orgName,
        licensedFUEs: state.licensedFUEs,
        calculatedFUEs: results.calculatedFUEs,
        totalUsers: results.totalUsers,
        userCounts: state.userCounts,
        riskFlags: Object.entries(state.riskFlags || {})
          .filter(([, v]) => v.active)
          .map(([k, v]) => ({ flag: k, count: v.count || 0 })),
        buffer: state.buffer || 10,
        totalWithBuffer: results.totalWithBuffer,
        variance: results.variance,
      });
      setAIResult(data);
    } catch (e) {
      setAIResult({ error: "Analysis failed. Please try again." });
    }
    setLoadingAI(false);
  }

  const phaseComponents = [
    <PhaseScope state={state} setState={setState} />,
    <PhaseClassify state={state} setState={setState} />,
    <PhaseRisks state={state} setState={setState} />,
    <PhaseCalculate state={state} setState={setState} results={results} />,
    <PhaseReport state={state} results={results} aiResult={aiResult} loadingAI={loadingAI} runAI={runAI} />,
  ];

  return (
    <div style={{ minHeight: "100vh", background: T.paper, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Header */}
      <div style={{
        background: T.deep, padding: "0 24px", height: 58,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 2px 12px rgba(11,77,46,0.3)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            background: T.amber, borderRadius: 8, width: 32, height: 32,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: 13, color: T.deep,
          }}>SAP</div>
          <div>
            <div style={{ color: T.white, fontWeight: 800, fontSize: 15 }}>FUE Internal Audit Tool</div>
            <div style={{ color: "#6DAB87", fontSize: 10, letterSpacing: "0.08em" }}>
              FUNCTIONAL USER EQUIVALENTS · LICENSE COMPLIANCE
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {results.calculatedFUEs > 0 && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "#6DAB87", letterSpacing: "0.08em" }}>CALCULATED FUEs</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: T.amber }}>{fmt(results.totalWithBuffer)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Phase nav */}
      <div style={{
        background: T.white, borderBottom: `1px solid ${T.mist}`,
        padding: "0 24px", display: "flex", gap: 0, overflowX: "auto",
      }}>
        {PHASES.map((p, i) => {
          const active = phase === i;
          const done = phase > i;
          return (
            <button key={p.id} onClick={() => setPhase(i)} style={{
              border: "none", background: "none", padding: "14px 20px",
              borderBottom: active ? `3px solid ${T.deep}` : "3px solid transparent",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 7,
              color: active ? T.deep : done ? T.mid : T.steel,
              fontWeight: active ? 800 : 600, fontSize: 13, whiteSpace: "nowrap",
              transition: "all 0.15s",
            }}>
              <span>{p.icon}</span>
              <span>{p.label}</span>
              {done && <span style={{ color: T.mid, fontSize: 12 }}>✓</span>}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 20px 60px" }}>
        {/* Phase heading */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: T.ink }}>
            {PHASES[phase].icon} {PHASES[phase].label}
          </h2>
          <div style={{ fontSize: 12, color: T.steel }}>
            Step {phase + 1} of {PHASES.length}
          </div>
        </div>

        {phaseComponents[phase]}

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28 }}>
          <Btn onClick={() => setPhase(p => p - 1)} disabled={phase === 0} variant="secondary">
            ← Previous
          </Btn>
          {phase < PHASES.length - 1 && (
            <Btn onClick={() => setPhase(p => p + 1)}>
              Next →
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}
