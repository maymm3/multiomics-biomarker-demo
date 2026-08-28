(function exposeSignalStats(root) {
  function calculateCohensD({ n1, mean1, sd1, n2, mean2, sd2 }) {
    const values = [n1, mean1, sd1, n2, mean2, sd2];
    if (
      values.some((value) => !Number.isFinite(value)) ||
      n1 <= 1 ||
      n2 <= 1 ||
      sd1 <= 0 ||
      sd2 <= 0
    ) {
      return null;
    }

    const pooledVariance =
      ((n1 - 1) * sd1 ** 2 + (n2 - 1) * sd2 ** 2) /
      (n1 + n2 - 2);
    if (!Number.isFinite(pooledVariance) || pooledVariance <= 0) return null;
    return (mean1 - mean2) / Math.sqrt(pooledVariance);
  }

  function classifyEffect(effect) {
    if (effect === null || !Number.isFinite(effect)) return 'Check the inputs';
    const magnitude = Math.abs(effect);
    if (magnitude < 0.2) return 'Very small';
    if (magnitude < 0.5) return 'Small';
    if (magnitude < 0.8) return 'Moderate';
    return 'Large';
  }

  const api = Object.freeze({ calculateCohensD, classifyEffect });
  root.SignalStats = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
