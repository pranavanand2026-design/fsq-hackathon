import { useMemo, useState, useRef, useEffect } from "react";
import { Send, X, AlertCircle, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "../lib/store";
import { api } from "../lib/api";
import type { HexResult } from "../lib/api";

const STARTERS_BY_VERTICAL: Record<string, string[]> = {
  bubble_tea: [
    "Where should I open a bubble tea near universities?",
    "Gaps for bubble tea in the inner west",
    "Best bubble tea spots near rail stations",
  ],
  coffee: [
    "Find gaps in the inner west for coffee",
    "Best coffee spots near offices in the CBD",
    "Low-competition coffee areas in Chatswood",
  ],
  fast_casual: [
    "Best spots for fast casual in Parramatta",
    "Where can I open a new Roll'd near a mall?",
    "Find fast-casual gaps near hospitals",
  ],
};

export function ChatBar({ onHighlight }: { onHighlight: (h: HexResult) => void }) {
  const [input, setInput] = useState("");
  const {
    vertical,
    chatOpen, setChatOpen, chatHistory, pushChat, chatLoading, setChatLoading,
    selectedHex, loadingReport,
  } = useStore();
  const reportVisible = !!(selectedHex || loadingReport);
  const bottomRef = useRef<HTMLDivElement>(null);
  const starters = useMemo(
    () => STARTERS_BY_VERTICAL[vertical] ?? STARTERS_BY_VERTICAL.bubble_tea,
    [vertical]
  );

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
    <div
      className="absolute bottom-6 left-0 z-10 flex justify-center pointer-events-none px-6 transition-[right] duration-300 ease-out"
      style={{ right: reportVisible ? 360 : 0 }}
    >
      <div
        className="w-full max-w-2xl bg-white border border-gray-200 rounded-2xl flex flex-col overflow-hidden pointer-events-auto"
        style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}
      >
      <AnimatePresence>
        {chatOpen && chatHistory.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="max-h-56 overflow-y-auto border-b border-gray-100"
          >
            <div className="p-4 space-y-3">
              {chatHistory.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-emerald-500 text-white"
                        : "bg-gray-50 border border-gray-100 text-gray-800"
                    }`}
                  >
                    {m.role === "assistant" && m.offline && (
                      <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-1">
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
                  <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 flex gap-1.5 items-center">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-gray-400"
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
        <div className="border-b border-gray-100 px-4 py-2.5 flex gap-2 overflow-x-auto">
          {starters.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="flex-shrink-0 text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-gray-900 border border-gray-200 rounded-full px-3.5 py-1.5 transition-colors font-medium"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* input bar */}
      <div className="px-4 py-3 flex items-center gap-3">
        <Sparkles size={18} className="text-emerald-500 flex-shrink-0" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          onClick={() => setChatOpen(true)}
          placeholder="Ask: where should I open near universities?"
          className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || chatLoading}
          className="bg-emerald-500 text-white p-2 rounded-xl hover:bg-emerald-600 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
        >
          <Send size={16} />
        </button>
        <button onClick={() => setChatOpen(!chatOpen)} className="text-gray-400 hover:text-gray-700 transition-colors">
          <X size={16} />
        </button>
      </div>
    </div>
  </div>
  );
}
