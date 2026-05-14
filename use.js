// ── USE PAGE ──

let currentScript = null;
let fieldValues = {};

// For universal note: which application sub-script is selected
let universalAppScript = null;

// Application script IDs (all non-universal, non-zelle scripts)
const APP_SCRIPT_IDS = [
  'flag-no-concerns', 'flag-concerns-found', 'identity-review-combined',
  'core-fraud-warning', 'misrouted-chex', 'misrouted-lending', 'misrouted-cr-watch',
  'id-scan-fail-no-concerns-new', 'id-scan-fail-no-concerns-existing',
  'id-scan-fail-concerns', 'id-scan-pass-no-concerns', 'id-scan-pass-concerns',
  'alloy-mismatch-combined', 'alloy-mismatch-confirmed-fraud',
  'alloy-mismatch-confirmed-not-fraud', 'alloy-mismatch-no-answer',
  'no-condition-lo-help'
];

// Hint text for the three universal account review boxes
const UNIVERSAL_HINTS = {
  ISSUE: 'e.g. Mbr calling to get access to OLB',
  ACTION_TAKEN: 'e.g. Reviewed and appears mbr had conversion done 05/12, no reason to keep OLB locked. Unlocked OLB.',
  ADVICE: 'e.g. Advised mbr OLB is now accessible'
};

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
  universalAppScript = null;
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
    // Use textarea for the three universal account body fields for more writing room
    if (UNIVERSAL_HINTS[field.key]) {
      const ta = document.createElement('textarea');
      ta.rows = 3;
      ta.placeholder = field.placeholder || '';
      ta.value = fieldValues[field.key] || '';
      ta.addEventListener('input', () => { fieldValues[field.key] = ta.value; updatePreview(); });
      group.appendChild(ta);

      const hintEl = document.createElement('div');
      hintEl.className = 'hint';
      hintEl.style.marginTop = '4px';
      hintEl.textContent = UNIVERSAL_HINTS[field.key];
      group.appendChild(hintEl);

    } else {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.placeholder = field.placeholder || '';
      inp.value = fieldValues[field.key] || '';
      inp.addEventListener('input', () => { fieldValues[field.key] = inp.value; updatePreview(); });
      group.appendChild(inp);
    }
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
    const styleClass = field.key === 'QUICK_FILL'
                     ? 'branch-btn-neutral'
                     : idx === 0 ? 'branch-btn-safe'
                     : idx === branches.length - 1 ? 'branch-btn-danger'
                     : 'branch-btn-neutral';
    btn.className = 'branch-btn ' + styleClass + (current === branch.value ? ' selected' : '');
    btn.textContent = branch.label;
    btn.addEventListener('click', () => {
      fieldValues[field.key] = branch.value;

      // Quick fill: write pre-set values directly into fieldValues so textareas populate
      if (field.key === 'QUICK_FILL') {
        if (branch.value === 'zelle_linked') {
          fieldValues['ISSUE'] = 'Mbr calling with issues related to Zelle. Issue: linked analysis block.';
          fieldValues['ACTION_TAKEN'] = 'Reviewed and removed linked analysis block.';
          fieldValues['ADVICE'] = 'Advised agent to assist mbr with removing payees.';
        } else if (branch.value === 'custom') {
          // Clear pre-fills so agent starts fresh
          delete fieldValues['ISSUE'];
          delete fieldValues['ACTION_TAKEN'];
          delete fieldValues['ADVICE'];
        }
      }

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

  // Universal note: when Application Review is selected, show inline app script picker
  if (field.key === 'CALL_TYPE' && current === 'application') {
    group.appendChild(renderAppSubPicker());
  }
}

// ── APPLICATION SUB-PICKER (universal note only) ──
function renderAppSubPicker() {
  const wrap = document.createElement('div');
  wrap.className = 'branch-children';
  wrap.style.marginTop = '10px';

  const lbl = document.createElement('label');
  lbl.textContent = 'Application Script';
  wrap.appendChild(lbl);

  const sel = document.createElement('select');
  sel.innerHTML = '<option value="">— Choose script —</option>';
  const appScripts = AppState.data.scripts.filter(s => APP_SCRIPT_IDS.includes(s.id));
  appScripts.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.title;
    if (universalAppScript && universalAppScript.id === s.id) opt.selected = true;
    sel.appendChild(opt);
  });

  sel.addEventListener('change', () => {
    universalAppScript = AppState.data.scripts.find(s => s.id === sel.value) || null;
    const sig = localStorage.getItem('fraudnotes_signature') || '';
    if (sig && !fieldValues['SIGNATURE']) fieldValues['SIGNATURE'] = sig;
    // Pre-fill LO_NAME from AGENT_INTRO if agent call and not already set
    if (universalAppScript && fieldValues['AGENT_INTRO'] && !fieldValues['LO_NAME']) {
      fieldValues['LO_NAME'] = fieldValues['AGENT_INTRO'];
    }
    renderFields();
    updatePreview();
  });

  wrap.appendChild(sel);

  // Once selected, render sub-script fields below the dropdown
  if (universalAppScript) {
    const divider = document.createElement('div');
    divider.className = 'divider';
    divider.style.margin = '12px 0';
    wrap.appendChild(divider);

    universalAppScript.fields.forEach(f => renderOneField(wrap, f, true));
  }

  return wrap;
}


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

  // Universal note + application path: just the sub-script note, no universal header
  if (currentScript.id === 'universal-note' && fieldValues['CALL_TYPE'] === 'application' && universalAppScript) {
    return resolveTemplate(universalAppScript.template, universalAppScript.fields, 'plain');
  }

  return resolveTemplate(currentScript.template, currentScript.fields, 'plain');
}

function updatePreview() {
  const preview = document.getElementById('preview');
  if (!currentScript) {
    preview.innerHTML = '<span style="color:var(--text-dim);font-style:italic;">Select a script above to see the note preview.</span>';
    return;
  }

  // Universal note + application path: just the sub-script note
  if (currentScript.id === 'universal-note' && fieldValues['CALL_TYPE'] === 'application') {
    if (universalAppScript) {
      preview.innerHTML = resolveTemplate(universalAppScript.template, universalAppScript.fields, 'html');
    } else {
      preview.innerHTML = '<span style="color:var(--text-dim);font-style:italic;">← Select an application script above</span>';
    }
    return;
  }

  preview.innerHTML = resolveTemplate(currentScript.template, currentScript.fields, 'html');
}

// Build just the header line for the universal note
function buildUniversalHeader(mode) {
  const caller = fieldValues['CALLER'];
  const memberName = fieldValues['MEMBER_NAME'] || '';
  const verif = fieldValues['VERIFICATION'] || '';
  const acct = fieldValues['ACCT_NUM'] || '';

  let headerLine = '';
  if (caller === 'agent') {
    const agentIntro = fieldValues['AGENT_INTRO'] || '';
    headerLine = `${agentIntro}, Mbr ${memberName} ${verif} ${acct}`.trim();
  } else if (caller === 'member') {
    const phone = fieldValues['IBC_PHONE'] || '';
    headerLine = `IBC from ${phone}, Mbr ${memberName} ${verif} ${acct}`.trim();
  } else {
    headerLine = `Mbr ${memberName} ${verif} ${acct}`.trim();
  }

  if (mode === 'plain') return headerLine;

  // HTML mode — color filled values green, blanks yellow
  const fmt = (val, label) => val
    ? `<span style="color:var(--green)">${escapeHtml(val)}</span>`
    : `<span class="blank">${escapeHtml(label)}</span>`;

  if (caller === 'agent') {
    const agentIntro = fieldValues['AGENT_INTRO'] || '';
    return fmt(agentIntro, 'Agent Name / Dept') + ', Mbr ' +
      fmt(memberName, 'Member Name') + ' ' +
      fmt(verif, 'Verification') + ' ' +
      fmt(acct, 'Account Number');
  } else if (caller === 'member') {
    const phone = fieldValues['IBC_PHONE'] || '';
    return 'IBC from ' + fmt(phone, 'Phone Number') + ', Mbr ' +
      fmt(memberName, 'Member Name') + ' ' +
      fmt(verif, 'Verification') + ' ' +
      fmt(acct, 'Account Number');
  }
  return 'Mbr ' + fmt(memberName, 'Member Name') + ' ' + fmt(verif, 'Verification') + ' ' + fmt(acct, 'Account Number');
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
  universalAppScript = null;
  renderFields();
  updatePreview();
}

document.addEventListener('DOMContentLoaded', async () => {
  setActiveNav();
  await loadScripts();
  initUsePage();
});
