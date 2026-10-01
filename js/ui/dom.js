// DOM helpers: element building, toasts, panels (stacked full-screen
// overlays) and dialogs.

import { audio } from '../core/audio.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// ---------------- toasts ----------------
export function toast(text, kind = 'info') {
  const root = $('#toasts');
  if (!root) return;
  const t = el(`<div class="toast toast-${kind}">${esc(text)}</div>`);
  root.appendChild(t);
  while (root.children.length > 4) root.firstChild.remove();
  setTimeout(() => t.classList.add('out'), 3600);
  setTimeout(() => t.remove(), 4200);
}

// ---------------- panels ----------------
const stack = [];
let onStackChange = () => {};
export function setPanelListener(fn) { onStackChange = fn; }
export function panelOpen() { return stack.length > 0; }

// Opens a full-screen panel. `render(root)` fills it and may be called again
// via panel.refresh(). Returns the panel handle.
export function openPanel(render, { cls = '', title = '', onClose = null, back = true } = {}) {
  const root = el(`<div class="panel ${cls}"><div class="panel-inner"></div></div>`);
  const inner = root.firstChild;
  const handle = {
    root, inner,
    refresh() { inner.innerHTML = ''; render(inner, handle); },
    close() { closePanel(handle); },
  };
  stack.forEach(p => p.root.classList.add('hidden'));
  $('#panels').appendChild(root);
  stack.push(handle);
  handle.onClose = onClose;
  handle.refresh();
  onStackChange(stack.length);
  return handle;
}

export function closePanel(handle = stack[stack.length - 1]) {
  if (!handle) return;
  const i = stack.indexOf(handle);
  if (i < 0) return;
  stack.splice(i, 1);
  handle.root.remove();
  handle.onClose?.();
  if (stack.length) stack[stack.length - 1].root.classList.remove('hidden');
  onStackChange(stack.length);
}

export function closeAllPanels() {
  while (stack.length) closePanel(stack[stack.length - 1]);
}

export function topPanel() { return stack[stack.length - 1] || null; }

// ---------------- dialogs ----------------
export function modal(title, html, buttons = [{ label: 'OK', primary: true }]) {
  return new Promise(resolve => {
    const m = el(`<div class="modal-back"><div class="modal">
      <h2>${esc(title)}</h2><div class="modal-body">${html}</div>
      <div class="modal-actions">${buttons.map((b, i) => `<button class="btn ${b.primary ? 'btn-primary' : ''} ${b.danger ? 'btn-danger' : ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div>
    </div></div>`);
    $('#modals').appendChild(m);
    m.querySelectorAll('button[data-i]').forEach(b => b.onclick = () => { audio.click(); m.remove(); resolve(buttons[+b.dataset.i].value ?? +b.dataset.i); });
    const first = m.querySelector('.btn-primary') || m.querySelector('button');
    first?.focus();
  });
}

export async function confirm(title, html, okLabel = 'Confirm', danger = false) {
  const r = await modal(title, html, [{ label: 'Cancel', value: false }, { label: okLabel, primary: !danger, danger, value: true }]);
  return r === true;
}

export function prompt(title, html, placeholder = '', initial = '') {
  return new Promise(resolve => {
    const m = el(`<div class="modal-back"><div class="modal"><h2>${esc(title)}</h2><div class="modal-body">${html}
      <input class="input" type="text" value="${esc(initial)}" placeholder="${esc(placeholder)}"></div>
      <div class="modal-actions"><button class="btn" data-c>Cancel</button><button class="btn btn-primary" data-ok>OK</button></div></div></div>`);
    $('#modals').appendChild(m);
    const inp = m.querySelector('input');
    inp.focus(); inp.select();
    const done = v => { m.remove(); resolve(v); };
    m.querySelector('[data-c]').onclick = () => done(null);
    m.querySelector('[data-ok]').onclick = () => done(inp.value);
    inp.onkeydown = e => { if (e.key === 'Enter') done(inp.value); if (e.key === 'Escape') done(null); };
  });
}

export function modalOpen() { return !!document.querySelector('#modals .modal-back'); }

// Small helper for wiring click handlers by data-action.
export function bind(root, handlers) {
  root.querySelectorAll('[data-action]').forEach(n => {
    const fn = handlers[n.dataset.action];
    if (fn) n.addEventListener('click', e => { e.stopPropagation(); audio.click(); fn(n.dataset, n, e); });
    else n.addEventListener('click', () => toast('Not wired up: ' + n.dataset.action, 'bad'));
  });
}

export function bar(pct, cls = '') {
  return `<div class="bar ${cls}"><div style="width:${Math.max(0, Math.min(100, pct))}%"></div></div>`;
}
