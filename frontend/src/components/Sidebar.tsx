import { useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, Send, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import logoImg from "./branchwiselogo.png";
import { useStore } from "../lib/store";
import { api } from "../lib/api";
import { scoreHex } from "../lib/colors";
import type { HexResult } from "../lib/api";

const STARTERS = [
  "Where should I open next?",
  "High traffic, low competition?",
  "Gaps near universities?",
];

function statusPill(score: number) {
  if (score >= 75) return { label: "Strong", color: "#3BB273", bg: "rgba(59,178,115,0.12)" };
  if (score >= 60) return { label: "Good",   color: "#5B9BFF", bg: "rgba(91,155,255,0.12)" };
  if (score >= 45) return { label: "Fair",   color: "#F5A623", bg: "rgba(245,166,35,0.12)" };
  return                  { label: "Risky",  color: "#E85D5D", bg: "rgba(232,93,93,0.12)" };
}

export function Sidebar({ onHighlight }: { onHighlight: (h: HexResult) => void }) {
  const {
    brandSlug,
    chatHistory, pushChat, chatLoading, setChatLoading, setScenario,
    pinned, togglePin, setCompareOpen,
    sidebarOpen, setSidebarOpen,
    setVerticals,
  } = useStore();

  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.verticals().then((d) => setVerticals(d.verticals));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, chatLoading]);

  async function send(msg?: string) {
    const text = (msg ?? input).trim();
    if (!text || chatLoading) return;
    setInput("");
    pushChat({ role: "user", text });
    setChatLoading(true);
    try {
      const res = await api.chat(text, brandSlug || undefined);
      pushChat({ role: "assistant", text: res.reply, offline: res._offline });
      if (res.scenario) setScenario(res.scenario);
      if (res.highlight) onHighlight(res.highlight);
    } catch {
      pushChat({ role: "assistant", text: "Error connecting to the server." });
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div
      className="absolute left-0 top-0 h-full border-r flex flex-col z-10 transition-[width] duration-300 ease-in-out overflow-hidden"
      style={{
        width: sidebarOpen ? 300 : 56,
        background: "rgba(247,250,255,0.95)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderColor: "rgba(226,232,240,0.8)",
        boxShadow: "2px 0 24px rgba(17,116,251,0.07)",
      }}
    >
      {/* ── header ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-4" style={{ backgroundColor: '#002D6B', minHeight: 64 }}>
        {sidebarOpen ? (
          <div className="flex items-center gap-2 min-w-0">
            <img src={logoImg} alt="Branchwise" className="w-9 h-9 object-contain flex-shrink-0" style={{ backgroundColor: '#002D6B' }} />
            <div className="min-w-0">
              <div className="font-display font-bold text-white text-base tracking-tight leading-none">Branchwise</div>
              <div className="text-[11px] font-medium mt-0.5 leading-none" style={{ color: 'rgba(255,255,255,0.55)' }}>Expansion intelligence</div>
            </div>
          </div>
        ) : (
          <img src={logoImg} alt="Branchwise" className="w-8 h-8 object-contain mx-auto" style={{ backgroundColor: '#002D6B' }} />
        )}
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex-shrink-0 ml-1 p-1 rounded-lg transition-colors cursor-pointer"
          style={{ color: 'rgba(255,255,255,0.6)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      {sidebarOpen && (
        <div className="flex-1 flex flex-col min-h-0" style={{ backgroundColor: '#F7FAFF' }}>

          {/* ── AI chat label ── */}
          <div className="flex items-center gap-1.5 px-4 pt-3 pb-1 flex-shrink-0">
            <Sparkles size={11} style={{ color: '#5B9BFF' }} />
            <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: '#94A3B8' }}>Branchwise AI</span>
          </div>

          {/* ── messages ── */}
          <div className="flex-1 overflow-y-auto px-3 pb-2 min-h-0" style={{ scrollbarWidth: 'none' }}>
            {chatHistory.length === 0 ? (
              <div className="flex flex-col gap-2 pt-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="text-left text-[12px] font-medium px-3 py-2.5 rounded-xl bg-white border transition-colors cursor-pointer"
                    style={{ borderColor: '#E2E8F0', color: '#64748B' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#5B9BFF'; e.currentTarget.style.color = '#0F172A'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#64748B'; }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2 pt-2">
                {chatHistory.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className="max-w-[88%] rounded-2xl px-3 py-2 text-[12px] leading-relaxed"
                      style={m.role === "user"
                        ? { backgroundColor: '#5B9BFF', color: '#fff' }
                        : { backgroundColor: '#fff', color: '#0F172A', border: '1px solid #E2E8F0' }
                      }
                    >
                      {m.role === "user" ? m.text : (
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                            ul: ({ children }) => <ul className="pl-3 list-disc space-y-0.5 mt-1">{children}</ul>,
                            li: ({ children }) => <li>{children}</li>,
                          }}
                        >{m.text}</ReactMarkdown>
                      )}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white rounded-2xl px-3 py-2.5 flex gap-1 items-center" style={{ border: '1px solid #E2E8F0' }}>
                      {[0,1,2].map((i) => (
                        <motion.div key={i} className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: '#5B9BFF' }}
                          animate={{ opacity: [0.3,1,0.3] }}
                          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* ── input ── */}
          <div className="flex-shrink-0 px-3 pb-3 pt-1 flex gap-2 items-center" style={{ borderTop: '1px solid #E2E8F0', backgroundColor: '#F7FAFF' }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask Branchwise..."
              className="flex-1 rounded-xl px-3 py-2 text-[12px] bg-white outline-none"
              style={{ border: '1px solid #E2E8F0', color: '#0F172A' }}
            />
            <button
              type="button"
              onClick={() => send()}
              disabled={!input.trim() || chatLoading}
              className="p-2 rounded-xl text-white flex-shrink-0 transition-colors cursor-pointer disabled:opacity-40"
              style={{ backgroundColor: '#5B9BFF' }}
            >
              <Send size={13} />
            </button>
          </div>

          {/* ── shortlist ── */}
          {pinned.length > 0 && (
            <div className="flex-shrink-0 px-3 pb-3" style={{ borderTop: '1px solid #E2E8F0' }}>
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] pt-3 pb-2" style={{ color: '#94A3B8' }}>Shortlist</div>
              <div className="space-y-1">
                {pinned.map((p) => {
                  const pill = statusPill(p.score);
                  return (
                    <div key={p.h3_id} onClick={() => onHighlight(p)}
                      className="flex items-center justify-between gap-2 py-1.5 cursor-pointer group"
                    >
                      <span className="text-[12px] font-semibold truncate" style={{ color: '#0F172A' }}>{p.locality ?? "Area"}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[12px] font-bold tabular" style={{ color: scoreHex(p.score) }}>{p.score}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: pill.color, backgroundColor: pill.bg }}>{pill.label}</span>
                        <button type="button" onClick={(e) => { e.stopPropagation(); togglePin(p); }}
                          className="opacity-0 group-hover:opacity-100 transition-all" style={{ color: '#CBD5E1' }}>
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {pinned.length >= 2 && (
                <button type="button" onClick={() => setCompareOpen(true)}
                  className="mt-2 w-full py-2 rounded-xl text-[12px] font-bold text-white"
                  style={{ backgroundColor: '#5B9BFF' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#0065F0'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#5B9BFF'; }}
                >
                  Compare candidate sites
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
