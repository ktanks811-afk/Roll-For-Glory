// Your FWPD record as a list: unpaid tickets and open warrants. Shared by
// the FWPD phone app and the precinct counter.

import { esc } from './dom.js';
import { fmtMoney } from '../core/state.js';
import { ensureRecord } from '../core/warrants.js';
import { caseLine, recordHtml as courtRecord } from './court.js';

export function recordHtml(s) {
  return warrantsHtml(s) + caseLine(s) + courtRecord(s);
}

function warrantsHtml(s) {
  ensureRecord(s);
  const { citations, warrants } = s;
  if (!citations.length && !warrants.length) return '<div class="li"><span>✅</span><div class="grow"><div class="t">No warrants</div><div class="s">No unpaid tickets either. Keep it that way.</div></div></div>';
  return `${warrants.length ? `<div class="section-title">Warrants</div>${warrants.map(w => `<div class="li"><span>${w.felony ? '🚨' : '⚠'}</span><div class="grow"><div class="t">${esc(w.text)}</div><div class="s">Issued day ${w.day} · ${w.kind === 'bailjump' ? `<b class="bad">Court warrant${w.felony ? ' (felony)' : ''}</b> — turn yourself in at the courthouse or a precinct` : w.felony ? '<b class="bad">Felony</b> — turn yourself in or get arrested' : 'Misdemeanour — can be paid'}</div></div>${w.fine ? `<b>${fmtMoney(w.fine)}</b>` : ''}</div>`).join('')}` : ''}
    ${citations.length ? `<div class="section-title">Unpaid tickets</div>${citations.map(c => `<div class="li"><span>🧾</span><div class="grow"><div class="t">${esc(c.text)}</div><div class="s">Due by day ${c.due}${c.due <= s.time.day ? ' — <b class="bad">due today</b>' : ''}</div></div><b>${fmtMoney(c.fine)}</b></div>`).join('')}` : ''}`;
}
