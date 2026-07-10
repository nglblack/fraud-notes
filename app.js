// ── SHARED STATE ──
window.AppState = {
  data: null,
};

const STORAGE_KEY = 'fraudnotes_data';

// ── TOAST ──
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'show' + (type ? ' ' + type : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = ''; }, 2200);
}

// ── SAVE TO LOCALSTORAGE ──
function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(AppState.data));
  } catch(e) {
    console.warn('Could not save to localStorage', e);
  }
}

// ── LOAD DATA (localStorage first, then scripts.json) ──
async function loadScripts() {
  let fresh = null;
  try {
    const res = await fetch('scripts.json?_=' + Date.now());
    if (res.ok) fresh = await res.json();
  } catch (e) { /* fall through */ }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && Array.isArray(parsed.scripts)) {
        // Backfill any top-level key present in scripts.json but missing from an older cached
        // snapshot (e.g. a new key added after this cache was written), without touching keys
        // the cache already has — existing customizations/edits are left exactly as they are.
        if (fresh) {
          Object.keys(fresh).forEach(key => {
            if (!(key in parsed)) parsed[key] = fresh[key];
          });
        }
        AppState.data = parsed;
        return;
      }
    }
  } catch(e) { /* fall through */ }

  if (fresh) {
    AppState.data = fresh;
    saveToStorage();
    return;
  }

  AppState.data = { scripts: [], closingActions: [], systemsReviewed: [], quickFillCategories: [] };
  showToast('Could not load scripts.json', 'error');
}

// ── EXPORT JSON ──
function exportJSON() {
  const blob = new Blob([JSON.stringify(AppState.data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'scripts.json';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('scripts.json exported ✓', 'success');
}

// ── IMPORT JSON ──
function importJSON(callback) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!parsed.scripts || !Array.isArray(parsed.scripts)) throw new Error('Invalid format');
        AppState.data = parsed;
        saveToStorage();
        showToast('Imported successfully ✓', 'success');
        if (callback) callback();
      } catch {
        showToast('Invalid JSON file', 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ── NOTE MARKUP (shared by the Use-page live preview and the clipboard export below) ──
// Lightweight markup: "• " line prefix for bullets, **text** for bold, _text_ for italic.
const MARKUP_BOLD_RE = /\*\*(.+?)\*\*/g;
const MARKUP_ITALIC_RE = /_(.+?)_/g;
const MARKUP_BULLET_PREFIX = '• ';

// Converts already-HTML-escaped text: **bold** -> <b>, _italic_ -> <i>.
function markupInlineToHtml(escapedText) {
  return escapedText
    .replace(MARKUP_BOLD_RE, '<b>$1</b>')
    .replace(MARKUP_ITALIC_RE, '<i>$1</i>');
}

// Strips markup down to plain inner text: **bold** -> bold, _italic_ -> italic.
// "• " bullets are already the correct plain-text character, so they pass through untouched.
function markupInlineToPlain(text) {
  return text
    .replace(MARKUP_BOLD_RE, '$1')
    .replace(MARKUP_ITALIC_RE, '$1');
}

// Tag grammar for the format toolbar's toggle/replace logic (use.js): each type's opening-tag
// regex (anchored to the end of the text immediately before the selection), a matcher for its
// closing tag (immediately after the selection), and a builder for fresh open/close tag strings.
// This only detects a tag of the SAME type immediately wrapping a selection — bold and italic are
// free to nest around each other (e.g. **_text_**) and are never touched by each other's check.
const MARKUP_TAG_DEFS = {
  bold: {
    openRegex: /\*\*$/,
    matchClose: after => (after.startsWith('**') ? '**' : null),
    build: () => ['**', '**'],
    placeholder: 'bold text',
  },
  italic: {
    openRegex: /_$/,
    matchClose: after => (after.startsWith('_') ? '_' : null),
    build: () => ['_', '_'],
    placeholder: 'italic text',
  },
};

// ── WHOLE-NOTE FONT/SIZE (Preview panel controls, use.js) ──
// Shared with use.js the same way MARKUP_BULLET_PREFIX etc. are: defined once here since
// copyToClipboard (below) and the live preview (use.js) both need the same literal values.
// "default"/undefined keys resolve to undefined, meaning "no override" — the clipboard HTML omits
// the property entirely rather than writing a var()-based or empty value (Oracle-safe rule).
const NOTE_FONTS = {
  arial: 'Arial, Helvetica, sans-serif',
  times: "'Times New Roman', Times, serif",
  courier: "'Courier New', Courier, monospace",
  georgia: 'Georgia, serif',
  verdana: 'Verdana, Geneva, sans-serif',
};
const NOTE_FONT_SIZES = {
  small: '11px',
  normal: '13px',
  large: '16px',
};

// ── COPY TO CLIPBOARD ──
// options is optional — { font, fontSize } from the Preview panel's whole-note controls. Only
// onCopy() (use.js) passes it; the ACCT_NUM/APP_ID plain-value copy button calls this with no
// second argument, so it's unaffected (undefined keys resolve to undefined -> no style override).
function copyToClipboard(text, options) {
  const fontFamily = NOTE_FONTS[options && options.font];
  const fontSizePx = NOTE_FONT_SIZES[options && options.fontSize];

  const plainText = text.split('\n').map(markupInlineToPlain).join('\n');

  // Rich HTML version: every line is its own flat <p> (blank lines become empty <p> for spacing) —
  // most reliable for Oracle/web CRMs that strip <br> tags. Bullet lines stay as literal "• " text
  // inside a <p> rather than real <ul>/<li> markup, since list markup is likely to get stripped by
  // the same sanitizers that strip <br>. Font/size (when set) are applied per-<p> rather than on an
  // outer wrapper, since Oracle's paste sanitizer may not preserve styles inherited from a wrapper.
  let pStyle = 'margin:0';
  if (fontFamily) pStyle += `;font-family:${fontFamily}`;
  if (fontSizePx) pStyle += `;font-size:${fontSizePx}`;

  const escaped = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const html = '<!DOCTYPE html><html><body>' +
    escaped.split(/\n/).map(line =>
      line.trim() === ''
        ? `<p style="${pStyle}">&nbsp;</p>`
        : `<p style="${pStyle}">` + markupInlineToHtml(line) + '</p>'
    ).join('') +
    '</body></html>';

  if (navigator.clipboard && window.ClipboardItem) {
    const item = new ClipboardItem({
      'text/plain': new Blob([plainText], { type: 'text/plain' }),
      'text/html':  new Blob([html],  { type: 'text/html' }),
    });
    navigator.clipboard.write([item]).then(() => showToast('Copied to clipboard ✓', 'success'))
      .catch(() => {
        // Fallback to plain text if write fails
        navigator.clipboard.writeText(plainText).then(() => showToast('Copied to clipboard ✓', 'success'));
      });
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(plainText).then(() => showToast('Copied to clipboard ✓', 'success'));
  } else {
    const ta = document.createElement('textarea');
    ta.value = plainText;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Copied to clipboard ✓', 'success');
  }
}

// ── NAV ACTIVE STATE ──
function setActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('nav a').forEach(a => {
    const href = a.getAttribute('href');
    a.classList.toggle('active', href === page || (page === 'index.html' && href === 'use.html'));
  });
}

// ── SVG ICONS ──
const Icons = {
  use: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  create: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  upload: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,6 9,17 4,12"/></svg>`,
  up: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18,15 12,9 6,15"/></svg>`,
  down: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6,9 12,15 18,9"/></svg>`,
};
