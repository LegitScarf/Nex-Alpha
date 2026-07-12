import React from "react";

export const OmegaLogo = ({ className = "", size = 22 }: { className?: string; size?: number }) => (
  <span
    className={`inline-flex items-center gap-2 ${className}`}
    data-testid="omega-logo"
  >
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="7" fill="#0A0A0A" />
      <path
        d="M9 22.5c1.2-1.2 1.8-3 1.8-5C10.8 13.5 13 11 16 11s5.2 2.5 5.2 6.5c0 2 .6 3.8 1.8 5"
        stroke="#FFFFFF"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path d="M7.5 22.5h4M20.5 22.5h4" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
    <span className="font-heading text-[17px] tracking-tight text-[#0A0A0A] font-bold">
      Omega
    </span>
  </span>
);

export default OmegaLogo;
