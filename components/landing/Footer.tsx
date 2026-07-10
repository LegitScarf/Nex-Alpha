import { motion } from "framer-motion";
import { ArrowUpRight, Mail, Twitter, Github } from "lucide-react";
import { TID } from "@/constants/testIds";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";

interface FooterProps {
  onLaunch: (productId: "omega") => void;
  loading: boolean;
}

export default function Footer({ onLaunch, loading }: FooterProps) {
  const { isSignedIn } = useAuth();

  const handleLaunchClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onLaunch("omega");
  };

  return (
    <footer
      id="launch"
      className="relative border-t border-black/5 bg-white overflow-hidden"
    >
      {/* CTA band */}
      <div className="relative py-24 md:py-28">
        <div className="max-w-5xl mx-auto px-6 md:px-8 text-center">
          <motion.h3
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="font-display font-black tracking-tighter text-[#0A0A0A] text-4xl md:text-6xl leading-[0.95]"
          >
            Ready to <span className="italic text-[#FF5E00]">talk</span> to your
            data?
          </motion.h3>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="mt-5 text-lg text-zinc-600"
          >
            Free forever plan. No credit card. First insight in under 30 seconds.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-8 flex justify-center"
          >
            {isSignedIn ? (
              <button
                onClick={handleLaunchClick}
                disabled={loading}
                data-testid={TID.footerLaunchButton}
                className="group inline-flex items-center gap-2 rounded-full bg-[#0A0A0A] text-white px-7 py-4 font-medium text-base shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] hover:bg-[#0047FF] hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50"
              >
                {loading ? "Launching..." : "Launch Omega"}
                <ArrowUpRight
                  size={18}
                  strokeWidth={2.2}
                  className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </button>
            ) : (
              <Link
                href="/sign-in"
                data-testid={TID.footerLaunchButton}
                className="group inline-flex items-center gap-2 rounded-full bg-[#0A0A0A] text-white px-7 py-4 font-medium text-base shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] hover:bg-[#0047FF] hover:-translate-y-0.5 transition-all duration-300"
              >
                Launch Omega
                <ArrowUpRight
                  size={18}
                  strokeWidth={2.2}
                  className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </Link>
            )}
          </motion.div>
        </div>
      </div>

      {/* Watermark */}
      <div
        aria-hidden
        className="pointer-events-none select-none overflow-hidden"
      >
        <div className="flex whitespace-nowrap animate-marquee">
          {[0, 1].map((k) => (
            <span
              key={k}
              className="font-display font-black tracking-tighter text-[16vw] leading-none text-transparent px-8"
              style={{
                WebkitTextStroke: "1px rgba(10,10,10,0.08)",
              }}
            >
              NEXALPHA · Ω · OMEGA · NEXALPHA · Ω · OMEGA ·&nbsp;
            </span>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-black/5">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#0A0A0A] text-white font-display font-black text-sm">
              Ω
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              © {new Date().getFullYear()} NexAlpha Labs — All rights reserved
            </span>
          </div>
          <div className="flex items-center gap-5">
            {[
              { icon: Twitter, label: "twitter", href: "#" },
              { icon: Github, label: "github", href: "https://github.com" },
              { icon: Mail, label: "email", href: "mailto:contact@nexalpha.com" },
            ].map(({ icon: Icon, label, href }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="text-zinc-500 hover:text-black transition-colors"
              >
                <Icon size={16} strokeWidth={1.75} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
