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
    const group = document.createElement('div');
    group.className = 'field-group';

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
      field.options.forEach(opt => {
        const chip = document.createElement('button');
        chip.className = 'chip' + (fieldValues[field.key] === opt ? ' selected' : '');
        chip.textContent = opt;
        chip.addEventListener('click', () => {
          // toggle — click same chip to deselect
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
    }

    container.appendChild(group);
  });
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

// ── BUILD FINAL NOTE TEXT ──
function buildNote() {
  if (!currentScript) return '';
  let text = currentScript.template;

  currentScript.fields.forEach(field => {
    const placeholder = `{{${field.key}}}`;
    let val = '';

    if (field.type === 'closing') {
      const arr = fieldValues[field.key] || [];
      val = arr.length ? '(' + arr.join(', ') + ')' : '';
    } else if (field.type === 'systems') {
      const arr = fieldValues[field.key] || [];
      val = arr.join(', ');
    } else {
      val = fieldValues[field.key] || '';
    }

    text = text.split(placeholder).join(val);
  });

  return text;
}

// ── LIVE PREVIEW ──
function updatePreview() {
  const preview = document.getElementById('preview');
  if (!currentScript) {
    preview.innerHTML = '<span style="color:var(--text-dim);font-style:italic;">Select a script above to see the note preview.</span>';
    return;
  }

  let text = currentScript.template;

  currentScript.fields.forEach(field => {
    const placeholder = `{{${field.key}}}`;
    let val;

    if (field.type === 'closing') {
      const arr = fieldValues[field.key] || [];
      val = arr.length ? '(' + arr.join(', ') + ')' : null;
    } else if (field.type === 'systems') {
      const arr = fieldValues[field.key] || [];
      val = arr.length ? arr.join(', ') : null;
    } else {
      val = fieldValues[field.key] || null;
    }

    if (val) {
      text = text.split(placeholder).join(`<span style="color:var(--green)">${escapeHtml(val)}</span>`);
    } else {
      const labelText = field.label;
      text = text.split(placeholder).join(`<span class="blank">${escapeHtml(labelText)}</span>`);
    }
  });

  preview.innerHTML = text;
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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
