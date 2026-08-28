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

  const api = Object.freeze({
    detectDelimiter,
    parseDelimited,
    serializeDelimited,
    numericColumnIndexes,
    summarizeDataset,
    aggregateMeanByCategory,
    histogram,
  });
  root.SignalData = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
