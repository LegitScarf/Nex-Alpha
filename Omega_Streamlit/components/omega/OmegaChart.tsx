import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip,
} from "recharts";

const PALETTE = ["#0A0A0A", "#0033FF", "#94A3B8", "#475569", "#CBD5E1", "#0F172A"];

const axisStyle = { fontSize: 11, fontFamily: "Manrope", fill: "#94A3B8" };

export const OmegaChart = ({ spec }: { spec: any }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!spec || !spec.data?.length) return null;
  const { type, title, x_key, y_key, data } = spec;

  const clean = data.map((d: any) => ({
    ...d,
    [y_key]: typeof d[y_key] === "string" ? Number(String(d[y_key]).replace(/[^0-9.\-]/g, "")) : d[y_key],
  }));

  if (!mounted) {
    return <div className="mt-4 h-[220px] rounded-xl border border-slate-100 bg-white" />;
  }

  return (
    <div
      className="mt-4 rounded-xl border border-slate-100 bg-white p-5"
      data-testid="omega-chart"
    >
      {title && (
        <div className="mb-4">
          <div className="text-[10px] tracking-[0.24em] uppercase text-slate-400 font-semibold">
            Chart · {type}
          </div>
          <div className="mt-1 font-heading text-[15px] text-[#0A0A0A] font-bold">{title}</div>
        </div>
      )}
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          {type === "line" ? (
            <LineChart data={clean} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
              <XAxis dataKey={x_key} tick={axisStyle} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} />
              <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={40} />
              <Tooltip
                cursor={{ stroke: "#E2E8F0", strokeDasharray: "3 3" }}
                contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12, fontFamily: "Manrope" }}
              />
              <Line
                type="monotone"
                dataKey={y_key}
                stroke="#0033FF"
                strokeWidth={2.5}
                dot={{ r: 3, stroke: "#0033FF", fill: "#fff", strokeWidth: 2 }}
                animationDuration={900}
              />
            </LineChart>
          ) : type === "pie" ? (
            <PieChart>
              <Tooltip
                contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12, fontFamily: "Manrope" }}
              />
              <Pie
                data={clean}
                dataKey={y_key}
                nameKey={x_key}
                innerRadius={45}
                outerRadius={80}
                paddingAngle={2}
                animationDuration={900}
              >
                {clean.map((_: any, i: number) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="#fff" strokeWidth={2} />
                ))}
              </Pie>
            </PieChart>
          ) : (
            <BarChart data={clean} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
              <XAxis dataKey={x_key} tick={axisStyle} tickLine={false} axisLine={{ stroke: "#E2E8F0" }} />
              <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={40} />
              <Tooltip
                cursor={{ fill: "rgba(15,23,42,0.04)" }}
                contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 12, fontFamily: "Manrope" }}
              />
              <Bar dataKey={y_key} radius={[4, 4, 0, 0]} fill="#0A0A0A" animationDuration={900}>
                {clean.map((_: any, i: number) => (
                  <Cell key={i} fill={i === clean.length - 1 ? "#0033FF" : "#0A0A0A"} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default OmegaChart;
