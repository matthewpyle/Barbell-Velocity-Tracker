// lib/strength.ts
export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function epley1RM(weightKg: number, reps: number) {
  if (weightKg <= 0 || reps <= 0) return 0;
  return weightKg * (1 + reps / 30);
}

export function brzycki1RM(weightKg: number, reps: number) {
  // Valid-ish up to ~10-12 reps; still fine for MVP if you label it.
  if (weightKg <= 0 || reps <= 0) return 0;
  const denom = 37 - reps;
  if (denom <= 0) return 0;
  return (weightKg * 36) / denom;
}
