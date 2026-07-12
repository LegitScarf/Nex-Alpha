"use client";

import { useState } from "react";
import Head from "next/head";
import { useAuth } from "@clerk/nextjs";

import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Products from "@/components/landing/Products";
import Pricing from "@/components/landing/Pricing";
import Footer from "@/components/landing/Footer";

export default function Home() {
  const { isSignedIn, getToken } = useAuth();
  const [loadingProduct, setLoadingProduct] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLaunch = async (productId: "omega") => {
    if (!isSignedIn) {
      window.location.href = "/sign-in";
      return;
    }
    window.location.href = "/omega";
  };

  const isOmegaLoading = loadingProduct === "omega";

  return (
    <>
      <Head>
        <title>NexAlpha — Natural Language AI Data Analytics</title>
        <meta
          name="description"
          content="The playful, powerful AI analyst that turns raw CSVs, SQL and Excel into real-time visual insights."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-white text-[#0A0A0A] font-body antialiased selection:bg-[#0A0A0A] selection:text-[#DFFF00]">
        <Navbar onLaunch={handleLaunch} loading={isOmegaLoading} />

        <main>
          {errorMessage && (
            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-lg w-full px-6 py-4 rounded-xl text-center text-sm font-semibold bg-red-50 border border-red-200 text-red-700 shadow-lg">
              {errorMessage}
            </div>
          )}

          <Hero onLaunch={handleLaunch} loading={isOmegaLoading} />
          <Products />
          <Pricing onLaunch={handleLaunch} loading={isOmegaLoading} />
        </main>

        <Footer onLaunch={handleLaunch} loading={isOmegaLoading} />
      </div>
    </>
  );
}