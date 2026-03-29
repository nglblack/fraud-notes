// ── CREATE PAGE ──

let editingScript = null;
let editingFields = [];

function initCreatePage() {
  renderScriptList();
  renderClosingChipEditor();
  renderSystemsEditor();

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
  document.getElementById('btn-reset-storage').addEventListener('click', onResetStorage);
  document.getElementById('btn-add-closing').addEventListener('click', onAddClosingAction);
  document.getElementById('btn-add-system').addEventListener('click', onAddSystemEntry);

  // Live preview while editing template
  document.getElementById('edit-template').addEventListener('input', renderEditorPreview);
}

// ── AUTO-SAVE HELPER ──
function autosave() {
  saveToStorage();
}

// ── SYSTEMS REVIEWED EDITOR ──
function renderSystemsEditor() {
  const systems = AppState.data.systemsReviewed || [];
  const container = document.getElementById('systems-chips-editor');
  container.innerHTML = '';
  if (!systems.length) {
    container.innerHTML = '<div class="hint" style="padding:4px 0">No systems yet. Click Add to create one.</div>';
    return;
  }
  systems.forEach((s, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'chip-editor-row';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.value = s;
    inp.addEventListener('input', () => {
      AppState.data.systemsReviewed[i] = inp.value;
      autosave();
    });
    const btn = document.createElement('button');
    btn.className = 'btn btn-danger btn-sm';
    btn.innerHTML = Icons.trash;
    btn.title = 'Remove';
    btn.addEventListener('click', () => {
      AppState.data.systemsReviewed.splice(i, 1);
      autosave();
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
  autosave();
  renderSystemsEditor();
}

// ── CLOSING ACTIONS EDITOR ──
function renderClosingChipEditor() {
  const actions = AppState.data.closingActions || [];
  const container = document.getElementById('closing-chips-editor');
  container.innerHTML = '';
  if (!actions.length) {
    container.innerHTML = '<div class="hint" style="padding:4px 0">No closing actions yet. Click Add to create one.</div>';
    return;
  }
  actions.forEach((action, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'chip-editor-row';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.value = action;
    inp.addEventListener('input', () => {
      AppState.data.closingActions[i] = inp.value;
      autosave();
    });
    const btn = document.createElement('button');
    btn.className = 'btn btn-danger btn-sm';
    btn.innerHTML = Icons.trash;
    btn.title = 'Remove';
    btn.addEventListener('click', () => {
      AppState.data.closingActions.splice(i, 1);
      autosave();
      renderClosingChipEditor();
    });
    wrap.appendChild(inp);
    wrap.appendChild(btn);
    container.appendChild(wrap);
  });
}

function onAddClosingAction() {
  if (!AppState.data.closingActions) AppState.data.closingActions = [];
  AppState.data.closingActions.push('New Action');
  autosave();
  renderClosingChipEditor();
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
  scripts.forEach((s, idx) => {
    const item = document.createElement('div');
    item.className = 'script-item' + (editingScript && editingScript.id === s.id ? ' active' : '');

    const info = document.createElement('div');
    info.style.cssText = 'flex:1;min-width:0;cursor:pointer';
    info.innerHTML = `<span class="script-item-title">${escapeHtml(s.title)}</span><span class="script-item-count">${s.fields.length} field${s.fields.length !== 1 ? 's' : ''}</span>`;
    info.addEventListener('click', () => onEditScript(s));

    // Reorder buttons
    const reorderWrap = document.createElement('div');
    reorderWrap.className = 'row';
    reorderWrap.style.gap = '2px';
    reorderWrap.style.flexShrink = '0';

    const btnUp = document.createElement('button');
    btnUp.className = 'btn btn-ghost btn-sm';
    btnUp.innerHTML = Icons.up;
    btnUp.title = 'Move up';
    btnUp.style.padding = '4px 6px';
    btnUp.disabled = idx === 0;
    btnUp.addEventListener('click', (e) => { e.stopPropagation(); moveScript(idx, -1); });

    const btnDown = document.createElement('button');
    btnDown.className = 'btn btn-ghost btn-sm';
    btnDown.innerHTML = Icons.down;
    btnDown.title = 'Move down';
    btnDown.style.padding = '4px 6px';
    btnDown.disabled = idx === scripts.length - 1;
    btnDown.addEventListener('click', (e) => { e.stopPropagation(); moveScript(idx, 1); });

    reorderWrap.appendChild(btnUp);
    reorderWrap.appendChild(btnDown);
    item.appendChild(info);
    item.appendChild(reorderWrap);
    list.appendChild(item);
  });
}

function moveScript(idx, dir) {
  const scripts = AppState.data.scripts;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= scripts.length) return;
  [scripts[idx], scripts[newIdx]] = [scripts[newIdx], scripts[idx]];
  autosave();
  renderScriptList();
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
  editingScript = JSON.parse(JSON.stringify(s));
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
  document.getElementById('editor-heading').textContent = isExisting ? 'Edit Script' : 'New Script';
  renderFieldEditorList();
  renderEditorPreview();
  // Scroll to editor
  setTimeout(() => {
    document.getElementById('editor-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
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
    container.innerHTML = '<div class="hint" style="padding:8px 0">No fields yet. Use <code style="font-family:var(--mono);color:var(--yellow)">{{PLACEHOLDER}}</code> in your template, then add matching fields below.</div>';
    return;
  }
  editingFields.forEach((f, i) => {
    container.appendChild(makeFieldEditorItem(f, i));
  });
}

function makeFieldEditorItem(f, i) {
  const wrap = document.createElement('div');
  wrap.className = 'field-editor-item';

  // ── Left: reorder ──
  const reorder = document.createElement('div');
  reorder.className = 'field-reorder';
  const btnUp = document.createElement('button');
  btnUp.className = 'btn btn-ghost btn-sm';
  btnUp.innerHTML = Icons.up;
  btnUp.title = 'Move up';
  btnUp.style.padding = '3px 5px';
  btnUp.disabled = i === 0;
  btnUp.addEventListener('click', () => { moveField(i, -1); });
  const btnDown = document.createElement('button');
  btnDown.className = 'btn btn-ghost btn-sm';
  btnDown.innerHTML = Icons.down;
  btnDown.title = 'Move down';
  btnDown.style.padding = '3px 5px';
  btnDown.disabled = i === editingFields.length - 1;
  btnDown.addEventListener('click', () => { moveField(i, 1); });
  reorder.appendChild(btnUp);
  reorder.appendChild(btnDown);

  // ── Middle: field info ──
  const info = document.createElement('div');
  info.className = 'field-info';

  // Key row
  const keyRow = document.createElement('div');
  keyRow.className = 'row';
  keyRow.style.marginBottom = '6px';
  const keyLabel = document.createElement('span');
  keyLabel.style.cssText = 'font-size:10px;color:var(--text-dim);white-space:nowrap;font-family:var(--mono)';
  keyLabel.textContent = '{{ }}';
  const keyInp = document.createElement('input');
  keyInp.type = 'text';
  keyInp.value = f.key;
  keyInp.placeholder = 'PLACEHOLDER_KEY';
  keyInp.style.fontFamily = 'var(--mono)';
  keyInp.style.fontSize = '11px';
  keyInp.style.flex = '1';
  keyInp.title = 'This matches {{KEY}} in your template';
  keyInp.addEventListener('input', () => {
    editingFields[i].key = keyInp.value.toUpperCase().replace(/\s+/g,'_');
    keyInp.value = editingFields[i].key;
    renderEditorPreview();
  });
  keyRow.appendChild(keyLabel);
  keyRow.appendChild(keyInp);
  info.appendChild(keyRow);

  // Label
  const labelInp = document.createElement('input');
  labelInp.type = 'text';
  labelInp.value = f.label;
  labelInp.placeholder = 'Display label (shown on Use page)';
  labelInp.style.marginBottom = '6px';
  labelInp.addEventListener('input', () => { editingFields[i].label = labelInp.value; renderEditorPreview(); });
  info.appendChild(labelInp);

  // Placeholder text (for text fields)
  if (f.type === 'text' || !f.type) {
    const phInp = document.createElement('input');
    phInp.type = 'text';
    phInp.value = f.placeholder || '';
    phInp.placeholder = 'Hint text shown in input (optional)';
    phInp.style.marginBottom = '6px';
    phInp.style.fontSize = '12px';
    phInp.addEventListener('input', () => { editingFields[i].placeholder = phInp.value; });
    info.appendChild(phInp);
  }

  // Type select
  const typeRow = document.createElement('div');
  typeRow.className = 'row';
  typeRow.style.marginBottom = '4px';
  const typeLbl = document.createElement('span');
  typeLbl.style.cssText = 'font-size:11px;color:var(--text-muted);white-space:nowrap';
  typeLbl.textContent = 'Field type:';

  const typeDescriptions = {
    text: 'text — free-form text input',
    chips: 'chips — pick one option from buttons',
    closing: 'closing — multi-select closing actions',
    systems: 'systems — multi-select systems reviewed'
  };

  const typeSel = document.createElement('select');
  typeSel.style.flex = '1';
  Object.entries(typeDescriptions).forEach(([val, label]) => {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = label;
    if (f.type === val) opt.selected = true;
    typeSel.appendChild(opt);
  });
  typeSel.addEventListener('change', () => {
    editingFields[i].type = typeSel.value;
    if (typeSel.value === 'chips' && !editingFields[i].options) editingFields[i].options = [];
    renderFieldEditorList();
    renderEditorPreview();
  });
  typeRow.appendChild(typeLbl);
  typeRow.appendChild(typeSel);
  info.appendChild(typeRow);

  // Chip options editor
  if (f.type === 'chips') {
    const optSection = document.createElement('div');
    optSection.style.marginTop = '8px';

    const optHeader = document.createElement('div');
    optHeader.className = 'row between';
    optHeader.style.marginBottom = '6px';
    const optLabel = document.createElement('span');
    optLabel.style.cssText = 'font-size:11px;color:var(--text-muted);font-weight:500';
    optLabel.textContent = 'Chip options:';
    const addOptBtn = document.createElement('button');
    addOptBtn.className = 'btn btn-ghost btn-sm';
    addOptBtn.style.cssText = 'font-size:10px;padding:3px 8px';
    addOptBtn.textContent = '+ Add Option';
    addOptBtn.addEventListener('click', () => {
      if (!editingFields[i].options) editingFields[i].options = [];
      editingFields[i].options.push('New option');
      renderFieldEditorList();
    });
    optHeader.appendChild(optLabel);
    optHeader.appendChild(addOptBtn);
    optSection.appendChild(optHeader);

    const optList = document.createElement('div');
    optList.style.display = 'flex';
    optList.style.flexDirection = 'column';
    optList.style.gap = '4px';

    (f.options || []).forEach((opt, oi) => {
      const optRow = document.createElement('div');
      optRow.className = 'chip-editor-row';
      optRow.style.cssText = 'background:var(--surface2);border-radius:var(--radius-sm);padding:4px 6px';
      const optInp = document.createElement('input');
      optInp.type = 'text';
      optInp.value = opt;
      optInp.placeholder = 'Option text...';
      optInp.style.cssText = 'font-size:12px;background:transparent;border:none;padding:2px 4px';
      optInp.addEventListener('input', () => {
        editingFields[i].options[oi] = optInp.value;
        renderEditorPreview();
      });
      optInp.addEventListener('focus', () => optInp.style.background = 'var(--bg)');
      optInp.addEventListener('blur', () => optInp.style.background = 'transparent');

      const delOptBtn = document.createElement('button');
      delOptBtn.className = 'btn btn-danger btn-sm';
      delOptBtn.innerHTML = Icons.trash;
      delOptBtn.style.padding = '3px 5px';
      delOptBtn.title = 'Remove option';
      delOptBtn.addEventListener('click', () => {
        editingFields[i].options.splice(oi, 1);
        renderFieldEditorList();
        renderEditorPreview();
      });
      optRow.appendChild(optInp);
      optRow.appendChild(delOptBtn);
      optList.appendChild(optRow);
    });

    if (!f.options || !f.options.length) {
      optList.innerHTML = '<div class="hint" style="padding:4px">No options yet. Click "+ Add Option" above.</div>';
    }

    optSection.appendChild(optList);
    info.appendChild(optSection);
  }

  wrap.appendChild(reorder);
  wrap.appendChild(info);

  // Delete button
  const del = document.createElement('button');
  del.className = 'btn btn-danger btn-sm';
  del.innerHTML = Icons.trash;
  del.style.alignSelf = 'flex-start';
  del.style.flexShrink = '0';
  del.title = 'Remove field';
  del.addEventListener('click', () => {
    editingFields.splice(i, 1);
    renderFieldEditorList();
    renderEditorPreview();
  });
  wrap.appendChild(del);

  return wrap;
}

function moveField(i, dir) {
  const newI = i + dir;
  if (newI < 0 || newI >= editingFields.length) return;
  [editingFields[i], editingFields[newI]] = [editingFields[newI], editingFields[i]];
  renderFieldEditorList();
}

// ── ADD FIELD ──
function onAddField() {
  editingFields.push({
    key: 'FIELD_' + (editingFields.length + 1),
    label: 'New Field',
    type: 'text',
    placeholder: ''
  });
  renderFieldEditorList();
  renderEditorPreview();
}

// ── LIVE EDITOR PREVIEW ──
function renderEditorPreview() {
  const preview = document.getElementById('editor-preview');
  if (!preview) return;
  const template = document.getElementById('edit-template').value;
  if (!template.trim()) {
    preview.innerHTML = '<span style="color:var(--text-dim);font-style:italic">Template preview will appear here…</span>';
    return;
  }

  let text = escapeHtml(template);
  editingFields.forEach(f => {
    const ph = escapeHtml('{{' + f.key + '}}');
    const label = escapeHtml(f.label || f.key);
    let badge = '';
    if (f.type === 'chips') badge = ' <span style="font-size:9px;background:var(--accent-dim);color:var(--accent);border-radius:3px;padding:1px 4px">chips</span>';
    else if (f.type === 'closing') badge = ' <span style="font-size:9px;background:var(--green-dim);color:var(--green);border-radius:3px;padding:1px 4px">closing</span>';
    else if (f.type === 'systems') badge = ' <span style="font-size:9px;background:var(--yellow-dim);color:var(--yellow);border-radius:3px;padding:1px 4px">systems</span>';
    text = text.split(ph).join(`<span class="blank">${label}${badge}</span>`);
  });
  // Any remaining {{...}} not matched by fields
  text = text.replace(/\{\{([^}]+)\}\}/g, '<span style="color:var(--red);background:rgba(247,111,111,0.1);border-radius:3px;padding:0 3px">{{$1}} ⚠ no field</span>');
  preview.innerHTML = text;
}

// ── SAVE SCRIPT ──
function onSaveScript() {
  const title = document.getElementById('edit-title').value.trim();
  const template = document.getElementById('edit-template').value.trim();

  if (!title) { showToast('Please enter a title', 'error'); return; }
  if (!template) { showToast('Please enter a template', 'error'); return; }

  editingScript.title = title;
  editingScript.template = template;
  editingScript.fields = JSON.parse(JSON.stringify(editingFields));

  const scripts = AppState.data.scripts;
  const idx = scripts.findIndex(s => s.id === editingScript.id);
  if (idx >= 0) scripts[idx] = editingScript;
  else scripts.push(editingScript);

  autosave();
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
  autosave();
  showToast('Deleted', '');
  hideEditor();
}

// ── CANCEL ──
function onCancelEdit() {
  hideEditor();
}

// ── RESET STORAGE ──
function onResetStorage() {
  if (!confirm('This will wipe all locally saved changes and reload from scripts.json. Continue?')) return;
  localStorage.removeItem('fraudnotes_data');
  location.reload();
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
  setActiveNav();
  await loadScripts();
  initCreatePage();
});
