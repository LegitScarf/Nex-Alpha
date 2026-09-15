import React from "react";
import { Quote } from "lucide-react";

export const Showcase = () => (
  <section
    id="showcase"
    className="relative bg-[#0A0A0A] text-white py-24 sm:py-32 overflow-hidden"
    data-testid="showcase-section"
  >
    <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
      style={{
        backgroundImage:
          "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
        backgroundSize: "64px 64px",
      }}
    />
    <div className="relative max-w-6xl mx-auto px-6 sm:px-8">
      <div className="grid grid-cols-12 gap-8 items-center">
        <div className="col-span-12 md:col-span-7">
          <div className="text-[11px] tracking-[0.24em] uppercase text-white/60 font-semibold">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#0033FF] mr-2 align-middle" />
            Editorial notes
          </div>
          <blockquote className="mt-6 font-serif-italic text-3xl sm:text-4xl leading-[1.15] tracking-tight">
            "It's the first analytics tool that actually feels like it read the room —
            not just the table."
          </blockquote>
          <div className="mt-8 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center">
              <Quote className="w-4 h-4 text-white/70" />
            </div>
            <div>
              <div className="text-sm font-semibold">Priya Iyer</div>
              <div className="text-xs text-white/60">Head of Ops · Northwind Analytics</div>
            </div>
          </div>
        </div>
        <div className="col-span-12 md:col-span-5">
          <div className="grid grid-cols-2 gap-4">
            {[
              { k: "12s", v: "Avg. time to first insight" },
              { k: "94%", v: "Answers accepted first try" },
              { k: "0", v: "SQL required" },
              { k: "3×", v: "Faster than a BI dashboard build" },
            ].map((s) => (
              <div key={s.k} className="p-6 rounded-2xl border border-white/10 bg-white/[0.03]">
                <div className="font-heading text-4xl tracking-tighter font-bold">{s.k}</div>
                <div className="mt-2 text-[12px] text-white/60 leading-snug">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default Showcase;
