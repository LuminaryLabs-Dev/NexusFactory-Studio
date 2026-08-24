export function generationDelay(model, fallback = 180) {
  const value = Number(model?.generation?.debounceMs ?? fallback);
  return Number.isFinite(value) ? Math.max(0, Math.min(5000, value)) : fallback;
}
export function createGenerationGate() {
  let latest = 0;
  return Object.freeze({
    begin() { latest += 1; return latest; },
    invalidate() { latest += 1; return latest; },
    isCurrent(token) { return token === latest; },
    current() { return latest; },
  });
}
