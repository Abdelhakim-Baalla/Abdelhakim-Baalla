// Builds every SVG in assets/ from the brand fonts, so the README renders the
// same typography as baalla.tech without depending on fonts GitHub cannot load.
// Run: node scripts/build.mjs   (GH_TOKEN or GITHUB_TOKEN refreshes the live numbers)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets');
const DATA = join(ROOT, 'scripts', 'data.json');
const LOGIN = 'Abdelhakim-Baalla';
mkdirSync(OUT, { recursive: true });

const font = (f) => opentype.loadSync(join(ROOT, 'fonts', f));
const F = {
  sans: font('Geist-Regular.ttf'),
  medium: font('Geist-Medium.ttf'),
  bold: font('Geist-SemiBold.ttf'),
  mono: font('GeistMono-Regular.ttf'),
  serif: font('InstrumentSerif-Regular.ttf'),
  italic: font('InstrumentSerif-Italic.ttf'),
  hand: font('Caveat-Medium.ttf'),
};

const THEMES = {
  light: {
    fg: '#0b0b0c', soft: '#3d3d42', muted: '#63636b', faint: '#9a9aa1',
    accent: '#2d5cff', panel: '#f4f4f1', dot: '#0b0b0c', dotO: 0.13,
    line: '#d5d5d0', green: '#128a4b', btn: '#0b0b0c', btnFg: '#fbfbfa', btn2: '#f0f0ed',
    paper: '#f6f6f3', strip: '#ecece8',
  },
  dark: {
    fg: '#f4f4f2', soft: '#d3d3d6', muted: '#a1a1a8', faint: '#6f6f77',
    accent: '#8fa7ff', panel: '#161a22', dot: '#ffffff', dotO: 0.14,
    line: '#3a3f4a', green: '#4ade80', btn: '#f4f4f2', btnFg: '#0b0b0c', btn2: '#1c212b',
    paper: '#12161d', strip: '#1a1f29',
  },
};

const W = 880;
const EASE = 'cubic-bezier(0.16,1,0.3,1)';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const n = (v) => +(+v).toFixed(2);

// ---- text → paths ---------------------------------------------------------
const width = (t, f, size, ls = 0) => f.getAdvanceWidth(t, size, { letterSpacing: ls });
function text(t, x, y, f, size, cls, { ls = 0, anchor = 'start', extra = '' } = {}) {
  const w = width(t, f, size, ls);
  const x0 = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
  const d = f.getPath(t, x0, y, size, { letterSpacing: ls }).toPathData(1);
  return `<path class="${cls}" ${extra} d="${d}"/>`;
}
// A line made of several runs: [{t, f, size, cls, ls}]
function runs(parts, x, y, { anchor = 'start' } = {}) {
  const total = parts.reduce((a, p) => a + width(p.t, p.f, p.size, p.ls || 0), 0);
  let cx = anchor === 'end' ? x - total : x;
  let out = '';
  for (const p of parts) {
    out += text(p.t, cx, y, p.f, p.size, p.cls, { ls: p.ls || 0 });
    cx += width(p.t, p.f, p.size, p.ls || 0);
  }
  return { svg: out, width: total, end: cx };
}
function wrap(words, f, size, max, sep = ' ') {
  const lines = [];
  let cur = [];
  for (const w of words) {
    const trial = [...cur, w].join(sep);
    if (cur.length && width(trial, f, size) > max) { lines.push(cur); cur = [w]; } else cur.push(w);
  }
  if (cur.length) lines.push(cur);
  return lines;
}
// One path per letter, so a word can arrive letter by letter.
function letters(t, x, y, f, size, cls, { ls = 0, base = 0, step = 28 } = {}) {
  let out = '';
  [...t].forEach((ch, k) => {
    const cx = x + width(t.slice(0, k), f, size, ls);
    out += `<g class="lt" style="animation-delay:${base + k * step}ms">${text(ch, cx, y, f, size, cls)}</g>`;
  });
  return out;
}
// A figure whose digits roll into place. At rest (and without motion) it shows the true value.
function odo(str, x, y, f, size, cls, id, { ls = 0, delay = 0 } = {}) {
  const lh = size * 1.18;
  let defs = '', out = '';
  [...str].forEach((ch, k) => {
    const cx = x + width(str.slice(0, k), f, size, ls);
    if (!/\d/.test(ch)) { out += text(ch, cx, y, f, size, cls); return; }
    const cw = width(ch, f, size);
    defs += `<clipPath id="${id}${k}"><rect x="${n(cx - 2)}" y="${n(y - size * 0.84)}" width="${n(cw + 4)}" height="${n(size * 1.04)}"/></clipPath>`;
    let strip = '';
    for (let j = 0; j < 10; j++) strip += text(String((+ch + 10 - j) % 10), cx, y + j * lh, f, size, cls);
    out += `<g clip-path="url(#${id}${k})"><g class="roll" style="--r:${n(-9 * lh)}px;animation-delay:${delay + k * 90}ms">${strip}</g></g>`;
  });
  return { svg: `<defs>${defs}</defs>${out}`, width: width(str, f, size, ls) };
}

function svg(h, t, title, body, css = '', w = W) {
  const c = THEMES[t];
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<style>
.fg{fill:${c.fg}}.soft{fill:${c.soft}}.muted{fill:${c.muted}}.faint{fill:${c.faint}}.accent{fill:${c.accent}}
.panel{fill:${c.panel}}.green{fill:${c.green}}.btn{fill:${c.btn}}.btnfg{fill:${c.btnFg}}.btn2{fill:${c.btn2}}.paper{fill:${c.paper}}.strip{fill:${c.strip}}
.s-accent{stroke:${c.accent}}.s-muted{stroke:${c.muted}}.s-fg{stroke:${c.fg}}.s-line{stroke:${c.line}}.s-btnfg{stroke:${c.btnFg}}
.ico{fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.in{animation:rise .7s ${EASE} both;animation-delay:calc(var(--i,0)*70ms)}
@keyframes rise{from{opacity:0;transform:translateY(12px)}}
.lt{animation:letter .7s ${EASE} both}
@keyframes letter{from{opacity:0;transform:translateY(.4em)}}
.roll{animation:roll 1.500s ${EASE} both}
@keyframes roll{from{transform:translateY(var(--r))}}
.note{animation:fade .6s ease-out .7s both}
@keyframes fade{from{opacity:0}}
.draw{stroke-dasharray:1;animation:draw .7s ${EASE} 1s both}
@keyframes draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
.ping{transform-box:fill-box;transform-origin:center;animation:ping 2.400s ease-out infinite}
@keyframes ping{from{opacity:.55;transform:scale(1)}80%,to{opacity:0;transform:scale(2.600)}}
${css}
@media (prefers-reduced-motion:reduce){*{animation:none!important}.ping{opacity:0}}
</style>
${body}
</svg>
`;
}
const emit = (name, fn) => {
  for (const t of Object.keys(THEMES)) writeFileSync(join(OUT, `${name}-${t}.svg`), fn(t, THEMES[t]));
};
const arrow = (x, y, s, cls) =>
  `<path class="ico ${cls}" transform="translate(${x} ${y}) scale(${n(s / 24)})" d="M7 17 17 7M9 7h8v8"/>`;
const dotsDef = (c) => `<pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="1" fill="${c.dot}" fill-opacity="${c.dotO}"/></pattern>`;

// ---- live data ------------------------------------------------------------
async function loadData() {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (token) {
    try {
      const h = { authorization: `Bearer ${token}`, 'user-agent': 'profile-readme', accept: 'application/vnd.github+json' };
      const gql = await fetch('https://api.github.com/graphql', {
        method: 'POST', headers: h,
        body: JSON.stringify({ query: `{user(login:"${LOGIN}"){contributionsCollection{contributionCalendar{totalContributions weeks{contributionDays{date contributionCount}}}}}}` }),
      }).then((r) => r.json());
      const cal = gql.data.user.contributionsCollection.contributionCalendar;
      // Unauthenticated-equivalent endpoints: public repositories only.
      const pub = { 'user-agent': 'profile-readme', accept: 'application/vnd.github+json' };
      const user = await fetch(`https://api.github.com/users/${LOGIN}`, { headers: pub }).then((r) => r.json());
      const repos = await fetch(`https://api.github.com/users/${LOGIN}/repos?per_page=100&type=owner`, { headers: pub }).then((r) => r.json());
      if (!Array.isArray(repos) || !user.public_repos) throw new Error('GitHub REST answer was not usable');
      const data = {
        total: cal.totalContributions,
        repos: user.public_repos,
        stars: repos.reduce((a, r) => a + r.stargazers_count, 0),
        days: cal.weeks.map((w) => w.contributionDays.map((d) => [d.date, d.contributionCount])),
      };
      writeFileSync(DATA, JSON.stringify(data));
      return data;
    } catch (e) {
      console.warn('Live fetch failed, using cached data:', e.message);
    }
  }
  if (!existsSync(DATA)) throw new Error('No scripts/data.json and no token to fetch it.');
  return JSON.parse(readFileSync(DATA, 'utf8'));
}

// ---- hero -----------------------------------------------------------------
const PHRASES = ['production web apps.', 'considered interfaces.', 'reliable APIs.', 'open-source tools.', 'things that last.'];
// The line types itself: every character has its own on/off window, and the caret follows the edge.
function typed(x, y, size) {
  const cw = width('a', F.mono, size);
  const SLOT = 3.6, T = SLOT * PHRASES.length, TYPE = 0.05, HOLD = 2.5, DEL = 0.024;
  const pct = (s) => n((s / T) * 100);
  let out = '', css = '', caret = [];
  PHRASES.forEach((p, i) => {
    const s = i * SLOT, len = p.length;
    out += `<g class="ph${i ? '' : ' ph0'}">`;
    [...p].forEach((ch, k) => {
      const a = s + (k + 1) * TYPE, b = s + HOLD + (len - 1 - k) * DEL;
      caret.push([a, k + 1], [b, k]);
      if (ch === ' ') return;
      const id = `c${i}_${k}`;
      css += `@keyframes ${id}{0%{opacity:0}${pct(a)}%{opacity:1}${pct(b)}%,to{opacity:0}}`;
      out += `<g class="ch" style="animation-name:${id}">${text(ch, x + k * cw, y, F.mono, size, 'fg')}</g>`;
    });
    out += `</g>`;
  });
  caret.sort((p, q) => p[0] - q[0]);
  css += `@keyframes caret{0%{transform:translateX(0)}${caret.map(([s, k]) => `${pct(s)}%{transform:translateX(${n(k * cw)}px)}`).join('')}}`;
  css += `.ch{opacity:0;animation:${T}s step-end infinite both}.caret{animation:caret ${T}s step-end infinite}.blink{animation:blink 1.060s step-end infinite}
@keyframes blink{50%{opacity:0}}
@media (prefers-reduced-motion:reduce){.ph0 .ch{opacity:1}.caret{opacity:0}}`;
  out += `<g class="caret"><rect class="accent blink" x="${n(x + 2)}" y="${n(y - size * 0.86)}" width="${n(size * 0.5)}" height="${n(size * 1.12)}" rx="1"/></g>`;
  return { svg: out, css };
}
function hero(data) {
  return (t, c) => {
    const MAIN = 338, STRIP = 74, H = MAIN + STRIP, PX = 36;
    const portrait = readFileSync(join(ROOT, 'scripts', 'portrait.jpg')).toString('base64');
    let b = `<defs>${dotsDef(c)}
<clipPath id="card"><rect width="${W}" height="${H}" rx="18"/></clipPath>
<clipPath id="ph"><rect x="0" y="0" width="182" height="228" rx="2"/></clipPath>
<filter id="lift" x="-30%" y="-20%" width="160%" height="160%"><feDropShadow dx="0" dy="14" stdDeviation="14" flood-color="#101014" flood-opacity="${t === 'dark' ? 0.6 : 0.2}"/></filter>
</defs>
<g clip-path="url(#card)"><rect class="paper" width="${W}" height="${H}"/><rect width="${W}" height="${MAIN}" fill="url(#dots)"/><rect class="strip" y="${MAIN}" width="${W}" height="${STRIP}"/></g>
<g transform="translate(${PX} 0)">`;

    b += letters('Abdelhakim', -3, 106, F.bold, 72, 'fg', { ls: -0.04, base: 60, step: 30 });
    const baw = width('Baâlla', F.italic, 86, -0.01);
    b += letters('Baâlla', -1, 184, F.italic, 86, 'fg', { ls: -0.01, base: 300, step: 45 });
    b += `<rect class="accent sq" x="${n(baw + 5)}" y="172" width="12" height="12"/>`;

    const lead = 'I build ';
    const ty = typed(width(lead, F.mono, 17), 232, 17);
    b += `<g class="in" style="--i:8">${text(lead, 0, 232, F.mono, 17, 'muted')}${ty.svg}</g>`;

    b += `<g class="in" style="--i:10"><circle class="green ping" cx="6" cy="271" r="4.500"/><circle class="green" cx="6" cy="271" r="4.500"/>
${text('Tech Lead & AI Systems Architect', 20, 276, F.medium, 16, 'fg')}
${runs([{ t: 'at  ', f: F.sans, size: 16, cls: 'muted' }, { t: 'Ton avenir au maroc', f: F.medium, size: 16, cls: 'fg' }, { t: '   ·   Agadir, Morocco', f: F.sans, size: 16, cls: 'muted' }], 20, 300).svg}</g>`;

    // The photograph, as on the portfolio: it lands, then barely floats.
    b += `<g class="float"><g class="land"><g transform="translate(610 70) rotate(2.200 98 124)">
<rect x="0" y="0" width="196" height="248" rx="3" fill="#fbfbfa" filter="url(#lift)"/>
<g transform="translate(7 7)" clip-path="url(#ph)"><image width="182" height="273" xlink:href="data:image/jpeg;base64,${portrait}" href="data:image/jpeg;base64,${portrait}" preserveAspectRatio="xMidYMin slice"/></g>
</g></g></g>`;

    b += `<g class="note" transform="rotate(-5 720 36)">
${text('open to select work,', 776, 32, F.hand, 22, 'muted', { anchor: 'end' })}
${text('say hello', 776, 55, F.hand, 22, 'muted', { anchor: 'end' })}
</g>
<path class="ico s-muted draw" pathLength="1" d="M752 62c15 0 27 5 33 16m0 0-8-4m8 4 1-9"/>`;
    b += `</g>`;

    // The strip: four true figures, rolling in
    const cells = [
      [String(data.repos), 'public repositories'],
      ['15', 'certifications'],
      ['4', 'spoken languages'],
      ['24h', 'typical reply'],
    ];
    const cw = (W - PX * 2) / cells.length;
    cells.forEach(([fig, label], i) => {
      const x = PX + cw * i;
      b += `<g class="in" style="--i:${12 + i}">${odo(fig, x - 1, MAIN + 36, F.bold, 26, 'fg', `o${i}_`, { ls: -0.03, delay: 900 + i * 120 }).svg}${text(label, x, MAIN + 56, F.sans, 13.5, 'muted')}</g>`;
    });

    const css = `${ty.css}
.sq{transform-box:fill-box;transform-origin:center;animation:stamp .5s ${EASE} .75s both}
@keyframes stamp{from{opacity:0;transform:scale(.2)}}
.land{transform-box:fill-box;transform-origin:center;animation:land .9s ${EASE} .25s both}
@keyframes land{from{opacity:0;transform:translateY(18px) rotate(-5deg) scale(.96)}}
.float{animation:float 7s ease-in-out 1.200s infinite alternate}
@keyframes float{to{transform:translateY(-5px)}}`;
    return svg(H, t, `Abdelhakim Baâlla. I build production web apps, considered interfaces, reliable APIs, open-source tools, things that last. Tech Lead and AI Systems Architect at Ton avenir au maroc, Agadir, Morocco. Open to select work. ${data.repos} public repositories, 15 certifications, 4 spoken languages, replies within 24 hours.`, b, css);
  };
}

// ---- headings -------------------------------------------------------------
const HEADS = {
  work: ['Things I’ve ', 'built', 'side projects & open source'],
  path: ['The path so ', 'far', 'the next chapter is underway'],
  stack: ['The stack I ship ', 'with', 'not a logo wall'],
  proof: ['Proof of ', 'practice', 'always one more course'],
  year: ['A year in ', 'dots', 'redrawn every morning'],
};
function heading(a, i, note) {
  return (t) => {
    const size = 34, y = 40;
    const aw = width(a, F.bold, size, -0.035), iw = width(i, F.italic, size * 1.14, -0.01);
    let b = letters(a, -1, y, F.bold, size, 'fg', { ls: -0.035, step: 16 });
    b += letters(i, -1 + aw, y, F.italic, size * 1.14, 'fg', { ls: -0.01, base: a.length * 16, step: 30 });
    b += `<g class="lt" style="animation-delay:${a.length * 16 + i.length * 30 + 60}ms">${text('.', -1 + aw + iw, y, F.bold, size, 'accent')}</g>`;
    const nw = width(note, F.hand, 21);
    const nx = W - 6 - nw;
    b += `<g class="note"><g transform="rotate(-3 ${n(nx + nw / 2)} 32)">${text(note, nx, 37, F.hand, 21, 'muted')}</g></g>
<path class="ico s-muted draw" pathLength="1" d="M${n(nx - 9)} 37c-8 5-17 5-25-1m0 0 7-1m-7 1 2 7"/>`;
    return svg(56, t, `${a}${i}.`, b);
  };
}

// ---- selected work --------------------------------------------------------
// Each project gets a field of colour and one motif drawn from its subject, and each motif does one small thing.
const ring = (cx, cy, r, count, br) => Array.from({ length: count }, (_, k) => {
  const a = (Math.PI * 2 * k) / count - Math.PI / 2;
  return `<circle class="mf bead" style="animation-delay:${n(k * 0.26)}s" cx="${n(cx + r * Math.cos(a))}" cy="${n(cy + r * Math.sin(a))}" r="${br}"/>`;
}).join('');
const qr = () => {
  const s = 12, ox = 42, oy = 46;
  const finder = (c, r) => `<rect class="mo" x="${ox + c * s + 2}" y="${oy + r * s + 2}" width="${s * 3 - 4}" height="${s * 3 - 4}" rx="3"/><rect class="mf" x="${ox + c * s + 12}" y="${oy + r * s + 12}" width="12" height="12" rx="1"/>`;
  const cells = [[3, 0], [3, 2], [4, 3], [6, 3], [3, 4], [5, 4], [4, 5], [6, 5], [3, 6], [5, 6], [0, 3], [2, 3]];
  return finder(0, 0) + finder(4, 0) + finder(0, 4) + cells.map(([c, r]) => `<rect class="mf" x="${ox + c * s + 1}" y="${oy + r * s + 1}" width="${s - 2}" height="${s - 2}" rx="2"/>`).join('')
    + `<rect class="mf scan" x="32" y="44" width="104" height="3.500" rx="1.700"/>`;
};
const MOTIF = {
  // the leaves sway
  sprout: () => `<path class="mo" d="M32 130q52-18 104 0M46 146q38-12 76 0M84 126V80"/><g class="sway"><path class="mf" d="M84 98c-22 0-32-12-32-30 20 0 32 10 32 30zM84 84c0-20 12-32 32-32 0 20-12 32-32 32z"/></g>`,
  // a scanner passes over the code
  qr,
  // the bars grow and the line draws itself, again and again
  wave: () => [[40, 26], [64, 42], [88, 34], [112, 60]].map(([x, h], i) => `<rect class="mf bar" style="animation-delay:${i * 0.12}s" fill-opacity=".4" x="${x}" y="${136 - h}" width="16" height="${h}" rx="4"/>`).join('') + `<path class="mo trend" pathLength="1" d="M34 84c16-22 30-22 46 0s30 22 54-18"/><circle class="mf tip" cx="134" cy="66" r="6"/>`,
  // the five prayers light up through the day
  crescent: () => `<path class="mf" d="M96 36a32 32 0 1 0 24 50 26 26 0 1 1-24-50z"/><path class="mo" stroke-opacity=".45" d="M36 140q48-34 96 0"/>` + [[36, 140], [60, 127.2], [84, 123], [108, 127.2], [132, 140]].map(([x, y], i) => `<circle class="mf hour" style="animation-delay:${i}s" cx="${x}" cy="${y}" r="4.500"/>`).join(''),
  // the orbits turn
  atom: () => `<g class="spin">${[0, 60, 120].map((a) => `<ellipse class="mo" cx="84" cy="88" rx="50" ry="19" transform="rotate(${a} 84 88)"/>`).join('')}<circle class="mf" cx="134" cy="88" r="5"/><circle class="mf" cx="34" cy="88" r="0.100" fill-opacity="0"/></g><circle class="mf" cx="84" cy="88" r="8"/>`,
  // the beads are counted, one by one
  beads: () => ring(84, 78, 38, 15, 5) + `<path class="mo" d="M84 122v16"/><circle class="mf" cx="84" cy="146" r="7"/>`,
};
const MOTION = `
.sway{transform-box:fill-box;transform-origin:50% 100%;animation:sway 3.600s ease-in-out infinite alternate}
@keyframes sway{from{transform:rotate(-5deg)}to{transform:rotate(5deg)}}
.scan{opacity:.75;animation:scan 2.600s ease-in-out infinite alternate}
@keyframes scan{to{transform:translateY(86px)}}
.bar{transform-box:fill-box;transform-origin:50% 100%;animation:grow 6s ${EASE} infinite}
@keyframes grow{0%{transform:scaleY(.15)}14%,100%{transform:none}}
.trend{stroke-dasharray:1;animation:trend 6s ${EASE} infinite}
@keyframes trend{0%,6%{stroke-dashoffset:1}26%,100%{stroke-dashoffset:0}}
.tip{transform-box:fill-box;transform-origin:center;animation:tip 6s ${EASE} infinite}
@keyframes tip{0%,22%{opacity:0;transform:scale(.3)}30%,100%{opacity:1;transform:none}}
.hour{transform-box:fill-box;transform-origin:center;animation:hour 5s ease-in-out infinite}
@keyframes hour{0%,24%,100%{transform:none}10%{transform:scale(1.800)}}
.spin{transform-box:fill-box;transform-origin:center;animation:spin 22s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.bead{animation:bead 3.900s ease-out infinite}
@keyframes bead{0%{opacity:1}22%,100%{opacity:.4}}`;
const WORK = [
  { slug: 'mahsoul', name: 'Mahsoul', kind: 'Agri-tech platform', year: '2025', motif: 'sprout', field: ['#128a4b', '#128a4b'],
    desc: 'Farmers book agronomists and vets, pay, and order supplies in one place.',
    stack: ['Laravel', 'PHP', 'MySQL', 'Tailwind CSS'] },
  { slug: 'lbaraka', name: 'LBaraka', kind: 'Solidarity app', year: '2026', motif: 'qr', field: ['#c8552b', '#c8552b'],
    desc: 'Neighbours give, lend and rent everyday objects, with deposits and QR handovers.',
    stack: ['React Native', 'NestJS', 'PostgreSQL', 'MongoDB'] },
  { slug: 'wealthwave', name: 'WealthWave', kind: 'Personal finance', year: '2025', motif: 'wave', field: ['#2d5cff', '#2d5cff'],
    desc: 'Budgets, savings goals and expense analytics for a calmer relationship with money.',
    stack: ['Node.js', 'Express', 'MySQL', 'Chart.js'] },
  { slug: 'salat', name: 'Salat Times', kind: 'Linux desktop plugin', year: '2026', motif: 'crescent', field: ['#6a50c7', '#6a50c7'],
    desc: 'Arabic-first prayer times for Omarchy: adhan, Hijri calendar, Qibla, all offline.',
    stack: ['QML', 'Quickshell', 'JavaScript'] },
  { slug: 'quantum', name: 'Quantum VQE Lab', kind: 'Quantum chemistry', year: '2026', motif: 'atom', field: ['#c04a7f', '#c04a7f'],
    desc: 'Reproducible variational quantum eigensolver experiments, with a local lab to run them.',
    stack: ['Python', 'Qiskit', 'Streamlit'] },
  { slug: 'athkar', name: 'Athkar Bot', kind: 'Discord bot', year: '2025', motif: 'beads', field: ['#0b0b0c', '#f4f4f2'], ink: ['#fbfbfa', '#0b0b0c'],
    desc: 'Daily Athkar reminders, Quranic verses and schedules for Discord communities.',
    stack: ['Python', 'discord.py'] },
];
function work(p) {
  return (t) => {
    const k = t === 'dark' ? 1 : 0;
    const H = 104, T = 104, L = T + 24, R = W - 24;
    const ink = p.ink ? p.ink[k] : '#ffffff';
    const s = T / 176;
    let b = `<defs><clipPath id="card"><rect width="${W}" height="${H}" rx="12"/></clipPath></defs>
<g clip-path="url(#card)"><rect class="panel" width="${W}" height="${H}"/><rect width="${T}" height="${H}" fill="${p.field[k]}"/>
<g transform="translate(${n((T - 168 * s) / 2)} 0) scale(${n(s)})"><g class="motif">${MOTIF[p.motif]()}</g></g></g>`;
    b += `<g class="in" style="--i:1">${text(p.name, L, 37, F.bold, 22, 'fg', { ls: -0.03 })}</g>`;
    b += `<g class="in" style="--i:2">${arrow(R - 16, 21, 18, 's-accent')}${text(p.kind, R - 24, 36, F.italic, 19, 'muted', { anchor: 'end' })}</g>`;
    let size = 15.5;
    while (width(p.desc, F.sans, size) > R - L) size -= 0.5;
    b += `<g class="in" style="--i:3">${text(p.desc, L, 62, F.sans, size, 'soft')}</g>`;
    const st = [];
    p.stack.forEach((x, i) => {
      if (i) st.push({ t: '   ·   ', f: F.sans, size: 13, cls: 'faint' });
      st.push({ t: x, f: F.medium, size: 13, cls: 'muted' });
    });
    b += `<g class="in" style="--i:4">${runs(st, L, 86).svg}${text(p.year, R, 86, F.mono, 13, 'muted', { anchor: 'end' })}</g>`;
    const css = `.mo{fill:none;stroke:${ink};stroke-width:3.800;stroke-linecap:round;stroke-linejoin:round}.mf{fill:${ink}}
.motif{transform-box:fill-box;transform-origin:center;animation:motif .9s ${EASE} .1s both}@keyframes motif{from{opacity:0;transform:scale(.8)}}${MOTION}`;
    return svg(H, t, `${p.name}, ${p.kind.toLowerCase()}, ${p.year}. ${p.desc} Built with ${p.stack.join(', ')}.`, b, css);
  };
}

// ---- the path so far ------------------------------------------------------
const PATH = [
  ['2026', 'now', 'Tech Lead & AI Systems Architect', 'Ton avenir au maroc', 'Souss Massa Technopark, Agadir'],
  ['2026', '', 'Full-Stack Web & Mobile Intern', 'Larmo', 'Casablanca'],
  ['2025', '', 'Full-Stack Developer Intern', 'NJT Group', 'Marrakech'],
  ['2024', '2026', 'Full-Stack Developer Program', 'YouCode, UM6P', 'Youssoufia'],
  ['2023', '2024', 'Baccalauréat, Physical Sciences', 'Arij Almaarifa', 'Sidi Bibi'],
];
function path(t) {
  const pitch = 62, top = 26, X = 124, yEnd = top + pitch * (PATH.length - 1), H = yEnd + 44;
  let b = `<path class="s-line rail" pathLength="1" fill="none" stroke-width="1.500" stroke-linecap="round" d="M${X} ${yEnd}V${top}"/>
<circle class="accent climb" cx="${X}" cy="${yEnd}" r="3"/>`;
  PATH.forEach(([y1, y2, role, org, place], i) => {
    const y = top + pitch * i;
    const label = y2 ? `${y1} — ${y2}` : y1;
    b += `<g class="in" style="--i:${(PATH.length - 1 - i) * 2}">`;
    b += text(label, X - 22, y + 5, F.mono, 13.5, i ? 'muted' : 'fg', { anchor: 'end' });
    if (!i) b += `<circle class="accent ping" cx="${X}" cy="${y}" r="5.500"/>`;
    b += `<circle class="${i ? 'fg' : 'accent'}" cx="${X}" cy="${y}" r="${i ? 3.5 : 5.5}"/>`;
    b += text(role, X + 24, y + 6, F.bold, 18, 'fg', { ls: -0.025 });
    b += runs([
      { t: org, f: F.italic, size: 18, cls: 'soft' },
      { t: '   ·   ', f: F.sans, size: 14, cls: 'faint' },
      { t: place, f: F.sans, size: 14, cls: 'muted' },
    ], X + 24, y + 29).svg;
    b += `</g>`;
  });
  const css = `
.rail{stroke-dasharray:1;animation:draw 1.400s ${EASE} both}
.climb{animation:climb 4.500s ${EASE} 1.500s infinite both}
@keyframes climb{0%{opacity:0;transform:none}8%{opacity:1}80%{opacity:1;transform:translateY(${-(yEnd - top)}px)}90%,100%{opacity:0;transform:translateY(${-(yEnd - top)}px)}}
@media (prefers-reduced-motion:reduce){.climb{opacity:0}}`;
  const alt = PATH.map(([a, z, r, o, p]) => `${a}${z ? ' to ' + z : ''}: ${r}, ${o}, ${p}`).join('. ');
  return svg(H, t, `The path so far. ${alt}.`, b, css);
}

// ---- the stack ------------------------------------------------------------
const STACK = [
  ['Languages & frameworks', ['Laravel', 'React', 'Vue.js', 'Next.js', 'NestJS', 'Node.js', 'React Native', 'TypeScript', 'PHP', 'Python', 'Tailwind CSS']],
  ['Data & APIs', ['PostgreSQL', 'MySQL', 'MongoDB', 'REST', 'GraphQL', 'Prisma']],
  ['Tooling & delivery', ['Git & GitHub', 'Docker', 'AWS', 'Vercel', 'CI/CD', 'Postman', 'Jira']],
  ['Design & modelling', ['Figma', 'UML', 'Merise', 'StarUML', 'Photoshop']],
];
function stack(t) {
  const X = 236, size = 16, lh = 28, gap = 16, SEP = '   ·   ';
  let y = 24, b = '', k = 0;
  STACK.forEach(([title, items], g) => {
    const lines = wrap(items, F.medium, size, W - X, SEP);
    b += `<g class="in" style="--i:${g * 2}">${text(title, 0, y, F.italic, 21, 'muted')}</g>`;
    lines.forEach((line, li) => {
      let cx = X;
      line.forEach((w, i) => {
        if (i) { b += text(SEP, cx, y + li * lh, F.sans, size, 'faint'); cx += width(SEP, F.sans, size); }
        b += `<g class="lt" style="animation-delay:${120 + k++ * 28}ms">${text(w, cx, y + li * lh, F.medium, size, 'fg')}</g>`;
        cx += width(w, F.medium, size);
      });
    });
    y += lines.length * lh + gap;
  });
  const alt = STACK.map(([a, i]) => `${a}: ${i.join(', ')}`).join('. ');
  return svg(y - gap - 10, t, `The stack I ship with. ${alt}.`, b);
}

// ---- a year in dots -------------------------------------------------------
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function year(data) {
  return (t) => {
    const PX = 32, weeks = data.days;
    const pitch = (W - PX * 2) / weeks.length;
    const counts = weeks.flat().map((d) => d[1]).filter(Boolean).sort((a, b) => a - b);
    const q = (p) => counts[Math.min(counts.length - 1, Math.floor(counts.length * p))] || 1;
    const cuts = [q(0.25), q(0.5), q(0.75)];
    const level = (v) => (v === 0 ? 0 : v <= cuts[0] ? 1 : v <= cuts[1] ? 2 : v <= cuts[2] ? 3 : 4);
    const R = [1.300, 2.600, 3.700, 4.800, 5.900], O = [0.38, 0.62, 0.76, 0.9, 1];

    const top = 132, H = n(top + pitch * 7 + 58);
    const total = odo(data.total.toLocaleString('en-US'), PX - 2, 76, F.bold, 54, 'w', 'y', { ls: -0.04, delay: 200 });
    let b = `<rect width="${W}" height="${H}" rx="18" fill="#2d5cff"/>${total.svg}
<g class="in" style="--i:3">${text('contributions', PX + total.width + 14, 76, F.italic, 32, 'w')}</g>
<g class="in" style="--i:5">${text(`in the last twelve months, across ${data.repos} public repositories and ${data.stars} stars.`, PX, 104, F.sans, 15.5, 'w', { extra: 'fill-opacity=".88"' })}</g>`;

    let lastMonth = -1, labels = '', today = '';
    weeks.forEach((wk, x) => {
      const cx = n(PX + pitch * x + pitch / 2);
      b += `<g class="col" style="animation-delay:${n(0.3 + x * 0.016)}s">`;
      wk.forEach(([date, v], di) => {
        const dow = new Date(date + 'T00:00:00Z').getUTCDay();
        const l = level(v), cy = n(top + dow * pitch + pitch / 2);
        b += `<circle class="w" cx="${cx}" cy="${cy}" r="${R[l]}" fill-opacity="${O[l]}"/>`;
        if (x === weeks.length - 1 && di === wk.length - 1) today = `<circle class="today" cx="${cx}" cy="${cy}" r="${R[l] + 2.5}"/>`;
      });
      b += `</g>`;
      const first = new Date(wk[0][0] + 'T00:00:00Z');
      const m = first.getUTCMonth();
      if (m !== lastMonth && x < weeks.length - 2) {
        if (lastMonth !== -1 || first.getUTCDate() <= 7) labels += text(MONTHS[m], PX + pitch * x + 1, top + pitch * 7 + 24, F.sans, 13, 'w', { extra: 'fill-opacity=".85"' });
        lastMonth = m;
      }
    });
    b += today + labels;
    const css = `.w{fill:#fff}.col{animation:pop .5s ${EASE} both}@keyframes pop{from{opacity:0;transform:translateY(8px)}}
.today{fill:none;stroke:#fff;stroke-width:1.500;transform-box:fill-box;transform-origin:center;animation:today 2.400s ease-out 1.500s infinite both}
@keyframes today{from{opacity:.9;transform:scale(.6)}80%,to{opacity:0;transform:scale(2.200)}}
@media (prefers-reduced-motion:reduce){.today{opacity:0}}`;
    return svg(H, t, `${data.total} contributions in the last twelve months, across ${data.repos} public repositories and ${data.stars} stars. Each dot is a day; larger dots are busier days.`, b, css);
  };
}

// ---- buttons --------------------------------------------------------------
const BUTTONS = [
  ['portfolio', 'baalla.tech', true],
  ['linkedin', 'LinkedIn'],
  ['email', 'Email'],
  ['cv', 'Download CV'],
  ['x', 'X'],
  ['youtube', 'YouTube'],
  ['hello', 'Start a conversation', true],
  ['services', 'See services'],
];
function button(label, primary) {
  return (t) => {
    const size = 14.5, pad = 15, H = 36;
    const tw = width(label, F.medium, size);
    const w = Math.ceil(pad + tw + 7 + 14 + pad - 2);
    const b = `<rect class="${primary ? 'btn' : 'btn2'}" width="${w}" height="${H}" rx="9"/>
${text(label, pad, 23, F.medium, size, primary ? 'btnfg' : 'fg')}
<g class="nudge">${arrow(pad + tw + 6, 11, 14, primary ? 's-btnfg' : 's-fg')}</g>`;
    const css = `.nudge{animation:nudge 4s ${EASE} 2s infinite}@keyframes nudge{0%,82%,100%{transform:none}90%{transform:translate(2px,-2px)}}`;
    return svg(H, t, label, b, css, w);
  };
}

// ---- the close ------------------------------------------------------------
// Inverted against the page: an ink field on light, a paper field on dark.
function close(t) {
  const H = 316, PX = 36, size = 42;
  let b = `<defs><clipPath id="card"><rect width="${W}" height="${H}" rx="18"/></clipPath></defs><g clip-path="url(#card)"><rect class="btn" width="${W}" height="${H}"/>`;
  const ws = 244;
  const ww = width('Baâlla', F.italic, ws, -0.02), sq = 28, total = ww + 12 + sq, x = (W - total) / 2;
  b += `<g class="mark">${text('Baâlla', x, H + 26, F.italic, ws, 'btnfg', { ls: -0.02, extra: 'fill-opacity=".14"' })}</g>
<rect class="blue cursor" x="${n(x + ww + 12)}" y="${H - sq - 22}" width="${sq}" height="${sq}"/>`;
  b += letters('Let’s build something', PX - 2, 72, F.bold, size, 'btnfg', { ls: -0.04, step: 18 });
  const w1 = width('worth ', F.bold, size, -0.04), w2 = width('shipping', F.italic, size * 1.14, -0.01);
  b += letters('worth ', PX - 2, 122, F.bold, size, 'btnfg', { ls: -0.04, base: 400, step: 18 });
  b += letters('shipping', PX - 2 + w1, 122, F.italic, size * 1.14, 'btnfg', { ls: -0.01, base: 510, step: 34 });
  b += `<g class="lt" style="animation-delay:840ms">${text('.', PX - 2 + w1 + w2, 122, F.bold, size, 'blue')}</g>`;
  b += `<g class="note" transform="rotate(-4 760 80)">${text('usually a reply', W - PX, 72, F.hand, 23, 'btnfg', { anchor: 'end', extra: 'fill-opacity=".72"' })}${text('within 24 hours', W - PX, 97, F.hand, 23, 'btnfg', { anchor: 'end', extra: 'fill-opacity=".72"' })}</g></g>`;
  const css = `.blue{fill:#2d5cff}
.mark{animation:mark 1.400s ${EASE} .2s both}@keyframes mark{from{opacity:0;transform:translateY(40px)}}
.cursor{animation:blink 1.060s step-end 1.600s infinite}@keyframes blink{50%{opacity:0}}`;
  return svg(H, t, 'Let’s build something worth shipping. Usually a reply within 24 hours. Baâlla.', b, css);
}

// ---- run ------------------------------------------------------------------
const data = await loadData();
emit('hero', hero(data));
for (const [k, [a, i, note]] of Object.entries(HEADS)) emit(`head-${k}`, heading(a, i, note));
for (const p of WORK) emit(`work-${p.slug}`, work(p));
emit('path', path);
emit('stack', stack);
emit('year', year(data));
for (const [k, label, primary] of BUTTONS) emit(`btn-${k}`, button(label, primary));
emit('close', close);
console.log(`Built assets for ${data.total} contributions, ${data.repos} repositories, ${data.stars} stars.`);
