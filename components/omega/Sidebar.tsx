import React, { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "@clerk/nextjs";
import { History, MessageSquare, Plus, PanelLeftClose, PanelLeft, Clock } from "lucide-react";
import { toast } from "sonner";

const API = process.env.NEXT_PUBLIC_OMEGA_API_URL || "http://localhost:8001/api";

interface Session {
  session_id: string;
  dataset_id: string;
  last_activity: string;
}

interface SidebarProps {
  onSelectSession: (sessionId: string, datasetId: string) => void;
  onNewSession: () => void;
  currentSessionId: string | null;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export const Sidebar = ({
  onSelectSession,
  onNewSession,
  currentSessionId,
  isOpen,
  setIsOpen,
}: SidebarProps) => {
  const { getToken, isSignedIn } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSessions = async () => {
    if (!isSignedIn) return;
    setLoading(true);
    try {
      const token = await getToken();
      const { data } = await axios.get(`${API}/chat/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSessions(data);
    } catch (e) {
      console.error("Could not fetch sessions:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [isSignedIn, currentSessionId]);

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <>
      {/* Floating Toggle Button when Sidebar is closed */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed top-4 left-4 z-40 p-2.5 bg-white border border-[#E5E5E5] rounded-xl shadow-sm text-[#0A0A0A] hover:bg-neutral-50 transition-all active:scale-95"
          title="Open History"
        >
          <PanelLeft className="w-5 h-5" />
        </button>
      )}

      {/* Sidebar Panel */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-80 bg-white border-r border-[#E5E5E5] flex flex-col transition-transform duration-300 ease-out transform ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="p-5 border-b border-[#E5E5E5] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#0047FF]" />
            <h2 className="font-display font-bold text-lg text-[#0A0A0A]">Analytical History</h2>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-500 transition-colors"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* New Session Action */}
        <div className="p-4 border-b border-[#E5E5E5]">
          <button
            onClick={() => {
              onNewSession();
              // Auto close on mobile layouts
              if (window.innerWidth < 768) setIsOpen(false);
            }}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#0047FF] text-white font-display font-medium rounded-xl hover:bg-[#0036C2] active:scale-[0.98] transition-all shadow-md shadow-[#0047ff]/20"
          >
            <Plus className="w-4 h-4" />
            <span>New Analysis</span>
          </button>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-neutral-400 gap-2">
              <div className="animate-spin text-[#0047FF] text-lg">Ω</div>
              <span className="text-xs">Loading sessions...</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 px-4 text-neutral-400">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
              <p className="text-sm font-display font-medium">No past analysis yet</p>
              <p className="text-xs mt-1">Upload a dataset to begin</p>
            </div>
          ) : (
            sessions.map((sess) => {
              const isActive = sess.session_id === currentSessionId;
              return (
                <button
                  key={sess.session_id}
                  onClick={() => {
                    onSelectSession(sess.session_id, sess.dataset_id);
                    if (window.innerWidth < 768) setIsOpen(false);
                  }}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col gap-1.5 ${
                    isActive
                      ? "bg-neutral-50 border-[#0047FF] shadow-sm"
                      : "bg-white border-transparent hover:bg-neutral-50 hover:border-neutral-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-display font-bold text-sm text-[#0A0A0A] truncate">
                      Session {sess.session_id.slice(0, 8)}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-neutral-100 rounded text-neutral-500 truncate max-w-[100px]">
                      {sess.dataset_id.slice(0, 8)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-neutral-400 font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(sess.last_activity)}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};
