export function scoreColor(score: number): [number, number, number, number] {
  if (score >= 75) return [16, 185, 129, 200];   // emerald
  if (score >= 50) return [245, 158, 11, 180];    // amber
  return [239, 68, 68, 160];                       // red
}

export function scoreHex(score: number): string {
  if (score >= 75) return "#10B981";
  if (score >= 50) return "#F59E0B";
  return "#EF4444";
}

export function scoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 50) return "Fair";
  return "Weak";
}
