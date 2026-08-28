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

const exampleTable = `feature,group,value,timepoint
P001,Persistent,1.82,week12
P001,Persistent,1.55,week12
P001,Persistent,1.46,week12
P001,Transient,0.31,week12
P001,Transient,0.08,week12
P001,Transient,0.17,week12
P007,Persistent,-0.92,week12
P007,Persistent,-1.14,week12
P007,Persistent,-0.83,week12
P007,Transient,0.12,week12
P007,Transient,-0.04,week12
P007,Transient,0.09,week12`;

let dataset = SignalData.parseDelimited(exampleTable);
const tableHead = document.querySelector('#data-table thead');
const tableBody = document.querySelector('#data-table tbody');
const categorySelect = document.querySelector('#category-column');
const valueSelect = document.querySelector('#value-column');
const chartMode = document.querySelector('#chart-mode');
const tableFilter = document.querySelector('#table-filter');
const chart = document.querySelector('#data-chart');
const svgNamespace = 'http://www.w3.org/2000/svg';
const maximumPreviewRows = 100;

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
  valueSelect.replaceChildren();
  numericIndexes.forEach((index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = dataset.headers[index];
    valueSelect.append(option);
  });
  const defaultCategory = dataset.headers.findIndex((_, index) => !numericSet.has(index));
  categorySelect.value = String(defaultCategory >= 0 ? defaultCategory : 0);
  if (numericIndexes.length > 0) valueSelect.value = String(numericIndexes[0]);
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
  chart.replaceChildren();
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
  chart.replaceChildren();
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
  document.querySelector('#chart-title').textContent = `Mean ${dataset.headers[valueIndex]} by ${dataset.headers[categoryIndex]}`;
  document.querySelector('#chart-observations').textContent = `${observations.toLocaleString()} valid values`;
  document.querySelector('#chart-description').textContent = `Bar chart of mean ${dataset.headers[valueIndex]} across ${groups.length} ${dataset.headers[categoryIndex]} categories. Hover a bar for its count.`;
}

function drawHistogram(valueIndex) {
  const bins = SignalData.histogram(dataset, valueIndex, 10);
  if (bins.length === 0) {
    drawEmptyChart('Choose a numeric column with valid values.');
    return;
  }
  chart.replaceChildren();
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
    });
    const title = document.createElementNS(svgNamespace, 'title');
    title.textContent = `${compactNumber(bin.start)} to ${compactNumber(bin.end)}: ${bin.count}`;
    bar.append(title);
  });
  appendSvg('text', { x: frame.left, y: frame.height - 24, class: 'chart-category' }, compactNumber(bins[0].start));
  appendSvg('text', { x: frame.width - frame.right, y: frame.height - 24, 'text-anchor': 'end', class: 'chart-category' }, compactNumber(bins.at(-1).end));
  const observations = bins.reduce((total, bin) => total + bin.count, 0);
  document.querySelector('#chart-title').textContent = `${dataset.headers[valueIndex]} distribution`;
  document.querySelector('#chart-observations').textContent = `${observations.toLocaleString()} valid values`;
  document.querySelector('#chart-description').textContent = `Histogram of ${observations} valid values from ${dataset.headers[valueIndex]}. Hover a bar for its interval and count.`;
}

function renderChart() {
  const valueIndex = Number(valueSelect.value);
  if (valueSelect.disabled || !Number.isInteger(valueIndex)) {
    drawEmptyChart('No numeric column was detected. Edit values or upload another table.');
    return;
  }
  if (chartMode.value === 'histogram') drawHistogram(valueIndex);
  else drawMeanChart(Number(categorySelect.value), valueIndex);
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
valueSelect.addEventListener('change', renderChart);
chartMode.addEventListener('change', renderChart);
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
