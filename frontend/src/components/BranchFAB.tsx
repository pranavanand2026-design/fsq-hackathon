import { useRef, useEffect, useState } from "react";
import { X, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import logoImg from "./branchwiselogo.png";
import { useStore } from "../lib/store";
import { api } from "../lib/api";
import type { HexResult } from "../lib/api";

const STARTERS = [
  "Where should I open next?",
  "High traffic, low competition?",
  "Gaps near universities?",
];

export function BranchFAB({ onHighlight }: { onHighlight: (h: HexResult) => void }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { brandSlug, chatHistory, pushChat, chatLoading, setChatLoading, setScenario } = useStore();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, chatLoading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  async function send(msg?: string) {
    const text = (msg ?? input).trim();
    if (!text || chatLoading) return;
    setInput("");
    pushChat({ role: "user", text });
    setChatLoading(true);
    if (!open) setOpen(true);
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
    <div className="fixed bottom-8 left-8 z-30 flex flex-col items-start gap-3">
      {/* Chat panel — expands upward */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-[400px] flex flex-col rounded-2xl overflow-hidden"
            style={{
              height: "50vh",
              maxHeight: 520,
              minHeight: 300,
              background: "rgba(255,255,255,0.97)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid rgba(226,232,240,0.9)",
              boxShadow: "0 12px 48px rgba(17,116,251,0.18), 0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            {/* Header */}
            <div
              className="flex-shrink-0 flex items-center gap-3 px-4 py-3"
              style={{ background: "#002D6B" }}
            >
              <img src={logoImg} alt="" className="w-7 h-7 object-contain flex-shrink-0" style={{ backgroundColor: "#002D6B" }} />
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-white text-sm tracking-tight leading-none">Branchwise AI</div>
                <div className="text-[10px] mt-0.5 leading-none" style={{ color: "rgba(255,255,255,0.5)" }}>Expansion intelligence</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg transition-colors cursor-pointer"
                style={{ color: "rgba(255,255,255,0.5)" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto min-h-0 px-4 py-3 bg-[#F7FAFF]" style={{ scrollbarWidth: "none" }}>
              {chatHistory.length === 0 ? (
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] px-1 pb-1" style={{ color: "#94A3B8" }}>Try asking</p>
                  {STARTERS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="text-left text-sm px-4 py-3 rounded-xl bg-white border transition-colors font-medium cursor-pointer"
                      style={{ borderColor: "#E2E8F0", color: "#64748B", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#5B9BFF"; e.currentTarget.style.color = "#0F172A"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.color = "#64748B"; }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {chatHistory.map((m, i) => (
                    <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
                        style={m.role === "user"
                          ? { backgroundColor: "#5B9BFF", color: "#fff" }
                          : { backgroundColor: "#fff", color: "#0F172A", border: "1px solid #E2E8F0" }
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
                      <div className="bg-white rounded-2xl px-3 py-2.5 flex gap-1 items-center" style={{ border: "1px solid #E2E8F0" }}>
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: "#5B9BFF" }}
                            animate={{ opacity: [0.3, 1, 0.3] }}
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

            {/* Input */}
            <div className="flex-shrink-0 px-3 py-3 flex items-center gap-2 bg-white" style={{ borderTop: "1px solid #E2E8F0" }}>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Ask Branchwise..."
                className="flex-1 rounded-xl px-3.5 py-2.5 text-sm bg-[#F7FAFF] outline-none transition-all"
                style={{ border: "1px solid #E2E8F0", color: "#0F172A" }}
                onFocus={(e) => { e.target.style.borderColor = "#5B9BFF"; }}
                onBlur={(e) => { e.target.style.borderColor = "#E2E8F0"; }}
              />
              <button
                type="button"
                onClick={() => send()}
                disabled={!input.trim() || chatLoading}
                className="p-2.5 rounded-xl text-white flex-shrink-0 transition-colors cursor-pointer disabled:opacity-40"
                style={{ backgroundColor: "#5B9BFF" }}
                onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = "#0065F0"; }}
                onMouseLeave={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = "#5B9BFF"; }}
              >
                <Send size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 rounded-full pl-1.5 pr-5 py-1.5 transition-all cursor-pointer select-none"
        style={{
          backgroundColor: "#002D6B",
          boxShadow: open
            ? "0 6px 24px rgba(91,155,255,0.35)"
            : "0 4px 16px rgba(91,155,255,0.22)",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#003A8A"; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#002D6B"; }}
      >
        <div
          className="w-11 h-11 flex items-center justify-center flex-shrink-0"
        >
          <img src={logoImg} alt="Branchwise" className="w-10 h-10 object-contain" style={{  }} />
        </div>
        <div className="flex flex-col items-start">
          <span className="font-display font-bold text-white text-sm tracking-tight leading-none">Ask Branchwise</span>
          <span className="text-[10px] leading-none mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>Expansion AI</span>
        </div>
      </button>
    </div>
  );
}
