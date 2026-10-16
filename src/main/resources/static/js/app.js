const $ = (selector) => document.querySelector(selector);
let analysis = null, traceEvents = [], traceIndex = -1, matrixKind = 'LCS_TABULATION', playback = null, benchmarkRows = [], fastaRecords = [];
const outputExpanded = { matches: false, ops: false };
const OUTPUT_PREVIEW_COUNT = 20;

function showView(id) {
  document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.id === id));
  document.querySelectorAll('nav [data-view]').forEach(tab => {
    const active = tab.dataset.view === id;
    tab.classList.toggle('active', active);
    if (active) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });
  history.replaceState(null, '', `#${id}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
document.querySelectorAll('[data-view]').forEach(tab => tab.addEventListener('click', () => showView(tab.dataset.view)));
const initialView = location.hash.slice(1);
if (document.getElementById(initialView)?.classList.contains('view')) showView(initialView);

function updateInputs() {
  for (const id of ['a', 'b']) {
    const raw = $(`#${id}`).value, normalized = raw.replace(/\s+/g, '').toUpperCase();
    const valid = /^[ACGTRYSWKMBDHVN]*$/.test(normalized) && normalized.length <= 2000;
    $(`#c${id}`).textContent = `${normalized.length} bases`;
    $(`#n${id}`).textContent = normalized || '—';
    $(`#v${id}`).textContent = !normalized ? '○ Awaiting DNA input' : valid ? '✓ Valid DNA input' : normalized.length > 2000 ? '✕ Limit is 2,000 bases' : '✕ Unsupported DNA symbol';
    $(`#v${id}`).classList.toggle('invalid', !valid);
  }
  updateMemoAnalysisLimit();
}
function updateMemoAnalysisLimit() {
  if (!$('#lcsVariant')) return;
  const long = Math.max($('#a').value.replace(/\s+/g, '').length, $('#b').value.replace(/\s+/g, '').length) > 500;
  const lcsMemo = $('#lcsVariant option[value="Memoization"]'), editMemo = $('#editVariant option[value="Memoization"]');
  lcsMemo.disabled = long; editMemo.disabled = long;
  if (long && $('#lcsVariant').value === 'Memoization') $('#lcsVariant').value = 'Full-table DP';
  if (long && $('#editVariant').value === 'Memoization') $('#editVariant').value = 'Full-table DP';
  $('#analysisMemoNotice').textContent = long ? 'Memoization is disabled above 500 bases per strand to protect recursion stack safety.' : 'Memoization is available for sequence pairs up to 500 bases per strand.';
}
['a', 'b'].forEach(id => $(`#${id}`).addEventListener('input', updateInputs));
document.querySelectorAll('[data-clear]').forEach(button => button.addEventListener('click', () => { $(`#${button.dataset.clear}`).value = ''; updateInputs(); }));
const specimens = { classic: ['ACGT', 'ACT'], sub: ['ACGTACGTA', 'ACGTTCGTA'], insert: ['GATTACAGAT', 'GATACAAT'], repeat: ['ATATATATA', 'TATATATAT'] };
document.querySelectorAll('[data-example]').forEach(button => button.addEventListener('click', () => { [$(`#a`).value, $(`#b`).value] = specimens[button.dataset.example]; updateInputs(); }));

function updateFastaSelection() {
  if (!fastaRecords.length) return;
  const i = Number($('#recordA').value), j = Number($('#recordB').value);
  $('#a').value = fastaRecords[i]?.sequence || '';
  $('#b').value = fastaRecords[j]?.sequence || '';
  updateInputs();
}
$('#fasta').addEventListener('change', async event => {
  const file = event.target.files?.[0]; if (!file) return;
  $('#records').textContent = 'Parsing FASTA on the server…';
  try {
    const response = await fetch('/api/fasta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: await file.text() }) });
    const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Could not parse this FASTA file.');
    fastaRecords = body;
    if (body.length < 2) throw new Error('Choose a FASTA file with at least two records to compare.');
    const options = body.map((record, index) => `<option value="${index}">${escapeHtml(record.header || `Record ${index + 1}`)} · ${record.sequence.length} bases</option>`).join('');
    $('#records').innerHTML = `<label>Sequence A record<select id="recordA">${options}</select></label><label>Sequence B record<select id="recordB">${options}</select></label><small>${body.length} records parsed · headers preserved</small>`;
    $('#recordA').value = '0'; $('#recordB').value = '1';
    $('#recordA').addEventListener('change', updateFastaSelection); $('#recordB').addEventListener('change', updateFastaSelection); updateFastaSelection();
  } catch (error) { $('#records').innerHTML = `<p class="error-note">${escapeHtml(error.message)}</p>`; }
});
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }

function variantValue(select) { return ({ 'Full-table DP': 'TABULATION', 'Memoization': 'MEMOIZATION', 'Rolling rows': 'ROLLING_ROWS' })[select.value]; }
$('#run').addEventListener('click', async () => {
  clearInterval(playback); playback = null;
  $('#error').textContent = '';
  const button = $('#run');
  const originalLabel = 'Compare sequences <span>→</span>';
  const controls = [...$('#input').querySelectorAll('input, textarea, select, button')]
    .filter(control => control !== button && !control.matches('[data-view]'))
    .map(control => [control, control.disabled]);
  controls.forEach(([control]) => { control.disabled = true; });
  $('#input').setAttribute('aria-busy', 'true');
  $('#runStatus').hidden = false;
  $('#runStatus').classList.remove('is-error');
  $('#runStatus').textContent = 'Sending both sequences to the Java backend…';
  if (analysis) $('#resultState').textContent = 'Previous result · new analysis running';
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.innerHTML = '<span class="spinner" aria-hidden="true"></span> Analyzing…';

  const payload = {
    sequenceA: $('#a').value, sequenceB: $('#b').value,
    includeTrace: $('#trace').checked, includeTables: $('#tables').checked,
    lcsVariant: variantValue($('#lcsVariant')), editVariant: variantValue($('#editVariant'))
  };
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Analysis failed.');
    analysis = body; traceEvents = body.trace || []; traceIndex = -1;
    outputExpanded.matches = false; outputExpanded.ops = false;
    renderAnalysis();
    showView('results');
    $('#runStatus').textContent = 'Analysis complete. The Results dashboard shows the latest server response.';
    $('#resultState').textContent = 'Latest run · verified server result';
  } catch (error) {
    $('#error').textContent = error.message || 'Analysis failed. Please review the input and try again.';
    $('#runStatus').classList.add('is-error');
    $('#runStatus').textContent = 'Analysis failed. Your input has been preserved.';
    if (analysis) $('#resultState').textContent = 'Previous result · latest run failed';
  } finally {
    controls.forEach(([control, wasDisabled]) => { control.disabled = wasDisabled; });
    $('#input').removeAttribute('aria-busy');
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.innerHTML = originalLabel;
  }
});

function summarizeSequence(sequence) {
  return sequence.length <= 34 ? sequence : `${sequence.slice(0, 20)}…${sequence.slice(-10)}`;
}
function renderAnalysis() {
  const a = analysis.sequenceA, b = analysis.sequenceB;
  $('#journeyState').textContent = 'Comparison complete';
  $('#journeyText').textContent = `Sequence A (${a.length} bases) compared with Sequence B (${b.length} bases). All values shown are from this server run.`;
  $('#tiles').innerHTML = `<div><b>Sequence A · ${a.length}</b><p>${[...a].map(char => `<span class="tile">${char}</span>`).join('')}</p></div><div><b>Sequence B · ${b.length}</b><p>${[...b].map(char => `<span class="tile">${char}</span>`).join('')}</p></div>`;
  $('#validation').innerHTML = `<span class="ok">✓</span> Whitespace was removed, lowercase was normalized, IUPAC DNA symbols were validated, and both lengths are within the 2,000 base limit.`;
  $('#lcsName').textContent = `LCS · ${analysis.lcsAlgorithm.replace('_', ' ').toLowerCase()}`;
  $('#editName').textContent = `Edit distance · ${analysis.editAlgorithm.replace('_', ' ').toLowerCase()}`;
  $('#resultState').textContent = 'Latest run · verified server result';
  $('#resultsText').textContent = `Computed for ${a.length} × ${b.length} input bases using ${analysis.lcsAlgorithm} and ${analysis.editAlgorithm}.`;
  $('#resultPair').innerHTML = `<div><span>SEQUENCE A</span><code>${escapeHtml(summarizeSequence(a))}</code><small>${a.length.toLocaleString()} bases</small></div><div><span>SEQUENCE B</span><code>${escapeHtml(summarizeSequence(b))}</code><small>${b.length.toLocaleString()} bases</small></div>`;
  $('#lcsn').textContent = analysis.lcsLength; $('#lcs').textContent = analysis.lcs || '∅';
  $('#lcss').textContent = `${analysis.lcsSimilarity.toFixed(2)}%`; $('#edit').textContent = analysis.editDistance;
  $('#edits').textContent = `${analysis.editSimilarity.toFixed(2)}%`; $('#opcount').textContent = analysis.editOperations.length;
  renderAlignmentOutputs();
  $('#visualState').textContent = analysis.traceAvailable ? 'Trace available' : 'Trace unavailable above 30 bases or not requested';
  drawMatrix();
}
function renderAlignmentOutputs() {
  if (!analysis) return;
  const matches = analysis.matches || [];
  const operations = analysis.editOperations || [];
  const shownMatches = outputExpanded.matches ? matches : matches.slice(0, OUTPUT_PREVIEW_COUNT);
  const shownOperations = outputExpanded.ops ? operations : operations.slice(0, OUTPUT_PREVIEW_COUNT);
  $('#matches').innerHTML = shownMatches.map(item => `<span class="chip match">${escapeHtml(item.nucleotide)} · A[${item.indexA}] / B[${item.indexB}]</span>`).join('') || '<span class="output-empty">No matched positions.</span>';
  $('#ops').innerHTML = shownOperations.map(item => `<span class="chip ${escapeHtml(String(item.type).toLowerCase())}">${escapeHtml(item.type)} ${escapeHtml(item.characterA || '∅')} → ${escapeHtml(item.characterB || '∅')}</span>`).join('') || '<span class="output-empty">No edit operations required.</span>';
  $('#matches').classList.toggle('expanded', outputExpanded.matches);
  $('#ops').classList.toggle('expanded', outputExpanded.ops);
  $('#matchesMeta').textContent = `${matches.length.toLocaleString()} matched positions${matches.length > OUTPUT_PREVIEW_COUNT && !outputExpanded.matches ? ` · showing first ${OUTPUT_PREVIEW_COUNT}` : ''}`;
  $('#opsMeta').textContent = `${operations.length.toLocaleString()} edit operations${operations.length > OUTPUT_PREVIEW_COUNT && !outputExpanded.ops ? ` · showing first ${OUTPUT_PREVIEW_COUNT}` : ''}`;
  $('#toggleMatches').hidden = matches.length <= OUTPUT_PREVIEW_COUNT;
  $('#toggleOps').hidden = operations.length <= OUTPUT_PREVIEW_COUNT;
  $('#toggleMatches').textContent = outputExpanded.matches ? 'Show fewer' : `Show all ${matches.length.toLocaleString()}`;
  $('#toggleOps').textContent = outputExpanded.ops ? 'Show fewer' : `Show all ${operations.length.toLocaleString()}`;
  $('#toggleMatches').setAttribute('aria-expanded', String(outputExpanded.matches));
  $('#toggleOps').setAttribute('aria-expanded', String(outputExpanded.ops));
}

async function copyOutput(value, label) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
    } else {
      const field = document.createElement('textarea');
      field.value = value;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      const copied = document.execCommand('copy');
      field.remove();
      if (!copied) throw new Error('Clipboard access is unavailable in this browser.');
    }
    $('#outputStatus').textContent = `${label} copied to clipboard.`;
  } catch (error) {
    $('#outputStatus').textContent = error.message || `Could not copy ${label.toLowerCase()}.`;
  }
}
$('#toggleMatches').addEventListener('click', () => {
  outputExpanded.matches = !outputExpanded.matches;
  renderAlignmentOutputs();
});
$('#toggleOps').addEventListener('click', () => {
  outputExpanded.ops = !outputExpanded.ops;
  renderAlignmentOutputs();
});
$('#copyMatches').addEventListener('click', () => {
  const text = (analysis?.matches || []).map(item => `${item.nucleotide}\tA[${item.indexA}]\tB[${item.indexB}]`).join('\n') || 'No matched positions.';
  copyOutput(text, 'Matched positions');
});
$('#copyOps').addEventListener('click', () => {
  const text = (analysis?.editOperations || []).map(item => `${item.type}\t${item.characterA || '∅'}\t${item.characterB || '∅'}`).join('\n') || 'No edit operations required.';
  copyOutput(text, 'Edit operations');
});
$('#downloadAnalysis').addEventListener('click', () => {
  if (!analysis) {
    $('#outputStatus').textContent = 'Run a comparison before downloading results.';
    return;
  }
  const content = JSON.stringify({ exportedAt: new Date().toISOString(), results: analysis }, null, 2);
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'dna-analysis-results.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  $('#outputStatus').textContent = 'Results JSON download started.';
});

function selectedEvents() { return traceEvents.filter(event => event.algorithm === matrixKind); }
function drawMatrix() {
  if (!analysis) return;
  const events = selectedEvents(), current = events[traceIndex];
  $('#counter').textContent = events.length ? `${Math.max(0, traceIndex + 1)} / ${events.length}` : 'Trace unavailable';
  const matrixHtml = renderGrid(events, current, traceIndex);
  $('#matrix').innerHTML = matrixHtml; $('#visualMatrix').innerHTML = matrixHtml;
  if (!current) { $('#eventTitle').textContent = events.length ? 'Ready to play' : 'No trace returned'; $('#explain').textContent = events.length ? 'Advance one step to inspect the first cell calculation.' : 'The server omits detailed traces above 30 bases per sequence.'; $('#rule').textContent = '—'; $('#cell').textContent = '—'; $('#value').textContent = '—'; return; }
  $('#eventTitle').textContent = `${current.algorithm.replaceAll('_', ' ')} · step ${traceIndex + 1}`;
  $('#explain').textContent = current.explanation; $('#rule').textContent = current.rule;
  $('#cell').textContent = `[${current.row}, ${current.column}] · ${current.characterA}/${current.characterB}`; $('#value').textContent = current.value;
  $('#visualEvent').textContent = `Cell [${current.row}, ${current.column}] · ${current.rule}`; $('#visualExplain').textContent = current.explanation;
}
function renderGrid(events, current, upto) {
  if (!analysis.traceAvailable) return '<p>Detailed table playback is available up to 30 bases per sequence. The analysis results remain available.</p>';
  const a = analysis.sequenceA, b = analysis.sequenceB, values = new Map();
  events.slice(0, Math.max(0, upto + 1)).forEach(item => values.set(`${item.row}:${item.column}`, item.value));
  if (current) values.set(`${current.row}:${current.column}`, current.value);
  const width = b.length + 2;
  let html = `<div class="grid" style="grid-template-columns:repeat(${width},minmax(23px,1fr))"><span class="cell label"></span><span class="cell label">·</span>${[...b].map(char => `<span class="cell label">${char}</span>`).join('')}`;
  for (let row = 0; row <= a.length; row++) {
    html += `<span class="cell label">${row ? a[row - 1] : '·'}</span>`;
    for (let col = 0; col <= b.length; col++) {
      const value = values.get(`${row}:${col}`), active = current?.row === row && current?.column === col;
      html += `<button class="cell ${row === 0 || col === 0 ? 'base' : value !== undefined ? 'done' : ''} ${active ? 'hit' : ''}" data-cell="${row}:${col}" aria-label="Cell ${row}, ${col}${value === undefined ? ', not computed' : `, value ${value}`}" ${value === undefined ? 'disabled' : ''}>${value ?? ''}</button>`;
    }
  }
  html += '</div>';
  return html;
}
function inspectCell(event) {
  const target = event.target.closest('[data-cell]'); if (!target || !analysis?.traceAvailable) return;
  const [row, col] = target.dataset.cell.split(':').map(Number), events = selectedEvents(), index = events.findIndex(item => item.row === row && item.column === col);
  if (index >= 0) { traceIndex = index; drawMatrix(); }
}
$('#matrix').addEventListener('click', inspectCell); $('#visualMatrix').addEventListener('click', inspectCell);
document.querySelectorAll('.matrixTab').forEach(tab => tab.addEventListener('click', () => {
  matrixKind = tab.dataset.kind; traceIndex = -1;
  document.querySelectorAll('.matrixTab').forEach(item => item.classList.toggle('active', item.dataset.kind === matrixKind)); drawMatrix();
}));
function setTraceIndex(index) { const length = selectedEvents().length; traceIndex = Math.max(-1, Math.min(length - 1, index)); drawMatrix(); }
$('#next').onclick = () => setTraceIndex(traceIndex + 1); $('#prev').onclick = () => setTraceIndex(traceIndex - 1);
$('#restart').onclick = () => { clearInterval(playback); playback = null; $('#play').textContent = '▷ Play'; setTraceIndex(-1); };
$('#end').onclick = $('#complete').onclick = () => setTraceIndex(selectedEvents().length - 1);
$('#play').onclick = () => {
  if (playback) { clearInterval(playback); playback = null; $('#play').textContent = '▷ Play'; return; }
  if (!selectedEvents().length) return;
  if (traceIndex >= selectedEvents().length - 1) traceIndex = -1;
  $('#play').textContent = 'Ⅱ Pause';
  playback = setInterval(() => { if (traceIndex >= selectedEvents().length - 1) { clearInterval(playback); playback = null; $('#play').textContent = '▷ Play'; } else setTraceIndex(traceIndex + 1); }, Math.max(40, 920 - Number($('#speed').value)));
};

$('#benchform').addEventListener('submit', async event => {
  event.preventDefault(); const checks = [...document.querySelectorAll('[data-benchmark-algorithm]')].filter(input => input.checked);
  if (!checks.length) { $('#benchmarkError').textContent = 'Select at least one implementation.'; return; }
  $('#benchmarkError').textContent = ''; $('#bars').textContent = 'Timing Java computations…';
  const button = $('#benchform button[type="submit"]'); button.disabled = true;
  try {
    const response = await fetch('/api/benchmark', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ problem: $('#problem').value, algorithms: checks.map(input => input.value), size: Number($('#size').value), repetitions: Number($('#reps').value), seed: Number($('#seed').value), pattern: $('#pattern').value }) });
    const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Benchmark failed.'); benchmarkRows = body.results; renderBenchmark(body);
  } catch (error) { $('#bars').textContent = error.message; } finally { button.disabled = false; }
});
function renderBenchmark(result) {
  const maximum = Math.max(...result.results.map(row => row.medianMilliseconds), 0.01);
  $('#benchmarkMeta').textContent = `seed ${result.seed} · ${result.repetitions} measured repetitions · ${result.pattern}`;
  $('#bars').innerHTML = result.results.map(row => `<div class="barline"><span>${row.algorithm}</span><div class="bar"><b style="width:${Math.max(1, 100 * row.medianMilliseconds / maximum)}%"></b></div><span>${row.medianMilliseconds} ms · ${row.correct ? 'verified' : 'mismatch'}</span></div>`).join('');
}
$('#csv').onclick = () => {
  if (!benchmarkRows.length) return;
  const csv = 'algorithm,problem,lengthA,lengthB,medianNanoseconds,medianMilliseconds,correct\n' + benchmarkRows.map(row => [row.algorithm, row.problem, row.lengthA, row.lengthB, row.medianNanoseconds, row.medianMilliseconds, row.correct].join(',')).join('\n');
  const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = 'dna-benchmark.csv'; link.click(); URL.revokeObjectURL(link.href);
};
function updateMemoBenchmarkLimit() {
  const correctMemo = [...document.querySelectorAll('[data-benchmark-algorithm]')].find(input => input.value === 'MEMOIZATION');
  if (!correctMemo) return;
  const limited = Number($('#size').value) > 500;
  correctMemo.disabled = limited;
  if (limited) correctMemo.checked = false;
  $('#memoWarning').textContent = limited ? 'Memoization is disabled above 500 bases to protect recursion stack safety.' : 'Recursion benchmark limit: 500 bases per sequence.';
}
$('#size').addEventListener('change', updateMemoBenchmarkLimit);
$('#lcsVariant').addEventListener('change', updateMemoAnalysisLimit);
$('#editVariant').addEventListener('change', updateMemoAnalysisLimit);
updateMemoBenchmarkLimit();
updateInputs();
