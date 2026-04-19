import { motion } from "framer-motion";
import { scoreHex } from "../lib/colors";

const LABELS: Record<string, string> = {
  market_saturation: "Market Saturation",
  cannibalisation: "Customer Redistribution",
  surrounding_amenities: "Surrounding Amenities",
  transit_accessibility: "Transit Accessibility",
  demographic_match: "Demographic Match",
};

const WEIGHTS: Record<string, number> = {
  market_saturation: 25,
  cannibalisation: 25,
  surrounding_amenities: 20,
  transit_accessibility: 15,
  demographic_match: 15,
};

export function ScoreBar({ name, value }: { name: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-600 font-medium">{LABELS[name] ?? name}</span>
        <span className="tabular text-gray-900 font-semibold">
          {value}
          <span className="text-gray-400 ml-1 font-normal">×{WEIGHTS[name]}%</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: scoreHex(value) }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
