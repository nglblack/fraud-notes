// ── CREATE PAGE ──

let editingScript = null; // the script object currently being edited
let editingFields = [];   // working copy of fields
let editingClosingActions = [];

function initCreatePage() {
  renderScriptList();
  renderClosingChipEditor();

  document.getElementById('btn-new-script').addEventListener('click', onNewScript);
  document.getElementById('btn-save-script').addEventListener('click', onSaveScript);
  document.getElementById('btn-delete-script').addEventListener('click', onDeleteScript);
  document.getElementById('btn-cancel-edit').addEventListener('click', onCancelEdit);
  document.getElementById('btn-add-field').addEventListener('click', onAddField);
  document.getElementById('btn-export').addEventListener('click', exportJSON);
  document.getElementById('btn-import').addEventListener('click', () => importJSON(() => {
    editingScript = null;
    editingFields = [];
    renderScriptList();
    renderClosingChipEditor();
    renderSystemsEditor();
    hideEditor();
  }));
  document.getElementById('btn-add-closing').addEventListener('click', onAddClosingAction);
  document.getElementById('btn-add-system').addEventListener('click', onAddSystemEntry);
  document.getElementById('edit-title').addEventListener('input', () => syncTemplateHint());
  renderSystemsEditor();
}

// ── SYSTEMS REVIEWED EDITOR ──
function renderSystemsEditor() {
  const systems = AppState.data.systemsReviewed || [];
  const container = document.getElementById('systems-chips-editor');
  container.innerHTML = '';
  systems.forEach((s, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'row';
    wrap.style.cssText = 'gap:5px;margin-bottom:5px';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.value = s;
    inp.style.flex = '1';
    inp.addEventListener('input', () => { AppState.data.systemsReviewed[i] = inp.value; });
    const btn = document.createElement('button');
    btn.className = 'btn btn-danger btn-sm';
    btn.innerHTML = Icons.trash;
    btn.addEventListener('click', () => {
      AppState.data.systemsReviewed.splice(i, 1);
      renderSystemsEditor();
    });
    wrap.appendChild(inp);
    wrap.appendChild(btn);
    container.appendChild(wrap);
  });
}

function onAddSystemEntry() {
  if (!AppState.data.systemsReviewed) AppState.data.systemsReviewed = [];
  AppState.data.systemsReviewed.push('New System');
  renderSystemsEditor();
}

// ── SCRIPT LIST ──
function renderScriptList() {
  const list = document.getElementById('script-list');
  const scripts = AppState.data.scripts || [];
  list.innerHTML = '';
  if (!scripts.length) {
    list.innerHTML = '<div class="empty-state"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>No scripts yet. Click + New Script.</div>';
    return;
  }
  scripts.forEach(s => {
    const item = document.createElement('div');
    item.className = 'script-item' + (editingScript && editingScript.id === s.id ? ' active' : '');
    item.innerHTML = `<span class="script-item-title">${escapeHtml(s.title)}</span><span class="script-item-count">${s.fields.length} field${s.fields.length !== 1 ? 's' : ''}</span>`;
    item.addEventListener('click', () => onEditScript(s));
    list.appendChild(item);
  });
}

// ── CLOSING ACTION EDITOR ──
function renderClosingChipEditor() {
  editingClosingActions = [...(AppState.data.closingActions || [])];
  const container = document.getElementById('closing-chips-editor');
  container.innerHTML = '';
  editingClosingActions.forEach((action, i) => {
    container.appendChild(makeClosingChipEditorItem(action, i));
  });
}

function makeClosingChipEditorItem(action, i) {
  const wrap = document.createElement('div');
  wrap.className = 'row';
  wrap.style.gap = '5px';
  wrap.style.marginBottom = '5px';
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.value = action;
  inp.style.flex = '1';
  inp.addEventListener('input', () => {
    editingClosingActions[i] = inp.value;
  });
  const btn = document.createElement('button');
  btn.className = 'btn btn-danger btn-sm';
  btn.innerHTML = Icons.trash;
  btn.addEventListener('click', () => {
    editingClosingActions.splice(i, 1);
    AppState.data.closingActions = [...editingClosingActions];
    renderClosingChipEditor();
  });
  wrap.appendChild(inp);
  wrap.appendChild(btn);
  return wrap;
}

function onAddClosingAction() {
  editingClosingActions.push('New Action');
  AppState.data.closingActions = [...editingClosingActions];
  renderClosingChipEditor();
}

function saveClosingActions() {
  // Gather current input values
  const inputs = document.querySelectorAll('#closing-chips-editor input[type="text"]');
  editingClosingActions = Array.from(inputs).map(i => i.value).filter(v => v.trim());
  AppState.data.closingActions = [...editingClosingActions];
}

// ── NEW SCRIPT ──
function onNewScript() {
  editingScript = {
    id: 'script_' + Date.now(),
    title: '',
    template: '',
    fields: []
  };
  editingFields = [];
  showEditor(false);
}

// ── EDIT EXISTING ──
function onEditScript(s) {
  editingScript = JSON.parse(JSON.stringify(s)); // deep copy
  editingFields = [...editingScript.fields];
  showEditor(true);
  renderScriptList();
}

// ── SHOW/HIDE EDITOR ──
function showEditor(isExisting) {
  document.getElementById('editor-section').classList.add('active');
  document.getElementById('edit-title').value = editingScript.title;
  document.getElementById('edit-template').value = editingScript.template;
  document.getElementById('btn-delete-script').style.display = isExisting ? '' : 'none';
  renderFieldEditorList();
  renderScriptList();
}

function hideEditor() {
  document.getElementById('editor-section').classList.remove('active');
  editingScript = null;
  editingFields = [];
  renderScriptList();
}

// ── FIELD EDITOR LIST ──
function renderFieldEditorList() {
  const container = document.getElementById('field-editor-list');
  container.innerHTML = '';
  if (!editingFields.length) {
    container.innerHTML = '<div class="hint" style="padding:8px 0">No fields yet. Use {{PLACEHOLDER}} in your template, then add fields below.</div>';
    return;
  }
  editingFields.forEach((f, i) => {
    container.appendChild(makeFieldEditorItem(f, i));
  });
}

function makeFieldEditorItem(f, i) {
  const wrap = document.createElement('div');
  wrap.className = 'field-editor-item';

  const info = document.createElement('div');
  info.className = 'field-info';

  // Key input
  const keyRow = document.createElement('div');
  keyRow.className = 'row';
  keyRow.style.marginBottom = '6px';
  const keyInp = document.createElement('input');
  keyInp.type = 'text';
  keyInp.value = f.key;
  keyInp.placeholder = 'PLACEHOLDER_KEY';
  keyInp.style.fontFamily = 'var(--mono)';
  keyInp.style.fontSize = '11px';
  keyInp.style.flex = '1';
  keyInp.addEventListener('input', () => { editingFields[i].key = keyInp.value.toUpperCase().replace(/\s+/g,'_'); keyInp.value = editingFields[i].key; });
  const keyLabel = document.createElement('span');
  keyLabel.style.cssText = 'font-size:10px;color:var(--text-dim);white-space:nowrap';
  keyLabel.textContent = '{{  }}';
  keyRow.appendChild(keyLabel);
  keyRow.appendChild(keyInp);
  info.appendChild(keyRow);

  // Label input
  const labelInp = document.createElement('input');
  labelInp.type = 'text';
  labelInp.value = f.label;
  labelInp.placeholder = 'Display label';
  labelInp.style.marginBottom = '6px';
  labelInp.addEventListener('input', () => { editingFields[i].label = labelInp.value; });
  info.appendChild(labelInp);

  // Type select
  const typeRow = document.createElement('div');
  typeRow.className = 'row';
  typeRow.style.marginBottom = '4px';
  const typeLbl = document.createElement('span');
  typeLbl.style.cssText = 'font-size:11px;color:var(--text-dim);white-space:nowrap';
  typeLbl.textContent = 'Type:';
  const typeSel = document.createElement('select');
  typeSel.style.flex = '1';
  ['text','chips','closing','systems'].forEach(t => {
    const opt = document.createElement('option');
    opt.value = t; opt.textContent = t;
    if (f.type === t) opt.selected = true;
    typeSel.appendChild(opt);
  });
  typeSel.addEventListener('change', () => {
    editingFields[i].type = typeSel.value;
    if (typeSel.value === 'chips' && !editingFields[i].options) editingFields[i].options = [];
    renderFieldEditorList();
  });
  typeRow.appendChild(typeLbl);
  typeRow.appendChild(typeSel);
  info.appendChild(typeRow);

  // Options (chips only)
  if (f.type === 'chips') {
    const optLabel = document.createElement('div');
    optLabel.style.cssText = 'font-size:11px;color:var(--text-dim);margin:4px 0 3px';
    optLabel.textContent = 'Options (one per line):';
    info.appendChild(optLabel);
    const optArea = document.createElement('textarea');
    optArea.rows = 3;
    optArea.value = (f.options || []).join('\n');
    optArea.placeholder = 'Option 1\nOption 2\nOption 3';
    optArea.addEventListener('input', () => {
      editingFields[i].options = optArea.value.split('\n').map(l => l.trim()).filter(Boolean);
    });
    info.appendChild(optArea);
  }

  wrap.appendChild(info);

  // Delete button
  const del = document.createElement('button');
  del.className = 'btn btn-danger btn-sm';
  del.innerHTML = Icons.trash;
  del.style.alignSelf = 'flex-start';
  del.addEventListener('click', () => {
    editingFields.splice(i, 1);
    renderFieldEditorList();
  });
  wrap.appendChild(del);

  return wrap;
}

// ── ADD FIELD ──
function onAddField() {
  editingFields.push({ key: 'FIELD_' + (editingFields.length + 1), label: 'New Field', type: 'text', placeholder: '' });
  renderFieldEditorList();
}

// ── SAVE SCRIPT ──
function onSaveScript() {
  saveClosingActions();

  const title = document.getElementById('edit-title').value.trim();
  const template = document.getElementById('edit-template').value.trim();

  if (!title) { showToast('Please enter a title', 'error'); return; }
  if (!template) { showToast('Please enter a template', 'error'); return; }

  editingScript.title = title;
  editingScript.template = template;
  editingScript.fields = editingFields;

  const scripts = AppState.data.scripts;
  const idx = scripts.findIndex(s => s.id === editingScript.id);
  if (idx >= 0) scripts[idx] = editingScript;
  else scripts.push(editingScript);

  showToast('Script saved ✓', 'success');
  hideEditor();
}

// ── DELETE SCRIPT ──
function onDeleteScript() {
  if (!editingScript) return;
  if (!confirm(`Delete "${editingScript.title}"?`)) return;
  const scripts = AppState.data.scripts;
  const idx = scripts.findIndex(s => s.id === editingScript.id);
  if (idx >= 0) scripts.splice(idx, 1);
  showToast('Deleted', '');
  hideEditor();
}

// ── CANCEL ──
function onCancelEdit() {
  hideEditor();
}

// ── TEMPLATE HINT ──
function syncTemplateHint() { /* placeholder for future live hint */ }

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
  setActiveNav();
  await loadScripts();
  initCreatePage();
});
