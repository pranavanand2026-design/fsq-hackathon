import { useMemo, useState, useRef, useEffect } from "react";
import { Send, X, AlertCircle, Sparkles, Minus } from "lucide-react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Rnd } from "react-rnd";
import { useStore } from "../lib/store";
import { api } from "../lib/api";
import type { HexResult } from "../lib/api";

const STARTERS_BY_VERTICAL: Record<string, string[]> = {
  bubble_tea: [
    "Where's the highest-opportunity suburb for our next store?",
    "Which areas have high foot traffic but low competition?",
    "Find me expansion gaps in the inner west",
  ],
  coffee: [
    "Where should we open our next location in the CBD?",
    "Which suburbs are underserved for coffee?",
    "Find low-competition areas near office precincts",
  ],
  fast_casual: [
    "Where's the best suburb to expand into next?",
    "Which areas have strong foot traffic but few competitors?",
    "Find expansion opportunities near shopping centres",
  ],
};

export function ChatBar({ onHighlight }: { onHighlight: (h: HexResult) => void }) {
  const [input, setInput] = useState("");
  const [minimised, setMinimised] = useState(false);
  const {
    vertical, brandSlug,
    chatOpen, setChatOpen, chatHistory, pushChat, chatLoading, setChatLoading,
    setScenario,
  } = useStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const starters = useMemo(
    () => STARTERS_BY_VERTICAL[vertical] ?? STARTERS_BY_VERTICAL.bubble_tea,
    [vertical]
  );

  const W = 460;
  const H = 350;
  const startX = 16;
  const startY = 16;

  useEffect(() => {
    if (!minimised) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, chatLoading, minimised]);

  async function send(msg?: string) {
    const text = (msg ?? input).trim();
    if (!text || chatLoading) return;
    setInput("");
    pushChat({ role: "user", text });
    setChatLoading(true);
    setMinimised(false);
    if (!chatOpen) setChatOpen(true);
    try {
      const res = await api.chat(text, brandSlug || undefined);
      pushChat({ role: "assistant", text: res.reply, offline: res._offline });
      if (res.scenario) setScenario(res.scenario);
      if (res.highlight) onHighlight(res.highlight);
    } catch {
      pushChat({ role: "assistant", text: "Error connecting to the server. Is the backend running?" });
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <Rnd
      default={{ x: startX, y: startY, width: W, height: minimised ? 52 : H }}
      minWidth={340}
      minHeight={minimised ? 52 : 180}
      bounds="window"
      dragHandleClassName="chat-drag-handle"
      style={{ zIndex: 30 }}
      size={minimised ? { width: W, height: 52 } : undefined}
      enableResizing={minimised ? false : {
        top: true, bottom: true, left: true, right: true,
        topLeft: true, topRight: true, bottomLeft: true, bottomRight: true,
      }}
    >
      <div
        className="absolute inset-0 border rounded-2xl flex flex-col overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.82)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.6)",
          boxShadow: "0 8px 40px rgba(17,116,251,0.10), 0 2px 8px rgba(0,0,0,0.06)"
        }}
      >
        {/* title bar — full drag handle */}
        <div className="chat-drag-handle flex-shrink-0 flex items-center gap-2.5 px-4 py-3 border-b border-bg-border cursor-grab active:cursor-grabbing select-none rounded-t-2xl" style={{ background: 'linear-gradient(to right, #EEF4FF, #F3F7FF)' }}>
          <Sparkles size={14} style={{ color: '#5B9BFF' }} className="flex-shrink-0" />
          <span className="font-display text-sm font-bold text-fg-primary flex-1 tracking-tight">Branchwise AI</span>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setMinimised((v) => !v)}
            className="text-fg-tertiary hover:text-fg-primary transition-colors p-1 rounded-lg hover:bg-white/60"
            title={minimised ? "Expand" : "Minimise"}
          >
            <Minus size={13} />
          </button>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setChatOpen(false)}
            className="text-fg-tertiary hover:text-fg-primary transition-colors p-1 rounded-lg hover:bg-white/60"
          >
            <X size={13} />
          </button>
        </div>

        {!minimised && (
          <>
            {/* message history */}
            {chatHistory.length > 0 && (
              <div className="flex-1 overflow-y-auto min-h-0 bg-bg-base">
                <div className="p-4 space-y-3">
                  {chatHistory.map((m, i) => (
                    <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                          m.role === "user"
                            ? "text-white"
                            : "bg-white border border-bg-border text-fg-primary shadow-card"
                        }`}
                        style={m.role === "user" ? { backgroundColor: '#5B9BFF' } : {}}
                      >
                        {m.role === "assistant" && m.offline && (
                          <div className="flex items-center gap-1 text-[10px] text-fg-tertiary mb-1">
                            <AlertCircle size={10} /> Offline mode
                          </div>
                        )}
                        {m.role === "user" ? m.text : (
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                              strong: ({ children }) => <strong className="font-semibold text-fg-primary">{children}</strong>,
                              em: ({ children }) => <em className="italic">{children}</em>,
                              ul: ({ children }) => <ul className="mt-1 mb-1.5 space-y-0.5 pl-4 list-disc">{children}</ul>,
                              ol: ({ children }) => <ol className="mt-1 mb-1.5 space-y-0.5 pl-4 list-decimal">{children}</ol>,
                              li: ({ children }) => <li className="text-fg-secondary">{children}</li>,
                              h3: ({ children }) => <p className="font-display font-semibold text-fg-primary mt-2 mb-0.5">{children}</p>,
                              h4: ({ children }) => <p className="font-medium text-fg-secondary mt-1.5 mb-0.5">{children}</p>,
                              code: ({ children }) => <code className="bg-bg-elevated rounded px-1 py-0.5 text-xs font-mono" style={{ color: '#0065F0' }}>{children}</code>,
                              hr: () => <hr className="my-2 border-bg-border" />,
                            }}
                          >
                            {m.text}
                          </ReactMarkdown>
                        )}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-bg-border rounded-2xl px-4 py-3 flex gap-1.5 items-center shadow-card">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: '#5B9BFF' }}
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              </div>
            )}

            {/* starter prompts */}
            {chatHistory.length === 0 && (
              <div className="flex-1 flex flex-col justify-end px-4 pb-3 gap-2 min-h-0 overflow-y-auto bg-bg-base">
                <p className="text-[10px] font-bold text-fg-tertiary uppercase tracking-[0.12em] px-1 pb-1">Try asking</p>
                {starters.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="text-left text-sm text-fg-secondary hover:text-fg-primary bg-white hover:bg-bg-elevated border border-bg-border rounded-xl px-4 py-3 transition-colors font-medium shadow-card"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* input bar */}
            <div className="flex-shrink-0 px-3 py-3 flex items-center gap-2 border-t border-bg-border bg-white">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder="Ask Branchwise..."
                className="flex-1 bg-bg-elevated border border-bg-border rounded-xl text-sm text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:ring-2 px-3.5 py-2.5 transition-all cursor-text"
                style={{ '--tw-ring-color': 'rgba(30,94,255,0.15)' } as React.CSSProperties}
                onFocus={(e) => { e.target.style.borderColor = '#5B9BFF'; }}
                onBlur={(e) => { e.target.style.borderColor = ''; }}
              />
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => send()}
                disabled={!input.trim() || chatLoading}
                className="text-white p-2.5 rounded-xl disabled:bg-gray-200 disabled:text-white transition-colors cursor-pointer flex-shrink-0"
                style={{ backgroundColor: '#5B9BFF' }}
                onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#0065F0'; }}
                onMouseLeave={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#5B9BFF'; }}
              >
                <Send size={15} />
              </button>
            </div>
          </>
        )}
      </div>
    </Rnd>
  );
}
