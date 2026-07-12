import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { OmegaChart } from "@/components/omega/OmegaChart";
import { OmegaLogo } from "@/components/omega/OmegaLogo";
import { ArrowUp, RotateCcw, FileSpreadsheet, Copy, Check, ChevronDown, ChevronUp, Download } from "lucide-react";
import { exportToPDF } from "../../utils/pdfExporter";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from "recharts";
const humaniseColumn = (str: string) => {
  if (!str) return "";
  return str.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
};

const API = process.env.NEXT_PUBLIC_OMEGA_API_URL || "http://localhost:8001/api";

const SEED_SUGGESTIONS = [
  "Summarise this dataset in three sentences.",
  "What's the standout trend or outlier?",
  "Give me a chart of the top drivers of revenue.",
];

interface ChatMessage {
  role: "user" | "omega";
  text?: string;
  answer?: string;
  followups?: string[];
  components?: any[];
}

const useTypewriter = (text: string, speed = 14) => {
  const [display, setDisplay] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDisplay("");
    setDone(false);
    if (!text) {
      setDone(true);
      return;
    }
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setDisplay(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return { display, done };
};

const RegressionPredictor = ({ comp }: { comp: any }) => {
  const { target_column, intercept, coefficients, features, dummy_mappings, model_metrics } = comp;
  const [vals, setVals] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {};
    features.forEach((feat: any) => {
      if (feat.type === "numeric") {
        init[feat.name] = feat.mean;
      } else {
        init[feat.name] = feat.default || feat.categories?.[0] || "";
      }
    });
    return init;
  });

  const handleSliderChange = (name: string, value: number) => {
    setVals(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setVals(prev => ({ ...prev, [name]: value }));
  };

  let prediction = intercept;
  features.forEach((feat: any) => {
    const name = feat.name;
    const value = vals[name];
    if (feat.type === "numeric") {
      const mean = feat.mean;
      const std = feat.std || 1.0;
      const scaled = (value - mean) / std;
      prediction += (coefficients[name] || 0.0) * scaled;
    } else {
      const dummies = dummy_mappings[name] || {};
      const dummyColName = dummies[value];
      if (dummyColName) {
        prediction += (coefficients[dummyColName] || 0.0);
      }
    }
  });

  const isCurrency = ["price", "cost", "sales", "revenue"].some(k => target_column.toLowerCase().includes(k));
  const predictionStr = isCurrency 
    ? `$${prediction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : prediction.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 });

  return (
    <div className="w-full mt-4 p-5 rounded-2xl border border-indigo-100 bg-indigo-50/10 font-sans shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded font-heading">
          🎛️ Predictive Regression Simulator
        </span>
        {model_metrics?.r_squared !== undefined && (
          <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full font-sans">
            R² = {Number(model_metrics.r_squared).toFixed(4)}
          </span>
        )}
      </div>
      <h4 className="text-[15px] font-heading font-bold text-slate-800">
        Predicting: {humaniseColumn(target_column)}
      </h4>
      <p className="text-[12px] text-slate-500 mb-4 font-sans">Adjust the controls below to calculate predictions dynamically.</p>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        {features.map((feat: any) => {
          const name = feat.name;
          if (feat.type === "numeric") {
            const min = feat.min;
            const max = feat.max;
            const current = vals[name] !== undefined ? vals[name] : feat.mean;
            return (
              <div key={name} className="flex flex-col gap-1.5 p-3 rounded-xl border border-slate-100 bg-white">
                <div className="flex justify-between text-xs text-slate-600 font-medium font-sans">
                  <span>{humaniseColumn(name)}</span>
                  <span className="font-semibold text-slate-800">{Number(current).toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={(max - min) / 100 || 0.1}
                  value={current}
                  onChange={(e) => handleSliderChange(name, parseFloat(e.target.value))}
                  className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0033FF]"
                />
              </div>
            );
          } else {
            const current = vals[name] || "";
            const cats = feat.categories || [];
            return (
              <div key={name} className="flex flex-col gap-1.5 p-3 rounded-xl border border-slate-100 bg-white font-sans">
                <label className="text-xs text-slate-600 font-medium">{humaniseColumn(name)}</label>
                <select
                  value={current}
                  onChange={(e) => handleSelectChange(name, e.target.value)}
                  className="text-xs text-slate-800 font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none cursor-pointer"
                >
                  {cats.map((cat: string) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            );
          }
        })}
      </div>

      <div className="rounded-xl border border-emerald-100 bg-emerald-50/20 p-4 text-center">
        <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider font-heading">Simulated {humaniseColumn(target_column)}</div>
        <div className="text-[28px] font-heading font-bold text-slate-800 mt-1">{predictionStr}</div>
      </div>
    </div>
  );
};

const ClassificationPredictor = ({ comp }: { comp: any }) => {
  const { target_column, intercept, coefficients, features, dummy_mappings, model_metrics, class_0_label, class_1_label } = comp;
  const [vals, setVals] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {};
    features.forEach((feat: any) => {
      if (feat.type === "numeric") {
        init[feat.name] = feat.mean;
      } else {
        init[feat.name] = feat.default || feat.categories?.[0] || "";
      }
    });
    return init;
  });

  const handleSliderChange = (name: string, value: number) => {
    setVals(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setVals(prev => ({ ...prev, [name]: value }));
  };

  let z = intercept;
  features.forEach((feat: any) => {
    const name = feat.name;
    const value = vals[name];
    if (feat.type === "numeric") {
      const mean = feat.mean;
      const std = feat.std || 1.0;
      const scaled = (value - mean) / std;
      z += (coefficients[name] || 0.0) * scaled;
    } else {
      const dummies = dummy_mappings[name] || {};
      const dummyColName = dummies[value];
      if (dummyColName) {
        z += (coefficients[dummyColName] || 0.0);
      }
    }
  });

  const probVal = 1.0 / (1.0 + Math.exp(-Math.max(-20, Math.min(20, z))));
  const predClass = probVal >= 0.5 ? class_1_label : class_0_label;
  const barColor = probVal >= 0.5 ? "bg-emerald-500" : "bg-rose-500";

  return (
    <div className="w-full mt-4 p-5 rounded-2xl border border-purple-100 bg-purple-50/10 font-sans shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <span className="text-[10px] uppercase font-bold tracking-wider text-purple-500 bg-purple-50 px-2 py-0.5 rounded font-heading">
          🎛️ Predictive Probability Simulator
        </span>
        {model_metrics?.accuracy !== undefined && (
          <span className="text-[11px] font-semibold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full font-sans">
            Accuracy: {(Number(model_metrics.accuracy) * 100).toFixed(1)}%
          </span>
        )}
      </div>
      <h4 className="text-[15px] font-heading font-bold text-slate-800">
        Target: {humaniseColumn(target_column)}
      </h4>
      <p className="text-[12px] text-slate-500 mb-4 font-sans">{class_0_label} vs {class_1_label} — adjust controls to calculate probability dynamically.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        {features.map((feat: any) => {
          const name = feat.name;
          if (feat.type === "numeric") {
            const min = feat.min;
            const max = feat.max;
            const current = vals[name] !== undefined ? vals[name] : feat.mean;
            return (
              <div key={name} className="flex flex-col gap-1.5 p-3 rounded-xl border border-slate-100 bg-white">
                <div className="flex justify-between text-xs text-slate-600 font-medium font-sans">
                  <span>{humaniseColumn(name)}</span>
                  <span className="font-semibold text-slate-800">{Number(current).toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={(max - min) / 100 || 0.1}
                  value={current}
                  onChange={(e) => handleSliderChange(name, parseFloat(e.target.value))}
                  className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0033FF]"
                />
              </div>
            );
          } else {
            const current = vals[name] || "";
            const cats = feat.categories || [];
            return (
              <div key={name} className="flex flex-col gap-1.5 p-3 rounded-xl border border-slate-100 bg-white font-sans">
                <label className="text-xs text-slate-600 font-medium">{humaniseColumn(name)}</label>
                <select
                  value={current}
                  onChange={(e) => handleSelectChange(name, e.target.value)}
                  className="text-xs text-slate-800 font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none cursor-pointer"
                >
                  {cats.map((cat: string) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            );
          }
        })}
      </div>

      <div className="rounded-xl border border-purple-100 bg-purple-50/20 p-4 font-sans">
        <div className="flex justify-between mb-3 text-slate-800">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-heading">Predicted Class</div>
            <div className="text-[20px] font-bold mt-0.5">{predClass}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-heading">Probability ({class_1_label})</div>
            <div className="text-[20px] font-bold mt-0.5">{(probVal * 100).toFixed(1)}%</div>
          </div>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
          <div className={`h-full ${barColor} transition-all duration-300`} style={{ width: `${probVal * 100}%` }}></div>
        </div>
      </div>
    </div>
  );
};

const ForecastPredictor = ({ comp }: { comp: any }) => {
  const { time_column, metric_column, model_metrics, historical_dates, historical_values, forecast_dates, forecast_values } = comp;
  const [horizon, setHorizon] = useState(forecast_dates?.length || 10);

  const data = [
    ...historical_dates.map((d: string, i: number) => ({
      date: d,
      Historical: historical_values[i],
      Forecast: null
    })),
    ...forecast_dates.slice(0, horizon).map((d: string, i: number) => ({
      date: d,
      Historical: null,
      Forecast: forecast_values[i]
    }))
  ];

  const r2 = model_metrics?.r_squared || 0.0;
  const accText = r2 > 0.8 ? "High Accuracy" : r2 > 0.5 ? "Moderate Accuracy" : "Low Accuracy";
  const accColor = r2 > 0.8 ? "text-emerald-700 bg-emerald-50" : r2 > 0.5 ? "text-amber-700 bg-amber-50" : "text-rose-700 bg-rose-50";

  return (
    <div className="w-full mt-4 p-5 rounded-2xl border border-teal-100 bg-teal-50/10 font-sans shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <span className="text-[10px] uppercase font-bold tracking-wider text-teal-600 bg-teal-50 px-2 py-0.5 rounded font-heading">
          🔮 Future Forecast Projection
        </span>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${accColor}`}>
          {accText}
        </span>
      </div>
      <h4 className="text-[15px] font-heading font-bold text-slate-800 font-sans">
        Seasonal Trend: {metric_column} over {time_column}
      </h4>

      <div className="grid grid-cols-3 gap-3 my-4 font-sans">
        <div className="p-3 bg-white border border-slate-100 rounded-xl">
          <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider font-heading">R-Squared</div>
          <div className="text-[16px] font-bold text-slate-800 mt-0.5">{r2.toFixed(4)}</div>
        </div>
        <div className="p-3 bg-white border border-slate-100 rounded-xl">
          <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider font-heading">Horizon</div>
          <div className="text-[16px] font-bold text-slate-800 mt-0.5">{horizon} periods</div>
        </div>
        <div className="p-3 bg-white border border-slate-100 rounded-xl">
          <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider font-heading">Std. Error</div>
          <div className="text-[16px] font-bold text-slate-800 mt-0.5">{(model_metrics?.std_err || 0.0).toFixed(2)}</div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 p-3 rounded-xl border border-slate-100 bg-white mb-4 font-sans">
        <div className="flex justify-between text-xs text-slate-600 font-medium">
          <span>Adjust Forecast Horizon</span>
          <span className="font-semibold text-slate-800">{horizon} periods</span>
        </div>
        <input
          type="range"
          min={1}
          max={forecast_dates.length}
          step={1}
          value={horizon}
          onChange={(e) => setHorizon(parseInt(e.target.value))}
          className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0033FF]"
        />
      </div>

      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 12, right: 8, bottom: 4, left: 0 }}>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94A3B8" }} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} />
            <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} tickLine={false} axisLine={false} width={40} />
            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12, fontFamily: "Manrope" }} />
            <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="Historical" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 4 }} connectNulls />
            <Line type="monotone" dataKey="Forecast" stroke="#EA580C" strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 3 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const AssistantBubble = ({ msg, isLatest, index }: { msg: ChatMessage; isLatest: boolean; index: number }) => {
  const { display, done } = useTypewriter(msg.answer || "", 12);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(msg.answer || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div id={`assistant-bubble-${index}`} className="bubble-in flex items-start gap-3 max-w-[92%]" data-testid="chat-message-omega">
      <div className="mt-1 w-7 h-7 shrink-0 rounded-lg bg-[#0A0A0A] text-white flex items-center justify-center text-[11px] font-heading font-bold">
        Ω
      </div>
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl rounded-tl-sm bg-[#F8F9FA] border border-slate-100 px-5 py-4">
          {!done && isLatest ? (
            <div className="text-[15px] leading-relaxed text-[#0A0A0A] whitespace-pre-wrap font-sans">
              <span className="omega-caret">{display}</span>
            </div>
          ) : (
            <div className="flex flex-col gap-5 font-sans text-[15px] leading-relaxed text-[#0A0A0A]">
              {msg.components?.map((comp: any, idx: number) => {
                if (comp.type === "markdown") {
                  return (
                    <div key={idx} className="whitespace-pre-wrap font-sans">
                      {comp.content}
                    </div>
                  );
                }
                if (comp.type === "chart" && comp.spec) {
                  return (
                    <div key={idx} className="w-full">
                      <OmegaChart spec={comp.spec} />
                    </div>
                  );
                }
                if (comp.type === "metric_grid" && comp.metrics) {
                  return (
                    <div key={idx} className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full">
                      {comp.metrics.map((metric: any, mIdx: number) => (
                        <div key={mIdx} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                          <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{metric.label}</div>
                          <div className="text-[18px] font-heading font-bold text-[#0A0A0A] mt-0.5">{metric.value}</div>
                        </div>
                      ))}
                    </div>
                  );
                }
                if (comp.type === "table" && comp.rows) {
                  return (
                    <div key={idx} className="overflow-x-auto rounded-xl border border-slate-200 bg-white w-full">
                      <table className="min-w-full divide-y divide-slate-100 text-left text-[13px]">
                        <thead className="bg-[#F8F9FA]">
                          <tr>
                            {comp.headers?.map((header: string, hIdx: number) => (
                              <th key={hIdx} className="px-4 py-2.5 font-semibold text-slate-600">{header}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-600">
                          {comp.rows.map((row: string[], rIdx: number) => (
                            <tr key={rIdx} className="hover:bg-slate-50 transition-colors">
                              {row.map((cell: string, cIdx: number) => (
                                <td key={cIdx} className="px-4 py-2.5 text-slate-800">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                }
                if (comp.type === "strategies" && comp.strategies) {
                  return (
                    <div key={idx} className="border-t border-slate-100 pt-4 w-full">
                      <h4 className="text-[13px] font-heading font-bold text-slate-800 uppercase tracking-wider mb-2.5">
                        🎯 Actionable Strategies
                      </h4>
                      <ul className="space-y-2">
                        {comp.strategies.map((strategy: string, sIdx: number) => (
                          <li key={sIdx} className="text-[14px] text-slate-600 flex items-start gap-2">
                            <span className="text-[#0033FF] font-bold mt-0.5">•</span>
                            <span>{strategy}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                }
                if (comp.type === "priority_matrix" && comp.priority_matrix) {
                  return (
                    <div key={idx} className="border-t border-slate-100 pt-4 w-full">
                      <h4 className="text-[13px] font-heading font-bold text-slate-800 uppercase tracking-wider mb-3">
                        📋 Priority Matrix
                      </h4>
                      <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
                        <table className="min-w-full divide-y divide-slate-100 text-left text-[13px]">
                          <thead className="bg-[#F8F9FA]">
                            <tr>
                              <th className="px-4 py-2 font-semibold text-slate-600">Proposed Action</th>
                              <th className="px-4 py-2 font-semibold text-slate-600">Expected Impact</th>
                              <th className="px-4 py-2 font-semibold text-slate-600">Implementation Effort</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-600">
                            {comp.priority_matrix.map((item: any, mIdx: number) => (
                              <tr key={mIdx} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-2.5 font-medium text-slate-800">{item.action}</td>
                                <td className="px-4 py-2.5">
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                    item.impact === "High" ? "bg-emerald-50 text-emerald-700" :
                                    item.impact === "Medium" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700"
                                  }`}>
                                    {item.impact}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                    item.effort === "Low" ? "bg-emerald-50 text-emerald-700" :
                                    item.effort === "Medium" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"
                                  }`}>
                                    {item.effort}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                }
                if (comp.type === "risks" && comp.risks) {
                  return (
                    <div key={idx} className="border-t border-slate-100 pt-4 w-full">
                      <div className="rounded-xl border border-rose-100 bg-rose-50/30 p-4">
                        <h4 className="text-[13px] font-heading font-bold text-rose-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          ⚠️ Risks & Operational Concerns
                        </h4>
                        <ul className="space-y-1.5">
                          {comp.risks.map((risk: string, rIdx: number) => (
                            <li key={rIdx} className="text-[13px] text-rose-700 flex items-start gap-1.5">
                              <span className="font-bold mt-0.5">•</span>
                              <span>{risk}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                }
                if (comp.type === "regression_predictor") {
                  return <RegressionPredictor key={idx} comp={comp} />;
                }
                if (comp.type === "classification_predictor") {
                  return <ClassificationPredictor key={idx} comp={comp} />;
                }
                if (comp.type === "forecast_predictor") {
                  return <ForecastPredictor key={idx} comp={comp} />;
                }
                return null;
              })}
            </div>
          )}
        </div>
        {done && (
          <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400 font-sans">
            <button
              onClick={copy}
              className="inline-flex items-center gap-1 hover:text-[#0A0A0A] transition-colors"
              data-testid="chat-copy-button"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={() => exportToPDF(`assistant-bubble-${index}`, `omega-analysis-block-${index}.pdf`)}
              className="inline-flex items-center gap-1 hover:text-[#0047FF] transition-colors"
              data-html2canvas-ignore
            >
              <Download className="w-3 h-3" />
              Export PDF
            </button>
            {msg.followups && msg.followups.length > 0 && <span>Suggested follow-ups below</span>}
          </div>
        )}
      </div>
    </div>
  );
};

const UserBubble = ({ text }: { text: string }) => (
  <div className="bubble-in flex justify-end" data-testid="chat-message-user">
    <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-[#0033FF] text-white px-5 py-3.5 text-[15px] leading-relaxed shadow-sm font-sans">
      {text}
    </div>
  </div>
);

const Thinking = () => (
  <div className="flex items-start gap-3" data-testid="chat-thinking">
    <div className="mt-1 w-7 h-7 shrink-0 rounded-lg bg-[#0A0A0A] text-white flex items-center justify-center text-[11px] font-heading font-bold">
      Ω
    </div>
    <div className="rounded-2xl rounded-tl-sm bg-[#F8F9FA] border border-slate-100 px-5 py-4 flex items-center gap-1.5 font-sans">
      <span className="omega-dot w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
      <span className="omega-dot w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
      <span className="omega-dot w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
      <span className="ml-2 text-xs text-slate-500 font-medium">Analysing your dataset…</span>
    </div>
  </div>
);

export const ChatInterface = ({ 
  dataset, 
  onReset,
  initialSessionId = null
}: { 
  dataset: any; 
  onReset: () => void;
  initialSessionId?: string | null;
}) => {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showColumns, setShowColumns] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [suggestions, setSuggestions] = useState<string[]>(SEED_SUGGESTIONS);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialSessionId) {
      setSessionId(initialSessionId);
      const fetchHistory = async () => {
        try {
          const token = await getToken();
          const { data } = await axios.get(`${API}/chat/history?session_id=${initialSessionId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const loaded: ChatMessage[] = [];
          for (const m of data) {
            loaded.push({ role: "user", text: m.message });
            loaded.push({ role: "omega", answer: m.answer, components: m.components });
          }
          setMessages(loaded);
        } catch (e) {
          toast.error("Could not load chat history");
        }
      };
      fetchHistory();
    } else {
      setMessages([]);
      setSessionId(null);
      setSuggestions(SEED_SUGGESTIONS);
    }
  }, [dataset?.id, initialSessionId]);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, sending]);

  const send = async (text?: string) => {
    const question = (text ?? input).trim();
    if (!question || sending) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: question }]);
    setSending(true);
    try {
      const token = await getToken();
      const { data } = await axios.post(`${API}/chat`, {
        dataset_id: dataset.id,
        session_id: sessionId,
        message: question,
      }, { 
        timeout: 120000,
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!sessionId) setSessionId(data.session_id);
      setMessages((m) => [
        ...m,
        {
          role: "omega",
          answer: data.answer,
          followups: data.followups,
          components: data.components,
        },
      ]);
      if (data.followups?.length) setSuggestions(data.followups);
    } catch (e: any) {
      console.error("Chat error details:", e);
      toast.error(e?.response?.data?.detail || "Omega couldn't respond. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section
      id="chat"
      className="relative bg-white py-20 sm:py-28"
      data-testid="chat-section"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8">
        {/* Dataset chip bar */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div
            className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white pl-2 pr-4 py-1.5 shadow-sm"
            data-testid="chat-dataset-chip"
          >
            <span className="w-8 h-8 rounded-full bg-[#F8F9FA] flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-[#0A0A0A]" />
            </span>
            <div className="leading-tight font-sans">
              <div className="text-[13px] font-semibold text-[#0A0A0A]">{dataset.name}</div>
              <div className="text-[11px] text-slate-500">
                {dataset.rows} rows · {dataset.columns.length} columns
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4" data-html2canvas-ignore>
            <button
              onClick={() => exportToPDF("chat-messages-container", `session-export-${sessionId || 'new'}.pdf`)}
              className="inline-flex items-center gap-1.5 text-[12px] text-[#0047FF] hover:text-[#0036C2] font-semibold transition-colors font-sans"
            >
              <Download className="w-3.5 h-3.5" />
              Export Session PDF
            </button>
            <button
              onClick={() => setShowColumns(!showColumns)}
              className="inline-flex items-center gap-1 text-[12px] text-slate-500 hover:text-[#0A0A0A] transition-colors font-sans"
            >
              {showColumns ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showColumns ? "Hide columns" : "Show columns"}
            </button>
            <button
              onClick={onReset}
              className="inline-flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-[#0A0A0A] transition-colors font-sans"
              data-testid="chat-reset-button"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Change dataset
            </button>
          </div>
        </div>

        {/* Columns Grid Accordion */}
        {showColumns && (
          <div className="mb-6 p-5 rounded-3xl border border-slate-100 bg-slate-50/40 font-sans transition-all animate-fadeIn">
            <div className="text-[11px] font-heading font-bold text-slate-400 uppercase tracking-widest mb-3.5">
              📊 Dataset Columns Inspector ({dataset.columns.length} columns)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
              {dataset.columns.map((col: string) => {
                const dtype = dataset.dtypes?.[col] || "object";
                const isNumeric = dtype.includes("int") || dtype.includes("float") || dtype.includes("double") || dtype.includes("num");
                return (
                  <div key={col} className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-white border border-slate-100 shadow-sm hover:border-slate-300 transition-all group">
                    <span className="font-semibold text-slate-800 text-[13px] truncate group-hover:text-[#0033FF] transition-colors" title={col}>
                      {col}
                    </span>
                    <span className={`text-[9px] uppercase font-bold tracking-wider shrink-0 ml-2.5 px-1.5 py-0.5 rounded-md ${
                      isNumeric ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                    }`}>
                      {isNumeric ? "num" : "str"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Chat card */}
        <div
          className="bg-white border border-slate-100 rounded-3xl shadow-[0_20px_60px_rgb(0,0,0,0.06)] overflow-hidden flex flex-col h-[80vh] min-h-[680px]"
          data-testid="chat-card"
        >
          {/* Top strip */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <OmegaLogo size={18} />
              <span className="text-[11px] tracking-[0.24em] uppercase text-slate-400 font-semibold font-heading">
                Decision chat
              </span>
            </div>
            <div className="flex items-center gap-2 font-sans">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] text-slate-500 font-medium">Connected · gpt-4o-mini</span>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollerRef}
            id="chat-messages-container"
            className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-5"
            data-testid="chat-messages"
          >
            {messages.length === 0 && !sending && (
              <div className="max-w-2xl mx-auto mt-6 text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-[11px] tracking-[0.24em] uppercase text-slate-500 font-semibold font-heading">
                  Ready
                </div>
                <h3 className="mt-5 font-heading text-3xl tracking-tighter text-[#0A0A0A] font-bold">
                  Ask Omega anything about <br />
                  <span className="font-serif-italic text-[#0033FF]">{dataset.name}</span>.
                </h3>
                <p className="mt-3 text-sm text-slate-500 font-sans">
                  I can summarise, spot trends, compare segments, or draw charts.
                </p>
              </div>
            )}
            {messages.map((m, idx) =>
              m.role === "user" ? (
                <UserBubble key={idx} text={m.text || ""} />
              ) : (
                <AssistantBubble
                  key={idx}
                  msg={m}
                  isLatest={idx === messages.length - 1}
                  index={idx}
                />
              )
            )}
            {sending && <Thinking />}
          </div>

          {/* Suggestions */}
          {!sending && (
            <div className="px-4 sm:px-6 pt-3 pb-1 flex gap-2 overflow-x-auto font-sans" data-testid="chat-suggestions">
              {suggestions.slice(0, 4).map((s, i) => (
                <button
                  key={i}
                  onClick={() => send(s)}
                  className="whitespace-nowrap px-3.5 py-1.5 rounded-full border border-slate-200 text-[12px] text-slate-600 hover:border-[#0033FF] hover:text-[#0033FF] transition-colors"
                  data-testid={`chat-suggestion-${i}`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="border-t border-slate-100 bg-white px-3 py-3 flex items-center gap-2"
            data-testid="chat-input-form"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask about ${dataset.name}…`}
              className="flex-1 bg-[#F8F9FA] border-0 focus:outline-none focus:ring-2 focus:ring-[#0033FF]/20 text-[15px] py-3.5 px-5 rounded-2xl font-sans"
              data-testid="chat-input-field"
              disabled={sending}
              autoFocus
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-[#0A0A0A] text-white hover:bg-[#1a1a1a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              data-testid="chat-send-button"
              aria-label="Send"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </form>
        </div>

        <div className="mt-4 text-center text-[11px] text-slate-400 font-sans">
          Omega analyses a schema summary — never sends your full dataset to the model.
        </div>
      </div>
    </section>
  );
};

export default ChatInterface;
