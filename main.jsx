import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

const STORAGE_KEY = "household-budget:scenario";

const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@500;700&family=Noto+Sans+JP:wght@400;500;700&display=swap');
`;

const DEFAULT_STATE = {
  income: 180000,
  otherIncome: 0,
  rent: 55000,
  utilities: 12000,
  phone: 6000,
  insurance: 8000,
  otherFixed: 5000,
  food: 35000,
  transport: 8000,
  leisure: 10000,
  otherVariable: 5000,
  goals: [
    { id: "g1", name: "欲しいもの・やりたいこと", amount: 300000 },
  ],
  monthlySavings: 20000,
  monthlyInvestment: 0,
  months: 12,
};

function newGoalId() {
  return `g-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const FIELD_GROUPS = [
  {
    label: "収入",
    tone: "income",
    fields: [
      { key: "income", label: "手取り月収", placeholder: "180000" },
      { key: "otherIncome", label: "その他収入（障害年金など）" },
    ],
  },
  {
    label: "固定費",
    tone: "fixed",
    fields: [
      { key: "rent", label: "家賃" },
      { key: "utilities", label: "水道・光熱費" },
      { key: "phone", label: "通信費" },
      { key: "insurance", label: "保険料" },
      { key: "otherFixed", label: "その他固定費" },
    ],
  },
  {
    label: "変動費",
    tone: "variable",
    fields: [
      { key: "food", label: "食費" },
      { key: "transport", label: "交通費" },
      { key: "leisure", label: "娯楽・交際費" },
      { key: "otherVariable", label: "その他変動費" },
    ],
  },
];

function yen(n) {
  const v = Math.round(Number(n) || 0);
  return v.toLocaleString("ja-JP");
}

function marginLevel(ratio) {
  if (ratio < 0)
    return { label: "赤字", note: "支出が収入を上回っています", color: "#A6472A" };
  if (ratio < 0.05)
    return { label: "厳しい", note: "余裕がほとんどありません", color: "#B08A3E" };
  if (ratio < 0.15)
    return { label: "やや厳しい", note: "少しずつ見直せると安心です", color: "#8C8148" };
  return { label: "余裕あり", note: "無理のないペースです", color: "#5F8161" };
}

export default function HouseholdBudgetSimulator() {
  const [state, setState] = useState(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setState({ ...DEFAULT_STATE, ...parsed });
      }
    } catch (e) {
      // no saved scenario yet
    } finally {
      setLoaded(true);
    }
  }, []);

  const update = useCallback((key, value) => {
    setState((s) => ({ ...s, [key]: value === "" ? "" : Number(value) }));
  }, []);

  const updateGoal = useCallback((id, key, value) => {
    setState((s) => ({
      ...s,
      goals: s.goals.map((g) =>
        g.id === id ? { ...g, [key]: key === "amount" ? (value === "" ? "" : Number(value)) : value } : g
      ),
    }));
  }, []);

  const addGoal = useCallback(() => {
    setState((s) => ({
      ...s,
      goals: [...s.goals, { id: newGoalId(), name: "", amount: 0 }],
    }));
  }, []);

  const removeGoal = useCallback((id) => {
    setState((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) }));
  }, []);

  const totals = useMemo(() => {
    const n = (v) => Number(v) || 0;
    const fixed =
      n(state.rent) + n(state.utilities) + n(state.phone) + n(state.insurance) + n(state.otherFixed);
    const variable = n(state.food) + n(state.transport) + n(state.leisure) + n(state.otherVariable);
    const income = n(state.income) + n(state.otherIncome);
    const balance = income - fixed - variable;
    const savingsPlan = n(state.monthlySavings);
    const investmentPlan = n(state.monthlyInvestment);
    const setAside = savingsPlan + investmentPlan;
    const freeAfterSavings = balance - setAside;
    const achievable = balance >= setAside;
    const ratio = income > 0 ? freeAfterSavings / income : 0;
    return {
      fixed,
      variable,
      income,
      balance,
      savingsPlan,
      investmentPlan,
      setAside,
      freeAfterSavings,
      achievable,
      ratio,
    };
  }, [state]);

  const chartData = useMemo(() => {
    const months = Math.max(1, Math.min(60, Number(state.months) || 12));
    const effectiveMonthly = totals.achievable ? totals.setAside : Math.max(totals.balance, 0);
    const savingsShare = totals.setAside > 0 ? totals.savingsPlan / totals.setAside : 0;
    const data = [];
    let cumulativeSavings = 0;
    let cumulativeInvestment = 0;
    for (let m = 0; m <= months; m++) {
      if (m > 0) {
        cumulativeSavings += effectiveMonthly * savingsShare;
        cumulativeInvestment += effectiveMonthly * (1 - savingsShare);
      }
      data.push({
        month: m,
        savings: Math.round(cumulativeSavings),
        investment: Math.round(cumulativeInvestment),
        total: Math.round(cumulativeSavings + cumulativeInvestment),
      });
    }
    return data;
  }, [totals.achievable, totals.setAside, totals.savingsPlan, totals.balance, state.months]);

  const goalsProgress = useMemo(() => {
    const effectiveMonthly = totals.achievable ? totals.setAside : Math.max(totals.balance, 0);
    let cumulative = 0;
    return (state.goals || []).map((g) => {
      const amount = Number(g.amount) || 0;
      cumulative += amount;
      const months = effectiveMonthly > 0 ? Math.ceil(cumulative / effectiveMonthly) : null;
      return { ...g, amount, cumulative, months };
    });
  }, [state.goals, totals.achievable, totals.setAside, totals.balance]);

  const level = marginLevel(totals.ratio);
  const gaugePct = Math.max(0, Math.min(100, (totals.ratio + 0.1) * 250)); // visual scaling

  const handleSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setSaveStatus("保存しました");
    } catch (e) {
      setSaveStatus("保存に失敗しました");
    }
    setTimeout(() => setSaveStatus(""), 2000);
  };

  const handleReset = () => {
    setState(DEFAULT_STATE);
  };

  if (!loaded) return null;

  return (
    <div style={styles.page}>
      <style>{FONT_IMPORT}</style>
      <style>{`
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button {
          -webkit-appearance: none; margin: 0;
        }
        input[type=number] { -moz-appearance: textfield; }
        .hb-input:focus { outline: 2px solid #5F8161; outline-offset: 1px; }
        .hb-btn:focus-visible { outline: 2px solid #2C3636; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) {
          .hb-gauge-ring { transition: none !important; }
        }
      `}</style>

      <header style={styles.header}>
        <div style={styles.tab}>家計ノート</div>
        <h1 style={styles.title}>就職後の収支シミュレーター</h1>
        <p style={styles.subtitle}>
          月々の収入と支出を書き込んで、無理のないペースかどうかを確かめてみましょう。
        </p>
      </header>

      <div style={styles.grid}>
        {/* Left: ledger input */}
        <section style={styles.ledger} aria-label="収支の入力">
          {FIELD_GROUPS.map((group) => (
            <div key={group.label} style={styles.groupBlock}>
              <div style={{ ...styles.groupLabel, borderColor: toneColor(group.tone) }}>
                {group.label}
              </div>
              {group.fields.map((f) => (
                <div key={f.key} style={styles.row}>
                  <label htmlFor={f.key} style={styles.rowLabel}>
                    {f.label}
                  </label>
                  <div style={styles.rowInputWrap}>
                    <input
                      id={f.key}
                      className="hb-input"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={state[f.key]}
                      onChange={(e) => update(f.key, e.target.value)}
                      style={styles.rowInput}
                      placeholder={f.placeholder || "0"}
                    />
                    <span style={styles.yenMark}>円</span>
                  </div>
                </div>
              ))}
            </div>
          ))}

          <div style={styles.groupBlock}>
            <div style={{ ...styles.groupLabel, borderColor: "#7A7263" }}>貯金・投資</div>
            <div style={styles.row}>
              <label htmlFor="monthlySavings" style={styles.rowLabel}>
                毎月の貯金額
              </label>
              <div style={styles.rowInputWrap}>
                <input
                  id="monthlySavings"
                  className="hb-input"
                  type="number"
                  min="0"
                  value={state.monthlySavings}
                  onChange={(e) => update("monthlySavings", e.target.value)}
                  style={styles.rowInput}
                />
                <span style={styles.yenMark}>円</span>
              </div>
            </div>
            <div style={styles.row}>
              <label htmlFor="monthlyInvestment" style={styles.rowLabel}>
                毎月の投資額
              </label>
              <div style={styles.rowInputWrap}>
                <input
                  id="monthlyInvestment"
                  className="hb-input"
                  type="number"
                  min="0"
                  value={state.monthlyInvestment}
                  onChange={(e) => update("monthlyInvestment", e.target.value)}
                  style={styles.rowInput}
                />
                <span style={styles.yenMark}>円</span>
              </div>
            </div>
          </div>

          <div style={styles.groupBlock}>
            <div style={{ ...styles.groupLabel, borderColor: "#7A7263" }}>目標（欲しいもの・やりたいこと）</div>
            {state.goals.map((g, idx) => (
              <div key={g.id} style={styles.goalRow}>
                <input
                  className="hb-input"
                  type="text"
                  value={g.name}
                  onChange={(e) => updateGoal(g.id, "name", e.target.value)}
                  placeholder={`目標${idx + 1}（例：旅行、パソコン）`}
                  style={styles.goalNameInput}
                  aria-label={`目標${idx + 1}の名前`}
                />
                <div style={styles.rowInputWrap}>
                  <input
                    className="hb-input"
                    type="number"
                    min="0"
                    value={g.amount}
                    onChange={(e) => updateGoal(g.id, "amount", e.target.value)}
                    style={styles.rowInput}
                    aria-label={`目標${idx + 1}の金額`}
                  />
                  <span style={styles.yenMark}>円</span>
                </div>
                <button
                  className="hb-btn"
                  style={styles.removeGoalBtn}
                  onClick={() => removeGoal(g.id)}
                  aria-label={`目標${idx + 1}を削除`}
                  disabled={state.goals.length <= 1}
                >
                  ×
                </button>
              </div>
            ))}
            <button className="hb-btn" style={styles.addGoalBtn} onClick={addGoal}>
              ＋ 目標を追加
            </button>
          </div>

          <div style={styles.groupBlock}>
            <div style={{ ...styles.groupLabel, borderColor: "#7A7263" }}>期間</div>
            <div style={styles.row}>
              <label htmlFor="months" style={styles.rowLabel}>
                表示する期間
              </label>
              <div style={styles.rowInputWrap}>
                <input
                  id="months"
                  className="hb-input"
                  type="number"
                  min="1"
                  max="60"
                  value={state.months}
                  onChange={(e) => update("months", e.target.value)}
                  style={styles.rowInput}
                />
                <span style={styles.yenMark}>ヶ月</span>
              </div>
            </div>
          </div>

          <div style={styles.washiTape} />
          <div style={styles.actionRow}>
            <button className="hb-btn" style={styles.primaryBtn} onClick={handleSave}>
              この内容を保存
            </button>
            <button className="hb-btn" style={styles.ghostBtn} onClick={handleReset}>
              初期値に戻す
            </button>
            {saveStatus && <span style={styles.saveStatus}>{saveStatus}</span>}
          </div>
        </section>

        {/* Right: results */}
        <section style={styles.results} aria-label="シミュレーション結果">
          <div style={styles.gaugeCard}>
            <div
              className="hb-gauge-ring"
              style={{
                ...styles.gaugeRing,
                background: `conic-gradient(${level.color} ${gaugePct}%, #E6E1D2 ${gaugePct}% 100%)`,
              }}
            >
              <div style={styles.gaugeInner}>
                <div style={{ ...styles.gaugeLabel, color: level.color }}>{level.label}</div>
                <div style={styles.gaugeSub}>ゆとり度</div>
              </div>
            </div>
            <div style={styles.gaugeNote}>{level.note}</div>
          </div>

          <div style={styles.summaryLine}>
            <SummaryItem label="収入" value={totals.income} />
            <SummaryItem label="固定費" value={-totals.fixed} />
            <SummaryItem label="変動費" value={-totals.variable} />
            <SummaryItem label="貯金" value={-totals.savingsPlan} />
            <SummaryItem label="投資" value={-totals.investmentPlan} />
            <SummaryItem label="自由に使えるお金" value={totals.freeAfterSavings} strong />
          </div>
          {!totals.achievable && (
            <div style={styles.warningNote}>
              今の収支だと、毎月 {yen(totals.setAside)}円（貯金+投資）は難しいかもしれません。
              金額を減らすか、支出を見直してみましょう。
            </div>
          )}

          <div style={styles.chartCard}>
            <div style={styles.chartTitle}>貯金・投資の推移予測</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="#E1DBC8" strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 12, fill: "#6B6559" }}
                  tickFormatter={(m) => `${m}ヶ月`}
                  stroke="#C9C2AC"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#6B6559" }}
                  tickFormatter={(v) => `${Math.round(v / 10000)}万`}
                  stroke="#C9C2AC"
                  width={44}
                />
                <Tooltip
                  formatter={(v, name) => [
                    `${yen(v)}円`,
                    name === "total" ? "合計" : name === "investment" ? "投資" : "貯金",
                  ]}
                  labelFormatter={(m) => `${m}ヶ月目`}
                  contentStyle={{
                    fontFamily: "'Noto Sans JP', sans-serif",
                    fontSize: 13,
                    border: "1px solid #D6D0BE",
                    borderRadius: 4,
                  }}
                />
                {goalsProgress
                  .filter((g) => g.amount > 0)
                  .map((g, idx) => (
                    <ReferenceLine
                      key={g.id}
                      y={g.cumulative}
                      stroke="#A6472A"
                      strokeDasharray="4 4"
                      label={{
                        value: g.name || `目標${idx + 1}`,
                        position: "insideTopRight",
                        fill: "#A6472A",
                        fontSize: 11,
                      }}
                    />
                  ))}
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#2C3636"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                  name="total"
                />
                {totals.savingsPlan > 0 && (
                  <Line
                    type="monotone"
                    dataKey="savings"
                    stroke="#5F8161"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    dot={false}
                    isAnimationActive={false}
                    name="savings"
                  />
                )}
                {totals.investmentPlan > 0 && (
                  <Line
                    type="monotone"
                    dataKey="investment"
                    stroke="#7A6FA6"
                    strokeWidth={1.5}
                    strokeDasharray="4 2"
                    dot={false}
                    isAnimationActive={false}
                    name="investment"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={styles.forecastCard}>
            {!totals.achievable && totals.balance <= 0 ? (
              <p style={styles.forecastText}>
                現在の内容では貯金・投資にまわせるお金がありません。固定費や変動費を見直すところから考えてみましょう。
              </p>
            ) : (
              <ul style={styles.goalList}>
                {goalsProgress
                  .filter((g) => g.amount > 0)
                  .map((g, idx) => (
                    <li key={g.id} style={styles.goalListItem}>
                      <span style={styles.goalListName}>{g.name || `目標${idx + 1}`}</span>
                      <span style={styles.goalListDetail}>
                        {yen(g.amount)}円　→　
                        {g.months === null ? "見込みなし" : `約${g.months}ヶ月後`}
                      </span>
                    </li>
                  ))}
                {goalsProgress.every((g) => g.amount <= 0) && (
                  <li style={styles.goalListDetail}>金額を入力すると達成の見込みが表示されます。</li>
                )}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function SummaryItem({ label, value, strong }) {
  const negative = value < 0;
  return (
    <div style={styles.summaryItem}>
      <div style={styles.summaryLabel}>{label}</div>
      <div
        style={{
          ...styles.summaryValue,
          fontWeight: strong ? 700 : 500,
          color: strong ? (negative ? "#A6472A" : "#2C3636") : "#4A453B",
        }}
      >
        {negative ? "-" : ""}
        {yen(Math.abs(value))}円
      </div>
    </div>
  );
}

function toneColor(tone) {
  if (tone === "income") return "#5F8161";
  if (tone === "fixed") return "#8C8148";
  return "#A6472A";
}

const styles = {
  page: {
    fontFamily: "'Noto Sans JP', sans-serif",
    background: "#F3F0E7",
    backgroundImage:
      "linear-gradient(#E1DBC8 1px, transparent 1px), linear-gradient(90deg, #E1DBC8 1px, transparent 1px)",
    backgroundSize: "24px 24px",
    color: "#2C3636",
    minHeight: "100vh",
    padding: "28px 16px 60px",
    boxSizing: "border-box",
  },
  header: {
    maxWidth: 920,
    margin: "0 auto 20px",
  },
  tab: {
    display: "inline-block",
    fontFamily: "'Noto Serif JP', serif",
    fontSize: 13,
    letterSpacing: "0.1em",
    background: "#2C3636",
    color: "#F3F0E7",
    padding: "4px 14px",
    borderRadius: "3px 3px 0 0",
  },
  title: {
    fontFamily: "'Noto Serif JP', serif",
    fontWeight: 700,
    fontSize: "clamp(22px, 4vw, 30px)",
    margin: "10px 0 6px",
    borderBottom: "2px solid #2C3636",
    paddingBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B6559",
    margin: 0,
    lineHeight: 1.6,
  },
  grid: {
    maxWidth: 920,
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 20,
  },
  ledger: {
    background: "#FBF9F3",
    border: "1px solid #D6D0BE",
    borderRadius: 6,
    padding: "20px 20px 24px",
    boxShadow: "0 1px 0 rgba(44,54,54,0.04)",
  },
  groupBlock: { marginBottom: 18 },
  groupLabel: {
    fontFamily: "'Noto Serif JP', serif",
    fontSize: 13,
    fontWeight: 700,
    borderLeft: "4px solid",
    paddingLeft: 8,
    marginBottom: 10,
    color: "#2C3636",
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "7px 0",
    borderBottom: "1px dashed #D6D0BE",
    gap: 12,
  },
  rowLabel: { fontSize: 14, color: "#4A453B", flexShrink: 0 },
  rowInputWrap: { display: "flex", alignItems: "center", gap: 6 },
  rowInput: {
    width: 110,
    textAlign: "right",
    fontFamily: "'Noto Sans JP', sans-serif",
    fontVariantNumeric: "tabular-nums",
    fontSize: 15,
    padding: "4px 6px",
    border: "1px solid #D6D0BE",
    borderRadius: 3,
    background: "#fff",
    color: "#2C3636",
  },
  yenMark: { fontSize: 13, color: "#8A8574", width: 16 },
  goalRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 0",
    borderBottom: "1px dashed #D6D0BE",
  },
  goalNameInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: "'Noto Sans JP', sans-serif",
    fontSize: 14,
    padding: "4px 8px",
    border: "1px solid #D6D0BE",
    borderRadius: 3,
    background: "#fff",
    color: "#2C3636",
  },
  removeGoalBtn: {
    background: "transparent",
    border: "1px solid #D6D0BE",
    color: "#8A8574",
    width: 26,
    height: 26,
    borderRadius: 4,
    fontSize: 14,
    lineHeight: 1,
    cursor: "pointer",
    flexShrink: 0,
  },
  addGoalBtn: {
    marginTop: 8,
    background: "transparent",
    border: "1px dashed #8C8148",
    color: "#5B5530",
    padding: "7px 14px",
    borderRadius: 4,
    fontSize: 13,
    cursor: "pointer",
  },
  goalList: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 },
  goalListItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: 6,
    fontSize: 14,
  },
  goalListName: { fontFamily: "'Noto Serif JP', serif", fontWeight: 700, color: "#2C3636" },
  goalListDetail: { fontSize: 13, color: "#4A453B", fontVariantNumeric: "tabular-nums" },
  washiTape: {
    height: 10,
    width: "60%",
    margin: "6px auto 16px",
    background: "repeating-linear-gradient(45deg, #D8CBA8, #D8CBA8 6px, #E3D8BB 6px, #E3D8BB 12px)",
    opacity: 0.7,
    borderRadius: 2,
  },
  actionRow: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  primaryBtn: {
    background: "#2C3636",
    color: "#F3F0E7",
    border: "none",
    padding: "10px 20px",
    borderRadius: 4,
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
  },
  ghostBtn: {
    background: "transparent",
    color: "#4A453B",
    border: "1px solid #C9C2AC",
    padding: "10px 16px",
    borderRadius: 4,
    fontSize: 14,
    cursor: "pointer",
  },
  saveStatus: { fontSize: 13, color: "#5F8161" },
  results: { display: "flex", flexDirection: "column", gap: 18 },
  gaugeCard: {
    background: "#FBF9F3",
    border: "1px solid #D6D0BE",
    borderRadius: 6,
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  },
  gaugeRing: {
    width: 140,
    height: 140,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.4s ease",
  },
  gaugeInner: {
    width: 106,
    height: 106,
    borderRadius: "50%",
    background: "#FBF9F3",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  gaugeLabel: { fontFamily: "'Noto Serif JP', serif", fontWeight: 700, fontSize: 18 },
  gaugeSub: { fontSize: 11, color: "#8A8574", marginTop: 2 },
  gaugeNote: { marginTop: 10, fontSize: 13, color: "#6B6559" },
  summaryLine: {
    display: "flex",
    justifyContent: "space-between",
    background: "#FBF9F3",
    border: "1px solid #D6D0BE",
    borderRadius: 6,
    padding: "14px 16px",
    flexWrap: "wrap",
    gap: 10,
  },
  summaryItem: { flex: "1 1 80px", textAlign: "center" },
  summaryLabel: { fontSize: 12, color: "#8A8574", marginBottom: 4 },
  summaryValue: { fontSize: 15, fontVariantNumeric: "tabular-nums" },
  warningNote: {
    background: "#FBF1E9",
    border: "1px solid #E0B48F",
    borderLeft: "4px solid #A6472A",
    borderRadius: 6,
    padding: "12px 14px",
    fontSize: 13,
    lineHeight: 1.6,
    color: "#7A3620",
  },
  chartCard: {
    background: "#FBF9F3",
    border: "1px solid #D6D0BE",
    borderRadius: 6,
    padding: "16px 8px 8px 4px",
  },
  chartTitle: {
    fontFamily: "'Noto Serif JP', serif",
    fontSize: 14,
    fontWeight: 700,
    margin: "0 0 6px 16px",
  },
  forecastCard: {
    background: "#FBF9F3",
    border: "1px solid #D6D0BE",
    borderLeft: "4px solid #5F8161",
    borderRadius: 6,
    padding: "14px 16px",
  },
  forecastText: { margin: 0, fontSize: 14, lineHeight: 1.7, color: "#2C3636" },
};
