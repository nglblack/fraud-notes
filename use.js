// ── USE PAGE ──

let currentScript = null;
let fieldValues = {};

// For universal note: which application sub-script is selected
let universalAppScript = null;

// For QUICK_FILL/ZELLE_FLOW: which walkthrough-type quick-fill entry (if any) currently has its
// inline mini-form expanded, plus that mini-form's own local field values — { entry, fieldValues }.
// Kept separate from the outer script's fieldValues so a walkthrough's field keys (ACTIONS,
// CARD_LAST4, etc.) can never collide with a same-named key used elsewhere. null when no
// walkthrough panel is open.
let activeWalkthrough = null;

// Walkthrough-type quick fills that have been submitted (Applied) at least once for the note
// currently being built, keyed by the entry's `value` — { fields, fieldValues, producesTemplate }.
// This is what makes a submitted walkthrough re-editable instead of leaving behind only plain
// resolved text in ISSUE/ACTION_TAKEN/ADVICE: reopening (see the "Edit" affordance in
// renderQuickFillSelect) points activeWalkthrough.fieldValues at the SAME stored object here, so
// every previously-added action-log row (type/detail/result, in order) comes back exactly as left.
// Distinct from `activeWalkthrough` — that's whichever panel is currently open (if any); an entry
// can be here (submitted before) without being the one currently open, and vice versa (freshly
// opened, not yet submitted). Reset alongside fieldValues whenever a new/blank note starts.
let submittedWalkthroughs = {};

// Application script IDs shown in the Application Script picker.
// This is the new consolidated walkthrough: 6 top-level reasons instead of
// the old flat list of 17. The older individual scripts (flag-no-concerns,
// misrouted-chex, id-scan-fail-*, alloy-mismatch-confirmed-*, etc.) still
// exist in scripts.json — nothing was deleted — they're just no longer
// listed here, since their content now lives inside the combined scripts
// below (fraud-condition-combined absorbs identity/ID-scan/Alloy review;
// misrouted-combined absorbs the three misrouted destinations).
const APP_SCRIPT_IDS = [
  'core-fraud-warning',
  'no-condition-lo-help',
  'fraud-condition-combined',
  'misrouted-combined',
  'doc-review',
  'indirect-review'
];

// Hint text for the three universal account review boxes
const UNIVERSAL_HINTS = {
  ISSUE: 'e.g. Mbr calling to get access to OLB',
  ACTION_TAKEN: 'e.g. Reviewed and appears mbr had conversion done 05/12, no reason to keep OLB locked. Unlocked OLB.',
  ADVICE: 'e.g. Advised mbr OLB is now accessible'
};

// Canned scripts for the QUICK_FILL (Universal Note) / ZELLE_FLOW (Zelle) dropdown, grouped into
// categories. Lives in scripts.json (AppState.data.quickFillCategories) rather than as a hardcoded
// constant here, so agents can add their own entries from the Use page (see
// buildQuickFillSaveForm/saveCurrentAsQuickFill below) without touching Manage or the JSON file by
// hand — saveToStorage()/exportJSON()/importJSON() already serialize AppState.data generically, so
// this persists and round-trips automatically. "Custom" is not part of this data — it's a separate,
// always-present option meaning "clear ISSUE/ACTION_TAKEN/ADVICE and let the agent type freely" (see
// renderQuickFillSelect). Every other entry's "fills" is written directly into fieldValues on
// selection, same mechanism as the old zelle_linked prefill.
function findQuickFillScript(value) {
  const categories = AppState.data.quickFillCategories || [];
  for (const cat of categories) {
    const found = cat.scripts.find(s => s.value === value);
    if (found) return found;
  }
  return null;
}

function slugifyQuickFillValue(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'script';
}

function allQuickFillValues() {
  const categories = AppState.data.quickFillCategories || [];
  const values = ['custom'];
  categories.forEach(cat => cat.scripts.forEach(s => values.push(s.value)));
  return values;
}

function uniqueQuickFillValue(name) {
  const base = slugifyQuickFillValue(name);
  const existing = allQuickFillValues();
  if (!existing.includes(base)) return base;
  let n = 2;
  while (existing.includes(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

// Builds a new quickFillCategories entry from the currently-filled ISSUE/ACTION_TAKEN/ADVICE
// values and saves it. Blocks (toast + form stays open, caller doesn't close it) rather than
// silently saving when Name is empty, when a new-category name is required but empty, or when
// none of the three note fields have anything in them.
function saveCurrentAsQuickFill(name, categoryChoice, newCategoryName) {
  const trimmedName = (name || '').trim();
  if (!trimmedName) {
    showToast('Enter a name first', 'error');
    return false;
  }

  const fills = {};
  ['ISSUE', 'ACTION_TAKEN', 'ADVICE'].forEach(key => {
    const val = fieldValues[key];
    if (val && val.trim()) fills[key] = val;
  });
  if (!Object.keys(fills).length) {
    showToast('Fill in Issue, Action Taken, or Advised first', 'error');
    return false;
  }

  if (!AppState.data.quickFillCategories) AppState.data.quickFillCategories = [];
  const newScript = { value: uniqueQuickFillValue(trimmedName), label: trimmedName, fills };

  if (categoryChoice === '__new__') {
    const catName = (newCategoryName || '').trim();
    if (!catName) {
      showToast('Enter a new category name', 'error');
      return false;
    }
    AppState.data.quickFillCategories.push({ category: catName, scripts: [newScript] });
  } else {
    const cat = AppState.data.quickFillCategories.find(c => c.category === categoryChoice);
    if (cat) cat.scripts.push(newScript);
    else AppState.data.quickFillCategories.push({ category: categoryChoice, scripts: [newScript] });
  }

  saveToStorage();
  renderFields();
  updatePreview();
  showToast('Saved as Quick Fill ✓', 'success');
  return true;
}

// Small inline form (not a modal) revealed below the format toolbar — Name + Category (existing
// categories first, "+ New Category" last, which reveals a text input for the new name).
function buildQuickFillSaveForm() {
  const form = document.createElement('div');
  form.className = 'branch-children';
  form.style.display = 'none';

  const nameLbl = document.createElement('label');
  nameLbl.textContent = 'Name';
  form.appendChild(nameLbl);

  const nameInp = document.createElement('input');
  nameInp.type = 'text';
  nameInp.placeholder = 'e.g. Zelle — Suspicious Activity';
  form.appendChild(nameInp);

  const catLbl = document.createElement('label');
  catLbl.textContent = 'Category';
  catLbl.style.marginTop = '10px';
  form.appendChild(catLbl);

  const catSel = document.createElement('select');
  const categories = AppState.data.quickFillCategories || [];
  catSel.innerHTML = categories.map(c => `<option value="${escapeHtml(c.category)}">${escapeHtml(c.category)}</option>`).join('') +
    '<option value="__new__">+ New Category</option>';
  form.appendChild(catSel);

  const newCatInp = document.createElement('input');
  newCatInp.type = 'text';
  newCatInp.placeholder = 'New category name';
  newCatInp.style.marginTop = '6px';
  newCatInp.style.display = catSel.value === '__new__' ? '' : 'none';
  form.appendChild(newCatInp);

  catSel.addEventListener('change', () => {
    newCatInp.style.display = catSel.value === '__new__' ? '' : 'none';
  });

  const btnRow = document.createElement('div');
  btnRow.className = 'row';
  btnRow.style.marginTop = '10px';
  btnRow.style.gap = '8px';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn btn-primary btn-sm';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => {
    saveCurrentAsQuickFill(nameInp.value, catSel.value, newCatInp.value);
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn-ghost btn-sm';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => { form.style.display = 'none'; });

  btnRow.appendChild(saveBtn);
  btnRow.appendChild(cancelBtn);
  form.appendChild(btnRow);

  return form;
}

// ── FORMAT TOOLBAR (small per-group toolbar — see renderNoteFieldGroup below — applies to
// whichever of the ISSUE/ACTION_TAKEN/ADVICE-style textareas was last focused) ──
let lastFocusedNoteField = null;

// Registers focus tracking once. #fields-container itself is never replaced (only its children,
// on every render), so this listener survives script/branch changes even though the toolbar DOM
// inside it gets rebuilt fresh each time.
function initNoteFieldTracking() {
  const container = document.getElementById('fields-container');
  if (!container) return;
  container.addEventListener('focusin', e => {
    if (e.target.tagName === 'TEXTAREA') lastFocusedNoteField = e.target;
  });
}

function getFocusedNoteField() {
  if (lastFocusedNoteField && document.body.contains(lastFocusedNoteField)) return lastFocusedNoteField;
  showToast('Click into a note field first', 'error');
  return null;
}

// Builds a small vertical toolbar (Bullet, Bold, Italic) wired to whatever textarea was last
// focused. Called fresh every time a note-field group renders (see renderNoteFieldGroup) — cheap,
// just 3 buttons.
function buildFormatToolbar() {
  const toolbar = document.createElement('div');
  toolbar.className = 'format-toolbar-inline';

  const makeButton = (label, onClick) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-ghost btn-sm';
    btn.innerHTML = label;
    // Prevent the button from stealing focus (and clearing the textarea's selection) on click
    btn.addEventListener('mousedown', e => e.preventDefault());
    btn.addEventListener('click', onClick);
    return btn;
  };

  toolbar.appendChild(makeButton('• Bullet', () => {
    const field = getFocusedNoteField();
    if (!field) return;
    applyBulletFormatting(field);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }));

  toolbar.appendChild(makeButton('<b>B</b> Bold', () => {
    const field = getFocusedNoteField();
    if (!field) return;
    applyMarkupTag(field, 'bold');
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }));

  toolbar.appendChild(makeButton('<i>I</i> Italic', () => {
    const field = getFocusedNoteField();
    if (!field) return;
    applyMarkupTag(field, 'italic');
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }));

  return toolbar;
}

// Bold/Italic: if the selection is already wrapped by a tag of THIS type — checked only via the
// text immediately touching the selection, not a full-document scan — toggle it off. Otherwise
// wrap fresh (or insert a placeholder if nothing is selected). Bold and italic are free to nest
// around each other (e.g. **_text_**); only same-type nesting is prevented.
function applyMarkupTag(field, type) {
  const def = MARKUP_TAG_DEFS[type];
  const start = field.selectionStart;
  const end = field.selectionEnd;
  const fieldValue = field.value;
  const before = fieldValue.slice(0, start);
  const after = fieldValue.slice(end);
  const selected = fieldValue.slice(start, end);

  const openMatch = before.match(def.openRegex);
  const closeStr = openMatch ? def.matchClose(after) : null;

  if (openMatch && closeStr) {
    // Already wrapped in this type immediately adjacent to the selection: toggle off
    const openStr = openMatch[0];
    field.value = before.slice(0, before.length - openStr.length) + selected + after.slice(closeStr.length);
    const newStart = start - openStr.length;
    field.setSelectionRange(newStart, newStart + selected.length);
  } else {
    // Not wrapped in this type: wrap fresh, nesting inside any other-type tag already touching it
    const [openTag, closeTag] = def.build();
    const inner = selected || def.placeholder;
    field.value = before + openTag + inner + closeTag + after;
    const newStart = start + openTag.length;
    field.setSelectionRange(newStart, newStart + inner.length);
  }
}

// Bullet: prefix every line touched by the selection with "• ". If every touched line is
// already bulleted, remove the prefix from all of them instead (toggle off).
function applyBulletFormatting(field) {
  const start = field.selectionStart;
  const end = field.selectionEnd;
  const value = field.value;

  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const nextBreak = value.indexOf('\n', end);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;

  const lines = value.slice(lineStart, lineEnd).split('\n');
  const allBulleted = lines.every(l => l.startsWith(MARKUP_BULLET_PREFIX));
  const newLines = lines.map(l => {
    if (allBulleted) return l.slice(MARKUP_BULLET_PREFIX.length);
    return l.startsWith(MARKUP_BULLET_PREFIX) ? l : MARKUP_BULLET_PREFIX + l;
  });
  const newBlock = newLines.join('\n');

  field.value = value.slice(0, lineStart) + newBlock + value.slice(lineEnd);
  field.setSelectionRange(lineStart, lineStart + newBlock.length);
}

// Enter on a bulleted line continues the list on the next line; Enter on an *empty* bulleted line
// (just "• " with nothing else) strips that bullet and drops a plain newline instead, so the agent
// can exit the list by pressing Enter twice. Only handles a collapsed cursor (no active selection) —
// default browser behavior applies otherwise.
function handleBulletEnterKey(e, ta) {
  if (e.key !== 'Enter' || ta.selectionStart !== ta.selectionEnd) return;

  const pos = ta.selectionStart;
  const value = ta.value;
  const lineStart = value.lastIndexOf('\n', pos - 1) + 1;
  const nextBreak = value.indexOf('\n', pos);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  const line = value.slice(lineStart, lineEnd);

  if (!line.startsWith(MARKUP_BULLET_PREFIX)) return;

  e.preventDefault();
  let newValue, newPos;
  if (line.slice(MARKUP_BULLET_PREFIX.length).trim() === '') {
    // Empty bullet: strip the prefix from this line and break out of the list with a plain newline
    newValue = value.slice(0, lineStart) + value.slice(lineStart + MARKUP_BULLET_PREFIX.length, pos) + '\n' + value.slice(pos);
    newPos = pos - MARKUP_BULLET_PREFIX.length + 1;
  } else {
    // Continue the list on the next line
    newValue = value.slice(0, pos) + '\n' + MARKUP_BULLET_PREFIX + value.slice(pos);
    newPos = pos + 1 + MARKUP_BULLET_PREFIX.length;
  }

  ta.value = newValue;
  ta.setSelectionRange(newPos, newPos);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
}

// Whole-note font/size controls in the Preview card header — separate from the per-field
// Bullet/Bold/Italic toolbar, which formats inline text within individual fields. Persisted like
// the Signature field: a saved preference, not per-note state, so it's read immediately (same
// read-on-render pattern as Signature's localStorage.getItem(...) || '') and never reset by
// onClear()/onScriptChange() — it stays set until the agent changes the dropdown again.
let noteFont = localStorage.getItem('fraudnotes_note_font') || 'default';
let noteFontSize = localStorage.getItem('fraudnotes_note_size') || 'normal';

// Syncs the <select> elements to the loaded state and wires their change listeners to save.
// Called once from initUsePage — the selects don't exist yet at the point noteFont/noteFontSize
// are read above (that runs at script-parse time, before the DOM is ready).
function initNoteFontControls() {
  const fontSel = document.getElementById('note-font-select');
  const sizeSel = document.getElementById('note-size-select');
  if (fontSel) fontSel.value = noteFont;
  if (sizeSel) sizeSel.value = noteFontSize;

  if (fontSel) fontSel.addEventListener('change', e => {
    noteFont = e.target.value;
    localStorage.setItem('fraudnotes_note_font', noteFont);
    updatePreview();
  });
  if (sizeSel) sizeSel.addEventListener('change', e => {
    noteFontSize = e.target.value;
    localStorage.setItem('fraudnotes_note_size', noteFontSize);
    updatePreview();
  });
}

function initUsePage() {
  renderScriptSelect();
  const sel = document.getElementById('script-select');
  sel.addEventListener('change', onScriptChange);
  document.getElementById('btn-copy').addEventListener('click', onCopy);
  document.getElementById('btn-clear').addEventListener('click', onClear);
  initNoteFontControls();
  initNoteFieldTracking();

  // Universal Note is the only option in this dropdown now — auto-select it instead of
  // requiring the agent to open the dropdown and pick the one available option.
  sel.value = 'universal-note';
  onScriptChange({ target: sel });
}

// Top-level Script dropdown is restricted to Universal Note only — every other script (Zelle,
// the individual application scripts, etc.) stays fully intact in scripts.json and remains
// reachable elsewhere (the Manage page's script list, and the Application Script sub-picker
// inside Universal Note via APP_SCRIPT_IDS) — this filter only affects what renders in this
// one <select>.
function renderScriptSelect() {
  const sel = document.getElementById('script-select');
  sel.innerHTML = '<option value="">— Choose a script —</option>';
  (AppState.data.scripts || [])
    .filter(s => s.id === 'universal-note')
    .forEach(s => {
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
  activeWalkthrough = null;
  submittedWalkthroughs = {};
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
  renderFieldList(container, currentScript.fields);
}

// Walks a fields array and renders each field in order, except that any RUN of consecutive
// ISSUE/ACTION_TAKEN/ADVICE-style fields (the UNIVERSAL_HINTS set) is wrapped together in its own
// sub-container with a single small toolbar above them, instead of each rendering independently.
// Used everywhere a fields array gets walked (top level, branch children, the universal-note app
// sub-picker) so the grouping applies uniformly regardless of which script or nesting depth the
// triplet appears at — no per-script special-casing needed.
function renderFieldList(container, fields, indented, values = fieldValues) {
  let i = 0;
  while (i < fields.length) {
    if (fields[i].type === 'text' && UNIVERSAL_HINTS[fields[i].key]) {
      const run = [];
      while (i < fields.length && fields[i].type === 'text' && UNIVERSAL_HINTS[fields[i].key]) {
        run.push(fields[i]);
        i++;
      }
      container.appendChild(renderNoteFieldGroup(run, indented, values));
    } else {
      renderOneField(container, fields[i], indented, values);
      i++;
    }
  }
}

function renderNoteFieldGroup(fields, indented, values = fieldValues) {
  const wrap = document.createElement('div');
  wrap.className = 'note-fields-group' + (indented ? ' field-group-indented' : '');

  const toolbar = buildFormatToolbar();
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn btn-ghost btn-sm';
  saveBtn.style.marginLeft = 'auto';
  saveBtn.textContent = 'Save as Quick Fill';
  toolbar.appendChild(saveBtn);
  wrap.appendChild(toolbar);

  const saveForm = buildQuickFillSaveForm();
  wrap.appendChild(saveForm);
  saveBtn.addEventListener('click', () => {
    saveForm.style.display = saveForm.style.display === 'none' ? '' : 'none';
  });

  const col = document.createElement('div');
  fields.forEach(field => renderOneField(col, field, false, values));
  wrap.appendChild(col);

  return wrap;
}

// `values` is the field-value store this field (and any of its nested branch/action-log children)
// reads from and writes into — defaults to the outer script's global `fieldValues`, but a
// walkthrough's inline mini-form (see renderWalkthroughForm) passes its own local object instead,
// so the same render functions work for both without the two ever colliding.
function renderOneField(container, field, indented, values = fieldValues) {
  const group = document.createElement('div');
  group.className = 'field-group' + (indented ? ' field-group-indented' : '');
  group.dataset.fieldKey = field.key;

  const lbl = document.createElement('label');
  lbl.textContent = field.label;
  group.appendChild(lbl);

  if (field.type === 'text') {
    // Auto-growing textarea for the three universal account body fields
    if (UNIVERSAL_HINTS[field.key]) {
      const ta = document.createElement('textarea');
      ta.rows = 2;
      ta.style.overflow = 'hidden';
      ta.style.resize = 'none';
      ta.placeholder = field.placeholder || '';
      ta.value = values[field.key] || '';
      const autoGrow = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
      ta.addEventListener('input', () => { values[field.key] = ta.value; updatePreview(); autoGrow(); });
      ta.addEventListener('keydown', e => handleBulletEnterKey(e, ta));
      group.appendChild(ta);
      setTimeout(autoGrow, 0);

      const hintEl = document.createElement('div');
      hintEl.className = 'hint';
      hintEl.style.marginTop = '4px';
      hintEl.textContent = UNIVERSAL_HINTS[field.key];
      group.appendChild(hintEl);

    } else {
      const row = document.createElement('div');
      row.className = 'row';
      row.style.gap = '6px';

      const inp = document.createElement('input');
      inp.type = 'text';
      inp.placeholder = field.placeholder || '';
      inp.value = values[field.key] || '';
      inp.style.flex = '1';
      inp.addEventListener('input', () => { values[field.key] = inp.value; updatePreview(); });
      row.appendChild(inp);

      if (field.key === 'ACCT_NUM' || field.key === 'APP_ID') {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn btn-ghost btn-sm';
        copyBtn.style.flexShrink = '0';
        copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
        copyBtn.title = 'Copy';
        copyBtn.addEventListener('click', () => {
          const val = inp.value.trim();
          if (!val) { showToast('Nothing to copy', 'error'); return; }
          copyToClipboard(val);
        });
        row.appendChild(copyBtn);
      }

      group.appendChild(row);
    }
  } else if (field.type === 'chips') {
    const chips = document.createElement('div');
    chips.className = 'chips';
    if (field.multiple && !values[field.key]) values[field.key] = [];
    (field.options || []).forEach(opt => {
      const chip = document.createElement('button');
      const isSelected = field.multiple
        ? values[field.key].includes(opt)
        : values[field.key] === opt;
      chip.className = 'chip' + (isSelected ? ' selected' : '');
      chip.textContent = opt;
      chip.addEventListener('click', () => {
        if (field.multiple) {
          const arr = values[field.key];
          const idx = arr.indexOf(opt);
          if (idx >= 0) { arr.splice(idx, 1); chip.classList.remove('selected'); }
          else { arr.push(opt); chip.classList.add('selected'); }
        } else {
          if (values[field.key] === opt) { delete values[field.key]; chip.classList.remove('selected'); }
          else { values[field.key] = opt; chips.querySelectorAll('.chip').forEach(c => c.classList.remove('selected')); chip.classList.add('selected'); }
        }
        updatePreview();
      });
      chips.appendChild(chip);
    });
    group.appendChild(chips);

  } else if (field.type === 'systems') {
    renderSystemsField(group, field.key, values);
  } else if (field.type === 'closing') {
    renderClosingField(group, field.key, values);
  } else if (field.type === 'action-log') {
    renderActionLogField(group, field, values);
  } else if (field.type === 'branch') {
    renderBranchField(group, field, values);
  } else if (field.type === 'signature') {
    renderSignatureField(group, field.key, values);
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

function renderBranchField(group, field, values = fieldValues) {
  const branches = normalizeBranches(field);
  const current  = values[field.key];

  // QUICK_FILL (Universal Note) and ZELLE_FLOW (Zelle) use a canned-script dropdown instead of
  // the button toggle every other branch field gets. They always belong to the outer script (a
  // walkthrough's own fields never declare one), so renderQuickFillSelect works directly off the
  // module-level fieldValues rather than the threaded `values` param. Everything below this —
  // which fields (if any) become visible, and the CALL_TYPE application sub-picker — is shared and
  // unaffected by which picker UI rendered the selection, since it's all still driven by
  // values[field.key] and the field's own scripts.json `branches`.
  if (field.key === 'QUICK_FILL' || field.key === 'ZELLE_FLOW') {
    renderQuickFillSelect(group, field, current);
  } else {
    renderBranchToggle(group, field, branches, current, values);
  }

  const selected = branches.find(b => b.value === current);
  if (selected && selected.fields && selected.fields.length) {
    const childWrap = document.createElement('div');
    childWrap.className = 'branch-children';
    renderFieldList(childWrap, selected.fields, true, values);
    group.appendChild(childWrap);
  }

  // Universal note: when Application Review is selected, show inline app script picker
  if (field.key === 'CALL_TYPE' && current === 'application') {
    group.appendChild(renderAppSubPicker());
  }
}

function renderBranchToggle(group, field, branches, current, values = fieldValues) {
  const toggle = document.createElement('div');
  toggle.className = field.compact ? 'branch-toggle-compact' : 'branch-toggle';

  branches.forEach((branch, idx) => {
    const btn = document.createElement('button');
    if (field.compact) {
      // Compact branch fields (e.g. LO_ADVICE) render as small pill buttons matching .chip's
      // look, instead of the large rectangular .branch-btn style — same underlying single-select
      // branch behavior (values[field.key] = branch.value, drives any nested child fields),
      // only the visual presentation differs.
      btn.className = 'chip-branch' + (current === branch.value ? ' selected' : '');
    } else {
      const styleClass = idx === 0 ? 'branch-btn-safe'
                       : idx === branches.length - 1 ? 'branch-btn-danger'
                       : 'branch-btn-neutral';
      btn.className = 'branch-btn ' + styleClass + (current === branch.value ? ' selected' : '');
    }
    btn.textContent = branch.label;
    btn.addEventListener('click', () => {
      values[field.key] = branch.value;
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
}

// Canned-script dropdown for QUICK_FILL/ZELLE_FLOW. Each entry is either:
//  - static (no "type", or "type": "static"): selecting it writes its "fills" directly into
//    fieldValues (same mechanism as the old zelle_linked prefill) — unchanged behavior.
//  - "type": "walkthrough": selecting it does NOT touch ISSUE/ACTION_TAKEN/ADVICE. Instead it opens
//    an inline mini-form (see renderWalkthroughForm) for the walkthrough's own `fields`, and only
//    its Apply button (applyWalkthrough) resolves `produces` and writes the result in.
// Which fields actually become visible afterward (for non-walkthrough entries) is decided entirely
// by the shared block in renderBranchField above (still reading the field's own untouched
// scripts.json branches) — this function only sets fieldValues, it never touches field visibility
// itself, except for the walkthrough mini-form it renders inline below the select.
function renderQuickFillSelect(group, field, current) {
  const row = document.createElement('div');
  row.className = 'row';
  row.style.gap = '6px';

  const sel = document.createElement('select');
  sel.style.flex = '1';
  let html = '<option value="custom">Custom</option>';
  (AppState.data.quickFillCategories || [])
    .filter(cat => cat.scripts && cat.scripts.length)
    .forEach(cat => {
      html += `<optgroup label="${escapeHtml(cat.category)}">`;
      cat.scripts.forEach(s => {
        let suffix = s.type === 'walkthrough' ? ' (walkthrough)' : '';
        if (s.type === 'walkthrough' && submittedWalkthroughs[s.value]) suffix = ' ✓' + suffix;
        html += `<option value="${s.value}">${escapeHtml(s.label + suffix)}</option>`;
      });
      html += '</optgroup>';
    });
  sel.innerHTML = html;
  if (current) sel.value = current;

  sel.addEventListener('change', () => {
    fieldValues[field.key] = sel.value;
    const script = sel.value !== 'custom' ? findQuickFillScript(sel.value) : null;

    if (script && script.type === 'walkthrough') {
      // Don't touch ISSUE/ACTION_TAKEN/ADVICE yet — only the mini-form's Apply button does that.
      // If this entry was already submitted once for this note, reopen with its stored
      // fieldValues (same object reference, so continuing to edit it here keeps
      // submittedWalkthroughs in sync automatically) instead of starting from a blank form.
      const existing = submittedWalkthroughs[script.value];
      activeWalkthrough = { entry: script, fieldValues: existing ? existing.fieldValues : {} };
    } else {
      activeWalkthrough = null;
      // Always clear all three first — every selection change starts from a blank slate, not
      // just "Custom" — so a partial-fill script (e.g. one that only sets ISSUE) never inherits
      // stray leftover text from whichever script was previously selected.
      delete fieldValues['ISSUE'];
      delete fieldValues['ACTION_TAKEN'];
      delete fieldValues['ADVICE'];
      if (script && script.fills) {
        Object.entries(script.fills).forEach(([key, val]) => { fieldValues[key] = val; });
      }
    }
    renderFields();
    updatePreview();
  });

  row.appendChild(sel);

  // Delete button only ever applies to the currently-selected script (there's no way to pick a
  // different one to delete without selecting it first) — never shown for "Custom", which isn't
  // a real entry in quickFillCategories.
  if (current && current !== 'custom') {
    const script = findQuickFillScript(current);
    if (script) {
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn-danger btn-sm';
      deleteBtn.style.flexShrink = '0';
      deleteBtn.innerHTML = Icons.trash;
      deleteBtn.title = 'Delete this Quick Fill';
      deleteBtn.addEventListener('click', () => {
        if (!confirm(`Delete Quick Fill "${script.label}"?`)) return;
        deleteQuickFillScript(script.value);
        // Only clear fields that still hold this script's exact, unedited fill value — leave
        // anything the agent has since typed over alone.
        if (script.fills) {
          Object.entries(script.fills).forEach(([key, val]) => {
            if (fieldValues[key] === val) delete fieldValues[key];
          });
        }
        if (activeWalkthrough && activeWalkthrough.entry.value === script.value) activeWalkthrough = null;
        delete submittedWalkthroughs[script.value];
        fieldValues[field.key] = 'custom';
        renderFields();
        updatePreview();
        showToast('Quick Fill deleted', 'success');
      });
      row.appendChild(deleteBtn);
    }
  }

  group.appendChild(row);

  const isWalkthroughOpen = activeWalkthrough && activeWalkthrough.entry.value === current;
  const submission = current ? submittedWalkthroughs[current] : null;

  // Already-submitted walkthrough, panel currently collapsed: show a dedicated "Edit" affordance
  // instead of the normal apply-on-select row — reselecting an option a <select> already has
  // selected doesn't fire "change", so without this there'd be no way to reopen it.
  if (submission && !isWalkthroughOpen) {
    const editRow = document.createElement('div');
    editRow.className = 'row';
    editRow.style.marginTop = '6px';
    editRow.style.gap = '6px';

    const badge = document.createElement('span');
    badge.className = 'hint';
    badge.textContent = '✓ Submitted';
    editRow.appendChild(badge);

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-ghost btn-sm';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => {
      const script = findQuickFillScript(current);
      if (!script) return;
      activeWalkthrough = { entry: script, fieldValues: submission.fieldValues };
      renderFields();
      updatePreview();
    });
    editRow.appendChild(editBtn);

    group.appendChild(editRow);
  }

  // A walkthrough entry's inline mini-form renders beneath the select+delete row instead of
  // applying anything immediately — see renderWalkthroughForm/applyWalkthrough.
  if (isWalkthroughOpen) {
    group.appendChild(renderWalkthroughForm(activeWalkthrough, field));
  }
}

// Inline mini-form for a "walkthrough"-type quick fill: renders `entry.fields` using the exact
// same field-rendering functions as the rest of the app (renderFieldList/renderOneField/
// renderActionLogField/etc.), but sourced from and written to this walkthrough's own local
// fieldValues (walkthroughState.fieldValues) via the `values` param those functions accept —
// never the outer script's fieldValues — so e.g. this walkthrough's ACTIONS/CARD_LAST4 can never
// collide with a same-named key elsewhere. Apply resolves entry.produces against that local store
// and writes the result into the outer ISSUE/ACTION_TAKEN/ADVICE fields; Cancel just discards it.
function renderWalkthroughForm(walkthroughState, field) {
  const wrap = document.createElement('div');
  wrap.className = 'branch-children';
  wrap.style.marginTop = '10px';

  const heading = document.createElement('div');
  heading.className = 'hint';
  heading.style.marginBottom = '8px';
  heading.textContent = 'Fill in the walkthrough below, then Apply to write it into Issue / Action Taken / Advised.';
  wrap.appendChild(heading);

  renderFieldList(wrap, walkthroughState.entry.fields, true, walkthroughState.fieldValues);

  const btnRow = document.createElement('div');
  btnRow.className = 'row';
  btnRow.style.marginTop = '10px';
  btnRow.style.gap = '8px';

  const applyBtn = document.createElement('button');
  applyBtn.type = 'button';
  applyBtn.className = 'btn btn-primary btn-sm';
  applyBtn.textContent = 'Apply';
  applyBtn.addEventListener('click', () => applyWalkthrough(walkthroughState, field));

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn-ghost btn-sm';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => {
    // Only reset the dropdown to Custom for a walkthrough that's never been submitted — cancelling
    // out of re-editing an already-submitted one should just collapse the panel and leave the
    // prior submission (both its resolved ISSUE/ACTION_TAKEN/ADVICE and the "Edit" affordance) in
    // place, not make it look like the walkthrough was never used.
    const alreadySubmitted = !!submittedWalkthroughs[walkthroughState.entry.value];
    activeWalkthrough = null;
    if (!alreadySubmitted) fieldValues[field.key] = 'custom';
    renderFields();
    updatePreview();
  });

  btnRow.appendChild(applyBtn);
  btnRow.appendChild(cancelBtn);
  wrap.appendChild(btnRow);

  return wrap;
}

// Resolves `template` against `valuesObj` instead of the module-level `fieldValues`, by
// temporarily swapping the global binding — safe here (and only here) because resolveTemplate()
// runs fully synchronously with no callbacks left dangling after the swap-back. The interactive
// render* functions above use an explicit `values` parameter instead, since their event handlers
// fire later (on user input) and must keep pointing at the right store at that later time.
function resolveWithFieldValues(template, fields, valuesObj) {
  const saved = fieldValues;
  fieldValues = valuesObj;
  try {
    return resolveTemplate(template, fields, 'plain');
  } finally {
    fieldValues = saved;
  }
}

// Resolves a walkthrough's `produces` templates against its own local fieldValues and writes them
// into the outer note's ISSUE/ACTION_TAKEN/ADVICE. ISSUE/ACTION_TAKEN are always overwritten
// (whether this is the first submission or a later re-edit — last action wins, no merging with
// whatever was there before, hand-typed or from a prior submission); ADVICE is only overwritten
// when the walkthrough actually produced non-empty text, so an agent's own hand-typed advice
// survives running a walkthrough that has nothing to say about it.
function applyWalkthrough(walkthroughState, field) {
  const entry = walkthroughState.entry;
  const produces = entry.produces || {};
  const resolvedIssue = resolveWithFieldValues(produces.ISSUE || '', entry.fields, walkthroughState.fieldValues);
  const resolvedAction = resolveWithFieldValues(produces.ACTION_TAKEN || '', entry.fields, walkthroughState.fieldValues);
  const resolvedAdvice = resolveWithFieldValues(produces.ADVICE || '', entry.fields, walkthroughState.fieldValues);

  fieldValues['ISSUE'] = resolvedIssue;
  fieldValues['ACTION_TAKEN'] = resolvedAction;
  if (resolvedAdvice.trim()) fieldValues['ADVICE'] = resolvedAdvice;

  // Persist the structured input itself (not just the resolved text) so this walkthrough can be
  // reopened later via the "Edit" affordance and re-submitted, instead of only leaving behind
  // plain text the agent can merely hand-edit from here on. Works for any walkthrough entry —
  // keyed generically by entry.value, nothing here is specific to any one walkthrough's fields.
  submittedWalkthroughs[entry.value] = {
    fields: entry.fields,
    fieldValues: walkthroughState.fieldValues,
    producesTemplate: produces,
  };

  activeWalkthrough = null;
  renderFields();
  updatePreview();
}

// Removes a script by value from whichever category holds it. If that category has no scripts
// left afterward, removes the whole category too, so an emptied category never lingers in the
// dropdown data (same reasoning as renderQuickFillSelect's empty-category render guard).
function deleteQuickFillScript(value) {
  const categories = AppState.data.quickFillCategories || [];
  for (const cat of categories) {
    const idx = cat.scripts.findIndex(s => s.value === value);
    if (idx >= 0) {
      cat.scripts.splice(idx, 1);
      if (cat.scripts.length === 0) categories.splice(categories.indexOf(cat), 1);
      break;
    }
  }
  saveToStorage();
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
    renderFields();
    updatePreview();
  });

  wrap.appendChild(sel);

  // Once selected, render sub-script fields below the dropdown.
  // LO_NAME is deliberately skipped here — it's the same info as the
  // Agent Name / Dept field already collected at the top of the Universal
  // Note, so it's never asked twice. The value is synced in automatically
  // (see the sync in buildNote/updatePreview) whenever the note is built.
  if (universalAppScript) {
    const divider = document.createElement('div');
    divider.className = 'divider';
    divider.style.margin = '12px 0';
    wrap.appendChild(divider);

    renderFieldList(wrap, universalAppScript.fields.filter(f => f.key !== 'LO_NAME'), true);
  }

  return wrap;
}


// ── ACTION LOG FIELD ──
// Reuses the same options/multi-select behavior as the standalone VERIFICATION chips field
// (see the zelle-call-in / universal-note scripts) for any action-log row whose detailField is
// "verification-chips". There's no single VERIFICATION field object to point at from inside a row
// (rows live in an arbitrary script's action-log field, not necessarily alongside a VERIFICATION
// field), so the option list is duplicated here rather than looked up by key.
const VERIFICATION_CHIP_OPTIONS = ['CWV', 'RGV', 'IDV', 'RHQ', 'Voice IDV'];

function renderActionLogField(group, field, values = fieldValues) {
  if (!values[field.key]) values[field.key] = [];
  const rows = values[field.key];
  const rowTypes = field.rowTypes || [];

  const list = document.createElement('div');
  list.style.cssText = 'display:flex;flex-direction:column;gap:8px';

  if (!rows.length) {
    const empty = document.createElement('div');
    empty.className = 'hint';
    empty.style.padding = '4px 0';
    empty.textContent = 'No actions logged yet.';
    list.appendChild(empty);
  } else {
    rows.forEach((row, ri) => list.appendChild(makeActionLogRow(row, ri, rows, rowTypes)));
  }

  group.appendChild(list);

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn btn-ghost btn-sm';
  addBtn.style.marginTop = '8px';
  addBtn.textContent = '+ Add Action';
  addBtn.addEventListener('click', () => {
    const firstType = rowTypes[0];
    rows.push({
      type: firstType ? firstType.value : '',
      detail: firstType && firstType.detailField === 'verification-chips' ? [] : '',
      result: null,
      combinedWith: defaultCombinedWithForRowType(firstType, rowTypes),
    });
    renderFields();
    updatePreview();
  });
  group.appendChild(addBtn);
}

// Returns the rowType definitions `rt` declares in its own `combinesWith` list, restricted to
// those whose OWN detailField is "none". combinesWith is meant to be symmetric/declarative (either
// side listing the other is enough to offer the combination), but only "none"-detail types can
// currently be the ADDED-ON side of a combination — a combined row still renders just one shared
// detail/result control (the primary type's), so combining with a type that needs its own detail
// isn't supported yet. If a future combinesWith entry points at such a type, it's silently
// excluded here (and resolveActionLogRow falls back to just the primary sentence) rather than
// guessing at output — extending this to detailed combined types would need its own design.
function getCombinableRowTypes(rt, rowTypes) {
  if (!rt || !Array.isArray(rt.combinesWith) || !rt.combinesWith.length) return [];
  return rt.combinesWith
    .map(val => (rowTypes || []).find(o => o.value === val))
    .filter(o => o && o.detailField === 'none');
}

// Value for a freshly-created (or freshly-type-switched) row's combinedWith, honoring
// combinesWithDefault: true on the rowType — defaults to the first entry in that type's own
// (filtered, "none"-detail-only) combinable list, e.g. suppression/takeover default-checking
// "Also apply: VCAS 10 Minute Bypass". Only ever consulted at row-creation/type-change time (see
// the "+ Add Action" and type-select handlers below) — re-rendering an existing row never calls
// this, so an agent unchecking the box and submitting stays unchecked on reopen rather than
// reverting to the default.
function defaultCombinedWithForRowType(rt, rowTypes) {
  if (!rt || !rt.combinesWithDefault) return undefined;
  const combinable = getCombinableRowTypes(rt, rowTypes);
  return combinable.length ? combinable[0].value : undefined;
}

function makeActionLogRow(row, ri, rows, rowTypes) {
  const rt = rowTypes.find(r => r.value === row.type);

  const card = document.createElement('div');
  card.style.cssText = 'border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px;background:var(--surface2)';

  const topRow = document.createElement('div');
  topRow.className = 'row';
  topRow.style.cssText = 'gap:6px;margin-bottom:6px';

  const typeSel = document.createElement('select');
  typeSel.style.flex = '1';
  rowTypes.forEach(o => {
    const opt = document.createElement('option'); opt.value = o.value; opt.textContent = o.label;
    if (row.type === o.value) opt.selected = true;
    typeSel.appendChild(opt);
  });
  typeSel.addEventListener('change', () => {
    row.type = typeSel.value;
    const newRt = rowTypes.find(o => o.value === row.type);
    row.detail = newRt && newRt.detailField === 'verification-chips' ? [] : '';
    row.result = null;
    // combinedWith is specific to the old type — don't carry it over. Re-derive from the new
    // type's own combinesWithDefault instead of just clearing, so switching TO suppression/
    // takeover starts pre-checked same as adding a fresh row of that type would.
    row.combinedWith = defaultCombinedWithForRowType(newRt, rowTypes);
    renderFields();
    updatePreview();
  });
  topRow.appendChild(typeSel);

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'btn btn-danger btn-sm';
  delBtn.innerHTML = Icons.trash;
  delBtn.style.flexShrink = '0';
  delBtn.addEventListener('click', () => {
    rows.splice(ri, 1);
    renderFields();
    updatePreview();
  });
  topRow.appendChild(delBtn);

  card.appendChild(topRow);

  // "Also apply" — lets this row additionally emit a combined type's lead-in sentence (see
  // getCombinableRowTypes/resolveActionLogRow) without changing row.type itself. Only offered for
  // combinesWith entries whose OWN detailField is "none", since a combined row renders just one
  // shared detail/result control (the primary type's) — see getCombinableRowTypes.
  const combinable = getCombinableRowTypes(rt, rowTypes);
  if (combinable.length === 1) {
    const other = combinable[0];
    const wrap = document.createElement('label');
    wrap.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px;font-size:12px;font-weight:normal;text-transform:none;letter-spacing:normal;color:var(--text);cursor:pointer';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = row.combinedWith === other.value;
    cb.addEventListener('change', () => {
      row.combinedWith = cb.checked ? other.value : undefined;
      renderFields();
      updatePreview();
    });
    wrap.appendChild(cb);
    wrap.appendChild(document.createTextNode('Also apply: ' + other.label));
    card.appendChild(wrap);
  } else if (combinable.length > 1) {
    const wrap = document.createElement('div');
    wrap.className = 'chips';
    wrap.style.marginBottom = '6px';
    combinable.forEach(other => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip-branch' + (row.combinedWith === other.value ? ' selected' : '');
      btn.textContent = 'Also apply: ' + other.label;
      btn.addEventListener('click', () => {
        row.combinedWith = row.combinedWith === other.value ? undefined : other.value;
        renderFields();
        updatePreview();
      });
      wrap.appendChild(btn);
    });
    card.appendChild(wrap);
  }

  if (rt && rt.detailField !== 'none') {
    if (rt.detailField === 'verification-chips') {
      if (!Array.isArray(row.detail)) row.detail = [];
      const chips = document.createElement('div');
      chips.className = 'chips';
      chips.style.marginBottom = '6px';
      VERIFICATION_CHIP_OPTIONS.forEach(opt => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip' + (row.detail.includes(opt) ? ' selected' : '');
        chip.textContent = opt;
        chip.addEventListener('click', () => {
          const idx = row.detail.indexOf(opt);
          if (idx >= 0) row.detail.splice(idx, 1); else row.detail.push(opt);
          renderFields();
          updatePreview();
        });
        chips.appendChild(chip);
      });
      card.appendChild(chips);
    } else {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.placeholder = rt.detailPlaceholder || '';
      inp.value = typeof row.detail === 'string' ? row.detail : '';
      inp.style.marginBottom = '6px';
      inp.addEventListener('input', () => { row.detail = inp.value; updatePreview(); });
      card.appendChild(inp);
    }

    const resultRow = document.createElement('div');
    resultRow.className = 'chips';
    [['success', 'Successful'], ['fail', 'Not successful']].forEach(([val, lbl]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip-branch' + (row.result === val ? ' selected' : '');
      btn.textContent = lbl;
      btn.addEventListener('click', () => {
        row.result = row.result === val ? null : val;
        renderFields();
        updatePreview();
      });
      resultRow.appendChild(btn);
    });
    card.appendChild(resultRow);
  }

  return card;
}

// Joins each row's resolved sentence(s) in add-order into the ACTIONS placeholder text. Row
// behavior is keyed off the fixed rowType values (falcon/vrol/ov_rf/base_rf/takeover/suppression/
// vcas) used by the Card Decline Walkthrough quick-fill entry — same convention as
// resolveCallerSource hardcoding specific branch values below.
function resolveActionLogField(rows, rowTypes) {
  return (rows || [])
    .map(row => {
      const rt = rowTypes.find(r => r.value === row.type);
      return rt ? resolveActionLogRow(row, rt, rowTypes) : '';
    })
    .filter(s => s && s.trim())
    .join(' ');
}

// Resolves a single row's complete sentence(s). This is the ONLY place that builds a row's final
// wording — there is no other function anywhere that independently appends "Turned FM back on" or
// a VCAS mention. (A previous version split this across a per-type sentence helper plus a
// separate combined-template lookup that reused the "suppression" case's ending from inside the
// "takeover" case; keeping construction spread across two cooperating call sites like that is what
// let the FM-back-on/VCAS clauses fire twice for one row. Every rowType's full wording, combined or
// not, is written out directly in the switch below instead.)
function resolveActionLogRow(row, rt, rowTypes) {
  const detail = typeof row.detail === 'string' ? row.detail.trim() : '';
  const resultSentence = row.result === 'success' ? 'Transaction was successful.'
    : row.result === 'fail' ? 'Transaction was not successful.'
    : '';

  // combinedWith only ever points at a detailField:"none" type (enforced by the UI's
  // getCombinableRowTypes, which only ever OFFERS combining with those); the only bespoke combined
  // wording implemented so far is pairing with "vcas" specifically, for takeover/suppression below.
  const combinedRt = row.combinedWith ? (rowTypes || []).find(o => o.value === row.combinedWith) : null;
  const combinedWithVcas = !!(combinedRt && combinedRt.detailField === 'none' && row.combinedWith === 'vcas');

  switch (row.type) {
    case 'falcon':
      return 'Reviewed Falcon' + (detail ? ` — ${detail}` : '') + '.';

    case 'vrol':
      return 'Reviewed VROL' + (detail ? ` — ${detail}` : '') + '.';

    case 'ov_rf':
      return `Reviewed available RFs and updated OV RF ${detail}. Advised member to attempt transaction again.` + (resultSentence ? ` ${resultSentence}` : '');

    case 'base_rf':
      return `Reviewed history and updated Base RF. ${detail}.` + (resultSentence ? ` ${resultSentence}` : '');

    case 'takeover': {
      const chips = Array.isArray(row.detail) ? row.detail.join('/') : '';
      if (!combinedWithVcas) {
        // Standalone takeover: no FM-back-on of its own — that's normally logged as a separate
        // suppression row afterward.
        return `Took over call and further verified member via ${chips}. Received permission to turn off Fraud monitoring and advised member to attempt transaction again.` + (resultSentence ? ` ${resultSentence}` : '');
      }
      // Combined with VCAS: this one row covers the whole turn-off / bypass / attempt /
      // turn-back-on lifecycle, so it also carries the FM-back-on (and merchant referral on fail)
      // that would otherwise live on a separate suppression row. Order: chips clause, FM-off
      // clause (VCAS folded in), attempt clause, result, FM-back-on (always after the result,
      // never before), merchant referral last of all on fail.
      let sentence = `Took over call and further verified member via ${chips}. Received permission to turn off Fraud monitoring, and reviewed VCAS, adding a 10 Minute Bypass. Advised member to attempt transaction again.`;
      if (resultSentence) sentence += ` ${resultSentence}`;
      sentence += ' Turned FM back on.';
      if (row.result === 'fail') sentence += ' Advised to reach out to merchant.';
      return sentence;
    }

    case 'suppression': {
      // Result always comes first, "Turned FM back on" always after it — cleanup happens once the
      // outcome is known, never before — with the VCAS clause folded into that same FM-back-on
      // clause when combined, and the merchant referral last of all on fail.
      let sentence = resultSentence ? `${resultSentence} ` : '';
      sentence += combinedWithVcas ? 'Turned FM back on, and reviewed VCAS, adding a 10 Minute Bypass.' : 'Turned FM back on.';
      if (row.result === 'fail') sentence += ' Advised to reach out to merchant.';
      return sentence;
    }

    case 'vcas':
      // Standalone VCAS row (no combinedWith) — its own independent sentence, unaffected by any of
      // the above.
      return 'Reviewed VCAS and added 10 Minute Bypass.';

    default:
      return '';
  }
}

function renderSignatureField(group, key, values = fieldValues) {
  const saved = localStorage.getItem('fraudnotes_signature') || '';
  // Auto-populate from saved so it appears in output without retyping
  if (saved && !values[key]) values[key] = saved;

  const inp = document.createElement('textarea');
  inp.rows = 2;
  inp.style.resize = 'vertical';
  inp.placeholder = 'e.g. SOrazco\nStephanie Orazco';
  inp.value = values[key] || '';

  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.style.marginTop = '5px';
  hint.textContent = saved ? 'Remembered — type to update. Press Enter for a new line.' : 'Enter once and it will be remembered for next time. Press Enter for a new line.';

  inp.addEventListener('input', () => {
    values[key] = inp.value;
    localStorage.setItem('fraudnotes_signature', inp.value);
    updatePreview();
  });

  group.appendChild(inp);
  group.appendChild(hint);
}

// ── CLOSING / SYSTEMS FIELDS ──
function renderClosingField(group, key, values = fieldValues) {
  if (!values[key]) values[key] = [];
  const chips = document.createElement('div');
  chips.className = 'chips';
  (AppState.data.closingActions || []).forEach(opt => {
    const chip = document.createElement('button');
    chip.className = 'chip closing' + (values[key].includes(opt) ? ' selected' : '');
    chip.textContent = opt;
    chip.addEventListener('click', () => {
      const arr = values[key];
      const idx = arr.indexOf(opt);
      if (idx >= 0) { arr.splice(idx, 1); chip.classList.remove('selected'); }
      else { arr.push(opt); chip.classList.add('selected'); }
      updatePreview();
    });
    chips.appendChild(chip);
  });
  group.appendChild(chips);
}

function renderSystemsField(group, key, values = fieldValues) {
  if (!values[key]) values[key] = [];
  const chips = document.createElement('div');
  chips.className = 'chips';
  (AppState.data.systemsReviewed || []).forEach(opt => {
    const chip = document.createElement('button');
    chip.className = 'chip' + (values[key].includes(opt) ? ' selected' : '');
    chip.textContent = opt;
    chip.addEventListener('click', () => {
      const arr = values[key];
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

// Wraps any "(...)" segment in a value in the same .blank styling used for genuine unfilled
// placeholders — a visual nudge that the agent hasn't personalized that spot yet. Preview-only,
// called from renderTextFieldPreview below; never touches the plain-text clipboard path.
function highlightPlaceholders(html) {
  return html.replace(/\([^()]*\)/g, m => `<span class="blank">${m}</span>`);
}

// ── PREVIEW-ONLY RENDERING FOR TEXT FIELD VALUES ──
// Renders a 'text' field's raw value for the live preview: bold/color via the shared markup
// helper (CSS-variable colors, since this renders on our own page), "• " lines grouped into
// a real <ul><li> list for an actual WYSIWYG bulleted look, and any "(...)" placeholder segments
// highlighted yellow inside the green "filled" span. This is separate from the clipboard/export
// HTML in app.js, which deliberately keeps bullets as flat "• "-prefixed <p> lines instead of real
// list markup (Oracle's notes field is likely to strip <ul>/<li>) and never highlights parens.
function renderTextFieldPreview(displayVal) {
  const lines = displayVal.split('\n');
  const parts = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].startsWith(MARKUP_BULLET_PREFIX)) {
      let items = '';
      while (i < lines.length && lines[i].startsWith(MARKUP_BULLET_PREFIX)) {
        const content = lines[i].slice(MARKUP_BULLET_PREFIX.length);
        items += `<li><span style="color:var(--green)">${highlightPlaceholders(markupInlineToHtml(escapeHtml(content)))}</span></li>`;
        i++;
      }
      parts.push(`<ul class="preview-bullets">${items}</ul>`);
    } else {
      parts.push(`<span style="color:var(--green)">${highlightPlaceholders(markupInlineToHtml(escapeHtml(lines[i])))}</span>`);
      i++;
    }
  }
  return parts.join('<br>');
}

// ── RESOLVE TEMPLATE ──
function resolveTemplate(template, fields, mode) {
  let text = template;

  // Handle {{#IF_INCLUDES_SYSTEMS=Some System}}...{{/IF_INCLUDES_SYSTEMS}},
  // {{#IF_SET_KEY}}...{{/IF_SET_KEY}} (true when fieldValues[KEY] is non-empty), and
  // {{#IF_KEY=value}}...{{/IF_KEY}}. All three run every pass until the text stops changing, so
  // nested IF blocks of different kinds resolve correctly regardless of nesting depth or order.
  let prev;
  do {
    prev = text;
    text = text.replace(/\{\{#IF_INCLUDES_SYSTEMS=([^}]+)\}\}([\s\S]*?)\{\{\/IF_INCLUDES_SYSTEMS\}\}/g, (match, systemName, inner) => {
      const selected = fieldValues['SYSTEMS_REVIEWED'] || [];
      return selected.includes(systemName.trim()) ? inner : '';
    });
    text = text.replace(/\{\{#IF_SET_([A-Z0-9_]+)\}\}([\s\S]*?)\{\{\/IF_SET_\1\}\}/g, (match, key, inner) => {
      const val = fieldValues[key];
      const isSet = Array.isArray(val) ? val.length > 0 : !!(val && String(val).trim());
      return isSet ? inner : '';
    });
    text = text.replace(/\{\{#IF_([A-Z0-9_]+)=([a-z0-9_]+)\}\}([\s\S]*?)\{\{\/IF_\1\}\}/g, (match, key, val, inner) => {
      return fieldValues[key] === val ? inner : '';
    });
  } while (text !== prev);

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
    if (field.outputIgnore) return; // display-only field, never in output
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
    } else if (field.type === 'action-log') {
      val = resolveActionLogField(fieldValues[field.key] || [], field.rowTypes || []);
      displayVal = val || null;
    } else if (field.type === 'branch') {
      val = ''; displayVal = null;
    } else if (field.type === 'signature') {
      val = fieldValues[field.key] ? fieldValues[field.key] + '\nFraud Intake Team' : '';
      displayVal = val || null;
    } else if (field.type === 'chips' && field.multiple) {
      const arr = fieldValues[field.key] || [];
      val = arr.join(' & ');
      displayVal = val || null;
    } else {
      val = fieldValues[field.key] || '';
      displayVal = val || null;
    }

    if (mode === 'plain') {
      text = text.split(placeholder).join(val);
    } else {
      if (displayVal) {
        const inner = field.type === 'text'
          ? renderTextFieldPreview(displayVal)
          : `<span style="color:var(--green)">${escapeHtml(displayVal)}</span>`;
        text = text.split(placeholder).join(inner);
      } else {
        text = text.split(placeholder).join(`<span class="blank">${escapeHtml(field.label)}</span>`);
      }
    }
  });

  if (mode === 'plain') text = text.replace(/\{\{[^}]+\}\}/g, '');
  return text;
}

// Keeps the sub-script's hidden LO_NAME field in sync with the top-level
// Agent Name / Dept field, no matter which order the agent fills them in.
function syncAppSubScriptLoName() {
  if (universalAppScript) {
    fieldValues['LO_NAME'] = fieldValues['AGENT_INTRO'] || fieldValues['LO_NAME'] || '';
  }
}

function buildNote() {
  if (!currentScript) return '';

  // Universal note + application path: just the sub-script note, no universal header
  if (currentScript.id === 'universal-note' && fieldValues['CALL_TYPE'] === 'application' && universalAppScript) {
    syncAppSubScriptLoName();
    return resolveTemplate(universalAppScript.template, universalAppScript.fields, 'plain');
  }

  return resolveTemplate(currentScript.template, currentScript.fields, 'plain');
}

function updatePreview() {
  const preview = document.getElementById('preview');
  preview.style.fontFamily = NOTE_FONTS[noteFont] || '';
  preview.style.fontSize = NOTE_FONT_SIZES[noteFontSize] || '';
  if (!currentScript) {
    preview.innerHTML = '<span style="color:var(--text-dim);font-style:italic;">Select a script above to see the note preview.</span>';
    return;
  }

  // Universal note + application path: just the sub-script note
  if (currentScript.id === 'universal-note' && fieldValues['CALL_TYPE'] === 'application') {
    if (universalAppScript) {
      syncAppSubScriptLoName();
      preview.innerHTML = resolveTemplate(universalAppScript.template, universalAppScript.fields, 'html').replace(/\n/g, '<br>');
    } else {
      preview.innerHTML = '<span style="color:var(--text-dim);font-style:italic;">← Select an application script above</span>';
    }
    return;
  }

  preview.innerHTML = resolveTemplate(currentScript.template, currentScript.fields, 'html').replace(/\n/g, '<br>');
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
  copyToClipboard(note, { font: noteFont, fontSize: noteFontSize });
}

function onClear() {
  fieldValues = {};
  universalAppScript = null;
  activeWalkthrough = null;
  submittedWalkthroughs = {};
  renderFields();
  updatePreview();
}

document.addEventListener('DOMContentLoaded', async () => {
  setActiveNav();
  await loadScripts();
  initUsePage();
});
