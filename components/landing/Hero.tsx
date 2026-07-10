import { motion } from "framer-motion";
import { ArrowUpRight, Play, Zap } from "lucide-react";
import { TID } from "@/constants/testIds";
import OmegaWidget from "./OmegaWidget";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";

interface HeroProps {
  onLaunch: (productId: "omega") => void;
  loading: boolean;
}

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.19, 1, 0.22, 1] },
  },
};

export default function Hero({ onLaunch, loading }: HeroProps) {
  const { isSignedIn } = useAuth();

  const handleLaunchClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onLaunch("omega");
  };

  return (
    <section
      id="top"
      className="relative pt-32 md:pt-40 pb-24 md:pb-32 overflow-hidden hero-spotlight"
    >
      {/* Animated Ω mark floating background */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
        className="pointer-events-none absolute inset-x-0 top-[100px] flex justify-center"
      >
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          className="font-display font-black text-[26vw] leading-none text-transparent select-none"
          style={{
            WebkitTextStroke: "1px rgba(10,10,10,0.06)",
          }}
        >
          Ω
        </motion.span>
      </motion.div>

      {/* Sparkle dots */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="absolute left-[8%] top-[38%] h-1.5 w-1.5 rounded-full bg-[#0047FF] animate-sparkle" />
        <span
          className="absolute right-[10%] top-[30%] h-1.5 w-1.5 rounded-full bg-[#FF5E00] animate-sparkle"
          style={{ animationDelay: "0.6s" }}
        />
        <span
          className="absolute left-[20%] bottom-[18%] h-1.5 w-1.5 rounded-full bg-[#DFFF00] animate-sparkle"
          style={{ animationDelay: "1.1s" }}
        />
        <span
          className="absolute right-[24%] bottom-[26%] h-1 w-1 rounded-full bg-[#00F0FF] animate-sparkle"
          style={{ animationDelay: "1.6s" }}
        />
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="visible"
        className="relative max-w-7xl mx-auto px-6 md:px-8 text-center"
      >
        {/* Badge */}
        <motion.div variants={item} className="flex justify-center">
          <span
            data-testid={TID.heroBadge}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 backdrop-blur-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-600"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-[#0047FF] opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#0047FF]" />
            </span>
            Introducing Omega Analytics · v1.0
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          variants={item}
          className="font-display font-black tracking-tighter leading-[0.92] mt-8 text-[#0A0A0A] text-5xl md:text-7xl lg:text-8xl"
        >
          Talk to your data.
          <br />
          <span className="relative inline-block">
            <span
              className="relative z-10 bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(110deg, #0A0A0A 20%, #0047FF 55%, #FF5E00 90%)",
              }}
            >
              Watch it answer.
            </span>
            <motion.span
              aria-hidden
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.9, duration: 0.7, ease: [0.19, 1, 0.22, 1] }}
              className="absolute -bottom-1 left-0 right-0 h-2 bg-[#DFFF00] origin-left -z-0"
            />
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          variants={item}
          className="mt-8 mx-auto max-w-2xl text-lg md:text-xl leading-relaxed text-zinc-600"
        >
          The playful, powerful AI analyst that turns raw CSVs, SQL and Excel into
          real-time visual insights — <span className="text-[#0A0A0A] font-semibold">zero code, zero SQL, zero friction.</span>
        </motion.p>

        {/* CTAs */}
        <motion.div
          variants={item}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          {isSignedIn ? (
            <button
              onClick={handleLaunchClick}
              disabled={loading}
              data-testid={TID.heroCtaButton}
              className="group relative inline-flex items-center gap-2 rounded-full bg-[#FF5E00] text-white px-6 py-3.5 font-medium text-sm md:text-base shadow-[0_10px_30px_-10px_rgba(255,94,0,0.55)] hover:shadow-[0_18px_40px_-10px_rgba(255,94,0,0.7)] hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50"
            >
              <Zap size={16} strokeWidth={2.2} />
              {loading ? "Launching..." : "Launch Omega — Free"}
              <ArrowUpRight
                size={16}
                strokeWidth={2.2}
                className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </button>
          ) : (
            <Link
              href="/sign-in"
              data-testid={TID.heroCtaButton}
              className="group relative inline-flex items-center gap-2 rounded-full bg-[#FF5E00] text-white px-6 py-3.5 font-medium text-sm md:text-base shadow-[0_10px_30px_-10px_rgba(255,94,0,0.55)] hover:shadow-[0_18px_40px_-10px_rgba(255,94,0,0.7)] hover:-translate-y-0.5 transition-all duration-300"
            >
              <Zap size={16} strokeWidth={2.2} />
              Launch Omega — Free
              <ArrowUpRight
                size={16}
                strokeWidth={2.2}
                className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </Link>
          )}
          <a
            href="#demo"
            data-testid={TID.heroSecondaryButton}
            className="group inline-flex items-center gap-2 rounded-full border border-black/15 bg-white/70 backdrop-blur-md px-6 py-3.5 font-medium text-sm md:text-base text-[#0A0A0A] hover:border-black hover:bg-white transition-all duration-300"
          >
            <Play size={14} strokeWidth={2.2} className="fill-current" />
            Watch the 30s demo
          </a>
        </motion.div>

        {/* Trust bar */}
        <motion.div
          variants={item}
          className="mt-14 flex flex-col items-center gap-4"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-400">
            trusted by analysts at
          </span>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 opacity-60">
            {["Northwind", "Acme Labs", "Vertex", "Kaido", "Helion", "Orbital"].map(
              (n) => (
                <span
                  key={n}
                  className="font-display font-bold tracking-tight text-zinc-500 text-sm md:text-base"
                >
                  {n}
                </span>
              )
            )}
          </div>
        </motion.div>

        {/* Interactive Widget */}
        <div id="demo" className="mt-20 md:mt-24">
          <OmegaWidget />
        </div>
      </motion.div>
    </section>
  );
}
