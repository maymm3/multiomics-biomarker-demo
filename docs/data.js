(function exposeSignalData(root) {
  function detectDelimiter(text) {
    const firstLine = String(text).replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] || '';
    const count = (character) => {
      let total = 0;
      let quoted = false;
      for (let index = 0; index < firstLine.length; index += 1) {
        if (firstLine[index] === '"') quoted = !quoted;
        else if (!quoted && firstLine[index] === character) total += 1;
      }
      return total;
    };
    return count('\t') > count(',') ? '\t' : ',';
  }

  function makeUniqueHeaders(values) {
    const used = new Map();
    return values.map((raw, index) => {
      const base = String(raw).trim() || `column_${index + 1}`;
      const seen = used.get(base) || 0;
      used.set(base, seen + 1);
      return seen === 0 ? base : `${base}_${seen + 1}`;
    });
  }

  function parseDelimited(text, delimiter = detectDelimiter(text)) {
    const source = String(text).replace(/^\uFEFF/, '');
    if (!source.trim()) throw new Error('The file is empty.');
    const records = [];
    let record = [];
    let field = '';
    let quoted = false;

    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];
      if (character === '"') {
        if (quoted && source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (character === delimiter && !quoted) {
        record.push(field);
        field = '';
      } else if ((character === '\n' || character === '\r') && !quoted) {
        if (character === '\r' && source[index + 1] === '\n') index += 1;
        record.push(field);
        if (record.some((value) => value.trim() !== '')) records.push(record);
        record = [];
        field = '';
      } else {
        field += character;
      }
    }
    if (quoted) throw new Error('The file contains an unclosed quoted value.');
    record.push(field);
    if (record.some((value) => value.trim() !== '')) records.push(record);
    if (records.length < 2) throw new Error('Include a header row and at least one data row.');

    const headers = makeUniqueHeaders(records[0]);
    const rows = records.slice(1).map((values) =>
      Array.from({ length: headers.length }, (_, index) => values[index] ?? '')
    );
    return { headers, rows, delimiter };
  }

  function escapeCell(value, delimiter = ',') {
    const text = String(value ?? '');
    return text.includes(delimiter) || /["\r\n]/.test(text)
      ? `"${text.replaceAll('"', '""')}"`
      : text;
  }

  function serializeDelimited(dataset, delimiter = ',') {
    const records = [dataset.headers, ...dataset.rows];
    return `${records.map((row) => row.map((value) => escapeCell(value, delimiter)).join(delimiter)).join('\n')}\n`;
  }

  function numericColumnIndexes(dataset) {
    return dataset.headers.flatMap((_, columnIndex) => {
      const values = dataset.rows
        .map((row) => String(row[columnIndex] ?? '').trim())
        .filter(Boolean);
      if (values.length === 0) return [];
      const numeric = values.filter((value) => Number.isFinite(Number(value))).length;
      return numeric / values.length >= 0.6 ? [columnIndex] : [];
    });
  }

  function summarizeDataset(dataset) {
    let missing = 0;
    dataset.rows.forEach((row) => {
      dataset.headers.forEach((_, index) => {
        if (String(row[index] ?? '').trim() === '') missing += 1;
      });
    });
    return {
      rows: dataset.rows.length,
      columns: dataset.headers.length,
      missing,
      numericColumns: numericColumnIndexes(dataset).length,
    };
  }

  function aggregateMeanByCategory(dataset, categoryIndex, valueIndex, limit = 16) {
    const groups = new Map();
    dataset.rows.forEach((row) => {
      const value = Number(row[valueIndex]);
      if (!Number.isFinite(value) || String(row[valueIndex]).trim() === '') return;
      const category = String(row[categoryIndex] ?? '').trim() || 'Missing';
      const current = groups.get(category) || { category, count: 0, sum: 0 };
      current.count += 1;
      current.sum += value;
      groups.set(category, current);
    });
    return [...groups.values()]
      .map((group) => ({
        category: group.category,
        count: group.count,
        mean: group.sum / group.count,
      }))
      .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category))
      .slice(0, limit);
  }

  function histogram(dataset, valueIndex, requestedBins = 10) {
    const values = dataset.rows
      .map((row) => String(row[valueIndex] ?? '').trim())
      .filter(Boolean)
      .map(Number)
      .filter(Number.isFinite);
    if (values.length === 0) return [];
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    if (minimum === maximum) return [{ start: minimum, end: maximum, count: values.length }];
    const binCount = Math.max(2, Math.min(30, Math.round(requestedBins)));
    const width = (maximum - minimum) / binCount;
    const bins = Array.from({ length: binCount }, (_, index) => ({
      start: minimum + index * width,
      end: minimum + (index + 1) * width,
      count: 0,
    }));
    values.forEach((value) => {
      const index = Math.min(binCount - 1, Math.floor((value - minimum) / width));
      bins[index].count += 1;
    });
    return bins;
  }

  function pairedNumericRows(dataset, xIndex, yIndex, categoryIndex = null, limit = 5000) {
    return dataset.rows.flatMap((row, rowIndex) => {
      const xText = String(row[xIndex] ?? '').trim();
      const yText = String(row[yIndex] ?? '').trim();
      const x = Number(xText);
      const y = Number(yText);
      if (!xText || !yText || !Number.isFinite(x) || !Number.isFinite(y)) return [];
      return [{
        x,
        y,
        rowIndex,
        category: categoryIndex === null ? '' : String(row[categoryIndex] ?? '').trim() || 'Missing',
      }];
    }).slice(0, limit);
  }

  function quantileSorted(values, probability) {
    if (values.length === 0) return null;
    const position = (values.length - 1) * probability;
    const lower = Math.floor(position);
    const fraction = position - lower;
    return values[lower + 1] === undefined
      ? values[lower]
      : values[lower] + fraction * (values[lower + 1] - values[lower]);
  }

  function boxPlotStats(dataset, categoryIndex, valueIndex, limit = 16) {
    const groups = new Map();
    dataset.rows.forEach((row) => {
      const text = String(row[valueIndex] ?? '').trim();
      const value = Number(text);
      if (!text || !Number.isFinite(value)) return;
      const category = String(row[categoryIndex] ?? '').trim() || 'Missing';
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(value);
    });
    return [...groups.entries()]
      .sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]))
      .slice(0, limit)
      .map(([category, unsorted]) => {
        const values = [...unsorted].sort((left, right) => left - right);
        const q1 = quantileSorted(values, 0.25);
        const median = quantileSorted(values, 0.5);
        const q3 = quantileSorted(values, 0.75);
        const iqr = q3 - q1;
        const lowerFence = q1 - 1.5 * iqr;
        const upperFence = q3 + 1.5 * iqr;
        const inside = values.filter((value) => value >= lowerFence && value <= upperFence);
        return {
          category,
          count: values.length,
          q1,
          median,
          q3,
          lower: inside[0],
          upper: inside.at(-1),
          outliers: values.filter((value) => value < lowerFence || value > upperFence),
        };
      });
  }

  function volcanoRows(dataset, effectIndex, probabilityIndex, limit = 10000) {
    return dataset.rows.flatMap((row, rowIndex) => {
      const effectText = String(row[effectIndex] ?? '').trim();
      const probabilityText = String(row[probabilityIndex] ?? '').trim();
      const effect = Number(effectText);
      const probability = Number(probabilityText);
      if (!effectText || !probabilityText || !Number.isFinite(effect) || !Number.isFinite(probability) || probability <= 0 || probability > 1) return [];
      const significance = probability === 1 ? 0 : -Math.log10(probability);
      return [{ effect, probability, significance, rowIndex }];
    }).slice(0, limit);
  }

  function heatmapMatrix(dataset, labelIndex, options = {}) {
    const { scaleRows = true, rowLimit = 60, columnLimit = 40 } = options;
    const numericIndexes = numericColumnIndexes(dataset)
      .filter((index) => index !== labelIndex)
      .slice(0, columnLimit);
    const rows = dataset.rows.slice(0, rowLimit).map((row, rowIndex) => {
      const rawValues = numericIndexes.map((index) => {
        const text = String(row[index] ?? '').trim();
        const value = Number(text);
        return text && Number.isFinite(value) ? value : null;
      });
      const valid = rawValues.filter((value) => value !== null);
      let values = rawValues;
      if (scaleRows && valid.length > 1) {
        const mean = valid.reduce((total, value) => total + value, 0) / valid.length;
        const variance = valid.reduce((total, value) => total + (value - mean) ** 2, 0) / (valid.length - 1);
        const deviation = Math.sqrt(variance);
        values = rawValues.map((value) => value === null ? null : deviation > 0 ? (value - mean) / deviation : 0);
      }
      return {
        label: String(row[labelIndex] ?? '').trim() || `Row ${rowIndex + 1}`,
        values,
      };
    });
    return {
      columns: numericIndexes.map((index) => dataset.headers[index]),
      columnIndexes: numericIndexes,
      rows,
      scaled: scaleRows,
    };
  }

  const api = Object.freeze({
    detectDelimiter,
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
  });
  root.SignalData = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
