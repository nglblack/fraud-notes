// ── USE PAGE ──

let currentScript = null;
let fieldValues = {};

function initUsePage() {
  renderScriptSelect();
  document.getElementById('script-select').addEventListener('change', onScriptChange);
  document.getElementById('btn-copy').addEventListener('click', onCopy);
  document.getElementById('btn-clear').addEventListener('click', onClear);
}

function renderScriptSelect() {
  const sel = document.getElementById('script-select');
  sel.innerHTML = '<option value="">— Choose a script —</option>';
  (AppState.data.scripts || []).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.title;
    sel.appendChild(opt);
  });
}

function onScriptChange(e) {
  const id = e.target.value;
  currentScript = AppState.data.scripts.find(s => s.id === id) || null;
  fieldValues = {};
  renderFields();
  updatePreview();
}

// ── RENDER FIELDS ──
function renderFields() {
  const container = document.getElementById('fields-container');
  const emptyState = document.getElementById('fields-empty');
  if (!currentScript) {
    container.innerHTML = '';
    if (emptyState) emptyState.style.display = '';
    return;
  }
  if (emptyState) emptyState.style.display = 'none';
  container.innerHTML = '';
  currentScript.fields.forEach(field => renderOneField(container, field));
}

function renderOneField(container, field, indented) {
  const group = document.createElement('div');
  group.className = 'field-group' + (indented ? ' field-group-indented' : '');
  group.dataset.fieldKey = field.key;

  const lbl = document.createElement('label');
  lbl.textContent = field.label;
  group.appendChild(lbl);

  if (field.type === 'text') {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.placeholder = field.placeholder || '';
    inp.value = fieldValues[field.key] || '';
    inp.addEventListener('input', () => { fieldValues[field.key] = inp.value; updatePreview(); });
    group.appendChild(inp);

  } else if (field.type === 'chips') {
    const chips = document.createElement('div');
    chips.className = 'chips';
    (field.options || []).forEach(opt => {
      const chip = document.createElement('button');
      chip.className = 'chip' + (fieldValues[field.key] === opt ? ' selected' : '');
      chip.textContent = opt;
      chip.addEventListener('click', () => {
        if (fieldValues[field.key] === opt) { delete fieldValues[field.key]; chip.classList.remove('selected'); }
        else { fieldValues[field.key] = opt; chips.querySelectorAll('.chip').forEach(c => c.classList.remove('selected')); chip.classList.add('selected'); }
        updatePreview();
      });
      chips.appendChild(chip);
    });
    group.appendChild(chips);

  } else if (field.type === 'systems') {
    renderSystemsField(group, field.key);
  } else if (field.type === 'closing') {
    renderClosingField(group, field.key);
  } else if (field.type === 'branch') {
    renderBranchField(group, field);
  }

  container.appendChild(group);
}

// ── BRANCH FIELD ──
// Supports any number of options via field.branches = [{value, label, fields[]}]
// Also backward-compatible with old yes/no format
function normalizeBranches(field) {
  // New format: field.branches = [{value, label, fields}]
  if (field.branches && field.branches.length) return field.branches;
  // Old yes/no format — convert on the fly
  return [
    { value: 'no',  label: field.noLabel  || 'No',  fields: field.noFields  || [] },
    { value: 'yes', label: field.yesLabel || 'Yes', fields: field.yesFields || [] },
  ];
}

function renderBranchField(group, field) {
  const branches = normalizeBranches(field);
  const current  = fieldValues[field.key];

  const toggle = document.createElement('div');
  toggle.className = 'branch-toggle';

  branches.forEach((branch, idx) => {
    const btn = document.createElement('button');
    // First option = safe/green, last = danger/red, middle = neutral
    const styleClass = idx === 0 ? 'branch-btn-safe'
                     : idx === branches.length - 1 ? 'branch-btn-danger'
                     : 'branch-btn-neutral';
    btn.className = 'branch-btn ' + styleClass + (current === branch.value ? ' selected' : '');
    btn.textContent = branch.label;
    btn.addEventListener('click', () => {
      fieldValues[field.key] = branch.value;
      renderFields();
      updatePreview();
      setTimeout(() => {
        const el = document.querySelector(`[data-field-key="${field.key}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    });
    toggle.appendChild(btn);
  });

  group.appendChild(toggle);

  // Show child fields for whichever branch is selected
  const selected = branches.find(b => b.value === current);
  if (selected && selected.fields && selected.fields.length) {
    const childWrap = document.createElement('div');
    childWrap.className = 'branch-children';
    selected.fields.forEach(cf => renderOneField(childWrap, cf, true));
    group.appendChild(childWrap);
  }
}

// ── CLOSING / SYSTEMS FIELDS ──
function renderClosingField(group, key) {
  if (!fieldValues[key]) fieldValues[key] = [];
  const chips = document.createElement('div');
  chips.className = 'chips';
  (AppState.data.closingActions || []).forEach(opt => {
    const chip = document.createElement('button');
    chip.className = 'chip closing' + (fieldValues[key].includes(opt) ? ' selected' : '');
    chip.textContent = opt;
    chip.addEventListener('click', () => {
      const arr = fieldValues[key];
      const idx = arr.indexOf(opt);
      if (idx >= 0) { arr.splice(idx, 1); chip.classList.remove('selected'); }
      else { arr.push(opt); chip.classList.add('selected'); }
      updatePreview();
    });
    chips.appendChild(chip);
  });
  group.appendChild(chips);
}

function renderSystemsField(group, key) {
  if (!fieldValues[key]) fieldValues[key] = [];
  const chips = document.createElement('div');
  chips.className = 'chips';
  (AppState.data.systemsReviewed || []).forEach(opt => {
    const chip = document.createElement('button');
    chip.className = 'chip' + (fieldValues[key].includes(opt) ? ' selected' : '');
    chip.textContent = opt;
    chip.addEventListener('click', () => {
      const arr = fieldValues[key];
      const idx = arr.indexOf(opt);
      if (idx >= 0) { arr.splice(idx, 1); chip.classList.remove('selected'); }
      else { arr.push(opt); chip.classList.add('selected'); }
      updatePreview();
    });
    chips.appendChild(chip);
  });
  group.appendChild(chips);
}

// ── COLLECT ALL FIELDS (flattens all branch children) ──
function collectAllFields(fields) {
  const result = [];
  function walk(arr) {
    (arr || []).forEach(f => {
      result.push(f);
      if (f.branches) f.branches.forEach(b => walk(b.fields));
      // backward compat
      if (f.yesFields) walk(f.yesFields);
      if (f.noFields)  walk(f.noFields);
    });
  }
  walk(fields);
  return result;
}

// ── RESOLVE TEMPLATE ──
function resolveTemplate(template, fields, mode) {
  let text = template;

  // Handle {{#IF_KEY=value}}...{{/IF_KEY}} — resolve repeatedly to handle nested conditionals
  let prev;
  do {
    prev = text;
    text = text.replace(/\{\{#IF_([A-Z0-9_]+)=([a-z0-9_]+)\}\}([\s\S]*?)\{\{\/IF_\1\}\}/g, (match, key, val, inner) => {
      return fieldValues[key] === val ? inner : '';
    });
  } while (text !== prev);

  const allFields = collectAllFields(fields);
  allFields.forEach(field => {
    const placeholder = `{{${field.key}}}`;
    let val, displayVal;

    if (field.type === 'closing') {
      const arr = fieldValues[field.key] || [];
      val = arr.length ? '(' + arr.join(', ') + ')' : '';
      displayVal = val || null;
    } else if (field.type === 'systems') {
      const arr = fieldValues[field.key] || [];
      val = arr.join(', ');
      displayVal = val || null;
    } else if (field.type === 'branch') {
      val = ''; displayVal = null;
    } else {
      val = fieldValues[field.key] || '';
      displayVal = val || null;
    }

    if (mode === 'plain') {
      text = text.split(placeholder).join(val);
    } else {
      if (displayVal) {
        text = text.split(placeholder).join(`<span style="color:var(--green)">${escapeHtml(displayVal)}</span>`);
      } else {
        text = text.split(placeholder).join(`<span class="blank">${escapeHtml(field.label)}</span>`);
      }
    }
  });

  if (mode === 'plain') text = text.replace(/\{\{[^}]+\}\}/g, '');
  return text;
}

function buildNote() {
  if (!currentScript) return '';
  return resolveTemplate(currentScript.template, currentScript.fields, 'plain');
}

function updatePreview() {
  const preview = document.getElementById('preview');
  if (!currentScript) {
    preview.innerHTML = '<span style="color:var(--text-dim);font-style:italic;">Select a script above to see the note preview.</span>';
    return;
  }
  preview.innerHTML = resolveTemplate(currentScript.template, currentScript.fields, 'html');
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function onCopy() {
  const note = buildNote();
  if (!note.trim()) { showToast('Nothing to copy', 'error'); return; }
  copyToClipboard(note);
}

function onClear() {
  fieldValues = {};
  renderFields();
  updatePreview();
}

document.addEventListener('DOMContentLoaded', async () => {
  setActiveNav();
  await loadScripts();
  initUsePage();
});
