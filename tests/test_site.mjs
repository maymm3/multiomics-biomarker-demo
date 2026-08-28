import assert from 'node:assert/strict';
import test from 'node:test';

import '../docs/stats.js';
import '../docs/data.js';

const { calculateCohensD, classifyEffect } = globalThis.SignalStats;
const {
  parseDelimited,
  serializeDelimited,
  numericColumnIndexes,
  summarizeDataset,
  aggregateMeanByCategory,
  histogram,
  pairedNumericRows,
  boxPlotStats,
  volcanoRows,
  heatmapMatrix,
} = globalThis.SignalData;

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

test('parses quoted CSV and preserves it through cleaned export', () => {
  const parsed = parseDelimited('\uFEFFfeature,group,value\r\n"P,001","A ""group""",1.5\r\nP002,B,\r\n');
  assert.deepEqual(parsed.headers, ['feature', 'group', 'value']);
  assert.deepEqual(parsed.rows[0], ['P,001', 'A "group"', '1.5']);
  assert.equal(parsed.rows[1][2], '');
  assert.deepEqual(parseDelimited(serializeDelimited(parsed)).rows, parsed.rows);
});

test('detects TSV files and makes duplicate headers unambiguous', () => {
  const parsed = parseDelimited('feature\tvalue\tvalue\nP001\t2\t3\n');
  assert.equal(parsed.delimiter, '\t');
  assert.deepEqual(parsed.headers, ['feature', 'value', 'value_2']);
});

test('summarizes missingness and detects mostly numeric columns', () => {
  const parsed = parseDelimited('feature,group,value\nP001,A,1.2\nP002,A,2.4\nP003,B,missing\nP004,,4.8\n');
  assert.deepEqual(numericColumnIndexes(parsed), [2]);
  assert.deepEqual(summarizeDataset(parsed), { rows: 4, columns: 3, missing: 1, numericColumns: 1 });
});

test('aggregates editable values by category and builds histogram bins', () => {
  const parsed = parseDelimited('group,value\nA,1\nA,3\nB,-2\nB,\n');
  assert.deepEqual(aggregateMeanByCategory(parsed, 0, 1), [
    { category: 'A', count: 2, mean: 2 },
    { category: 'B', count: 1, mean: -2 },
  ]);
  const bins = histogram(parsed, 1, 2);
  assert.equal(bins.length, 2);
  assert.equal(bins.reduce((total, bin) => total + bin.count, 0), 3);
});

test('rejects empty and malformed delimited files', () => {
  assert.throws(() => parseDelimited(''), /empty/i);
  assert.throws(() => parseDelimited('a,b\n"open,1\n'), /unclosed/i);
});

test('keeps only complete numeric pairs for scatter and line plots', () => {
  const parsed = parseDelimited('group,x,y\nA,1,2\nA,missing,3\nB,4,\nB,5,6\n');
  assert.deepEqual(pairedNumericRows(parsed, 1, 2, 0), [
    { x: 1, y: 2, rowIndex: 0, category: 'A' },
    { x: 5, y: 6, rowIndex: 3, category: 'B' },
  ]);
});

test('calculates quartiles, whiskers, and outliers for box plots', () => {
  const parsed = parseDelimited('group,value\nA,1\nA,2\nA,3\nA,100\nB,-1\nB,1\n');
  const groups = boxPlotStats(parsed, 0, 1);
  assert.equal(groups[0].category, 'A');
  assert.equal(groups[0].median, 2.5);
  assert.equal(groups[0].upper, 3);
  assert.deepEqual(groups[0].outliers, [100]);
});

test('transforms valid probabilities for volcano plots', () => {
  const parsed = parseDelimited('effect,p\n2,0.01\n-1.5,1\n0,0\n1,2\n');
  assert.deepEqual(volcanoRows(parsed, 0, 1), [
    { effect: 2, probability: 0.01, significance: 2, rowIndex: 0 },
    { effect: -1.5, probability: 1, significance: 0, rowIndex: 1 },
  ]);
});

test('builds a row-scaled heatmap matrix without inventing missing values', () => {
  const parsed = parseDelimited('feature,s1,s2,s3\nP001,1,2,3\nP002,4,,4\n');
  const matrix = heatmapMatrix(parsed, 0);
  assert.deepEqual(matrix.columns, ['s1', 's2', 's3']);
  assert.ok(Math.abs(matrix.rows[0].values.reduce((total, value) => total + value, 0)) < 1e-12);
  assert.equal(matrix.rows[1].values[1], null);
  assert.deepEqual([matrix.rows[1].values[0], matrix.rows[1].values[2]], [0, 0]);
});
