"use client"

import { useState } from "react"
import Head from "next/head"
import Link from "next/link"
import { useAuth, useUser, UserButton } from "@clerk/nextjs"
import { motion } from "framer-motion"
import { 
  LineChart, 
  TrendingUp, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  Sparkles,
  Terminal,
  Play,
  Mail,
  Briefcase,
  User,
  ExternalLink
} from "lucide-react"

export default function Home() {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const { user } = useUser()
  
  const [loadingProduct, setLoadingProduct] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleLaunch = async (productId: "omega" | "optitrade") => {
    if (!isSignedIn) {
      // Direct them to login
      window.location.href = "/sign-in"
      return
    }

    setLoadingProduct(productId)
    setErrorMessage(null)

    try {
      // Get JWT token from Clerk session
      const token = await getToken()
      
      // Request launch URL from FastAPI backend
      const response = await fetch(`/api/launch?product=${productId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || "Authentication validation failed")
      }

      const data = await response.json()
      
      if (data.success && data.url) {
        // Open Streamlit Cloud App in a new tab
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

  // Animation variants for Framer Motion
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  }

  const itemVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } }
  }

  return (
    <>
      <Head>
        <title>NexAlpha - AI Analytics & Trading Solutions</title>
        <meta name="description" content="Decoupled AI applications powered by multi-agent architectures and advanced data insights." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-background grid-bg text-gray-100 flex flex-col relative selection:bg-primary/30 selection:text-white">
        
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[160px] pointer-events-none -z-20" />
        <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[140px] pointer-events-none -z-20" />

        {/* Navigation Bar */}
        <nav className="sticky top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-md px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-2xl font-black tracking-wider bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                NEXALPHA
              </span>
            </Link>

            <div className="flex items-center space-x-6">
              {isLoaded && (
                <>
                  {isSignedIn ? (
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-400 hidden sm:inline-block">
                        Welcome, <span className="text-white font-semibold">{user?.firstName || user?.username}</span>
                      </span>
                      <UserButton afterSignOutUrl="/" />
                    </div>
                  ) : (
                    <div className="flex items-center space-x-4">
                      <Link href="/sign-in" className="text-sm text-gray-400 hover:text-white transition">
                        Sign In
                      </Link>
                      <Link href="/sign-up" className="bg-primary hover:bg-primary/90 text-white text-sm font-semibold px-4 py-2 rounded-lg transition shadow-lg shadow-primary/25">
                        Get Started
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <header className="px-6 pt-20 pb-16 text-center max-w-5xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center space-x-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-6">
              <Sparkles className="w-4 h-4 text-accent animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-300">
                AI Orchestration Engine
              </span>
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
              Deploying Enterprise <br />
              <span className="gradient-text">Grade AI Suite</span>
            </h1>

            <p className="text-gray-400 text-lg md:text-xl max-w-3xl mx-auto mb-10 leading-relaxed">
              NexAlpha releases premium AI architectures and multi-agent systems designed to eliminate programming friction and maximize options analytical trading efficiency.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="#products" className="bg-gradient-to-r from-primary to-secondary hover:opacity-95 text-white font-bold px-8 py-4 rounded-xl transition shadow-lg shadow-primary/20 flex items-center space-x-2">
                <span>Explore Suite</span>
                <ArrowRight className="w-5 h-5" />
              </a>
              {(!isLoaded || !isSignedIn) && (
                <Link href="/sign-up" className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold px-8 py-4 rounded-xl transition">
                  Create Free Account
                </Link>
              )}
            </div>
          </motion.div>
        </header>

        {/* Error Dialog */}
        {errorMessage && (
          <div className="max-w-md mx-auto mb-8 bg-red-950/40 border border-red-500/30 text-red-200 px-6 py-4 rounded-xl text-center backdrop-blur-md">
            <p className="text-sm font-semibold">{errorMessage}</p>
          </div>
        )}

        {/* Products Showcase */}
        <section id="products" className="py-20 px-6 max-w-7xl mx-auto w-full">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4">Our AI Solutions</h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Decoupled intelligent frameworks built to automate analysis and trading strategies.
            </p>
          </div>

          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Omega Card */}
            <motion.div 
              variants={itemVariants} 
              className="card-blur rounded-2xl p-8 flex flex-col justify-between relative group overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all" />
              
              <div>
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 border border-primary/20">
                  <LineChart className="w-6 h-6 text-primary" />
                </div>
                <div className="flex items-center space-x-2 mb-3">
                  <h3 className="text-2xl font-bold text-white">Omega</h3>
                  <span className="text-xs bg-primary/15 border border-primary/30 text-primary px-2.5 py-0.5 rounded-full font-medium">
                    AI Analytics
                  </span>
                </div>
                <p className="text-gray-400 mb-6 leading-relaxed">
                  Perform complex, multi-modal data analysis using standard natural language query interfaces. Zero code, Python, SQL, Excel, or R requirements needed.
                </p>
                
                <ul className="space-y-3 mb-8 text-sm text-gray-300">
                  <li className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Instant CSV, Excel and SQL dataset imports</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Real-time charts and visual matrixes</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Statistical summaries & trend extraction</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => handleLaunch("omega")}
                disabled={loadingProduct !== null}
                className="w-full bg-white/5 hover:bg-primary border border-white/10 hover:border-primary text-white font-bold py-3.5 px-4 rounded-xl transition flex items-center justify-center space-x-2 group/btn"
              >
                {loadingProduct === "omega" ? (
                  <div className="spinner" />
                ) : (
                  <>
                    <span>Launch Omega</span>
                    <Play className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </motion.div>

            {/* OptiTrade Card */}
            <motion.div 
              variants={itemVariants} 
              className="card-blur rounded-2xl p-8 flex flex-col justify-between relative group overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-2xl group-hover:bg-accent/20 transition-all" />
              
              <div>
                <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center mb-6 border border-accent/20">
                  <TrendingUp className="w-6 h-6 text-accent" />
                </div>
                <div className="flex items-center space-x-2 mb-3">
                  <h3 className="text-2xl font-bold text-white">OptiTrade</h3>
                  <span className="text-xs bg-accent/15 border border-accent/30 text-accent px-2.5 py-0.5 rounded-full font-medium">
                    Trading Agent
                  </span>
                </div>
                <p className="text-gray-400 mb-6 leading-relaxed">
                  A multi-agent options trading assistant optimized for Nifty 50. Provides the ideal option strike recommendations customized for budget, timeline, and expiry targets.
                </p>

                <ul className="space-y-3 mb-8 text-sm text-gray-300">
                  <li className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Multi-agent correlation validation systems</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Dynamic strike price optimization model</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Budget & Risk-reward parameters checks</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => handleLaunch("optitrade")}
                disabled={loadingProduct !== null}
                className="w-full bg-white/5 hover:bg-accent border border-white/10 hover:border-accent text-white font-bold py-3.5 px-4 rounded-xl transition flex items-center justify-center space-x-2 group/btn"
              >
                {loadingProduct === "optitrade" ? (
                  <div className="spinner" />
                ) : (
                  <>
                    <span>Launch OptiTrade</span>
                    <Play className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </motion.div>
          </motion.div>
        </section>

        {/* Pricing Tiers Section */}
        <section className="py-20 px-6 border-t border-white/5 bg-black/20">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-extrabold mb-4">Subscription Plans</h2>
              <p className="text-gray-400 max-w-xl mx-auto">
                Scale your analytical workspace limits with flexible membership subscriptions.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Free Plan */}
              <div className="border border-white/5 bg-background/50 rounded-2xl p-8 flex flex-col justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-300 mb-2">Explorer</h3>
                  <div className="flex items-baseline mb-6">
                    <span className="text-4xl font-black text-white">$0</span>
                    <span className="text-gray-500 ml-2">/ month</span>
                  </div>
                  <p className="text-sm text-gray-400 mb-6">
                    For individuals starting out with AI analytics and basic multi-agent evaluations.
                  </p>
                  <ul className="space-y-4 mb-8 text-sm text-gray-300">
                    <li className="flex items-center space-x-3">
                      <Zap className="w-4 h-4 text-primary" />
                      <span>5 queries / day on Omega</span>
                    </li>
                    <li className="flex items-center space-x-3">
                      <Zap className="w-4 h-4 text-primary" />
                      <span>Basic Nifty 50 recommendations</span>
                    </li>
                    <li className="flex items-center space-x-3">
                      <Zap className="w-4 h-4 text-primary" />
                      <span>Standard system execution latency</span>
                    </li>
                  </ul>
                </div>
                <button className="w-full bg-white/5 hover:bg-white/10 text-white text-sm font-semibold py-3 px-4 rounded-xl transition border border-white/10">
                  Current Tier
                </button>
              </div>

              {/* Premium Plan */}
              <div className="border-2 border-primary bg-primary/5 rounded-2xl p-8 flex flex-col justify-between relative">
                <div className="absolute -top-3 right-6 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  Popular
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">Alpha Pro</h3>
                  <div className="flex items-baseline mb-6">
                    <span className="text-4xl font-black text-white">$29</span>
                    <span className="text-gray-500 ml-2">/ month</span>
                  </div>
                  <p className="text-sm text-gray-400 mb-6">
                    For active trading researchers and high-frequency analytical workflows.
                  </p>
                  <ul className="space-y-4 mb-8 text-sm text-gray-300">
                    <li className="flex items-center space-x-3">
                      <Zap className="w-4 h-4 text-primary" />
                      <span>Unlimited multi-modal queries on Omega</span>
                    </li>
                    <li className="flex items-center space-x-3">
                      <Zap className="w-4 h-4 text-primary" />
                      <span>Advanced Nifty 50 strike optimization</span>
                    </li>
                    <li className="flex items-center space-x-3">
                      <Zap className="w-4 h-4 text-primary" />
                      <span>Priority API execution speed</span>
                    </li>
                    <li className="flex items-center space-x-3">
                      <Zap className="w-4 h-4 text-primary" />
                      <span>Exclusive access to future tools</span>
                    </li>
                  </ul>
                </div>
                <button className="w-full bg-primary hover:bg-primary/90 text-white text-sm font-semibold py-3 px-4 rounded-xl transition shadow-lg shadow-primary/20">
                  Upgrade Workspace
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Footer with Founder Info */}
        <footer className="mt-auto border-t border-white/5 bg-card/60 backdrop-blur-md py-12 px-6">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start justify-between gap-8">
            <div>
              <span className="text-xl font-black tracking-wider bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-4 inline-block">
                NEXALPHA
              </span>
              <p className="text-gray-400 text-sm max-w-sm leading-relaxed">
                Building secure, full-stack pipelines to power the next generation of financial and operational agent interfaces.
              </p>
            </div>

            {/* Founder Card */}
            <div className="border border-white/5 bg-background/50 rounded-2xl p-6 w-full max-w-sm flex items-start space-x-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20 flex-shrink-0">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-white text-base">Arpan Kumar Mallik</h4>
                <div className="flex items-center space-x-2 text-xs text-gray-400">
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Data Analyst, Capgemini</span>
                </div>
                <div className="space-y-1 pt-1">
                  <a href="mailto:arpanmallik.careers@gmail.com" className="flex items-center space-x-2 text-xs text-primary hover:underline">
                    <Mail className="w-3.5 h-3.5" />
                    <span>arpanmallik.careers@gmail.com</span>
                  </a>
                  <a href="mailto:nexalpha.login@gmail.com" className="flex items-center space-x-2 text-xs text-primary hover:underline">
                    <Mail className="w-3.5 h-3.5" />
                    <span>nexalpha.login@gmail.com</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto mt-12 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500">
            <p>&copy; {new Date().getFullYear()} NexAlpha. All rights reserved.</p>
            <p className="flex items-center space-x-1">
              <span>Powered by Next.js & FastAPI</span>
            </p>
          </div>
        </footer>
      </div>
    </>
  )
}
