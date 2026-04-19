export function scoreColor(score: number): [number, number, number, number] {
  if (score >= 75) return [59, 178, 115, 200];   // #3BB273 green
  if (score >= 50) return [245, 166, 35, 180];   // #F5A623 amber
  return [232, 93, 93, 160];                      // #E85D5D red
}

export function scoreHex(score: number): string {
  if (score >= 75) return "#3BB273";
  if (score >= 50) return "#F5A623";
  return "#E85D5D";
}

export function scoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 50) return "Fair";
  return "Weak";
}
