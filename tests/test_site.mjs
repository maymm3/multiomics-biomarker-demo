import assert from 'node:assert/strict';
import test from 'node:test';

import '../docs/stats.js';

const { calculateCohensD, classifyEffect } = globalThis.SignalStats;

test('reproduces the default synthetic example', () => {
  const effect = calculateCohensD({
    n1: 34,
    mean1: 1.61,
    sd1: 0.55,
    n2: 33,
    mean2: 0.14,
    sd2: 0.49,
  });
  assert.ok(effect > 2.8 && effect < 2.85);
  assert.equal(classifyEffect(effect), 'Large');
});

test('keeps effect direction and labels equal means', () => {
  assert.equal(calculateCohensD({ n1: 12, mean1: -1, sd1: 1, n2: 12, mean2: 1, sd2: 1 }), -2);
  const zero = calculateCohensD({ n1: 20, mean1: 0.5, sd1: 1, n2: 20, mean2: 0.5, sd2: 1 });
  assert.equal(zero, 0);
  assert.equal(classifyEffect(zero), 'Very small');
});

test('rejects invalid sample sizes and deviations', () => {
  assert.equal(calculateCohensD({ n1: 1, mean1: 1, sd1: 1, n2: 10, mean2: 0, sd2: 1 }), null);
  assert.equal(calculateCohensD({ n1: 10, mean1: 1, sd1: 0, n2: 10, mean2: 0, sd2: 1 }), null);
});
