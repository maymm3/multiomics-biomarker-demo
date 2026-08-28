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
