const features = [
  { id: 'P001', auc: 0.974, effect: 2.66, direction: 'higher' },
  { id: 'P003', auc: 0.973, effect: 2.82, direction: 'higher' },
  { id: 'P004', auc: 0.969, effect: 2.45, direction: 'higher' },
  { id: 'P002', auc: 0.944, effect: 2.41, direction: 'higher' },
  { id: 'P005', auc: 0.930, effect: 2.08, direction: 'higher' },
  { id: 'P007', auc: 0.905, effect: -1.88, direction: 'lower' },
  { id: 'P006', auc: 0.824, effect: -1.34, direction: 'lower' },
  { id: 'P008', auc: 0.817, effect: -1.28, direction: 'lower' },
];

const featureList = document.querySelector('#feature-list');
const emptyState = document.querySelector('#empty-state');
let selectedId = 'P001';

function selectFeature(feature) {
  selectedId = feature.id;
  document.querySelector('#selected-id').textContent = feature.id;
  document.querySelector('#selected-direction').textContent = `${feature.direction} in persistent group`;
  document.querySelector('#selected-auc').textContent = feature.auc.toFixed(3);
  document.querySelector('#selected-effect').textContent = `${feature.effect > 0 ? '+' : ''}${feature.effect.toFixed(2)}`;
  document.querySelector('#selected-explanation').textContent =
    `${feature.id} shows a ${feature.direction} week-12 change in the synthetic persistent-response group. It was deliberately embedded so the workflow could prove that it recovers known signals.`;
  renderFeatures(document.querySelector('#protein-search').value);
}

function renderFeatures(query = '') {
  const visible = features.filter((feature) => feature.id.toLowerCase().includes(query.trim().toLowerCase()));
  featureList.replaceChildren();
  emptyState.hidden = visible.length > 0;

  visible.forEach((feature, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `feature-row${feature.id === selectedId ? ' active' : ''}`;
    button.setAttribute('role', 'listitem');
    button.setAttribute('aria-pressed', String(feature.id === selectedId));
    button.innerHTML = `
      <span class="feature-name"><small>${String(index + 1).padStart(2, '0')}</small><strong>${feature.id}</strong></span>
      <span class="bar-track" aria-label="AUC ${feature.auc.toFixed(3)}"><span style="width:${feature.auc * 100}%"></span></span>
      <span class="effect ${feature.direction}">${feature.effect > 0 ? '+' : ''}${feature.effect.toFixed(2)}</span>
    `;
    button.addEventListener('click', () => selectFeature(feature));
    featureList.append(button);
  });
}

document.querySelector('#protein-search').addEventListener('input', (event) => renderFeatures(event.target.value));
renderFeatures();

const exampleTable = `feature,group,value,timepoint,log2_fold_change,p_value
P001,Persistent,1.82,week12,2.31,0.0004
P001,Persistent,1.55,week12,2.31,0.0004
P001,Persistent,1.46,week12,2.31,0.0004
P001,Transient,0.31,week12,2.31,0.0004
P001,Transient,0.08,week12,2.31,0.0004
P001,Transient,0.17,week12,2.31,0.0004
P007,Persistent,-0.92,week12,-1.74,0.003
P007,Persistent,-1.14,week12,-1.74,0.003
P007,Persistent,-0.83,week12,-1.74,0.003
P007,Transient,0.12,week12,-1.74,0.003
P007,Transient,-0.04,week12,-1.74,0.003
P007,Transient,0.09,week12,-1.74,0.003
P031,Persistent,0.42,week12,0.28,0.41
P031,Transient,0.31,week12,0.28,0.41`;

let dataset = SignalData.parseDelimited(exampleTable);
const tableHead = document.querySelector('#data-table thead');
const tableBody = document.querySelector('#data-table tbody');
const categorySelect = document.querySelector('#category-column');
const xSelect = document.querySelector('#x-column');
const valueSelect = document.querySelector('#value-column');
const chartMode = document.querySelector('#chart-mode');
const chartPalette = document.querySelector('#chart-palette');
const chartTitleInput = document.querySelector('#chart-title-input');
const tableFilter = document.querySelector('#table-filter');
const chart = document.querySelector('#data-chart');
const svgNamespace = 'http://www.w3.org/2000/svg';
const maximumPreviewRows = 100;
const palettes = {
  forest: ['#214d3b', '#e06f51', '#4f856d', '#d5a238', '#765b88', '#4d7691'],
  ocean: ['#176b87', '#f28f3b', '#3ba99c', '#7768ae', '#c8553d', '#5b8e7d'],
  sunset: ['#d1495b', '#edae49', '#00798c', '#6a4c93', '#66a182', '#2e4057'],
  colorblind: ['#0072b2', '#d55e00', '#009e73', '#cc79a7', '#e69f00', '#56b4e9'],
  mono: ['#26332e', '#50605a', '#75817d', '#9aa29f', '#bec3c1', '#454e4b'],
};

function setDatasetMessage(message, error = false) {
  const element = document.querySelector('#dataset-message');
  element.textContent = message;
  element.classList.toggle('error', error);
}

function appendSvg(tag, attributes = {}, text = '') {
  const element = document.createElementNS(svgNamespace, tag);
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
  if (text) element.textContent = text;
  chart.append(element);
  return element;
}

function resetChart() {
  chart.replaceChildren();
  appendSvg('style', {}, `
    .chart-gridline{stroke:#deded5;stroke-width:1}.chart-baseline{stroke:#737b77;stroke-width:1.5}
    .chart-tick,.chart-category,.chart-empty{fill:#68716d;font:11px Arial,sans-serif}.chart-empty{font-size:14px}
    .chart-point{stroke:#fff;stroke-width:1;opacity:.82}.chart-line{fill:none;stroke-width:2.2;stroke-linejoin:round;stroke-linecap:round}
    .box-whisker{stroke:#4f5c57;stroke-width:1.5}.box-median{stroke:#17201d;stroke-width:2.5}
  `);
  appendSvg('rect', { x: 0, y: 0, width: 760, height: 350, fill: '#fcfbf7' });
}

function paletteColor(index) {
  const colors = palettes[chartPalette.value] || palettes.forest;
  return colors[index % colors.length];
}

function setChartTitle(defaultTitle) {
  const title = chartTitleInput.value.trim() || defaultTitle;
  document.querySelector('#chart-title').textContent = title;
  chart.setAttribute('aria-label', title);
  return title;
}

function compactNumber(value) {
  if (!Number.isFinite(value)) return '—';
  const magnitude = Math.abs(value);
  if (magnitude >= 1000 || (magnitude > 0 && magnitude < 0.01)) return value.toExponential(1);
  return Number(value.toFixed(2)).toString();
}

function populateDashboardControls() {
  const numericIndexes = SignalData.numericColumnIndexes(dataset);
  const numericSet = new Set(numericIndexes);
  categorySelect.replaceChildren();
  dataset.headers.forEach((header, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = header;
    categorySelect.append(option);
  });
  xSelect.replaceChildren();
  valueSelect.replaceChildren();
  numericIndexes.forEach((index) => {
    const xOption = document.createElement('option');
    xOption.value = String(index);
    xOption.textContent = dataset.headers[index];
    xSelect.append(xOption);
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = dataset.headers[index];
    valueSelect.append(option);
  });
  const defaultCategory = dataset.headers.findIndex((_, index) => !numericSet.has(index));
  categorySelect.value = String(defaultCategory >= 0 ? defaultCategory : 0);
  if (numericIndexes.length > 0) {
    xSelect.value = String(numericIndexes[Math.min(1, numericIndexes.length - 1)]);
    valueSelect.value = String(numericIndexes[0]);
  }
  xSelect.disabled = numericIndexes.length === 0;
  valueSelect.disabled = numericIndexes.length === 0;
  chartMode.disabled = numericIndexes.length === 0;
}

function renderDataSummary() {
  const summary = SignalData.summarizeDataset(dataset);
  document.querySelector('#data-rows').textContent = summary.rows.toLocaleString();
  document.querySelector('#data-columns').textContent = summary.columns.toLocaleString();
  document.querySelector('#data-missing').textContent = summary.missing.toLocaleString();
  document.querySelector('#data-numeric').textContent = summary.numericColumns.toLocaleString();
}

function drawEmptyChart(message) {
  resetChart();
  appendSvg('rect', { x: 0, y: 0, width: 760, height: 350, rx: 16, fill: '#f2f1ea' });
  appendSvg('text', { x: 380, y: 170, 'text-anchor': 'middle', class: 'chart-empty' }, message);
  document.querySelector('#chart-observations').textContent = '0 valid values';
}

function drawMeanChart(categoryIndex, valueIndex) {
  const groups = SignalData.aggregateMeanByCategory(dataset, categoryIndex, valueIndex);
  if (groups.length === 0) {
    drawEmptyChart('Choose a numeric column with valid values.');
    return;
  }
  resetChart();
  const frame = { left: 62, right: 24, top: 24, bottom: 82, width: 760, height: 350 };
  const plotWidth = frame.width - frame.left - frame.right;
  const plotHeight = frame.height - frame.top - frame.bottom;
  const minimum = Math.min(0, ...groups.map((group) => group.mean));
  const maximum = Math.max(0, ...groups.map((group) => group.mean));
  const span = maximum - minimum || 1;
  const y = (value) => frame.top + (maximum - value) / span * plotHeight;
  const baseline = y(0);

  for (let tick = 0; tick <= 4; tick += 1) {
    const value = maximum - (span * tick / 4);
    const position = y(value);
    appendSvg('line', { x1: frame.left, x2: frame.width - frame.right, y1: position, y2: position, class: 'chart-gridline' });
    appendSvg('text', { x: frame.left - 10, y: position + 4, 'text-anchor': 'end', class: 'chart-tick' }, compactNumber(value));
  }
  appendSvg('line', { x1: frame.left, x2: frame.width - frame.right, y1: baseline, y2: baseline, class: 'chart-baseline' });

  const slot = plotWidth / groups.length;
  const barWidth = Math.max(8, Math.min(52, slot * 0.62));
  groups.forEach((group, index) => {
    const barX = frame.left + index * slot + (slot - barWidth) / 2;
    const valueY = y(group.mean);
    const barY = Math.min(valueY, baseline);
    const barHeight = Math.max(1, Math.abs(baseline - valueY));
    const bar = appendSvg('rect', {
      x: barX,
      y: barY,
      width: barWidth,
      height: barHeight,
      rx: 5,
      class: group.mean >= 0 ? 'chart-bar positive' : 'chart-bar negative',
      style: `fill:${group.mean >= 0 ? paletteColor(index) : paletteColor(index + 1)}`,
    });
    const title = document.createElementNS(svgNamespace, 'title');
    title.textContent = `${group.category}: mean ${compactNumber(group.mean)} from ${group.count} values`;
    bar.append(title);
    appendSvg('text', {
      x: barX + barWidth / 2,
      y: frame.height - frame.bottom + 20,
      'text-anchor': 'end',
      transform: `rotate(-35 ${barX + barWidth / 2} ${frame.height - frame.bottom + 20})`,
      class: 'chart-category',
    }, group.category.length > 16 ? `${group.category.slice(0, 15)}…` : group.category);
  });
  const observations = groups.reduce((total, group) => total + group.count, 0);
  setChartTitle(`Mean ${dataset.headers[valueIndex]} by ${dataset.headers[categoryIndex]}`);
  document.querySelector('#chart-observations').textContent = `${observations.toLocaleString()} valid values`;
  document.querySelector('#chart-description').textContent = `Bar chart of mean ${dataset.headers[valueIndex]} across ${groups.length} ${dataset.headers[categoryIndex]} categories. Hover a bar for its count.`;
}

function drawHistogram(valueIndex) {
  const bins = SignalData.histogram(dataset, valueIndex, 10);
  if (bins.length === 0) {
    drawEmptyChart('Choose a numeric column with valid values.');
    return;
  }
  resetChart();
  const frame = { left: 58, right: 24, top: 24, bottom: 58, width: 760, height: 350 };
  const plotWidth = frame.width - frame.left - frame.right;
  const plotHeight = frame.height - frame.top - frame.bottom;
  const maximum = Math.max(...bins.map((bin) => bin.count), 1);
  const slot = plotWidth / bins.length;
  for (let tick = 0; tick <= 4; tick += 1) {
    const count = Math.round(maximum - maximum * tick / 4);
    const position = frame.top + plotHeight * tick / 4;
    appendSvg('line', { x1: frame.left, x2: frame.width - frame.right, y1: position, y2: position, class: 'chart-gridline' });
    appendSvg('text', { x: frame.left - 10, y: position + 4, 'text-anchor': 'end', class: 'chart-tick' }, String(count));
  }
  bins.forEach((bin, index) => {
    const height = bin.count / maximum * plotHeight;
    const bar = appendSvg('rect', {
      x: frame.left + index * slot + 1,
      y: frame.top + plotHeight - height,
      width: Math.max(2, slot - 2),
      height,
      rx: 3,
      class: 'chart-bar positive',
      style: `fill:${paletteColor(0)}`,
    });
    const title = document.createElementNS(svgNamespace, 'title');
    title.textContent = `${compactNumber(bin.start)} to ${compactNumber(bin.end)}: ${bin.count}`;
    bar.append(title);
  });
  appendSvg('text', { x: frame.left, y: frame.height - 24, class: 'chart-category' }, compactNumber(bins[0].start));
  appendSvg('text', { x: frame.width - frame.right, y: frame.height - 24, 'text-anchor': 'end', class: 'chart-category' }, compactNumber(bins.at(-1).end));
  const observations = bins.reduce((total, bin) => total + bin.count, 0);
  setChartTitle(`${dataset.headers[valueIndex]} distribution`);
  document.querySelector('#chart-observations').textContent = `${observations.toLocaleString()} valid values`;
  document.querySelector('#chart-description').textContent = `Histogram of ${observations} valid values from ${dataset.headers[valueIndex]}. Hover a bar for its interval and count.`;
}

function numericExtent(values, includeZero = false) {
  let minimum = Math.min(...values);
  let maximum = Math.max(...values);
  if (includeZero) {
    minimum = Math.min(0, minimum);
    maximum = Math.max(0, maximum);
  }
  if (minimum === maximum) {
    const padding = Math.abs(minimum) * 0.1 || 1;
    return [minimum - padding, maximum + padding];
  }
  const padding = (maximum - minimum) * 0.06;
  return [minimum - padding, maximum + padding];
}

function drawCartesianAxes(xValues, yValues, xLabel, yLabel) {
  const frame = { left: 64, right: 24, top: 24, bottom: 62, width: 760, height: 350 };
  const [xMinimum, xMaximum] = numericExtent(xValues);
  const [yMinimum, yMaximum] = numericExtent(yValues);
  const plotWidth = frame.width - frame.left - frame.right;
  const plotHeight = frame.height - frame.top - frame.bottom;
  const x = (value) => frame.left + (value - xMinimum) / (xMaximum - xMinimum) * plotWidth;
  const y = (value) => frame.top + (yMaximum - value) / (yMaximum - yMinimum) * plotHeight;
  for (let tick = 0; tick <= 4; tick += 1) {
    const yValue = yMaximum - (yMaximum - yMinimum) * tick / 4;
    const yPosition = y(yValue);
    appendSvg('line', { x1: frame.left, x2: frame.width - frame.right, y1: yPosition, y2: yPosition, class: 'chart-gridline' });
    appendSvg('text', { x: frame.left - 10, y: yPosition + 4, 'text-anchor': 'end', class: 'chart-tick' }, compactNumber(yValue));
    const xValue = xMinimum + (xMaximum - xMinimum) * tick / 4;
    appendSvg('text', { x: x(xValue), y: frame.height - frame.bottom + 20, 'text-anchor': 'middle', class: 'chart-tick' }, compactNumber(xValue));
  }
  appendSvg('line', { x1: frame.left, x2: frame.width - frame.right, y1: frame.height - frame.bottom, y2: frame.height - frame.bottom, class: 'chart-baseline' });
  appendSvg('text', { x: frame.left + plotWidth / 2, y: frame.height - 10, 'text-anchor': 'middle', class: 'chart-category' }, xLabel);
  appendSvg('text', { x: 14, y: frame.top + plotHeight / 2, 'text-anchor': 'middle', transform: `rotate(-90 14 ${frame.top + plotHeight / 2})`, class: 'chart-category' }, yLabel);
  return { frame, x, y };
}

function drawPointChart(xIndex, yIndex, categoryIndex, connectPoints = false) {
  const points = SignalData.pairedNumericRows(dataset, xIndex, yIndex, categoryIndex);
  if (points.length === 0) {
    drawEmptyChart('Choose two numeric columns with paired values.');
    return;
  }
  resetChart();
  const axes = drawCartesianAxes(
    points.map((point) => point.x),
    points.map((point) => point.y),
    dataset.headers[xIndex],
    dataset.headers[yIndex],
  );
  const categories = [...new Set(points.map((point) => point.category))];
  const categoryColor = new Map(categories.map((category, index) => [category, paletteColor(index)]));
  if (connectPoints) {
    categories.forEach((category) => {
      const series = points.filter((point) => point.category === category).sort((left, right) => left.x - right.x);
      appendSvg('polyline', {
        points: series.map((point) => `${axes.x(point.x)},${axes.y(point.y)}`).join(' '),
        class: 'chart-line',
        stroke: categoryColor.get(category),
      });
    });
  }
  points.forEach((point) => {
    const circle = appendSvg('circle', {
      cx: axes.x(point.x),
      cy: axes.y(point.y),
      r: connectPoints ? 3.2 : 4.2,
      fill: categoryColor.get(point.category),
      class: 'chart-point',
    });
    const title = document.createElementNS(svgNamespace, 'title');
    title.textContent = `${point.category}: ${dataset.headers[xIndex]} ${compactNumber(point.x)}, ${dataset.headers[yIndex]} ${compactNumber(point.y)}`;
    circle.append(title);
  });
  const kind = connectPoints ? 'Line' : 'Scatter';
  setChartTitle(`${kind}: ${dataset.headers[yIndex]} vs ${dataset.headers[xIndex]}`);
  document.querySelector('#chart-observations').textContent = `${points.length.toLocaleString()} paired values`;
  document.querySelector('#chart-description').textContent = `${kind} plot of ${dataset.headers[yIndex]} against ${dataset.headers[xIndex]}, colored by ${dataset.headers[categoryIndex]}.`;
}

function drawBoxPlot(categoryIndex, valueIndex) {
  const groups = SignalData.boxPlotStats(dataset, categoryIndex, valueIndex);
  if (groups.length === 0) {
    drawEmptyChart('Choose a category and a numeric column with valid values.');
    return;
  }
  resetChart();
  const frame = { left: 62, right: 24, top: 24, bottom: 82, width: 760, height: 350 };
  const values = groups.flatMap((group) => [group.lower, group.upper, ...group.outliers]);
  const [minimum, maximum] = numericExtent(values);
  const plotWidth = frame.width - frame.left - frame.right;
  const plotHeight = frame.height - frame.top - frame.bottom;
  const y = (value) => frame.top + (maximum - value) / (maximum - minimum) * plotHeight;
  for (let tick = 0; tick <= 4; tick += 1) {
    const value = maximum - (maximum - minimum) * tick / 4;
    const position = y(value);
    appendSvg('line', { x1: frame.left, x2: frame.width - frame.right, y1: position, y2: position, class: 'chart-gridline' });
    appendSvg('text', { x: frame.left - 10, y: position + 4, 'text-anchor': 'end', class: 'chart-tick' }, compactNumber(value));
  }
  const slot = plotWidth / groups.length;
  const boxWidth = Math.max(12, Math.min(48, slot * 0.55));
  groups.forEach((group, index) => {
    const center = frame.left + slot * index + slot / 2;
    appendSvg('line', { x1: center, x2: center, y1: y(group.lower), y2: y(group.upper), class: 'box-whisker' });
    appendSvg('line', { x1: center - boxWidth / 3, x2: center + boxWidth / 3, y1: y(group.lower), y2: y(group.lower), class: 'box-whisker' });
    appendSvg('line', { x1: center - boxWidth / 3, x2: center + boxWidth / 3, y1: y(group.upper), y2: y(group.upper), class: 'box-whisker' });
    const box = appendSvg('rect', {
      x: center - boxWidth / 2,
      y: y(group.q3),
      width: boxWidth,
      height: Math.max(1, y(group.q1) - y(group.q3)),
      rx: 4,
      fill: paletteColor(index),
      'fill-opacity': .34,
      stroke: paletteColor(index),
      'stroke-width': 2,
    });
    const title = document.createElementNS(svgNamespace, 'title');
    title.textContent = `${group.category}: n=${group.count}, median ${compactNumber(group.median)}, IQR ${compactNumber(group.q1)}–${compactNumber(group.q3)}`;
    box.append(title);
    appendSvg('line', { x1: center - boxWidth / 2, x2: center + boxWidth / 2, y1: y(group.median), y2: y(group.median), class: 'box-median' });
    group.outliers.forEach((value) => appendSvg('circle', { cx: center, cy: y(value), r: 2.8, fill: paletteColor(index), class: 'chart-point' }));
    appendSvg('text', {
      x: center,
      y: frame.height - frame.bottom + 20,
      'text-anchor': 'end',
      transform: `rotate(-35 ${center} ${frame.height - frame.bottom + 20})`,
      class: 'chart-category',
    }, group.category.length > 16 ? `${group.category.slice(0, 15)}…` : group.category);
  });
  const observations = groups.reduce((total, group) => total + group.count, 0);
  setChartTitle(`${dataset.headers[valueIndex]} by ${dataset.headers[categoryIndex]}`);
  document.querySelector('#chart-observations').textContent = `${observations.toLocaleString()} valid values`;
  document.querySelector('#chart-description').textContent = `Box plot showing medians, interquartile ranges, 1.5×IQR whiskers, and outliers for ${groups.length} groups.`;
}

function drawVolcanoPlot(effectIndex, probabilityIndex) {
  const points = SignalData.volcanoRows(dataset, effectIndex, probabilityIndex);
  if (points.length === 0) {
    drawEmptyChart('Choose a numeric effect column and a p-value column between 0 and 1.');
    return;
  }
  resetChart();
  const effectCutoff = Math.max(0, Number(document.querySelector('#effect-cutoff').value) || 0);
  const probabilityCutoff = Math.min(1, Math.max(Number.MIN_VALUE, Number(document.querySelector('#probability-cutoff').value) || 0.05));
  const axes = drawCartesianAxes(
    points.map((point) => point.effect),
    points.map((point) => point.significance),
    dataset.headers[effectIndex],
    `−log10(${dataset.headers[probabilityIndex]})`,
  );
  let significant = 0;
  points.forEach((point) => {
    const isSignificant = Math.abs(point.effect) >= effectCutoff && point.probability <= probabilityCutoff;
    if (isSignificant) significant += 1;
    const color = isSignificant ? (point.effect >= 0 ? paletteColor(0) : paletteColor(1)) : '#a8afac';
    const circle = appendSvg('circle', { cx: axes.x(point.effect), cy: axes.y(point.significance), r: isSignificant ? 4 : 3, fill: color, class: 'chart-point' });
    const title = document.createElementNS(svgNamespace, 'title');
    title.textContent = `Row ${point.rowIndex + 1}: effect ${compactNumber(point.effect)}, p ${point.probability}`;
    circle.append(title);
  });
  const yCutoff = -Math.log10(probabilityCutoff);
  appendSvg('line', { x1: axes.x(effectCutoff), x2: axes.x(effectCutoff), y1: axes.frame.top, y2: axes.frame.height - axes.frame.bottom, stroke: '#8c6a2d', 'stroke-dasharray': '5 4' });
  appendSvg('line', { x1: axes.x(-effectCutoff), x2: axes.x(-effectCutoff), y1: axes.frame.top, y2: axes.frame.height - axes.frame.bottom, stroke: '#8c6a2d', 'stroke-dasharray': '5 4' });
  appendSvg('line', { x1: axes.frame.left, x2: axes.frame.width - axes.frame.right, y1: axes.y(yCutoff), y2: axes.y(yCutoff), stroke: '#8c6a2d', 'stroke-dasharray': '5 4' });
  setChartTitle(`Volcano: ${dataset.headers[effectIndex]} vs ${dataset.headers[probabilityIndex]}`);
  document.querySelector('#chart-observations').textContent = `${significant}/${points.length} significant`;
  document.querySelector('#chart-description').textContent = `Volcano plot using |effect| ≥ ${effectCutoff} and p ≤ ${probabilityCutoff}. Thresholds are exploratory and adjustable.`;
}

function mixHex(leftHex, rightHex, amount) {
  const parse = (hex) => [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
  const left = parse(leftHex);
  const right = parse(rightHex);
  const values = left.map((value, index) => Math.round(value + (right[index] - value) * amount));
  return `#${values.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function drawHeatmap(labelIndex) {
  const matrix = SignalData.heatmapMatrix(dataset, labelIndex, { scaleRows: true, rowLimit: 40, columnLimit: 30 });
  if (matrix.columns.length === 0 || matrix.rows.length === 0) {
    drawEmptyChart('A heatmap needs a row-label column and at least one numeric column.');
    return;
  }
  resetChart();
  const frame = { left: 126, right: 20, top: 82, bottom: 20, width: 760, height: 350 };
  const plotWidth = frame.width - frame.left - frame.right;
  const plotHeight = frame.height - frame.top - frame.bottom;
  const cellWidth = plotWidth / matrix.columns.length;
  const cellHeight = plotHeight / matrix.rows.length;
  const negativeColor = paletteColor(1);
  const positiveColor = paletteColor(0);
  let validCells = 0;
  matrix.rows.forEach((row, rowIndex) => {
    row.values.forEach((value, columnIndex) => {
      let fill = '#d8d8d2';
      if (value !== null) {
        validCells += 1;
        const normalized = Math.max(-2.5, Math.min(2.5, value)) / 2.5;
        fill = normalized < 0
          ? mixHex('#f7f5ef', negativeColor, Math.abs(normalized))
          : mixHex('#f7f5ef', positiveColor, normalized);
      }
      const cell = appendSvg('rect', {
        x: frame.left + columnIndex * cellWidth,
        y: frame.top + rowIndex * cellHeight,
        width: Math.max(1, cellWidth - .6),
        height: Math.max(1, cellHeight - .6),
        fill,
      });
      const title = document.createElementNS(svgNamespace, 'title');
      title.textContent = `${row.label} · ${matrix.columns[columnIndex]}: ${value === null ? 'missing' : compactNumber(value)}${matrix.scaled ? ' z-score' : ''}`;
      cell.append(title);
    });
    if (cellHeight >= 8 || rowIndex % Math.ceil(8 / cellHeight) === 0) {
      appendSvg('text', { x: frame.left - 7, y: frame.top + rowIndex * cellHeight + cellHeight * .72, 'text-anchor': 'end', class: 'chart-tick' }, row.label.length > 17 ? `${row.label.slice(0, 16)}…` : row.label);
    }
  });
  matrix.columns.forEach((column, index) => {
    const x = frame.left + index * cellWidth + cellWidth / 2;
    appendSvg('text', { x, y: frame.top - 8, 'text-anchor': 'start', transform: `rotate(-45 ${x} ${frame.top - 8})`, class: 'chart-category' }, column.length > 15 ? `${column.slice(0, 14)}…` : column);
  });
  setChartTitle(`Row-scaled heatmap by ${dataset.headers[labelIndex]}`);
  document.querySelector('#chart-observations').textContent = `${validCells.toLocaleString()} cells`;
  document.querySelector('#chart-description').textContent = `Heatmap of the first ${matrix.rows.length} rows and ${matrix.columns.length} numeric columns. Values are z-scored within each row; missing cells are gray.`;
}

function renderChart() {
  const mode = chartMode.value;
  document.querySelectorAll('.volcano-only').forEach((element) => {
    element.hidden = mode !== 'volcano';
  });
  const valueIndex = Number(valueSelect.value);
  const xIndex = Number(xSelect.value);
  const categoryIndex = Number(categorySelect.value);
  if (valueSelect.disabled || !Number.isInteger(valueIndex) || !Number.isInteger(xIndex)) {
    drawEmptyChart('No numeric column was detected. Edit values or upload another table.');
    return;
  }
  if (mode === 'histogram') drawHistogram(valueIndex);
  else if (mode === 'box') drawBoxPlot(categoryIndex, valueIndex);
  else if (mode === 'scatter') drawPointChart(xIndex, valueIndex, categoryIndex, false);
  else if (mode === 'line') drawPointChart(xIndex, valueIndex, categoryIndex, true);
  else if (mode === 'volcano') drawVolcanoPlot(xIndex, valueIndex);
  else if (mode === 'heatmap') drawHeatmap(categoryIndex);
  else drawMeanChart(categoryIndex, valueIndex);
}

function chooseColumn(pattern, select) {
  const index = dataset.headers.findIndex((header) => pattern.test(header));
  if (index >= 0 && [...select.options].some((option) => Number(option.value) === index)) {
    select.value = String(index);
  }
}

function handleChartModeChange() {
  if (chartMode.value === 'volcano') {
    chooseColumn(/log2.*(?:fold|fc)|effect|estimate/i, xSelect);
    chooseColumn(/^p$|p[._ -]?value|pvalue|padj|fdr/i, valueSelect);
  } else if (chartMode.value === 'heatmap') {
    chooseColumn(/feature|gene|protein|metabolite|id|name/i, categorySelect);
  }
  renderChart();
}

function filteredRowIndexes() {
  const query = tableFilter.value.trim().toLowerCase();
  return dataset.rows.flatMap((row, index) =>
    !query || row.some((value) => String(value).toLowerCase().includes(query)) ? [index] : []
  );
}

function renderDataTable() {
  tableHead.replaceChildren();
  tableBody.replaceChildren();
  const headerRow = document.createElement('tr');
  const rowHeader = document.createElement('th');
  rowHeader.scope = 'col';
  rowHeader.textContent = 'Row';
  headerRow.append(rowHeader);
  dataset.headers.forEach((header) => {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = header;
    headerRow.append(cell);
  });
  const actionHeader = document.createElement('th');
  actionHeader.scope = 'col';
  actionHeader.textContent = 'Action';
  headerRow.append(actionHeader);
  tableHead.append(headerRow);

  const matches = filteredRowIndexes();
  matches.slice(0, maximumPreviewRows).forEach((rowIndex) => {
    const rowElement = document.createElement('tr');
    const indexCell = document.createElement('th');
    indexCell.scope = 'row';
    indexCell.textContent = String(rowIndex + 1);
    rowElement.append(indexCell);
    dataset.headers.forEach((header, columnIndex) => {
      const cell = document.createElement('td');
      const input = document.createElement('input');
      input.type = 'text';
      input.value = dataset.rows[rowIndex][columnIndex] ?? '';
      input.setAttribute('aria-label', `${header}, row ${rowIndex + 1}`);
      input.addEventListener('input', () => {
        dataset.rows[rowIndex][columnIndex] = input.value;
        renderDataSummary();
        renderChart();
      });
      cell.append(input);
      rowElement.append(cell);
    });
    const actionCell = document.createElement('td');
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-row';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove row ${rowIndex + 1}`);
    remove.addEventListener('click', () => {
      dataset.rows.splice(rowIndex, 1);
      renderDashboard(false);
    });
    actionCell.append(remove);
    rowElement.append(actionCell);
    tableBody.append(rowElement);
  });
  document.querySelector('#preview-count').textContent = `${matches.length.toLocaleString()} matching rows`;
  document.querySelector('#table-note').textContent = matches.length > maximumPreviewRows
    ? `Showing the first ${maximumPreviewRows} matching rows. Filter to edit another row.`
    : 'Edit any visible cell. The dashboard recalculates immediately.';
}

function renderDashboard(resetControls = true) {
  if (resetControls) populateDashboardControls();
  renderDataSummary();
  renderChart();
  renderDataTable();
}

async function loadUploadedFile(file) {
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) {
    setDatasetMessage('Choose a file smaller than 8 MB for responsive browser analysis.', true);
    return;
  }
  try {
    const parsed = SignalData.parseDelimited(await file.text());
    if (parsed.headers.length > 200 || parsed.rows.length > 25000) {
      throw new Error('Use at most 200 columns and 25,000 rows in this browser workspace.');
    }
    dataset = parsed;
    tableFilter.value = '';
    setDatasetMessage(`${file.name} loaded: ${parsed.rows.length.toLocaleString()} rows. Edit a cell or adjust the chart controls.`);
    renderDashboard();
  } catch (error) {
    setDatasetMessage(error.message || 'The table could not be read.', true);
  }
}

document.querySelector('#dataset-file').addEventListener('change', (event) => loadUploadedFile(event.target.files[0]));
document.querySelector('#load-example').addEventListener('click', () => {
  dataset = SignalData.parseDelimited(exampleTable);
  tableFilter.value = '';
  setDatasetMessage('Synthetic example restored. Upload a CSV or TSV whenever you are ready.');
  renderDashboard();
});
categorySelect.addEventListener('change', renderChart);
xSelect.addEventListener('change', renderChart);
valueSelect.addEventListener('change', renderChart);
chartMode.addEventListener('change', handleChartModeChange);
chartPalette.addEventListener('change', renderChart);
chartTitleInput.addEventListener('input', renderChart);
document.querySelector('#effect-cutoff').addEventListener('input', renderChart);
document.querySelector('#probability-cutoff').addEventListener('input', renderChart);
tableFilter.addEventListener('input', renderDataTable);
document.querySelector('#add-row').addEventListener('click', () => {
  dataset.rows.push(Array(dataset.headers.length).fill(''));
  tableFilter.value = '';
  renderDashboard(false);
  tableBody.querySelector('tr:last-child input')?.focus();
});
document.querySelector('#download-data').addEventListener('click', () => {
  const blob = new Blob([SignalData.serializeDelimited(dataset)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'signal-atlas-cleaned-data.csv';
  link.click();
  URL.revokeObjectURL(url);
});
document.querySelector('#download-chart').addEventListener('click', () => {
  const exported = chart.cloneNode(true);
  exported.setAttribute('xmlns', svgNamespace);
  exported.setAttribute('width', '1520');
  exported.setAttribute('height', '700');
  const title = document.createElementNS(svgNamespace, 'title');
  title.textContent = document.querySelector('#chart-title').textContent;
  exported.insertBefore(title, exported.firstChild);
  const source = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(exported)}`;
  const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `signal-atlas-${chartMode.value}.svg`;
  link.click();
  URL.revokeObjectURL(url);
});
renderDashboard();

const inputIds = ['n1', 'mean1', 'sd1', 'n2', 'mean2', 'sd2'];
const inputValues = () => Object.fromEntries(inputIds.map((id) => [id, Number(document.querySelector(`#${id}`).value)]));
let latestResult = null;

function updateCalculator() {
  const inputs = inputValues();
  const effect = SignalStats.calculateCohensD(inputs);
  const label = SignalStats.classifyEffect(effect);
  const valid = effect !== null && Number.isFinite(effect);
  latestResult = { tool: 'Signal Atlas effect-size calculator', inputs, cohen_d: valid ? Number(effect.toFixed(4)) : null, interpretation: label, notice: 'Exploratory result only. Not a clinical recommendation.' };
  document.querySelector('#result-number').textContent = valid ? effect.toFixed(2) : '—';
  document.querySelector('#result-label').textContent = `${label}${valid ? ' standardized difference' : ''}`;
  document.querySelector('#result-bar').style.width = valid ? `${Math.min(100, Math.abs(effect) / 3 * 100)}%` : '0%';
  document.querySelector('#result-explanation').textContent = valid
    ? `Group A's mean change is ${effect >= 0 ? 'higher' : 'lower'} than Group B's by ${Math.abs(effect).toFixed(2)} pooled standard deviations.`
    : 'Use sample sizes above 1 and standard deviations above 0.';
}

document.querySelector('#effect-form').addEventListener('input', updateCalculator);
document.querySelector('#effect-form').addEventListener('submit', (event) => event.preventDefault());
document.querySelector('#download-result').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(latestResult, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'signal-atlas-result.json';
  link.click();
  URL.revokeObjectURL(url);
});
updateCalculator();
