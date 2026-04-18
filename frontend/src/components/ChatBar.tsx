import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, X, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "../lib/store";
import { api } from "../lib/api";
import type { HexResult } from "../lib/api";

const STARTERS = [
  "Where should I open a bubble tea near universities?",
  "Find gaps in the inner west for coffee",
  "Best spots for fast casual in Parramatta",
];

export function ChatBar({ onHighlight }: { onHighlight: (h: HexResult) => void }) {
  const [input, setInput] = useState("");
  const { chatOpen, setChatOpen, chatHistory, pushChat, chatLoading, setChatLoading } = useStore();
  const bottomRef = useRef<HTMLDivElement>(null);

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
      const res = await api.chat(text);
      pushChat({ role: "assistant", text: res.reply, offline: res._offline });
      if (res.highlight) onHighlight(res.highlight);
    } catch {
      pushChat({ role: "assistant", text: "Error connecting to the server. Is the backend running?" });
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div className="absolute bottom-0 left-60 right-0 z-10">
      <AnimatePresence>
        {chatOpen && chatHistory.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-bg-panel border-t border-bg-border max-h-56 overflow-y-auto"
          >
            <div className="p-3 space-y-3">
              {chatHistory.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-accent text-white"
                        : "bg-bg-elevated text-fg-primary"
                    }`}
                  >
                    {m.role === "assistant" && m.offline && (
                      <div className="flex items-center gap-1 text-[10px] text-fg-tertiary mb-1">
                        <AlertCircle size={10} />
                        Offline mode
                      </div>
                    )}
                    {m.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-bg-elevated rounded-xl px-3 py-2 flex gap-1 items-center">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-fg-tertiary"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* starter prompts */}
      {chatOpen && chatHistory.length === 0 && (
        <div className="bg-bg-panel border-t border-bg-border px-3 py-2 flex gap-2 overflow-x-auto">
          {STARTERS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="flex-shrink-0 text-xs bg-bg-elevated hover:bg-bg-border text-fg-secondary hover:text-fg-primary border border-bg-border rounded-full px-3 py-1.5 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* input bar */}
      <div className="bg-bg-panel border-t border-bg-border px-3 py-2 flex items-center gap-2">
        <Sparkles size={16} className="text-accent flex-shrink-0" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask: where should I open near universities?"
          className="flex-1 bg-transparent text-sm text-fg-primary placeholder:text-fg-tertiary focus:outline-none"
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || chatLoading}
          className="text-accent hover:text-emerald-400 disabled:text-fg-tertiary transition-colors"
        >
          <Send size={16} />
        </button>
        <button onClick={() => setChatOpen(!chatOpen)} className="text-fg-tertiary hover:text-fg-primary transition-colors">
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
