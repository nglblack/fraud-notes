// ── USE PAGE ──

let currentScript = null;
let fieldValues = {}; // key -> value string

function initUsePage() {
  renderScriptSelect();
  document.getElementById('script-select').addEventListener('change', onScriptChange);
  document.getElementById('btn-copy').addEventListener('click', onCopy);
  document.getElementById('btn-clear').addEventListener('click', onClear);
}

// ── POPULATE SELECT ──
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

// ── SCRIPT SELECTED ──
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

  currentScript.fields.forEach(field => {
    renderOneField(container, field);
  });
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
    inp.addEventListener('input', () => {
      fieldValues[field.key] = inp.value;
      updatePreview();
    });
    group.appendChild(inp);

  } else if (field.type === 'chips') {
    const chips = document.createElement('div');
    chips.className = 'chips';
    (field.options || []).forEach(opt => {
      const chip = document.createElement('button');
      chip.className = 'chip' + (fieldValues[field.key] === opt ? ' selected' : '');
      chip.textContent = opt;
      chip.addEventListener('click', () => {
        if (fieldValues[field.key] === opt) {
          delete fieldValues[field.key];
          chip.classList.remove('selected');
        } else {
          fieldValues[field.key] = opt;
          chips.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
          chip.classList.add('selected');
        }
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
    renderBranchField(group, field, container);
  }

  container.appendChild(group);
}

// ── BRANCH FIELD ──
function renderBranchField(group, field, container) {
  const yesLabel = field.yesLabel || 'Yes';
  const noLabel  = field.noLabel  || 'No';
  const current  = fieldValues[field.key]; // 'yes' | 'no' | undefined

  const toggle = document.createElement('div');
  toggle.className = 'branch-toggle';

  const makeBtn = (val, label, isRed) => {
    const btn = document.createElement('button');
    btn.className = 'branch-btn' + (isRed ? ' branch-btn-danger' : ' branch-btn-safe') + (current === val ? ' selected' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      fieldValues[field.key] = val;
      // Re-render so branch children appear/disappear
      const fieldsContainer = document.getElementById('fields-container');
      renderFields();
      updatePreview();
      // Scroll to the newly revealed section
      setTimeout(() => {
        const branchGroup = fieldsContainer.querySelector(`[data-field-key="${field.key}"]`);
        if (branchGroup) branchGroup.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    });
    return btn;
  };

  toggle.appendChild(makeBtn('no',  noLabel,  false));
  toggle.appendChild(makeBtn('yes', yesLabel, true));
  group.appendChild(toggle);

  // Render child fields inline, right after this group, if a branch is selected
  if (current === 'yes' && field.yesFields && field.yesFields.length) {
    const childWrap = document.createElement('div');
    childWrap.className = 'branch-children';
    field.yesFields.forEach(cf => renderOneField(childWrap, cf, true));
    group.appendChild(childWrap);
  } else if (current === 'no' && field.noFields && field.noFields.length) {
    const childWrap = document.createElement('div');
    childWrap.className = 'branch-children';
    field.noFields.forEach(cf => renderOneField(childWrap, cf, true));
    group.appendChild(childWrap);
  }
}

// ── CLOSING ACTIONS FIELD ──
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

// ── SYSTEMS REVIEWED FIELD ──
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

// ── RESOLVE TEMPLATE (shared by buildNote + updatePreview) ──
// mode: 'plain' -> returns text string
// mode: 'html'  -> returns html string with highlights
function resolveTemplate(template, fields, mode) {
  // First handle conditional blocks:
  // {{#IF_KEY=yes}}...{{/IF_KEY}} and {{#IF_KEY=no}}...{{/IF_KEY}}
  let text = template;

  // Process all branch conditionals
  text = text.replace(/\{\{#IF_([A-Z0-9_]+)=(yes|no)\}\}([\s\S]*?)\{\{\/IF_\1\}\}/g, (match, key, val, inner) => {
    return fieldValues[key] === val ? inner : '';
  });

  // Now resolve all {{PLACEHOLDER}} tokens
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
      val = ''; displayVal = null; // branch itself doesn't output text
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

  // Clean up any leftover {{...}} in plain mode
  if (mode === 'plain') {
    text = text.replace(/\{\{[^}]+\}\}/g, '');
  }

  return text;
}

// Flatten nested yesFields/noFields into a single list for placeholder resolution
function collectAllFields(fields) {
  const result = [];
  fields.forEach(f => {
    result.push(f);
    if (f.yesFields) f.yesFields.forEach(cf => result.push(cf));
    if (f.noFields)  f.noFields.forEach(cf => result.push(cf));
  });
  return result;
}

// ── BUILD FINAL NOTE TEXT ──
function buildNote() {
  if (!currentScript) return '';
  return resolveTemplate(currentScript.template, currentScript.fields, 'plain');
}

// ── LIVE PREVIEW ──
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

// ── COPY ──
function onCopy() {
  const note = buildNote();
  if (!note.trim()) { showToast('Nothing to copy', 'error'); return; }
  copyToClipboard(note);
}

// ── CLEAR ──
function onClear() {
  fieldValues = {};
  renderFields();
  updatePreview();
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
  setActiveNav();
  await loadScripts();
  initUsePage();
});
