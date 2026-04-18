import { motion } from "framer-motion";
import { scoreHex } from "../lib/colors";

const LABELS: Record<string, string> = {
  competition_density: "Competition density",
  anchor_pull:         "Anchor pull",
  foot_traffic_proxy:  "Foot-traffic proxy",
  transit_proximity:   "Transit proximity",
  cannibalization:     "Cannibalization dist.",
};

const WEIGHTS: Record<string, number> = {
  competition_density: 25,
  anchor_pull:         25,
  foot_traffic_proxy:  20,
  transit_proximity:   15,
  cannibalization:     15,
};

export function ScoreBar({ name, value }: { name: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-fg-secondary">{LABELS[name] ?? name}</span>
        <span className="tabular text-fg-primary font-medium">
          {value}
          <span className="text-fg-tertiary ml-1">×{WEIGHTS[name]}%</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-bg-elevated overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: scoreHex(value) }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
