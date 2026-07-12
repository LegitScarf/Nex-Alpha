import React from "react";
import { OmegaLogo } from "@/components/omega/OmegaLogo";
import { ArrowUpRight } from "lucide-react";

export const OmegaHeader = ({ onLaunch }: { onLaunch: () => void }) => {
  return (
    <header
      className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-100"
      data-testid="omega-header"
    >
      <div className="max-w-6xl mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
        <OmegaLogo />
        <nav className="hidden md:flex items-center gap-8 text-[13px] text-slate-600">
          <a href="#product" className="hover:text-[#0A0A0A] transition-colors" data-testid="nav-product">Product</a>
          <a href="#how" className="hover:text-[#0A0A0A] transition-colors" data-testid="nav-how">How it works</a>
          <a href="#showcase" className="hover:text-[#0A0A0A] transition-colors" data-testid="nav-showcase">Showcase</a>
        </nav>
        <button
          onClick={onLaunch}
          className="group inline-flex items-center gap-1.5 bg-[#0A0A0A] text-white text-[13px] font-medium px-4 py-2 rounded-full hover:bg-[#1a1a1a] transition-colors"
          data-testid="header-launch-button"
        >
          Launch Omega
          <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </button>
      </div>
    </header>
  );
};

export default OmegaHeader;
