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
  document.getElementById('edit-template').addEventListener('input', renderEditorPreview);
}

function autosave() { saveToStorage(); }

// ── SYSTEMS EDITOR ──
function renderSystemsEditor() {
  const systems = AppState.data.systemsReviewed || [];
  const container = document.getElementById('systems-chips-editor');
  container.innerHTML = '';
  if (!systems.length) {
    container.innerHTML = '<div class="hint" style="padding:4px 0">No systems yet.</div>';
    return;
  }
  systems.forEach((s, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'chip-editor-row';
    const inp = document.createElement('input'); inp.type = 'text'; inp.value = s;
    inp.addEventListener('input', () => { AppState.data.systemsReviewed[i] = inp.value; autosave(); });
    const btn = document.createElement('button');
    btn.className = 'btn btn-danger btn-sm'; btn.innerHTML = Icons.trash;
    btn.addEventListener('click', () => { AppState.data.systemsReviewed.splice(i, 1); autosave(); renderSystemsEditor(); });
    wrap.appendChild(inp); wrap.appendChild(btn);
    container.appendChild(wrap);
  });
}

function onAddSystemEntry() {
  if (!AppState.data.systemsReviewed) AppState.data.systemsReviewed = [];
  AppState.data.systemsReviewed.push('New System');
  autosave(); renderSystemsEditor();
}

// ── CLOSING EDITOR ──
function renderClosingChipEditor() {
  const actions = AppState.data.closingActions || [];
  const container = document.getElementById('closing-chips-editor');
  container.innerHTML = '';
  if (!actions.length) {
    container.innerHTML = '<div class="hint" style="padding:4px 0">No closing actions yet.</div>';
    return;
  }
  actions.forEach((action, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'chip-editor-row';
    const inp = document.createElement('input'); inp.type = 'text'; inp.value = action;
    inp.addEventListener('input', () => { AppState.data.closingActions[i] = inp.value; autosave(); });
    const btn = document.createElement('button');
    btn.className = 'btn btn-danger btn-sm'; btn.innerHTML = Icons.trash;
    btn.addEventListener('click', () => { AppState.data.closingActions.splice(i, 1); autosave(); renderClosingChipEditor(); });
    wrap.appendChild(inp); wrap.appendChild(btn);
    container.appendChild(wrap);
  });
}

function onAddClosingAction() {
  if (!AppState.data.closingActions) AppState.data.closingActions = [];
  AppState.data.closingActions.push('New Action');
  autosave(); renderClosingChipEditor();
}

// ── SCRIPT LIST ──
function renderScriptList() {
  const list = document.getElementById('script-list');
  const scripts = AppState.data.scripts || [];
  list.innerHTML = '';
  if (!scripts.length) {
    list.innerHTML = '<div class="empty-state"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>No scripts yet.</div>';
    return;
  }
  scripts.forEach((s, idx) => {
    const item = document.createElement('div');
    item.className = 'script-item' + (editingScript && editingScript.id === s.id ? ' active' : '');
    const info = document.createElement('div');
    info.style.cssText = 'flex:1;min-width:0;cursor:pointer';
    info.innerHTML = `<span class="script-item-title">${escapeHtml(s.title)}</span><span class="script-item-count">${s.fields.length} field${s.fields.length !== 1 ? 's' : ''}</span>`;
    info.addEventListener('click', () => onEditScript(s));
    const reorderWrap = document.createElement('div');
    reorderWrap.className = 'row'; reorderWrap.style.gap = '2px'; reorderWrap.style.flexShrink = '0';
    const btnUp = document.createElement('button');
    btnUp.className = 'btn btn-ghost btn-sm'; btnUp.innerHTML = Icons.up; btnUp.title = 'Move up';
    btnUp.style.padding = '4px 6px'; btnUp.disabled = idx === 0;
    btnUp.addEventListener('click', e => { e.stopPropagation(); moveScript(idx, -1); });
    const btnDown = document.createElement('button');
    btnDown.className = 'btn btn-ghost btn-sm'; btnDown.innerHTML = Icons.down; btnDown.title = 'Move down';
    btnDown.style.padding = '4px 6px'; btnDown.disabled = idx === scripts.length - 1;
    btnDown.addEventListener('click', e => { e.stopPropagation(); moveScript(idx, 1); });
    reorderWrap.appendChild(btnUp); reorderWrap.appendChild(btnDown);
    item.appendChild(info); item.appendChild(reorderWrap);
    list.appendChild(item);
  });
}

function moveScript(idx, dir) {
  const s = AppState.data.scripts;
  const ni = idx + dir;
  if (ni < 0 || ni >= s.length) return;
  [s[idx], s[ni]] = [s[ni], s[idx]];
  autosave(); renderScriptList();
}

// ── NEW / EDIT ──
function onNewScript() {
  editingScript = { id: 'script_' + Date.now(), title: '', template: '', fields: [] };
  editingFields = [];
  showEditor(false);
}

function onEditScript(s) {
  editingScript = JSON.parse(JSON.stringify(s));
  editingFields = editingScript.fields;
  showEditor(true);
  renderScriptList();
}

function showEditor(isExisting) {
  document.getElementById('editor-section').classList.add('active');
  document.getElementById('edit-title').value = editingScript.title;
  document.getElementById('edit-template').value = editingScript.template;
  document.getElementById('btn-delete-script').style.display = isExisting ? '' : 'none';
  document.getElementById('editor-heading').textContent = isExisting ? 'Edit Script' : 'New Script';
  renderFieldEditorList();
  renderEditorPreview();
  setTimeout(() => document.getElementById('editor-section').scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
}

function hideEditor() {
  document.getElementById('editor-section').classList.remove('active');
  editingScript = null; editingFields = [];
  renderScriptList();
}

// ── FIELD LIST ──
function renderFieldEditorList() {
  const container = document.getElementById('field-editor-list');
  container.innerHTML = '';
  if (!editingFields.length) {
    container.innerHTML = '<div class="hint" style="padding:8px 0">No fields yet. Add fields below to match your <code style="font-family:var(--mono);color:var(--yellow)">{{PLACEHOLDERS}}</code>.</div>';
    return;
  }
  editingFields.forEach((f, i) => container.appendChild(makeFieldEditorItem(f, i, editingFields, true)));
}

// ── FIELD EDITOR ITEM (recursive for branch children) ──
function makeFieldEditorItem(f, i, parentArray, isTop) {
  const wrap = document.createElement('div');
  wrap.className = 'field-editor-item' + (isTop ? '' : ' field-editor-item-child');

  // Reorder
  const reorder = document.createElement('div');
  reorder.className = 'field-reorder';
  const btnUp = document.createElement('button');
  btnUp.className = 'btn btn-ghost btn-sm'; btnUp.innerHTML = Icons.up; btnUp.style.padding = '3px 5px';
  btnUp.disabled = i === 0;
  btnUp.addEventListener('click', () => { if (i > 0) { [parentArray[i], parentArray[i-1]] = [parentArray[i-1], parentArray[i]]; renderFieldEditorList(); renderEditorPreview(); }});
  const btnDown = document.createElement('button');
  btnDown.className = 'btn btn-ghost btn-sm'; btnDown.innerHTML = Icons.down; btnDown.style.padding = '3px 5px';
  btnDown.disabled = i === parentArray.length - 1;
  btnDown.addEventListener('click', () => { if (i < parentArray.length-1) { [parentArray[i], parentArray[i+1]] = [parentArray[i+1], parentArray[i]]; renderFieldEditorList(); renderEditorPreview(); }});
  reorder.appendChild(btnUp); reorder.appendChild(btnDown);

  // Info
  const info = document.createElement('div');
  info.className = 'field-info';

  // Key
  const keyRow = document.createElement('div');
  keyRow.className = 'row'; keyRow.style.marginBottom = '6px';
  const keyLabel = document.createElement('span');
  keyLabel.style.cssText = 'font-size:10px;color:var(--text-dim);white-space:nowrap;font-family:var(--mono)';
  keyLabel.textContent = '{{ }}';
  const keyInp = document.createElement('input');
  keyInp.type = 'text'; keyInp.value = f.key; keyInp.placeholder = 'KEY';
  keyInp.style.cssText = 'font-family:var(--mono);font-size:11px;flex:1';
  keyInp.addEventListener('input', () => { f.key = keyInp.value.toUpperCase().replace(/\s+/g,'_'); keyInp.value = f.key; renderEditorPreview(); });
  keyRow.appendChild(keyLabel); keyRow.appendChild(keyInp);
  info.appendChild(keyRow);

  // Label
  const labelInp = document.createElement('input');
  labelInp.type = 'text'; labelInp.value = f.label || ''; labelInp.placeholder = 'Display label';
  labelInp.style.marginBottom = '6px';
  labelInp.addEventListener('input', () => { f.label = labelInp.value; renderEditorPreview(); });
  info.appendChild(labelInp);

  // Type
  const typeRow = document.createElement('div');
  typeRow.className = 'row'; typeRow.style.marginBottom = '6px';
  const typeLbl = document.createElement('span');
  typeLbl.style.cssText = 'font-size:11px;color:var(--text-muted);white-space:nowrap';
  typeLbl.textContent = 'Type:';
  const typeSel = document.createElement('select');
  typeSel.style.flex = '1';
  const typeOptions = [
    ['text',    'text — free-form input'],
    ['chips',   'chips — pick one option'],
    ['closing', 'closing — multi-select closing actions'],
    ['systems', 'systems — multi-select systems reviewed'],
    ['branch',  'branch — yes/no reveals extra fields'],
  ];
  typeOptions.forEach(([val, label]) => {
    const opt = document.createElement('option');
    opt.value = val; opt.textContent = label;
    if (f.type === val) opt.selected = true;
    typeSel.appendChild(opt);
  });
  typeSel.addEventListener('change', () => {
    f.type = typeSel.value;
    if (f.type === 'chips' && !f.options) f.options = [];
    if (f.type === 'branch') {
      if (!f.yesLabel) f.yesLabel = 'Concerns Found';
      if (!f.noLabel)  f.noLabel  = 'No Concerns';
      if (!f.yesFields) f.yesFields = [];
      if (!f.noFields)  f.noFields  = [];
    }
    renderFieldEditorList(); renderEditorPreview();
  });
  typeRow.appendChild(typeLbl); typeRow.appendChild(typeSel);
  info.appendChild(typeRow);

  // Placeholder (text only)
  if (f.type === 'text') {
    const phInp = document.createElement('input');
    phInp.type = 'text'; phInp.value = f.placeholder || ''; phInp.placeholder = 'Hint text in input (optional)';
    phInp.style.cssText = 'margin-bottom:6px;font-size:12px';
    phInp.addEventListener('input', () => f.placeholder = phInp.value);
    info.appendChild(phInp);
  }

  // Chips options
  if (f.type === 'chips') {
    info.appendChild(makeChipsOptionsEditor(f));
  }

  // Branch editor
  if (f.type === 'branch') {
    info.appendChild(makeBranchEditor(f));
  }

  wrap.appendChild(reorder);
  wrap.appendChild(info);

  const del = document.createElement('button');
  del.className = 'btn btn-danger btn-sm'; del.innerHTML = Icons.trash;
  del.style.cssText = 'align-self:flex-start;flex-shrink:0';
  del.title = 'Remove field';
  del.addEventListener('click', () => { parentArray.splice(i, 1); renderFieldEditorList(); renderEditorPreview(); });
  wrap.appendChild(del);

  return wrap;
}

// ── CHIPS OPTIONS EDITOR ──
function makeChipsOptionsEditor(f) {
  const section = document.createElement('div');
  section.style.marginTop = '4px';
  const header = document.createElement('div');
  header.className = 'row between'; header.style.marginBottom = '6px';
  const lbl = document.createElement('span');
  lbl.style.cssText = 'font-size:11px;color:var(--text-muted);font-weight:500';
  lbl.textContent = 'Chip options:';
  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-ghost btn-sm';
  addBtn.style.cssText = 'font-size:10px;padding:3px 8px';
  addBtn.textContent = '+ Add Option';
  addBtn.addEventListener('click', () => { f.options.push('New option'); renderFieldEditorList(); });
  header.appendChild(lbl); header.appendChild(addBtn);
  section.appendChild(header);
  const list = document.createElement('div');
  list.style.cssText = 'display:flex;flex-direction:column;gap:4px';
  (f.options || []).forEach((opt, oi) => {
    const row = document.createElement('div');
    row.className = 'chip-editor-row';
    row.style.cssText = 'background:var(--surface2);border-radius:var(--radius-sm);padding:4px 6px';
    const inp = document.createElement('input');
    inp.type = 'text'; inp.value = opt; inp.placeholder = 'Option text';
    inp.style.cssText = 'font-size:12px;background:transparent;border:none;padding:2px 4px';
    inp.addEventListener('input', () => { f.options[oi] = inp.value; renderEditorPreview(); });
    inp.addEventListener('focus', () => inp.style.background = 'var(--bg)');
    inp.addEventListener('blur',  () => inp.style.background = 'transparent');
    const del = document.createElement('button');
    del.className = 'btn btn-danger btn-sm'; del.innerHTML = Icons.trash; del.style.padding = '3px 5px';
    del.addEventListener('click', () => { f.options.splice(oi, 1); renderFieldEditorList(); renderEditorPreview(); });
    row.appendChild(inp); row.appendChild(del);
    list.appendChild(row);
  });
  if (!f.options || !f.options.length) {
    list.innerHTML = '<div class="hint" style="padding:4px">No options yet. Click "+ Add Option".</div>';
  }
  section.appendChild(list);
  return section;
}

// ── BRANCH EDITOR ──
function makeBranchEditor(f) {
  const section = document.createElement('div');
  section.style.marginTop = '6px';

  // Button label row
  const labelRow = document.createElement('div');
  labelRow.className = 'row';
  labelRow.style.cssText = 'gap:8px;margin-bottom:10px';

  const noLabelWrap = document.createElement('div');
  noLabelWrap.style.flex = '1';
  const noLabelLbl = document.createElement('div');
  noLabelLbl.style.cssText = 'font-size:10px;color:var(--green);margin-bottom:3px;font-weight:500';
  noLabelLbl.textContent = 'No-concerns button label:';
  const noLabelInp = document.createElement('input');
  noLabelInp.type = 'text'; noLabelInp.value = f.noLabel || 'No Concerns';
  noLabelInp.style.cssText = 'font-size:12px';
  noLabelInp.addEventListener('input', () => f.noLabel = noLabelInp.value);
  noLabelWrap.appendChild(noLabelLbl); noLabelWrap.appendChild(noLabelInp);

  const yesLabelWrap = document.createElement('div');
  yesLabelWrap.style.flex = '1';
  const yesLabelLbl = document.createElement('div');
  yesLabelLbl.style.cssText = 'font-size:10px;color:var(--red);margin-bottom:3px;font-weight:500';
  yesLabelLbl.textContent = 'Concerns-found button label:';
  const yesLabelInp = document.createElement('input');
  yesLabelInp.type = 'text'; yesLabelInp.value = f.yesLabel || 'Concerns Found';
  yesLabelInp.style.cssText = 'font-size:12px';
  yesLabelInp.addEventListener('input', () => f.yesLabel = yesLabelInp.value);
  yesLabelWrap.appendChild(yesLabelLbl); yesLabelWrap.appendChild(yesLabelInp);

  labelRow.appendChild(noLabelWrap);
  labelRow.appendChild(yesLabelWrap);
  section.appendChild(labelRow);

  // Yes fields
  section.appendChild(makeBranchChildList(f, 'yes'));
  // No fields
  section.appendChild(makeBranchChildList(f, 'no'));

  return section;
}

function makeBranchChildList(f, side) {
  const arr = side === 'yes' ? (f.yesFields || (f.yesFields = [])) : (f.noFields || (f.noFields = []));
  const color = side === 'yes' ? 'var(--red)' : 'var(--green)';
  const title = side === 'yes' ? `Fields shown when "${f.yesLabel || 'Concerns Found'}" is selected:` : `Fields shown when "${f.noLabel || 'No Concerns'}" is selected:`;

  const wrap = document.createElement('div');
  wrap.style.cssText = `border-left:2px solid ${color};padding-left:10px;margin-bottom:10px`;

  const header = document.createElement('div');
  header.className = 'row between'; header.style.marginBottom = '6px';
  const lbl = document.createElement('span');
  lbl.style.cssText = `font-size:10px;color:${color};font-weight:600`;
  lbl.textContent = title;
  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-ghost btn-sm';
  addBtn.style.cssText = 'font-size:10px;padding:3px 8px';
  addBtn.textContent = '+ Field';
  addBtn.addEventListener('click', () => {
    arr.push({ key: 'FIELD_' + Date.now(), label: 'New Field', type: 'text', placeholder: '' });
    renderFieldEditorList(); renderEditorPreview();
  });
  header.appendChild(lbl); header.appendChild(addBtn);
  wrap.appendChild(header);

  if (!arr.length) {
    const hint = document.createElement('div');
    hint.className = 'hint'; hint.style.cssText = 'padding:4px 0;font-size:10px';
    hint.textContent = side === 'yes' ? 'No extra fields — only conditional template text will show.' : 'No extra fields — only conditional template text will show.';
    wrap.appendChild(hint);
  } else {
    arr.forEach((cf, ci) => {
      wrap.appendChild(makeFieldEditorItem(cf, ci, arr, false));
    });
  }

  return wrap;
}

// ── ADD TOP-LEVEL FIELD ──
function onAddField() {
  editingFields.push({ key: 'FIELD_' + (editingFields.length + 1), label: 'New Field', type: 'text', placeholder: '' });
  renderFieldEditorList(); renderEditorPreview();
}

// ── LIVE PREVIEW ──
function renderEditorPreview() {
  const preview = document.getElementById('editor-preview');
  if (!preview) return;
  const template = document.getElementById('edit-template').value;
  if (!template.trim()) {
    preview.innerHTML = '<span style="color:var(--text-dim);font-style:italic">Template preview will appear here…</span>';
    return;
  }

  // Show conditional blocks highlighted
  let text = escapeHtml(template);

  // Highlight {{#IF...}} blocks
  text = text.replace(/\{\{#IF_([A-Z0-9_]+)=(yes|no)\}\}/g, (m, key, val) => {
    const color = val === 'yes' ? 'var(--red)' : 'var(--green)';
    return `<span style="background:rgba(79,142,247,0.1);color:var(--accent);border-radius:3px;font-size:10px;padding:0 3px">${escapeHtml(m)}</span>`;
  });
  text = text.replace(/\{\{\/IF_([A-Z0-9_]+)\}\}/g, m => `<span style="background:rgba(79,142,247,0.1);color:var(--accent);border-radius:3px;font-size:10px;padding:0 3px">${escapeHtml(m)}</span>`);

  // Collect all fields including branch children
  const allFields = [];
  editingFields.forEach(f => {
    allFields.push(f);
    if (f.yesFields) f.yesFields.forEach(cf => allFields.push(cf));
    if (f.noFields)  f.noFields.forEach(cf => allFields.push(cf));
  });

  allFields.forEach(f => {
    const ph = escapeHtml('{{' + f.key + '}}');
    const label = escapeHtml(f.label || f.key);
    let badge = '';
    if (f.type === 'chips')   badge = ' <span style="font-size:9px;background:var(--accent-dim);color:var(--accent);border-radius:3px;padding:1px 4px">chips</span>';
    if (f.type === 'closing') badge = ' <span style="font-size:9px;background:var(--green-dim);color:var(--green);border-radius:3px;padding:1px 4px">closing</span>';
    if (f.type === 'systems') badge = ' <span style="font-size:9px;background:var(--yellow-dim);color:var(--yellow);border-radius:3px;padding:1px 4px">systems</span>';
    if (f.type === 'branch')  return;
    text = text.split(ph).join(`<span class="blank">${label}${badge}</span>`);
  });

  text = text.replace(/\{\{([^}]+)\}\}/g, '<span style="color:var(--red);background:rgba(247,111,111,0.1);border-radius:3px;padding:0 3px">{{$1}} ⚠</span>');
  preview.innerHTML = text;
}

// ── SAVE ──
function onSaveScript() {
  const title    = document.getElementById('edit-title').value.trim();
  const template = document.getElementById('edit-template').value.trim();
  if (!title)    { showToast('Please enter a title', 'error'); return; }
  if (!template) { showToast('Please enter a template', 'error'); return; }
  editingScript.title    = title;
  editingScript.template = template;
  editingScript.fields   = JSON.parse(JSON.stringify(editingFields));
  const scripts = AppState.data.scripts;
  const idx = scripts.findIndex(s => s.id === editingScript.id);
  if (idx >= 0) scripts[idx] = editingScript;
  else scripts.push(editingScript);
  autosave();
  showToast('Script saved ✓', 'success');
  hideEditor();
}

// ── DELETE ──
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

function onCancelEdit() { hideEditor(); }

function onResetStorage() {
  if (!confirm('Wipe local changes and reload from scripts.json?')) return;
  localStorage.removeItem('fraudnotes_data');
  location.reload();
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

document.addEventListener('DOMContentLoaded', async () => {
  setActiveNav();
  await loadScripts();
  initCreatePage();
});
