import React, { useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { UploadCloud, FileSpreadsheet, Sparkles, ArrowRight, Loader2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_OMEGA_API_URL || "http://localhost:8001/api";

const samples = [
  { key: "sales", label: "Sales performance", meta: "18 rows · 5 columns" },
  { key: "marketing", label: "Marketing channels", meta: "6 rows · 5 columns" },
  { key: "customers", label: "Customer segments", meta: "5 rows · 4 columns" },
];

export const DatasetUpload = ({ onDataset }: { onDataset: (data: any) => void }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingSample, setLoadingSample] = useState<string | null>(null);

  const upload = async (file: File) => {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await axios.post(`${API}/datasets/upload`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
      });
      toast.success(`Loaded ${data.name} · ${data.rows} rows`);
      onDataset(data);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Could not parse file");
    } finally {
      setLoading(false);
    }
  };

  const loadSample = async (key: string) => {
    setLoadingSample(key);
    try {
      const { data } = await axios.post(`${API}/datasets/sample`, { name: key }, { timeout: 120000 });
      toast.success(`Sample ${key} loaded`);
      onDataset(data);
    } catch (e) {
      toast.error("Could not load sample");
    } finally {
      setLoadingSample(null);
    }
  };

  return (
    <section
      id="upload"
      className="relative bg-white py-24 sm:py-32"
      data-testid="upload-section"
    >
      <div className="max-w-4xl mx-auto px-6 sm:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <div
            className="inline-flex items-center gap-2 text-[11px] tracking-[0.24em] uppercase text-slate-500 font-semibold"
            data-testid="upload-eyebrow"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#0033FF]" />
            Step one
          </div>
          <h2 className="mt-5 font-heading text-4xl sm:text-5xl tracking-tighter text-[#0A0A0A] font-bold">
            Start with a <span className="font-serif-italic text-[#0033FF]">dataset</span>.
          </h2>
          <p className="mt-4 text-slate-600 text-[16px] leading-relaxed">
            Drop a CSV, Excel, or JSON file. Omega parses your schema locally,
            then opens a chat interface where you can ask anything.
          </p>
        </div>

        <div
          className={`mt-12 relative rounded-3xl border-2 border-dashed transition-colors ${
            dragOver ? "border-[#0033FF] bg-[#0033FF]/[0.03]" : "border-slate-200 bg-slate-50/50 hover:bg-slate-50"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) upload(f);
          }}
          data-testid="upload-dropzone"
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.tsv,.txt,.xlsx,.xls,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
            data-testid="upload-file-input"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            className="w-full flex flex-col items-center justify-center py-16 px-8 focus:outline-none"
            data-testid="upload-dataset-button"
          >
            <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
              {loading ? (
                <Loader2 className="w-6 h-6 text-[#0033FF] animate-spin" />
              ) : (
                <UploadCloud className="w-6 h-6 text-[#0033FF]" />
              )}
            </div>
            <div className="mt-5 font-heading text-[22px] tracking-tight text-[#0A0A0A] font-bold">
              {loading ? "Parsing your dataset…" : "Drop a file, or click to browse"}
            </div>
            <div className="mt-2 text-sm text-slate-500">
              CSV · TSV · Excel · JSON — up to 25MB
            </div>
          </button>
        </div>

        <div className="mt-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-[11px] tracking-[0.24em] uppercase text-slate-400 font-semibold">
              Or try a sample
            </span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {samples.map((s) => (
              <button
                key={s.key}
                onClick={() => loadSample(s.key)}
                disabled={loadingSample === s.key}
                className="group text-left p-5 rounded-2xl bg-white border border-slate-100 hover:border-[#0A0A0A] transition-all shadow-[0_4px_20px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)]"
                data-testid={`sample-${s.key}-button`}
              >
                <div className="flex items-start justify-between">
                  <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center">
                    {loadingSample === s.key ? (
                      <Loader2 className="w-4 h-4 text-[#0033FF] animate-spin" />
                    ) : (
                      <FileSpreadsheet className="w-4 h-4 text-[#0A0A0A]" />
                    )}
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#0A0A0A] group-hover:translate-x-0.5 transition-all" />
                </div>
                <div className="mt-4 font-heading text-[15px] text-[#0A0A0A] font-bold">
                  {s.label}
                </div>
                <div className="mt-1 text-xs text-slate-500">{s.meta}</div>
              </button>
            ))}
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <Sparkles className="w-3 h-3 text-[#0033FF]" />
          Your data stays in this session — nothing persists beyond your chat.
        </p>
      </div>
    </section>
  );
};

export default DatasetUpload;
