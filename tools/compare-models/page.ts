// Makes qa/25/compare-models.html from qa/25/results.json. Grimoire look (brand/grimoire-look.md), still sky.
// Run from the repo root:  node tools/compare-models/page.ts
import { readFileSync, writeFileSync } from 'node:fs';

import { library } from './library.ts';

type Answer = {
  model: string; label: string; ms: number; error: string | null; cost: number | null; provider: string | null;
  formatOk: boolean; raw: string | null; reply: string | null; actions: Record<string, unknown>[]; actionsKept: number;
};
type Result = { n: number; text: string; good: string; caseCardProcedure?: string; blocked: boolean; blockReason: string | null; mustBlock?: boolean; answers: Answer[] };
const run = JSON.parse(readFileSync('qa/25/results.json', 'utf8')) as { ranAt: string; models: { id: string; label: string }[]; results: Result[] };

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const names = new Map<string, string>();
for (const i of library.data.items) names.set(i.id, i.name);
for (const c of library.data.cards) names.set(c.id, `${c.procedure} (${c.surgeon})`);
for (const l of library.data.cardItems) names.set(l.id, `line: ${names.get(l.item_id)} ${l.phase}`);
for (const d of library.contextInput.myDepartments) names.set(d.id, d.label);
const nm = (id: unknown) => (id ? names.get(String(id)) ?? `unknown id "${String(id).slice(0, 12)}"` : '');

function actionText(a: Record<string, unknown>): string {
  switch (a.type) {
    case 'open_item': return `Opens item: ${nm(a.item_id)}`;
    case 'open_card': return `Opens card: ${nm(a.card_id)}`;
    case 'show_results': return `Shows: ${[...((a.item_ids as string[]) ?? []), ...((a.card_ids as string[]) ?? [])].map(nm).join(', ') || 'nothing'}`;
    case 'go_to': return `Goes to: ${a.tab}`;
    case 'switch_department': return `Switches to: ${nm(a.department_id)}`;
    default: return `Draft (${a.kind}): ${a.summary ?? ''}`;
  }
}

const sec = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const money = (c: number | null) => (c === null ? '—' : c === 0 ? 'free' : `$${c.toFixed(4)}`);
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

// Summary per model
const sent = run.results.filter((r) => r.answers.length);
const summary = run.models.map((m) => {
  const as = sent.map((r) => r.answers.find((a) => a.model === m.id)!).filter(Boolean);
  const ok = as.filter((a) => a.formatOk);
  const badIds = ok.filter((a) => a.actionsKept < a.actions.length).length;
  return {
    label: m.label, id: m.id, total: as.length, ok: ok.length,
    errors: as.filter((a) => a.error).length,
    broken: as.filter((a) => !a.error && !a.formatOk).length,
    badIds,
    median: median(as.filter((a) => !a.error).map((a) => a.ms)),
    slowest: Math.max(0, ...as.filter((a) => !a.error).map((a) => a.ms)),
    cost: as.reduce((s, a) => s + (a.cost ?? 0), 0),
  };
});

function card(a: Answer): string {
  const state = a.error ? ['bad', 'Failed'] : !a.formatOk ? ['bad', 'Broken format'] : a.actionsKept < a.actions.length ? ['warn', 'Made-up id'] : ['ok', 'Clean'];
  const body = a.error
    ? `<p class="quiet">${esc(a.error)}</p>`
    : !a.formatOk
      ? `<p class="quiet">What came back:</p><pre>${esc(a.raw || '(empty)')}</pre>`
      : `<p class="reply">${esc(a.reply)}</p>${a.actions.length ? `<ul>${a.actions.map((x) => `<li>${esc(actionText(x))}</li>`).join('')}</ul>` : '<p class="quiet">No action.</p>'}`;
  return `<div class="win ans"><i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i>
    <div class="ah"><b>${esc(a.label)}</b><span class="tag ${state[0]}">${state[1]}</span></div>
    <div class="meta">${sec(a.ms)} · ${money(a.cost)}</div>${body}</div>`;
}

function question(r: Result): string {
  const head = `<h3><span class="num">${r.n}</span> “${esc(r.text)}”</h3>
    ${r.caseCardProcedure ? `<p class="quiet">Case open on the phone: ${esc(r.caseCardProcedure)}.</p>` : ''}
    <p class="good"><b>A good answer:</b> ${esc(r.good)}</p>`;
  if (!r.answers.length) {
    const msg = r.blocked ? `Blocked on the phone by the scrubber: “${esc(r.blockReason)}”. Not sent to any model.` : 'The scrubber did NOT block this. It was not sent.';
    return `<section class="q">${head}<div class="win blocked ${r.blocked ? '' : 'miss'}"><i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i>${msg}</div></section>`;
  }
  return `<section class="q">${head}<div class="grid">${r.answers.map(card).join('')}</div></section>`;
}

// Still star field: fixed pseudo-random dots as one box-shadow.
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const tints = ['#ffffff', '#cfe0ff', '#d9c8ff', '#f7e3b0'];
const stars = Array.from({ length: 260 }, (_, i) => {
  const onBand = i % 3 === 0;
  const x = onBand ? rnd() * 100 : rnd() * 100;
  const y = onBand ? Math.min(99, Math.max(1, 70 - x * 0.62 + (rnd() - 0.5) * 14)) : rnd() * 100;
  return `${x.toFixed(2)}vw ${y.toFixed(2)}vh 0 ${rnd() < 0.06 ? 1 : 0}px ${tints[i % 4]}`;
}).join(',');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chat box model test</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;800&display=swap" rel="stylesheet">
<style>
:root{--page:#0b0a1f;--win:#14122e;--raised:#1d1a40;--line:#2e2a5c;--text:#f3eefe;--quiet:#aaa4d2;--faint:#6e689e;--gold:#f5c96a;--gold-d:#2f2614;--violet:#b79cff;--violet-d:#251d4d;--coral:#e63946}
*{box-sizing:border-box}
body{margin:0;background:var(--page);color:var(--text);font:16px/1.5 Arial,sans-serif;min-height:100vh}
.sky{position:fixed;inset:0;z-index:-1;overflow:hidden;background:
 radial-gradient(60vw 40vh at 15% 20%,rgba(120,60,140,.28),transparent 70%),
 radial-gradient(55vw 45vh at 85% 70%,rgba(40,50,140,.30),transparent 70%),
 radial-gradient(40vw 30vh at 70% 10%,rgba(245,201,106,.08),transparent 70%),
 radial-gradient(70vw 50vh at 40% 90%,rgba(90,40,120,.22),transparent 70%),var(--page)}
.sky::before{content:"";position:absolute;left:-20%;top:30%;width:140%;height:26%;transform:rotate(-32deg);background:linear-gradient(transparent,rgba(200,180,255,.07),transparent);filter:blur(30px)}
.sky::after{content:"";position:absolute;inset:0;box-shadow:inset 0 0 160px rgba(0,0,0,.7)}
.stars{position:absolute;left:0;top:0;width:1px;height:1px;border-radius:50%;box-shadow:${stars}}
.sigil{position:absolute;right:-120px;bottom:-120px;width:420px;height:420px;border:1px solid rgba(183,156,255,.12);border-radius:50%;box-shadow:0 0 0 30px rgba(183,156,255,.03),inset 0 0 0 60px rgba(183,156,255,.025)}
main{max-width:1280px;margin:0 auto;padding:32px 16px 64px}
h1,h2,h3{font-family:Cinzel,Georgia,serif;margin:0}
h1{font-size:30px;text-transform:uppercase;letter-spacing:.06em;font-weight:800;color:var(--gold)}
h2{font-size:21px;text-transform:uppercase;letter-spacing:.06em;margin:40px 0 14px;color:var(--violet)}
h3{font-size:18px;font-weight:600}
.lead{color:var(--quiet);max-width:780px}
.win{position:relative;background:rgba(29,26,64,.38);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid var(--line);padding:16px;box-shadow:0 10px 30px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.05)}
.win::before{content:"";position:absolute;inset:0;background:linear-gradient(rgba(255,255,255,.04),transparent 40%);pointer-events:none}
.c{position:absolute;width:12px;height:12px;border-color:var(--gold);border-style:solid;border-width:0;opacity:.8}
.tl{top:6px;left:6px;border-top-width:1px;border-left-width:1px}.tr{top:6px;right:6px;border-top-width:1px;border-right-width:1px}
.bl{bottom:6px;left:6px;border-bottom-width:1px;border-left-width:1px}.br{bottom:6px;right:6px;border-bottom-width:1px;border-right-width:1px}
.todo{border-color:var(--gold);margin:20px 0}
.todo b{color:var(--gold)}
table{width:100%;border-collapse:collapse;font-size:15px}
th,td{text-align:left;padding:10px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--quiet);font-weight:400;font-size:14px}
td.n{font-family:Cinzel,Georgia,serif;font-weight:600;font-size:17px}
.tablewrap{overflow-x:auto}
.q{margin:28px 0}
.good{color:var(--quiet);margin:6px 0 12px}.good b{color:var(--gold);font-weight:400}
.num{display:inline-block;min-width:30px;color:var(--violet)}
.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
@media (max-width:1000px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:600px){.grid{grid-template-columns:1fr}h1{font-size:24px}}
.ans{font-size:15px}
.ah{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap}
.meta{color:var(--faint);font-size:13px;margin:4px 0 8px}
.reply{margin:0 0 8px}
.ans ul{margin:0;padding-left:18px;color:var(--violet)}
.quiet{color:var(--quiet);margin:0}
.tag{font-size:13px;padding:2px 8px;border:1px solid}
.tag.ok{color:var(--violet);border-color:var(--violet);background:var(--violet-d)}
.tag.warn{color:var(--gold);border-color:var(--gold);background:var(--gold-d)}
.tag.bad{color:#000;background:var(--coral);border-color:var(--coral)}
pre{white-space:pre-wrap;word-break:break-word;font:13px/1.4 Consolas,monospace;color:var(--quiet);margin:6px 0 0;max-height:180px;overflow:auto}
.blocked{color:var(--violet)}.blocked.miss{color:#000;background:var(--coral)}
footer{color:var(--faint);font-size:13px;margin-top:48px}
</style></head><body>
<div class="sky"><div class="stars"></div><div class="sigil"></div></div>
<main>
<h1>Chat box model test</h1>
<p class="lead">OR-Nav ticket 25, step 1. The same ${run.results.length} questions went to four AI models through OpenRouter, with the real chat box prompt and the Sample General Hospital / Main OR library. Run on ${esc(new Date(run.ranAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }))}.</p>
<div class="win todo"><i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i>
<b>Your step, Sean:</b> read the answers, then tell Claude the order to try the models in (first to last). Free models go first; Claude Haiku is paid and goes last.</div>

<h2>Scorecard</h2>
<div class="win tablewrap"><i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i>
<table><tr><th>Model</th><th>Clean answers</th><th>Failed (error, busy, timeout)</th><th>Broken format</th><th>Made-up ids</th><th>Typical time</th><th>Slowest</th><th>Cost (all ${sent.length})</th></tr>
${summary.map((s) => `<tr><td class="n">${esc(s.label)}</td><td>${s.ok} of ${s.total}</td><td>${s.errors}</td><td>${s.broken}</td><td>${s.badIds}</td><td>${sec(s.median)}</td><td>${sec(s.slowest)}</td><td>${money(s.cost)}</td></tr>`).join('')}
</table>
<p class="quiet" style="margin-top:10px;font-size:14px">“Made-up id” means the model pointed at an item or card that is not in the library. The app drops those, so they do no harm, but the nurse gets less help. “Broken format” and “Failed” answers make the server try the next model.</p>
</div>

<h2>Answers side by side</h2>
${run.results.map(question).join('\n')}
<footer>Made by tools/compare-models (run.ts, page.ts). Raw data: qa/25/results.json. Model ids: ${run.models.map((m) => esc(m.id)).join(', ')}.</footer>
</main></body></html>`;

writeFileSync('qa/25/compare-models.html', html);
console.log('Saved qa/25/compare-models.html');
