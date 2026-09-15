import React from "react";
import { Upload, MessageSquare, LineChart } from "lucide-react";

const steps = [
  {
    n: "01",
    icon: Upload,
    label: "Drop your data",
    body: "CSV, Excel, JSON — Omega detects columns, types, and stats without a config file.",
  },
  {
    n: "02",
    icon: MessageSquare,
    label: "Ask in plain English",
    body: "No SQL. No formulas. Ask like you'd ask a senior analyst on your team.",
  },
  {
    n: "03",
    icon: LineChart,
    label: "Get the answer & the chart",
    body: "Omega replies with a short, editorial explanation and — when useful — an inline chart.",
  },
];

export const HowItWorks = () => (
  <section id="how" className="bg-white py-24 sm:py-32 border-t border-slate-100" data-testid="how-section">
    <div className="max-w-6xl mx-auto px-6 sm:px-8">
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 md:col-span-4">
          <div className="text-[11px] tracking-[0.24em] uppercase text-slate-500 font-semibold">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#0033FF] mr-2 align-middle" />
            How it works
          </div>
          <h2 className="mt-5 font-heading text-4xl sm:text-5xl tracking-tighter text-[#0A0A0A]">
            Three steps, <br />
            <span className="font-serif-italic text-[#0033FF]">zero setup.</span>
          </h2>
          <p className="mt-5 text-slate-600 leading-relaxed max-w-sm">
            Omega collapses the workflow between a spreadsheet, an analyst, and a chart tool into a single conversation.
          </p>
        </div>
        <div className="col-span-12 md:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <div
                key={s.n}
                className="p-6 rounded-2xl border border-slate-100 bg-white hover:border-[#0A0A0A] transition-all shadow-[0_4px_20px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)]"
                data-testid={`how-step-${i}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] tracking-[0.24em] text-slate-400 font-semibold">{s.n}</span>
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-[#0033FF]" />
                  </div>
                </div>
                <div className="mt-8 font-heading text-[17px] text-[#0A0A0A] tracking-tight font-bold">
                  {s.label}
                </div>
                <div className="mt-2 text-sm text-slate-500 leading-relaxed">{s.body}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  </section>
);

export default HowItWorks;
