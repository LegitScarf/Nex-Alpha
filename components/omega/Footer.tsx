import React from "react";
import { OmegaLogo } from "@/components/omega/OmegaLogo";

export const Footer = () => (
  <footer className="border-t border-slate-100 bg-white" data-testid="omega-footer">
    <div className="max-w-6xl mx-auto px-6 sm:px-8 py-12 grid grid-cols-12 gap-8">
      <div className="col-span-12 md:col-span-6">
        <OmegaLogo />
        <p className="mt-4 max-w-md text-sm text-slate-500 leading-relaxed font-sans">
          Omega is a no-code decision support layer. Data in — decisions out.
        </p>
      </div>
      <div className="col-span-6 md:col-span-3">
        <div className="text-[11px] tracking-[0.24em] uppercase text-slate-400 font-semibold">Product</div>
        <ul className="mt-4 space-y-2 text-sm text-slate-600 font-sans">
          <li><a href="#hero" className="hover:text-[#0A0A0A]">Overview</a></li>
          <li><a href="#how" className="hover:text-[#0A0A0A]">How it works</a></li>
          <li><a href="#showcase" className="hover:text-[#0A0A0A]">Showcase</a></li>
        </ul>
      </div>
      <div className="col-span-6 md:col-span-3">
        <div className="text-[11px] tracking-[0.24em] uppercase text-slate-400 font-semibold">Company</div>
        <ul className="mt-4 space-y-2 text-sm text-slate-600 font-sans">
          <li>Studio Omega</li>
          <li>Contact</li>
          <li>Privacy</li>
        </ul>
      </div>
    </div>
    <div className="border-t border-slate-100">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 py-6 flex items-center justify-between text-[11px] text-slate-400 font-sans">
        <span>© {new Date().getFullYear()} Omega</span>
        <span className="tracking-[0.24em] uppercase">Made with intent</span>
      </div>
    </div>
  </footer>
);

export default Footer;
