import React, { useEffect, useRef, useState } from "react";
import { OmegaHeader } from "@/components/omega/OmegaHeader";
import { Hero } from "@/components/omega/Hero";
import { DatasetUpload } from "@/components/omega/DatasetUpload";
import { ChatInterface } from "@/components/omega/ChatInterface";
import { HowItWorks } from "@/components/omega/HowItWorks";
import { Showcase } from "@/components/omega/Showcase";
import { Footer } from "@/components/omega/Footer";
import { Toaster } from "sonner";
import { useAuth } from "@clerk/nextjs";

const OmegaExperience = () => {
  const { isLoaded, isSignedIn } = useAuth();
  const [dataset, setDataset] = useState<any>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLDivElement>(null);

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      // Redirect to landing page login portal if not authenticated
      window.location.href = "/sign-in";
    }
  }, [isLoaded, isSignedIn]);

  const scrollToUpload = () => {
    document.getElementById("upload")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (dataset) {
      setTimeout(() => {
        document.getElementById("chat")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
    }
  }, [dataset]);

  const handleSelectSession = (sessionId: string, datasetId: string) => {
    setActiveSessionId(sessionId);
    setDataset({ id: datasetId });
  };

  const handleNewSession = () => {
    setDataset(null);
    setActiveSessionId(null);
  };

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin font-display font-black text-4xl text-[#0047FF]">Ω</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#0A0A0A] font-body flex" data-testid="omega-experience">
      <div className="flex-1 min-h-screen flex flex-col">
        <OmegaHeader onLaunch={scrollToUpload} />
        {!dataset && (
          <>
            <Hero onGetStarted={scrollToUpload} />
            <div ref={uploadRef} id="upload">
              <DatasetUpload onDataset={(data) => {
                setDataset(data);
                setActiveSessionId(null);
              }} />
            </div>
            <HowItWorks />
            <Showcase />
          </>
        )}
        {dataset && (
          <div ref={chatRef} className="flex-1">
            <ChatInterface 
              dataset={dataset} 
              onReset={handleNewSession} 
              initialSessionId={activeSessionId}
            />
          </div>
        )}
        <Footer />
        <Toaster position="top-center" richColors />
      </div>
    </div>
  );
};

export default OmegaExperience;
