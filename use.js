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
  if (currentScript) {
    const sig = localStorage.getItem('fraudnotes_signature') || '';
    if (sig) fieldValues['SIGNATURE'] = sig;
  }
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
  } else if (field.type === 'signature') {
    renderSignatureField(group, field.key);
  }

  container.appendChild(group);
}

// ── BRANCH FIELD ──
function normalizeBranches(field) {
  if (field.branches && field.branches.length) return field.branches;
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

  const selected = branches.find(b => b.value === current);
  if (selected && selected.fields && selected.fields.length) {
    const childWrap = document.createElement('div');
    childWrap.className = 'branch-children';
    selected.fields.forEach(cf => renderOneField(childWrap, cf, true));
    group.appendChild(childWrap);
  }
}

// ── SIGNATURE FIELD ──
function renderSignatureField(group, key) {
  const saved = localStorage.getItem('fraudnotes_signature') || '';
  if (!fieldValues[key]) fieldValues[key] = saved;

  const inp = document.createElement('input');
  inp.type = 'text';
  inp.placeholder = 'e.g. AB-2119';
  inp.value = fieldValues[key];

  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.style.marginTop = '5px';
  hint.textContent = 'Auto-saved for this browser — enter once and it will remember you.';

  inp.addEventListener('input', () => {
    fieldValues[key] = inp.value;
    localStorage.setItem('fraudnotes_signature', inp.value);
    updatePreview();
  });

  group.appendChild(inp);
  group.appendChild(hint);
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
      if (f.yesFields) walk(f.yesFields);
      if (f.noFields)  walk(f.noFields);
    });
  }
  walk(fields);
  return result;
}

// ── RESOLVE CALLER_SOURCE to human-readable text ──
function resolveCallerSource(fields) {
  const callerBranch = (fields || []).find(f => f.key === 'CALLER_SOURCE');
  if (!callerBranch || !callerBranch.branches) return null;
  const selected = callerBranch.branches.find(b => b.value === fieldValues['CALLER_SOURCE']);
  if (!selected) return null;
  if (selected.value === 'branch') {
    return fieldValues['BRANCH_DETAIL'] ? 'Branch ' + fieldValues['BRANCH_DETAIL'] : 'Branch';
  }
  if (selected.value === 'other') {
    return fieldValues['CALLER_SOURCE_CUSTOM'] || selected.label;
  }
  return selected.label;
}

// ── RESOLVE TEMPLATE ──
function resolveTemplate(template, fields, mode) {
  let text = template;

  // Handle {{#IF_INCLUDES_SYSTEMS=Some System}}...{{/IF_INCLUDES_SYSTEMS}}
  let prev;
  do {
    prev = text;
    text = text.replace(/\{\{#IF_INCLUDES_SYSTEMS=([^}]+)\}\}([\s\S]*?)\{\{\/IF_INCLUDES_SYSTEMS\}\}/g, (match, systemName, inner) => {
      const selected = fieldValues['SYSTEMS_REVIEWED'] || [];
      return selected.includes(systemName.trim()) ? inner : '';
    });
  } while (text !== prev);

  // Handle {{#IF_KEY=value}}...{{/IF_KEY}}
  do {
    prev = text;
    text = text.replace(/\{\{#IF_([A-Z0-9_]+)=([a-z0-9_]+)\}\}([\s\S]*?)\{\{\/IF_\1\}\}/g, (match, key, val, inner) => {
      return fieldValues[key] === val ? inner : '';
    });
  } while (text !== prev);

  // Resolve ZELLE_FLOW — auto-fills ISSUE, ACTION_TAKEN, ADVICE for linked analysis
  const zelleBranch = (fields || []).find(f => f.key === 'ZELLE_FLOW');
  if (zelleBranch && zelleBranch.branches) {
    const selectedFlow = zelleBranch.branches.find(b => b.value === fieldValues['ZELLE_FLOW']);
    if (selectedFlow && selectedFlow.value === 'linked_analysis') {
      const autoFills = {
        '{{ISSUE}}': 'linked analysis block',
        '{{ACTION_TAKEN}}': 'removed linked analysis block',
        '{{ADVICE}}': 'agent to assist with removing payees',
      };
      Object.entries(autoFills).forEach(([ph, val]) => {
        if (mode === 'plain') {
          text = text.split(ph).join(val);
        } else {
          text = text.split(ph).join(`<span style="color:var(--green)">${escapeHtml(val)}</span>`);
        }
      });
    }
  }

  // Resolve CALLER_SOURCE specially
  const callerSourceText = resolveCallerSource(fields);
  if (callerSourceText !== null) {
    if (mode === 'plain') {
      text = text.split('{{CALLER_SOURCE}}').join(callerSourceText);
    } else {
      text = text.split('{{CALLER_SOURCE}}').join(`<span style="color:var(--green)">${escapeHtml(callerSourceText)}</span>`);
    }
  }

  const allFields = collectAllFields(fields);
  allFields.forEach(field => {
    const placeholder = `{{${field.key}}}`;
    let val, displayVal;

    if (field.key === 'CALLER_SOURCE') return; // already handled above
    if (field.key === 'ZELLE_FLOW') return;     // already handled above

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
    } else if (field.type === 'signature') {
      val = fieldValues[field.key] ? fieldValues[field.key] + '\nFraud Intake Team' : '';
      displayVal = val || null;
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
