import { motion, useScroll, useTransform } from "framer-motion";
import { useState, useEffect } from "react";
import { ArrowUpRight } from "lucide-react";
import { TID } from "@/constants/testIds";
import { useAuth, UserButton } from "@clerk/nextjs";
import Link from "next/link";

interface NavbarProps {
  onLaunch: (productId: "omega") => void;
  loading: boolean;
}

export default function Navbar({ onLaunch, loading }: NavbarProps) {
  const { scrollY } = useScroll();
  const [elevated, setElevated] = useState(false);
  const { isSignedIn } = useAuth();

  useEffect(() => {
    return scrollY.on("change", (v) => setElevated(v > 12));
  }, [scrollY]);

  const opacity = useTransform(scrollY, [0, 80], [0.6, 0.9]);

  const links = [
    { label: "Products", href: "#products", id: TID.navLinks.products },
    { label: "Pricing", href: "#pricing", id: TID.navLinks.pricing },
    { label: "Docs", href: "#docs", id: TID.navLinks.docs },
  ];

  return (
    <motion.header
      style={{ ["--bg-op" as any]: opacity }}
      className={`fixed top-0 inset-x-0 z-50 transition-shadow duration-300 ${
        elevated ? "shadow-[0_1px_0_rgba(0,0,0,0.06)]" : ""
      }`}
    >
      <div
        className={`w-full ${
          elevated ? "glass" : "bg-white/50 backdrop-blur-md"
        } border-b border-black/5`}
      >
        <div className="max-w-7xl mx-auto px-6 md:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link
            href="#top"
            data-testid={TID.navLogo}
            className="flex items-center gap-2 group"
          >
            <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#0A0A0A] text-white font-display font-black text-lg leading-none">
              Ω
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[#DFFF00] animate-sparkle" />
            </span>
            <span className="font-display font-bold tracking-tight text-[#0A0A0A]">
              NexAlpha
            </span>
            <span className="hidden md:inline font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400 pl-2 border-l border-zinc-200 ml-1">
              /Omega
            </span>
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-8">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                data-testid={l.id}
                className="relative text-sm font-medium text-zinc-600 hover:text-black transition-colors group"
              >
                {l.label}
                <span className="absolute left-0 -bottom-1 h-[2px] w-0 bg-[#0047FF] transition-all duration-300 group-hover:w-full" />
              </a>
            ))}
          </nav>

          {/* CTA */}
          <div className="flex items-center gap-4">
            {isSignedIn ? (
              <>
                <button
                  onClick={() => onLaunch("omega")}
                  disabled={loading}
                  data-testid={TID.navLaunchButton}
                  className="group inline-flex items-center gap-1.5 rounded-full bg-[#0A0A0A] text-white pl-4 pr-3 py-2 text-sm font-medium hover:bg-[#0047FF] transition-all duration-300 hover:shadow-[0_10px_30px_-10px_rgba(0,71,255,0.6)] disabled:opacity-50"
                >
                  {loading ? "Launching..." : "Launch Omega"}
                  <ArrowUpRight
                    size={16}
                    strokeWidth={2}
                    className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </button>
                <UserButton afterSignOutUrl="/" />
              </>
            ) : (
              <Link
                href="/sign-in"
                data-testid={TID.navLaunchButton}
                className="group inline-flex items-center gap-1.5 rounded-full bg-[#0A0A0A] text-white pl-4 pr-3 py-2 text-sm font-medium hover:bg-[#0047FF] transition-all duration-300 hover:shadow-[0_10px_30px_-10px_rgba(0,71,255,0.6)]"
              >
                Sign In
                <ArrowUpRight
                  size={16}
                  strokeWidth={2}
                  className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </Link>
            )}
          </div>
        </div>
      </div>
    </motion.header>
  );
}
