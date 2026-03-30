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
    editingScript = null; editingFields = [];
    renderScriptList(); renderClosingChipEditor(); renderSystemsEditor(); hideEditor();
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
  if (!systems.length) { container.innerHTML = '<div class="hint" style="padding:4px 0">No systems yet.</div>'; return; }
  systems.forEach((s, i) => {
    const wrap = document.createElement('div'); wrap.className = 'chip-editor-row';
    const inp = document.createElement('input'); inp.type = 'text'; inp.value = s;
    inp.addEventListener('input', () => { AppState.data.systemsReviewed[i] = inp.value; autosave(); });
    const btn = document.createElement('button'); btn.className = 'btn btn-danger btn-sm'; btn.innerHTML = Icons.trash;
    btn.addEventListener('click', () => { AppState.data.systemsReviewed.splice(i, 1); autosave(); renderSystemsEditor(); });
    wrap.appendChild(inp); wrap.appendChild(btn); container.appendChild(wrap);
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
  if (!actions.length) { container.innerHTML = '<div class="hint" style="padding:4px 0">No closing actions yet.</div>'; return; }
  actions.forEach((action, i) => {
    const wrap = document.createElement('div'); wrap.className = 'chip-editor-row';
    const inp = document.createElement('input'); inp.type = 'text'; inp.value = action;
    inp.addEventListener('input', () => { AppState.data.closingActions[i] = inp.value; autosave(); });
    const btn = document.createElement('button'); btn.className = 'btn btn-danger btn-sm'; btn.innerHTML = Icons.trash;
    btn.addEventListener('click', () => { AppState.data.closingActions.splice(i, 1); autosave(); renderClosingChipEditor(); });
    wrap.appendChild(inp); wrap.appendChild(btn); container.appendChild(wrap);
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
    const rw = document.createElement('div'); rw.className = 'row'; rw.style.cssText = 'gap:2px;flex-shrink:0';
    const bU = document.createElement('button'); bU.className = 'btn btn-ghost btn-sm'; bU.innerHTML = Icons.up; bU.style.padding = '4px 6px'; bU.disabled = idx === 0;
    bU.addEventListener('click', e => { e.stopPropagation(); moveScript(idx, -1); });
    const bD = document.createElement('button'); bD.className = 'btn btn-ghost btn-sm'; bD.innerHTML = Icons.down; bD.style.padding = '4px 6px'; bD.disabled = idx === scripts.length - 1;
    bD.addEventListener('click', e => { e.stopPropagation(); moveScript(idx, 1); });
    rw.appendChild(bU); rw.appendChild(bD);
    item.appendChild(info); item.appendChild(rw); list.appendChild(item);
  });
}

function moveScript(idx, dir) {
  const s = AppState.data.scripts; const ni = idx + dir;
  if (ni < 0 || ni >= s.length) return;
  [s[idx], s[ni]] = [s[ni], s[idx]]; autosave(); renderScriptList();
}

// ── NEW / EDIT ──
function onNewScript() {
  editingScript = { id: 'script_' + Date.now(), title: '', template: '', fields: [] };
  editingFields = []; showEditor(false);
}

function onEditScript(s) {
  editingScript = JSON.parse(JSON.stringify(s));
  editingFields = editingScript.fields;
  showEditor(true); renderScriptList();
}

function showEditor(isExisting) {
  document.getElementById('editor-section').classList.add('active');
  document.getElementById('edit-title').value = editingScript.title;
  document.getElementById('edit-template').value = editingScript.template;
  document.getElementById('btn-delete-script').style.display = isExisting ? '' : 'none';
  document.getElementById('editor-heading').textContent = isExisting ? 'Edit Script' : 'New Script';
  renderFieldEditorList(); renderEditorPreview();
  setTimeout(() => document.getElementById('editor-section').scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
}

function hideEditor() {
  document.getElementById('editor-section').classList.remove('active');
  editingScript = null; editingFields = []; renderScriptList();
}

// ── FIELD LIST ──
function renderFieldEditorList() {
  const container = document.getElementById('field-editor-list');
  container.innerHTML = '';
  if (!editingFields.length) {
    container.innerHTML = '<div class="hint" style="padding:8px 0">No fields yet. Add fields to match your <code style="font-family:var(--mono);color:var(--yellow)">{{PLACEHOLDERS}}</code>.</div>';
    return;
  }
  editingFields.forEach((f, i) => container.appendChild(makeFieldEditorItem(f, i, editingFields, true)));
}

// ── NORMALIZE branch to new format ──
function normalizeBranchField(f) {
  if (f.branches && f.branches.length) return;
  // Convert old yes/no format to new branches array
  f.branches = [
    { value: 'no',  label: f.noLabel  || 'No',  fields: f.noFields  || [] },
    { value: 'yes', label: f.yesLabel || 'Yes', fields: f.yesFields || [] },
  ];
  delete f.noLabel; delete f.yesLabel; delete f.noFields; delete f.yesFields;
}

// ── FIELD EDITOR ITEM ──
function makeFieldEditorItem(f, i, parentArray, isTop) {
  const wrap = document.createElement('div');
  wrap.className = 'field-editor-item' + (isTop ? '' : ' field-editor-item-child');

  // Reorder buttons
  const reorder = document.createElement('div'); reorder.className = 'field-reorder';
  const bU = document.createElement('button'); bU.className = 'btn btn-ghost btn-sm'; bU.innerHTML = Icons.up; bU.style.padding = '3px 5px'; bU.disabled = i === 0;
  bU.addEventListener('click', () => { if (i > 0) { [parentArray[i], parentArray[i-1]] = [parentArray[i-1], parentArray[i]]; renderFieldEditorList(); renderEditorPreview(); }});
  const bD = document.createElement('button'); bD.className = 'btn btn-ghost btn-sm'; bD.innerHTML = Icons.down; bD.style.padding = '3px 5px'; bD.disabled = i === parentArray.length - 1;
  bD.addEventListener('click', () => { if (i < parentArray.length-1) { [parentArray[i], parentArray[i+1]] = [parentArray[i+1], parentArray[i]]; renderFieldEditorList(); renderEditorPreview(); }});
  reorder.appendChild(bU); reorder.appendChild(bD);

  const info = document.createElement('div'); info.className = 'field-info';

  // Key
  const keyRow = document.createElement('div'); keyRow.className = 'row'; keyRow.style.marginBottom = '6px';
  const keyLbl = document.createElement('span'); keyLbl.style.cssText = 'font-size:10px;color:var(--text-dim);white-space:nowrap;font-family:var(--mono)'; keyLbl.textContent = '{{ }}';
  const keyInp = document.createElement('input'); keyInp.type = 'text'; keyInp.value = f.key; keyInp.placeholder = 'KEY'; keyInp.style.cssText = 'font-family:var(--mono);font-size:11px;flex:1';
  keyInp.addEventListener('input', () => { f.key = keyInp.value.toUpperCase().replace(/\s+/g,'_'); keyInp.value = f.key; renderEditorPreview(); });
  keyRow.appendChild(keyLbl); keyRow.appendChild(keyInp); info.appendChild(keyRow);

  // Label
  const labelInp = document.createElement('input'); labelInp.type = 'text'; labelInp.value = f.label || ''; labelInp.placeholder = 'Display label'; labelInp.style.marginBottom = '6px';
  labelInp.addEventListener('input', () => { f.label = labelInp.value; renderEditorPreview(); });
  info.appendChild(labelInp);

  // Type
  const typeRow = document.createElement('div'); typeRow.className = 'row'; typeRow.style.marginBottom = '6px';
  const typeLbl = document.createElement('span'); typeLbl.style.cssText = 'font-size:11px;color:var(--text-muted);white-space:nowrap'; typeLbl.textContent = 'Type:';
  const typeSel = document.createElement('select'); typeSel.style.flex = '1';
  [['text','text — free-form input'],['chips','chips — pick one option'],['closing','closing — multi-select closing actions'],['systems','systems — multi-select systems reviewed'],['branch','branch — multiple options, each reveals fields']].forEach(([val, lbl]) => {
    const opt = document.createElement('option'); opt.value = val; opt.textContent = lbl;
    if (f.type === val) opt.selected = true; typeSel.appendChild(opt);
  });
  typeSel.addEventListener('change', () => {
    f.type = typeSel.value;
    if (f.type === 'chips' && !f.options) f.options = [];
    if (f.type === 'branch') normalizeBranchField(f);
    renderFieldEditorList(); renderEditorPreview();
  });
  typeRow.appendChild(typeLbl); typeRow.appendChild(typeSel); info.appendChild(typeRow);

  if (f.type === 'text') {
    const phInp = document.createElement('input'); phInp.type = 'text'; phInp.value = f.placeholder || ''; phInp.placeholder = 'Hint text (optional)'; phInp.style.cssText = 'margin-bottom:6px;font-size:12px';
    phInp.addEventListener('input', () => f.placeholder = phInp.value); info.appendChild(phInp);
  }

  if (f.type === 'chips') info.appendChild(makeChipsOptionsEditor(f));
  if (f.type === 'branch') { normalizeBranchField(f); info.appendChild(makeBranchEditor(f)); }

  wrap.appendChild(reorder); wrap.appendChild(info);

  const del = document.createElement('button'); del.className = 'btn btn-danger btn-sm'; del.innerHTML = Icons.trash; del.style.cssText = 'align-self:flex-start;flex-shrink:0';
  del.addEventListener('click', () => { parentArray.splice(i, 1); renderFieldEditorList(); renderEditorPreview(); });
  wrap.appendChild(del);
  return wrap;
}

// ── CHIPS OPTIONS EDITOR ──
function makeChipsOptionsEditor(f) {
  const section = document.createElement('div'); section.style.marginTop = '4px';
  const header = document.createElement('div'); header.className = 'row between'; header.style.marginBottom = '6px';
  const lbl = document.createElement('span'); lbl.style.cssText = 'font-size:11px;color:var(--text-muted);font-weight:500'; lbl.textContent = 'Chip options:';
  const addBtn = document.createElement('button'); addBtn.className = 'btn btn-ghost btn-sm'; addBtn.style.cssText = 'font-size:10px;padding:3px 8px'; addBtn.textContent = '+ Add Option';
  addBtn.addEventListener('click', () => { f.options.push('New option'); renderFieldEditorList(); });
  header.appendChild(lbl); header.appendChild(addBtn); section.appendChild(header);
  const list = document.createElement('div'); list.style.cssText = 'display:flex;flex-direction:column;gap:4px';
  (f.options || []).forEach((opt, oi) => {
    const row = document.createElement('div'); row.className = 'chip-editor-row'; row.style.cssText = 'background:var(--surface2);border-radius:var(--radius-sm);padding:4px 6px';
    const inp = document.createElement('input'); inp.type = 'text'; inp.value = opt; inp.placeholder = 'Option text'; inp.style.cssText = 'font-size:12px;background:transparent;border:none;padding:2px 4px';
    inp.addEventListener('input', () => { f.options[oi] = inp.value; renderEditorPreview(); });
    inp.addEventListener('focus', () => inp.style.background = 'var(--bg)'); inp.addEventListener('blur', () => inp.style.background = 'transparent');
    const del = document.createElement('button'); del.className = 'btn btn-danger btn-sm'; del.innerHTML = Icons.trash; del.style.padding = '3px 5px';
    del.addEventListener('click', () => { f.options.splice(oi, 1); renderFieldEditorList(); renderEditorPreview(); });
    row.appendChild(inp); row.appendChild(del); list.appendChild(row);
  });
  if (!f.options || !f.options.length) list.innerHTML = '<div class="hint" style="padding:4px">No options yet.</div>';
  section.appendChild(list); return section;
}

// ── BRANCH EDITOR — supports N options ──
function makeBranchEditor(f) {
  const section = document.createElement('div'); section.style.marginTop = '6px';

  // Header with "Add Option" button
  const header = document.createElement('div'); header.className = 'row between'; header.style.marginBottom = '10px';
  const headerLbl = document.createElement('span'); headerLbl.style.cssText = 'font-size:11px;color:var(--text-muted);font-weight:600'; headerLbl.textContent = 'Branch options:';
  const addOptBtn = document.createElement('button'); addOptBtn.className = 'btn btn-ghost btn-sm'; addOptBtn.style.cssText = 'font-size:10px;padding:3px 10px'; addOptBtn.textContent = '+ Add Option';
  addOptBtn.addEventListener('click', () => {
    const idx = f.branches.length;
    f.branches.push({ value: 'option_' + idx, label: 'Option ' + (idx + 1), fields: [] });
    renderFieldEditorList(); renderEditorPreview();
  });
  header.appendChild(headerLbl); header.appendChild(addOptBtn); section.appendChild(header);

  // Hint about template syntax
  const hint = document.createElement('p'); hint.className = 'hint'; hint.style.marginBottom = '10px';
  hint.innerHTML = 'Use <code style="font-family:var(--mono);color:var(--yellow)">{{#IF_KEY=value}}...{{/IF_KEY}}</code> in the template for each option\'s value.';
  section.appendChild(hint);

  // Each branch option
  const branchColors = ['var(--green)', 'var(--red)', 'var(--accent)', 'var(--yellow)', 'var(--text-muted)'];

  f.branches.forEach((branch, bi) => {
    const color = branchColors[bi % branchColors.length];
    const branchWrap = document.createElement('div');
    branchWrap.style.cssText = `border-left:2px solid ${color};padding-left:10px;margin-bottom:12px`;

    // Branch label + value row
    const topRow = document.createElement('div'); topRow.className = 'row'; topRow.style.cssText = 'gap:6px;margin-bottom:6px;align-items:flex-end';

    const labelWrap = document.createElement('div'); labelWrap.style.flex = '1';
    const labelMeta = document.createElement('div'); labelMeta.style.cssText = `font-size:10px;color:${color};margin-bottom:3px;font-weight:600`; labelMeta.textContent = 'Button label:';
    const labelInp = document.createElement('input'); labelInp.type = 'text'; labelInp.value = branch.label; labelInp.style.fontSize = '12px';
    labelInp.addEventListener('input', () => { branch.label = labelInp.value; renderEditorPreview(); });
    labelWrap.appendChild(labelMeta); labelWrap.appendChild(labelInp);

    const valueWrap = document.createElement('div'); valueWrap.style.flex = '1';
    const valueMeta = document.createElement('div'); valueMeta.style.cssText = `font-size:10px;color:${color};margin-bottom:3px;font-weight:600`; valueMeta.textContent = 'Template value:';
    const valueInp = document.createElement('input'); valueInp.type = 'text'; valueInp.value = branch.value; valueInp.style.cssText = 'font-size:12px;font-family:var(--mono)';
    valueInp.placeholder = 'e.g. fraud, noanswer, notfraud';
    valueInp.addEventListener('input', () => { branch.value = valueInp.value.toLowerCase().replace(/\s+/g,'_'); valueInp.value = branch.value; renderEditorPreview(); });
    valueWrap.appendChild(valueMeta); valueWrap.appendChild(valueInp);

    // Delete branch button (only if more than 2)
    const delBranch = document.createElement('button'); delBranch.className = 'btn btn-danger btn-sm'; delBranch.innerHTML = Icons.trash; delBranch.style.padding = '5px 7px'; delBranch.title = 'Remove this option';
    delBranch.disabled = f.branches.length <= 2;
    delBranch.addEventListener('click', () => { f.branches.splice(bi, 1); renderFieldEditorList(); renderEditorPreview(); });

    topRow.appendChild(labelWrap); topRow.appendChild(valueWrap); topRow.appendChild(delBranch);
    branchWrap.appendChild(topRow);

    // Child fields for this branch
    const childHeader = document.createElement('div'); childHeader.className = 'row between'; childHeader.style.cssText = 'margin-bottom:4px';
    const childLbl = document.createElement('span'); childLbl.style.cssText = `font-size:10px;color:${color};font-weight:500`; childLbl.textContent = 'Fields shown when selected:';
    const addChildBtn = document.createElement('button'); addChildBtn.className = 'btn btn-ghost btn-sm'; addChildBtn.style.cssText = 'font-size:10px;padding:2px 7px'; addChildBtn.textContent = '+ Field';
    addChildBtn.addEventListener('click', () => {
      branch.fields.push({ key: 'FIELD_' + Date.now(), label: 'New Field', type: 'text', placeholder: '' });
      renderFieldEditorList(); renderEditorPreview();
    });
    childHeader.appendChild(childLbl); childHeader.appendChild(addChildBtn);
    branchWrap.appendChild(childHeader);

    if (!branch.fields || !branch.fields.length) {
      const noFields = document.createElement('div'); noFields.className = 'hint'; noFields.style.cssText = 'padding:3px 0;font-size:10px'; noFields.textContent = 'No extra fields — template text only.';
      branchWrap.appendChild(noFields);
    } else {
      branch.fields.forEach((cf, ci) => branchWrap.appendChild(makeFieldEditorItem(cf, ci, branch.fields, false)));
    }

    section.appendChild(branchWrap);
  });

  return section;
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
  if (!template.trim()) { preview.innerHTML = '<span style="color:var(--text-dim);font-style:italic">Template preview will appear here…</span>'; return; }

  let text = escapeHtml(template);
  text = text.replace(/\{\{#IF_([A-Z0-9_]+)=([a-z0-9_]+)\}\}/g, m => `<span style="background:rgba(79,142,247,0.1);color:var(--accent);border-radius:3px;font-size:10px;padding:0 3px">${escapeHtml(m)}</span>`);
  text = text.replace(/\{\{\/IF_([A-Z0-9_]+)\}\}/g, m => `<span style="background:rgba(79,142,247,0.1);color:var(--accent);border-radius:3px;font-size:10px;padding:0 3px">${escapeHtml(m)}</span>`);

  const allFields = [];
  editingFields.forEach(f => {
    allFields.push(f);
    if (f.branches) f.branches.forEach(b => (b.fields || []).forEach(cf => allFields.push(cf)));
    if (f.yesFields) f.yesFields.forEach(cf => allFields.push(cf));
    if (f.noFields)  f.noFields.forEach(cf => allFields.push(cf));
  });

  allFields.forEach(f => {
    if (f.type === 'branch') return;
    const ph = escapeHtml('{{' + f.key + '}}');
    const label = escapeHtml(f.label || f.key);
    let badge = '';
    if (f.type === 'chips')   badge = ' <span style="font-size:9px;background:var(--accent-dim);color:var(--accent);border-radius:3px;padding:1px 4px">chips</span>';
    if (f.type === 'closing') badge = ' <span style="font-size:9px;background:var(--green-dim);color:var(--green);border-radius:3px;padding:1px 4px">closing</span>';
    if (f.type === 'systems') badge = ' <span style="font-size:9px;background:var(--yellow-dim);color:var(--yellow);border-radius:3px;padding:1px 4px">systems</span>';
    text = text.split(ph).join(`<span class="blank">${label}${badge}</span>`);
  });

  text = text.replace(/\{\{([^}]+)\}\}/g, '<span style="color:var(--red);background:rgba(247,111,111,0.1);border-radius:3px;padding:0 3px">{{$1}} ⚠</span>');
  preview.innerHTML = text;
}

// ── SAVE ──
function onSaveScript() {
  const title = document.getElementById('edit-title').value.trim();
  const template = document.getElementById('edit-template').value.trim();
  if (!title)    { showToast('Please enter a title', 'error'); return; }
  if (!template) { showToast('Please enter a template', 'error'); return; }
  editingScript.title = title; editingScript.template = template;
  editingScript.fields = JSON.parse(JSON.stringify(editingFields));
  const scripts = AppState.data.scripts;
  const idx = scripts.findIndex(s => s.id === editingScript.id);
  if (idx >= 0) scripts[idx] = editingScript; else scripts.push(editingScript);
  autosave(); showToast('Script saved ✓', 'success'); hideEditor();
}

function onDeleteScript() {
  if (!editingScript) return;
  if (!confirm(`Delete "${editingScript.title}"?`)) return;
  const idx = AppState.data.scripts.findIndex(s => s.id === editingScript.id);
  if (idx >= 0) AppState.data.scripts.splice(idx, 1);
  autosave(); showToast('Deleted', ''); hideEditor();
}

function onCancelEdit() { hideEditor(); }

function onResetStorage() {
  if (!confirm('Wipe local changes and reload from scripts.json?')) return;
  localStorage.removeItem('fraudnotes_data'); location.reload();
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

document.addEventListener('DOMContentLoaded', async () => {
  setActiveNav();
  await loadScripts();
  initCreatePage();
});
