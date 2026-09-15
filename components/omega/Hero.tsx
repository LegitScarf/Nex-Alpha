import React from "react";
import { ArrowRight, Sparkles } from "lucide-react";

const clients = [
  "NORTHWIND", "AXIOM", "PARALLAX", "MERIDIAN", "HELIOGRAPH",
  "OBSCURA", "FIELDNOTES", "PRIME BASIS", "STUDIO OMEGA",
];

export const Hero = ({ onGetStarted }: { onGetStarted: () => void }) => {
  return (
    <section
      id="hero"
      className="relative overflow-hidden bg-white"
      data-testid="hero-section"
    >
      {/* faint grid */}
      <div className="absolute inset-0 omega-grid pointer-events-none" />
      <div className="absolute inset-0 omega-noise" />

      <div className="relative max-w-6xl mx-auto px-6 sm:px-8 pt-24 sm:pt-32 pb-16">
        <div className="grid grid-cols-12 gap-8 items-end">
          <div className="col-span-12 lg:col-span-8">
            <div
              className="reveal reveal-1 inline-flex items-center gap-2 text-[11px] tracking-[0.24em] uppercase text-slate-500 font-semibold"
              data-testid="hero-eyebrow"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#0033FF]" />
              Decision support, without the dashboard
            </div>

            <h1
              className="reveal reveal-2 mt-6 font-heading text-[44px] sm:text-6xl lg:text-7xl leading-[0.95] tracking-tighter text-[#0A0A0A]"
              data-testid="hero-heading"
            >
              Ask your data <br />
              <span className="font-serif-italic text-[#0033FF]">what it means.</span>
            </h1>

            <p
              className="reveal reveal-3 mt-6 max-w-xl text-[17px] leading-relaxed text-slate-600"
              data-testid="hero-subheading"
            >
              Omega is a no-code decision support layer that reads your dataset,
              answers business questions in plain language, and draws the chart
              your board actually wants to see — in seconds.
            </p>

            <div className="reveal reveal-4 mt-10 flex items-center gap-3">
              <button
                onClick={onGetStarted}
                className="group inline-flex items-center gap-2 bg-[#0A0A0A] text-white text-sm font-medium px-6 py-3.5 rounded-full hover:bg-[#1a1a1a] transition-colors"
                data-testid="hero-primary-cta"
              >
                Try with your dataset
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <a
                href="#how"
                className="inline-flex items-center gap-2 text-sm font-medium text-[#0A0A0A] px-4 py-3.5 rounded-full hover:bg-slate-50 transition-colors"
                data-testid="hero-secondary-cta"
              >
                <Sparkles className="w-4 h-4 text-[#0033FF]" />
                See how it works
              </a>
            </div>

            <div className="reveal reveal-5 mt-10 flex items-center gap-4 text-xs text-slate-500">
              <div className="flex -space-x-1">
                <span className="w-6 h-6 rounded-full bg-[#0A0A0A]" />
                <span className="w-6 h-6 rounded-full bg-[#0033FF]" />
                <span className="w-6 h-6 rounded-full bg-slate-200" />
              </div>
              <span>Trusted by analysts, operators & founders shipping decisions daily</span>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 hidden lg:block">
            <div className="reveal reveal-3 border border-slate-100 rounded-2xl p-6 bg-white/70 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div className="text-[10px] tracking-[0.24em] uppercase text-slate-400 font-semibold">
                Live sample
              </div>
              <div className="mt-3 font-serif-italic text-[22px] text-[#0A0A0A] leading-snug">
                "Which region compounded fastest last quarter?"
              </div>
              <div className="mt-5 flex items-end gap-1.5 h-24">
                {[24, 34, 48, 58, 72, 86].map((h, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-t ${i === 5 ? "bg-[#0033FF]" : "bg-[#0A0A0A]"}`}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <div className="mt-3 flex justify-between text-[10px] text-slate-400 tracking-wider">
                <span>JAN</span><span>FEB</span><span>MAR</span><span>APR</span><span>MAY</span><span>JUN</span>
              </div>
              <div className="mt-4 text-[13px] text-slate-600">
                North region compounded <span className="text-[#0A0A0A] font-semibold">+92% MoM</span> — outpacing South by 3.4×.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* marquee */}
      <div className="relative border-y border-slate-100 py-6 overflow-hidden bg-white">
        <div className="omega-marquee flex whitespace-nowrap gap-14">
          {[...clients, ...clients].map((c, i) => (
            <span key={i} className="text-[11px] tracking-[0.32em] text-slate-400 font-semibold">
              {c}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Hero;
