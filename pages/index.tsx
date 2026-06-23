"use client"

import { useState, useEffect, useRef } from "react"
import Head from "next/head"
import Link from "next/link"
import { useAuth, useUser, UserButton } from "@clerk/nextjs"
import { motion, useInView } from "framer-motion"
import {
  LineChart,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  Zap,
  Sparkles,
  Play,
  Mail,
  Briefcase,
  User,
  BarChart2,
  Activity,
  ChevronRight,
} from "lucide-react"

// ─── Animation helpers ────────────────────────────────────────
const fadeUp = {
  hidden: { y: 28, opacity: 0 },
  visible: (i: number = 0) => ({
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 90, damping: 18, delay: i * 0.1 },
  }),
}

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.13 } },
}

// ─── Omega terminal widget ────────────────────────────────────
const QUERY_TEXT = "analyze Q3 sales trends"
const BAR_DATA = [
  { label: "Jul", h: 58, color: "#6366f1" },
  { label: "Aug", h: 72, color: "#8b5cf6" },
  { label: "Sep", h: 88, color: "#a855f7" },
  { label: "Q3",  h: 100, color: "#ec4899" },
  { label: "Q2",  h: 63, color: "#6366f1" },
  { label: "Q1",  h: 48, color: "#6366f1" },
]

function OmegaWidget() {
  const [phase, setPhase]   = useState<"typing" | "loading" | "chart">("typing")
  const [typed, setTyped]   = useState("")
  const [bars, setBars]     = useState<number[]>([])
  const idxRef              = useRef(0)
  const containerRef        = useRef<HTMLDivElement>(null)
  const inView              = useInView(containerRef, { once: true })

  // Re-runs animation whenever the card scrolls into view
  useEffect(() => {
    if (!inView) return
    setPhase("typing")
    setTyped("")
    setBars([])
    idxRef.current = 0
  }, [inView])

  // Typing phase
  useEffect(() => {
    if (phase !== "typing") return
    if (idxRef.current >= QUERY_TEXT.length) {
      setTimeout(() => setPhase("loading"), 350)
      return
    }
    const t = setTimeout(() => {
      setTyped(QUERY_TEXT.slice(0, idxRef.current + 1))
      idxRef.current++
    }, 55)
    return () => clearTimeout(t)
  }, [phase, typed])

  // Loading → chart
  useEffect(() => {
    if (phase !== "loading") return
    const t = setTimeout(() => setPhase("chart"), 900)
    return () => clearTimeout(t)
  }, [phase])

  // Bars cascade in
  useEffect(() => {
    if (phase !== "chart") return
    BAR_DATA.forEach((_, i) => {
      setTimeout(() => setBars(prev => [...prev, i]), i * 90)
    })
  }, [phase])

  return (
    <div ref={containerRef} className="terminal-widget mt-6">
      <div className="terminal-header">
        <span className="terminal-dot" style={{ background: "#ff5f57" }} />
        <span className="terminal-dot" style={{ background: "#febc2e" }} />
        <span className="terminal-dot" style={{ background: "#28c840" }} />
        <span className="terminal-dim ml-3 text-xs select-none">omega — data shell</span>
      </div>
      <div className="terminal-body">
        {/* prompt line */}
        <div>
          <span className="terminal-prompt">❯ </span>
          <span className="terminal-user">{typed}</span>
          {phase === "typing" && <span className="cursor-blink" />}
        </div>

        {(phase === "loading" || phase === "chart") && (
          <div className="mt-1">
            {phase === "loading" ? (
              <span className="terminal-dim">
                <span style={{ animation: "blink 0.9s step-end infinite" }}>⠋</span>
                {" "}Running multi-modal analysis…
              </span>
            ) : (
              <span className="terminal-output">✓ Analysis complete — Q3 sales data (6 segments)</span>
            )}
          </div>
        )}

        {phase === "chart" && (
          <>
            <div className="chart-container">
              {BAR_DATA.map((b, i) =>
                bars.includes(i) ? (
                  <div
                    key={i}
                    className="chart-bar"
                    style={{
                      height: `${b.h}%`,
                      background: `linear-gradient(to top, ${b.color}cc, ${b.color}55)`,
                      animationDelay: `${i * 0.07}s`,
                      border: `1px solid ${b.color}55`,
                    }}
                  />
                ) : (
                  <div key={i} className="flex-1" />
                )
              )}
            </div>
            <div className="chart-labels">
              {BAR_DATA.map((b, i) => (
                <span key={i} className="chart-label">{b.label}</span>
              ))}
            </div>
            <div className="mt-2">
              <span className="terminal-output text-xs">↑ 23.4% QoQ · Peak: Sep · Trend: accelerating</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── OptiTrade widget ─────────────────────────────────────────
const STRIKES = [
  { strike: "24,500 CE", premium: "₹142", action: "BUY",  conf: 91, active: true  },
  { strike: "24,450 CE", premium: "₹178", action: "HOLD", conf: 74, active: false },
  { strike: "24,400 PE", premium: "₹95",  action: "SKIP", conf: 38, active: false },
]

const SPARK = [32, 36, 31, 42, 38, 46, 41, 55, 50, 62, 58, 70]
const SPARK_W = 140
const SPARK_H = 36

function sparkPath(pts: number[]): string {
  const mx = Math.max(...pts)
  const mn = Math.min(...pts)
  const norm = (v: number) => SPARK_H - ((v - mn) / (mx - mn + 1)) * (SPARK_H - 4) - 2
  return pts
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i / (pts.length - 1)) * SPARK_W},${norm(v)}`)
    .join(" ")
}

function OptiTradeWidget() {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick(t => (t + 1) % SPARK.length), 1600)
    return () => clearInterval(id)
  }, [])

  const livePrice = (24461 + Math.sin(tick * 0.9) * 18).toFixed(0)

  return (
    <div className="mt-6 space-y-3">
      {/* Live index ticker */}
      <div
        className="flex items-center justify-between px-3 py-2 rounded-lg"
        style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <span className="text-xs font-bold text-gray-300">NIFTY 50</span>
        <div className="flex items-center gap-3">
          <svg width={SPARK_W} height={SPARK_H} viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}>
            <defs>
              <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d={sparkPath(SPARK) + ` L${SPARK_W},${SPARK_H} L0,${SPARK_H} Z`}
              fill="url(#spark-fill)"
            />
            <path d={sparkPath(SPARK)} fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <div className="text-right">
            <div className="text-sm font-bold text-white font-mono">{livePrice}</div>
            <div className="text-xs text-emerald-400">+0.38%</div>
          </div>
        </div>
      </div>

      {/* Strike recommendations */}
      <div className="space-y-2">
        {STRIKES.map((s, i) => (
          <div
            key={i}
            className="strike-card flex items-center justify-between"
            style={
              !s.active
                ? { background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.06)", opacity: 0.6 }
                : undefined
            }
          >
            <div className="flex items-center gap-2">
              {s.active && <span className="strike-badge">● {s.action}</span>}
              {!s.active && (
                <span
                  className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: s.action === "HOLD" ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.06)",
                    border: `1px solid ${s.action === "HOLD" ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.1)"}`,
                    color: s.action === "HOLD" ? "#fbbf24" : "#94a3b8",
                    letterSpacing: "0.05em",
                  }}
                >
                  {s.action}
                </span>
              )}
              <span className="text-sm font-bold text-white font-mono">{s.strike}</span>
            </div>
            <div className="flex items-center gap-3 text-right">
              <span className="text-xs text-gray-400 font-mono">{s.premium}</span>
              <div className="text-right">
                <div className="text-xs text-gray-500 mb-0.5">Conf.</div>
                <div
                  className="text-xs font-bold font-mono"
                  style={{ color: s.conf > 80 ? "#34d399" : s.conf > 60 ? "#fbbf24" : "#f87171" }}
                >
                  {s.conf}%
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-600 pt-1">
        ⚠ Illustrative only · Not financial advice
      </p>
    </div>
  )
}

// ─── Main page component ──────────────────────────────────────
export default function Home() {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const { user } = useUser()

  const [loadingProduct, setLoadingProduct] = useState<string | null>(null)
  const [errorMessage,   setErrorMessage]   = useState<string | null>(null)

  const handleLaunch = async (productId: "omega" | "optitrade") => {
    if (!isSignedIn) {
      window.location.href = "/sign-in"
      return
    }
    setLoadingProduct(productId)
    setErrorMessage(null)
    try {
      const token = await getToken()
      const response = await fetch(`/api/launch?product=${productId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || "Authentication validation failed")
      }
      const data = await response.json()
      if (data.success && data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer")
      } else {
        throw new Error("Invalid response received from server")
      }
    } catch (err: any) {
      console.error(err)
      setErrorMessage(err.message || "An unexpected error occurred while launching application.")
    } finally {
      setLoadingProduct(null)
    }
  }

  // Ref for products section in-view animation
  const productsRef  = useRef(null)
  const pricingRef   = useRef(null)
  const productsInView = useInView(productsRef,  { once: true, margin: "-80px" })
  const pricingInView  = useInView(pricingRef,   { once: true, margin: "-80px" })

  return (
    <>
      <Head>
        <title>NexAlpha — AI Analytics & Trading Suite</title>
        <meta name="description" content="Enterprise-grade AI products: natural-language analytics and multi-agent options trading for Nifty 50." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </Head>

      <div className="min-h-screen bg-background grid-bg text-gray-100 flex flex-col relative overflow-x-hidden">

        {/* ── Ambient orbs ───────────────────────────────────── */}
        <div
          className="orb"
          style={{ top: "-120px", left: "15%", width: "700px", height: "700px", background: "rgba(99,102,241,0.13)" }}
        />
        <div
          className="orb"
          style={{ top: "35%", right: "8%", width: "520px", height: "520px", background: "rgba(168,85,247,0.10)", animationDelay: "4s" }}
        />
        <div
          className="orb"
          style={{ bottom: "10%", left: "30%", width: "420px", height: "420px", background: "rgba(236,72,153,0.07)", animationDelay: "8s" }}
        />

        {/* ── Navigation ─────────────────────────────────────── */}
        <nav
          className="sticky top-0 z-50 px-6 py-3.5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(3,0,20,0.75)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 select-none">
              <span
                className="text-xl font-black tracking-widest"
                style={{ background: "linear-gradient(135deg, #6366f1, #a855f7, #ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
              >
                NEXALPHA
              </span>
            </Link>

            <div className="flex items-center gap-5">
              <a href="#products" className="text-sm text-gray-400 hover:text-white transition hidden sm:inline">
                Products
              </a>
              <a href="#pricing" className="text-sm text-gray-400 hover:text-white transition hidden sm:inline">
                Pricing
              </a>

              {isLoaded && (
                <>
                  {isSignedIn ? (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-400 hidden md:inline">
                        Hi, <span className="text-white font-semibold">{user?.firstName ?? user?.username}</span>
                      </span>
                      <UserButton afterSignOutUrl="/" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Link href="/sign-in" className="text-sm text-gray-400 hover:text-white transition">
                        Sign In
                      </Link>
                      <Link
                        href="/sign-up"
                        className="text-sm font-semibold px-4 py-2 rounded-lg text-white transition"
                        style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", boxShadow: "0 2px 16px rgba(99,102,241,0.3)" }}
                      >
                        Get Started
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </nav>

        {/* ── Hero ───────────────────────────────────────────── */}
        <header className="relative px-6 pt-24 pb-20 text-center max-w-5xl mx-auto w-full">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
          >
            {/* Pill badge */}
            <motion.div variants={fadeUp} custom={0} className="flex justify-center mb-7">
              <span className="headline-pill">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" style={{ animation: "blink 2s step-end infinite" }} />
                AI Orchestration Engine · v2.0
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={fadeUp}
              custom={1}
              className="text-5xl md:text-[4.75rem] font-black tracking-tight leading-[1.05] mb-6"
            >
              Enterprise-Grade
              <br />
              <span
                style={{
                  background: "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                AI Suite
              </span>
              <span className="text-white"> — Unleashed.</span>
            </motion.h1>

            {/* Sub-headline */}
            <motion.p
              variants={fadeUp}
              custom={2}
              className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-11 leading-relaxed font-light"
            >
              NexAlpha ships premium multi-agent architectures that replace coding friction with
              natural language, and transform options trading into a data-driven science.
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={fadeUp}
              custom={3}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <a href="#products" className="btn-primary">
                Explore the Suite
                <ArrowRight className="w-4 h-4" />
              </a>
              {(!isLoaded || !isSignedIn) && (
                <Link href="/sign-up" className="btn-ghost">
                  Create Free Account
                  <ChevronRight className="w-4 h-4 opacity-60" />
                </Link>
              )}
            </motion.div>

            {/* Social proof strip */}
            <motion.div
              variants={fadeUp}
              custom={4}
              className="flex items-center justify-center gap-6 mt-12 text-xs text-gray-500"
            >
              {[
                { icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />, label: "Clerk Auth" },
                { icon: <Zap           className="w-3.5 h-3.5 text-yellow-400" />, label: "FastAPI backend" },
                { icon: <Activity      className="w-3.5 h-3.5 text-indigo-400" />, label: "Streamlit Cloud" },
              ].map((item, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {item.icon}
                  {item.label}
                </span>
              ))}
            </motion.div>
          </motion.div>
        </header>

        {/* ── Error banner ───────────────────────────────────── */}
        {errorMessage && (
          <div
            className="max-w-lg mx-auto mb-8 px-6 py-4 rounded-xl text-center text-sm font-semibold text-red-200"
            style={{ background: "rgba(127,29,29,0.35)", border: "1px solid rgba(239,68,68,0.3)", backdropFilter: "blur(12px)" }}
          >
            {errorMessage}
          </div>
        )}

        {/* ── Products ───────────────────────────────────────── */}
        <section id="products" className="py-24 px-6 max-w-7xl mx-auto w-full" ref={productsRef}>
          <motion.div
            initial="hidden"
            animate={productsInView ? "visible" : "hidden"}
            variants={stagger}
            className="text-center mb-16"
          >
            <motion.p variants={fadeUp} className="text-xs font-bold tracking-[0.18em] uppercase text-indigo-400 mb-3">
              Our Products
            </motion.p>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-extrabold mb-4">
              Two Tools.{" "}
              <span
                style={{
                  background: "linear-gradient(90deg,#a855f7,#ec4899)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Infinite Leverage.
              </span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-gray-400 max-w-xl mx-auto text-base">
              Decoupled intelligent frameworks — built to automate analysis and
              sharpen every trading decision.
            </motion.p>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 lg:grid-cols-2 gap-7"
            initial="hidden"
            animate={productsInView ? "visible" : "hidden"}
            variants={stagger}
          >

            {/* ── Omega card ──────────────────────────────────── */}
            <motion.div variants={fadeUp} className="card-blur rounded-2xl p-7 flex flex-col relative overflow-hidden group">
              {/* corner glow */}
              <div
                className="absolute -top-12 -right-12 w-48 h-48 rounded-full transition-all duration-500"
                style={{ background: "radial-gradient(circle, rgba(99,102,241,0.18), transparent 70%)", filter: "blur(30px)" }}
              />
              <div
                className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: "radial-gradient(circle, rgba(99,102,241,0.35), transparent 70%)", filter: "blur(30px)" }}
              />

              {/* Header */}
              <div className="flex items-start justify-between mb-5 relative">
                <div>
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.25)" }}
                  >
                    <BarChart2 className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-2xl font-black text-white tracking-tight">Omega</h3>
                    <span className="tag-primary">AI Analytics</span>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
                    Complex, multi-modal data analysis through natural language. Zero code,
                    SQL, Excel, or R required — ever.
                  </p>
                </div>
              </div>

              {/* Feature list */}
              <ul className="space-y-2.5 mb-5">
                {[
                  "Instant CSV, Excel & SQL imports",
                  "Real-time charts & visual matrices",
                  "Statistical summaries & trend extraction",
                ].map((f, i) => (
                  <li key={i} className="feature-item">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {/* Interactive demo */}
              <OmegaWidget />

              {/* Launch */}
              <button
                onClick={() => handleLaunch("omega")}
                disabled={loadingProduct !== null}
                className="btn-launch-omega mt-6"
              >
                {loadingProduct === "omega" ? (
                  <><div className="spinner" /> Launching…</>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Launch Omega
                    <ArrowRight className="w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </motion.div>

            {/* ── OptiTrade card ───────────────────────────────── */}
            <motion.div variants={fadeUp} className="card-blur rounded-2xl p-7 flex flex-col relative overflow-hidden group">
              {/* corner glow */}
              <div
                className="absolute -top-12 -right-12 w-48 h-48 rounded-full transition-all duration-500"
                style={{ background: "radial-gradient(circle, rgba(236,72,153,0.18), transparent 70%)", filter: "blur(30px)" }}
              />
              <div
                className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: "radial-gradient(circle, rgba(236,72,153,0.35), transparent 70%)", filter: "blur(30px)" }}
              />

              {/* Header */}
              <div className="flex items-start justify-between mb-5 relative">
                <div>
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: "rgba(236,72,153,0.12)", border: "1px solid rgba(236,72,153,0.22)" }}
                  >
                    <TrendingUp className="w-5 h-5 text-pink-400" />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-2xl font-black text-white tracking-tight">OptiTrade</h3>
                    <span className="tag-accent">Trading Agent</span>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
                    Multi-agent options assistant for Nifty 50. Strike recommendations calibrated
                    to your budget, timeline & expiry targets.
                  </p>
                </div>
              </div>

              {/* Feature list */}
              <ul className="space-y-2.5 mb-5">
                {[
                  "Multi-agent correlation validation",
                  "Dynamic strike price optimisation",
                  "Budget & risk-reward parameter checks",
                ].map((f, i) => (
                  <li key={i} className="feature-item">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {/* Interactive demo */}
              <OptiTradeWidget />

              {/* Launch */}
              <button
                onClick={() => handleLaunch("optitrade")}
                disabled={loadingProduct !== null}
                className="btn-launch-trade mt-6"
              >
                {loadingProduct === "optitrade" ? (
                  <><div className="spinner" /> Launching…</>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Launch OptiTrade
                    <ArrowRight className="w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </motion.div>

          </motion.div>
        </section>

        {/* ── Pricing ────────────────────────────────────────── */}
        <section
          id="pricing"
          className="py-24 px-6"
          style={{ background: "rgba(0,0,0,0.25)", borderTop: "1px solid rgba(255,255,255,0.04)" }}
          ref={pricingRef}
        >
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial="hidden"
              animate={pricingInView ? "visible" : "hidden"}
              variants={stagger}
              className="text-center mb-16"
            >
              <motion.p variants={fadeUp} className="text-xs font-bold tracking-[0.18em] uppercase text-indigo-400 mb-3">
                Pricing
              </motion.p>
              <motion.h2 variants={fadeUp} className="text-3xl md:text-5xl font-extrabold mb-4">
                Flexible Plans
              </motion.h2>
              <motion.p variants={fadeUp} className="text-gray-400 max-w-md mx-auto">
                Scale your analytical workspace with membership subscriptions
                designed for every workflow.
              </motion.p>
            </motion.div>

            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 gap-7 max-w-3xl mx-auto"
              initial="hidden"
              animate={pricingInView ? "visible" : "hidden"}
              variants={stagger}
            >
              {/* Free */}
              <motion.div variants={fadeUp} className="card-free rounded-2xl p-8 flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Explorer</p>
                  <div className="flex items-baseline gap-1.5 mb-1">
                    <span className="text-5xl font-black text-white">$0</span>
                    <span className="text-gray-500 text-sm">/&nbsp;month</span>
                  </div>
                  <p className="text-sm text-gray-400 mb-7 leading-relaxed">
                    For individuals starting out with AI analytics and basic multi-agent evaluations.
                  </p>
                  <ul className="space-y-3">
                    {[
                      "5 queries / day on Omega",
                      "Basic Nifty 50 recommendations",
                      "Standard execution latency",
                    ].map((f, i) => (
                      <li key={i} className="feature-item">
                        <Zap className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  className="mt-8 w-full py-3 rounded-xl font-semibold text-sm transition"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }}
                >
                  Current Tier
                </button>
              </motion.div>

              {/* Pro */}
              <motion.div variants={fadeUp} className="card-pro rounded-2xl p-8 flex flex-col justify-between relative">
                <div
                  className="absolute -top-3 right-5 text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-widest"
                  style={{ background: "linear-gradient(90deg,#6366f1,#a855f7)", color: "#fff" }}
                >
                  Popular
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-indigo-300 mb-1">Alpha Pro</p>
                  <div className="flex items-baseline gap-1.5 mb-1">
                    <span className="text-5xl font-black text-white">$29</span>
                    <span className="text-gray-500 text-sm">/&nbsp;month</span>
                  </div>
                  <p className="text-sm text-gray-400 mb-7 leading-relaxed">
                    For active trading researchers and high-frequency analytical workflows.
                  </p>
                  <ul className="space-y-3">
                    {[
                      "Unlimited multi-modal queries on Omega",
                      "Advanced Nifty 50 strike optimisation",
                      "Priority API execution speed",
                      "Exclusive access to future tools",
                    ].map((f, i) => (
                      <li key={i} className="feature-item">
                        <Zap className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  className="btn-primary mt-8 w-full justify-center"
                  style={{ boxShadow: "0 4px 24px rgba(99,102,241,0.35)" }}
                >
                  Upgrade Workspace
                </button>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ── Footer ─────────────────────────────────────────── */}
        <footer
          className="mt-auto py-14 px-6"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.35)", backdropFilter: "blur(16px)" }}
        >
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start justify-between gap-10">

            {/* Brand blurb */}
            <div className="max-w-xs">
              <span
                className="text-xl font-black tracking-widest mb-4 inline-block"
                style={{ background: "linear-gradient(135deg,#6366f1,#a855f7,#ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
              >
                NEXALPHA
              </span>
              <p className="text-gray-500 text-sm leading-relaxed">
                Building secure, full-stack AI pipelines to power the next generation
                of financial and operational agent interfaces.
              </p>
            </div>

            {/* Founder card */}
            <div className="founder-card w-full max-w-sm">
              <div className="flex items-start gap-4">
                <div className="founder-avatar">
                  <User className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="flex-1 space-y-1.5">
                  <h4 className="text-base font-bold text-white leading-tight">Arpan Kumar Mallik</h4>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Briefcase className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Data Analyst · Capgemini</span>
                  </div>
                  <hr className="section-divider my-2" />
                  <div className="space-y-1.5 pt-0.5">
                    <a
                      href="mailto:arpanmallik.careers@gmail.com"
                      className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 transition"
                    >
                      <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                      arpanmallik.careers@gmail.com
                    </a>
                    <a
                      href="mailto:nexalpha.login@gmail.com"
                      className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 transition"
                    >
                      <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                      nexalpha.login@gmail.com
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div
            className="max-w-7xl mx-auto mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-600"
            style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
          >
            <p>© {new Date().getFullYear()} NexAlpha. All rights reserved.</p>
            <p>Powered by Next.js · FastAPI · Streamlit Cloud</p>
          </div>
        </footer>

      </div>
    </>
  )
}