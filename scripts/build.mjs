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
    paper: '#f6f6f3', strip: '#ecece8', chip: '#e6e6e1',
  },
  dark: {
    fg: '#f4f4f2', soft: '#d3d3d6', muted: '#a1a1a8', faint: '#6f6f77',
    accent: '#8fa7ff', panel: '#161a22', dot: '#ffffff', dotO: 0.14,
    line: '#3a3f4a', green: '#4ade80', btn: '#f4f4f2', btnFg: '#0b0b0c', btn2: '#1c212b',
    paper: '#12161d', strip: '#1a1f29', chip: '#262c38',
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
.panel{fill:${c.panel}}.green{fill:${c.green}}.btn{fill:${c.btn}}.btnfg{fill:${c.btnFg}}.btn2{fill:${c.btn2}}.paper{fill:${c.paper}}.strip{fill:${c.strip}}.chip{fill:${c.chip}}
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
  now: ['What I’m building ', 'now', 'the day job'],
  help: ['How I can ', 'help', 'six ways to start'],
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

// ---- tiles, icons, chips ----------------------------------------------------
// The shared language of the page: a field of colour, one drawn icon, one small movement.
const FIELD = { blue: '#2d5cff', green: '#128a4b', warm: '#c8552b', purple: '#6a50c7', pink: '#c04a7f' };
const ICON = {
  layers: 'M12 3 3 8l9 5 9-5-9-5zM3 12.500l9 5 9-5M3 17l9 5 9-5',
  phone: 'M8 2.500h8a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2zM10.500 18.500h3',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M13.500 5l-3 14',
  cap: 'M2 9l10-5 10 5-10 5L2 9zM6 11.500V16c0 1.500 2.700 3 6 3s6-1.500 6-3v-4.500M22 9v5',
  flask: 'M9 3h6M10 3v6l-5.500 9a2 2 0 0 0 1.700 3h11.600a2 2 0 0 0 1.700-3L14 9V3M7.500 15h9',
  db: 'M4 6c0-1.700 3.600-3 8-3s8 1.300 8 3-3.600 3-8 3-8-1.300-8-3zM4 6v6c0 1.700 3.600 3 8 3s8-1.300 8-3V6M4 12v6c0 1.700 3.600 3 8 3s8-1.300 8-3v-6',
  cube: 'M12 3l8 4.500v9L12 21l-8-4.500v-9L12 3zM12 12l8-4.500M12 12v9M12 12L4 7.500',
  bezier: 'M4 20C8 8 16 16 20 4M4 20h.01M20 4h.01M2.500 18.500h3v3h-3zM18.500 2.500h3v3h-3z',
  browser: 'M3 5h18v14H3zM3 9h18M6 7h.01M8.500 7h.01',
  server: 'M4 4h16v6H4zM4 14h16v6H4zM7.500 7h.01M7.500 17h.01',
  bag: 'M5 8h14l-1 12H6L5 8zM9 8V6a3 3 0 0 1 6 0v2',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  bloch: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12c0 1.700 4 3 9 3s9-1.300 9-3M12 12l5-6',
  spark: 'M12 3c.600 5 3.400 8.400 9 9-5.600.600-8.400 4-9 9-.600-5-3.400-8.400-9-9 5.600-.600 8.400-4 9-9z',
  terminal: 'M3 5h18v14H3zM7 10l3 2.500L7 15M12.500 15h4',
  nodes: 'M5 6a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM15 6a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM10 18a2 2 0 1 0 4 0 2 2 0 0 0-4 0zM9 6h6M8 8l3 8M16 8l-3 8',
  chip: 'M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4',
  swap: 'M4 9h14l-4-4M20 15H6l4 4',
};
const TILE_CSS = `.tw{fill:none;stroke:#fff;stroke-width:1.700;stroke-linecap:round;stroke-linejoin:round}.ti{fill:none;stroke-width:1.700;stroke-linecap:round;stroke-linejoin:round}
.ic{transform-box:fill-box;transform-origin:center;animation:ic 5.600s ${EASE} infinite}
@keyframes ic{0%,18%,100%{transform:none}8%{transform:scale(1.160) rotate(-5deg)}}
.chipin{animation:chipin .5s ${EASE} both}@keyframes chipin{from{opacity:0;transform:translateY(6px)}}`;
function tile(x, y, s, color, icon, i = 0, r = 12) {
  const ink = color === 'ink';
  const k = (s * 0.5) / 24, o = (s - 24 * k) / 2;
  return `<rect ${ink ? 'class="btn"' : `fill="${FIELD[color]}"`} x="${x}" y="${y}" width="${s}" height="${s}" rx="${r}"/>
<g transform="translate(${n(x + o)} ${n(y + o)}) scale(${n(k)})"><path class="ic ${ink ? 'ti s-btnfg' : 'tw'}" style="animation-delay:${n(0.6 + i * 0.4)}s" d="${ICON[icon]}"/></g>`;
}
function chips(items, x, y, maxW, { size = 12.5, h = 24, pad = 9, gap = 6, base = 0 } = {}) {
  let cx = x, cy = y, out = '';
  items.forEach((it, i) => {
    const w = width(it, F.medium, size) + pad * 2;
    if (cx + w > x + maxW && cx > x) { cx = x; cy += h + gap; }
    out += `<g class="chipin" style="animation-delay:${base + i * 35}ms"><rect class="chip" x="${n(cx)}" y="${cy}" width="${n(w)}" height="${h}" rx="${h / 2}"/>${text(it, cx + pad, cy + h / 2 + size * 0.36, F.medium, size, 'fg')}</g>`;
    cx += w + gap;
  });
  return { svg: out, height: cy - y + h };
}

// ---- what I'm building now --------------------------------------------------
function now(t) {
  const H = 188, T = 188, L = T + 26, R = W - 26;
  const sat = [0, 1, 2, 3, 4].map((k) => {
    const a = (Math.PI * 2 * k) / 5 - Math.PI / 2;
    return [n(94 + 58 * Math.cos(a)), n(94 + 58 * Math.sin(a))];
  });
  let b = `<defs><clipPath id="card"><rect width="${W}" height="${H}" rx="16"/></clipPath></defs>
<g clip-path="url(#card)"><rect class="panel" width="${W}" height="${H}"/><rect width="${T}" height="${H}" fill="${FIELD.blue}"/>
<g class="hub">${sat.map(([x, y]) => `<path class="flow" d="M94 94L${x} ${y}"/>`).join('')}
${sat.map(([x, y], k) => `<circle class="sat" style="animation-delay:${k * 0.5}s" cx="${x}" cy="${y}" r="9"/>`).join('')}
<circle fill="#fff" cx="94" cy="94" r="17"/><circle fill="${FIELD.blue}" cx="94" cy="94" r="6"/></g></g>`;
  b += `<g class="in" style="--i:1">${text('TAM Digital Platform', L, 42, F.bold, 24, 'fg', { ls: -0.03 })}</g>`;
  const when = '2026 — now', ww = width(when, F.mono, 13);
  b += `<g class="in" style="--i:2"><circle class="green ping" cx="${n(R - ww - 12)}" cy="36" r="4"/><circle class="green" cx="${n(R - ww - 12)}" cy="36" r="4"/>${text(when, R, 40.500, F.mono, 13, 'muted', { anchor: 'end' })}</g>`;
  b += `<g class="in" style="--i:2">${runs([
    { t: 'Tech Lead & AI Systems Architect', f: F.italic, size: 19, cls: 'soft' },
    { t: '   ·   ', f: F.sans, size: 14, cls: 'faint' },
    { t: 'Ton avenir au maroc, Souss Massa Technopark', f: F.sans, size: 14, cls: 'muted' },
  ], L, 68).svg}</g>`;
  const desc = 'A multi-company platform that centralises business operations, makes collaboration easier and automates the work in between. I lead its architecture, its AI integration and its delivery.';
  wrap(desc.split(' '), F.sans, 15, R - L).forEach((line, i) => {
    b += `<g class="in" style="--i:${3 + i}">${text(line.join(' '), L, 98 + i * 22, F.sans, 15, 'soft')}</g>`;
  });
  b += chips(['System architecture', 'AI integration', 'Requirements engineering', 'Agile delivery', 'Automation'], L, 140, R - L, { base: 500 }).svg;
  const css = `${TILE_CSS}
.flow{fill:none;stroke:#fff;stroke-width:2.500;stroke-linecap:round;stroke-dasharray:1 9;animation:flow 1.400s linear infinite}
@keyframes flow{to{stroke-dashoffset:-20}}
.sat{fill:#fff;transform-box:fill-box;transform-origin:center;animation:sat 2.500s ease-in-out infinite}
@keyframes sat{0%,30%,100%{transform:none}14%{transform:scale(1.350)}}
.hub{transform-box:fill-box;transform-origin:center;animation:motif .9s ${EASE} .1s both}@keyframes motif{from{opacity:0;transform:scale(.8) rotate(-20deg)}}`;
  return svg(H, t, `TAM Digital Platform. Tech Lead and AI Systems Architect at Ton avenir au maroc, Souss Massa Technopark, since 2026. ${desc}`, b, css);
}

// ---- the path so far ------------------------------------------------------
const PATH = [
  { when: '2026 — now', role: 'Tech Lead & AI Systems Architect', org: 'Ton avenir au maroc', place: 'Agadir', color: 'blue', icon: 'layers',
    desc: 'Leading the architecture, AI integration and delivery of the TAM Digital Platform.',
    tags: ['System architecture', 'AI integration', 'Technical leadership', 'Automation'] },
  { when: 'Apr — Jul 2026', role: 'Full-Stack Web & Mobile Developer, intern', org: 'Larmo', place: 'Casablanca', color: 'warm', icon: 'phone',
    desc: 'Designed and built StoreezCOD for web and mobile, on a scalable backend.',
    tags: ['Nest.js', 'Next.js', 'TypeScript', 'Docker', 'AWS'] },
  { when: 'May — Jul 2025', role: 'Full-Stack Developer, intern', org: 'NJT Group', place: 'Marrakech', color: 'green', icon: 'code',
    desc: 'Built and maintained web applications alongside senior developers.',
    tags: ['Laravel', 'React', 'Code review', 'Scrum'] },
  { when: '2024 — 2026', role: 'Full-Stack Developer Program, graduated', org: 'YouCode, UM6P', place: 'Youssoufia', color: 'purple', icon: 'cap',
    desc: 'Two intensive, project-based years: from algorithms to deployed full-stack apps.',
    tags: ['MERN', 'Laravel', 'Vue.js', 'Agile'] },
  { when: '2023 — 2024', role: 'Baccalauréat, Physical Sciences', org: 'Arij Almaarifa', place: 'Sidi Bibi', color: 'ink', icon: 'flask',
    desc: 'A foundation in analytical thinking, before software.',
    tags: [] },
];
function path(t) {
  const pitch = 104, S = 40, X = 150, TX = X + 38, top = 4;
  const H = top + pitch * (PATH.length - 1) + 72;
  const y0 = top + S / 2, y1 = top + pitch * (PATH.length - 1) + S / 2;
  let b = `<path class="s-line rail" pathLength="1" fill="none" stroke-width="1.500" stroke-linecap="round" d="M${X} ${y1}V${y0}"/>
<circle class="accent climb" cx="${X}" cy="${y1}" r="3"/>`;
  PATH.forEach((p, i) => {
    const y = top + pitch * i;
    b += `<g class="in" style="--i:${(PATH.length - 1 - i) * 2}">`;
    b += text(p.when, X - 34, y + 25, F.mono, 13, i ? 'muted' : 'fg', { anchor: 'end' });
    b += tile(X - S / 2, y, S, p.color, p.icon, i, 11);
    b += text(p.role, TX, y + 17, F.bold, 17, 'fg', { ls: -0.025 });
    b += runs([
      { t: p.org, f: F.italic, size: 17.5, cls: 'soft' },
      { t: '   ·   ', f: F.sans, size: 13.5, cls: 'faint' },
      { t: p.place, f: F.sans, size: 13.5, cls: 'muted' },
    ], TX, y + 39).svg;
    b += text(p.desc, TX, y + 61, F.sans, 14, 'soft');
    b += `</g>`;
    if (p.tags.length) {
      const st = [];
      p.tags.forEach((x, k) => {
        if (k) st.push({ t: '   ·   ', f: F.sans, size: 12.5, cls: 'faint' });
        st.push({ t: x, f: F.medium, size: 12.5, cls: 'muted' });
      });
      b += `<g class="in" style="--i:${(PATH.length - 1 - i) * 2 + 1}">${runs(st, TX, y + 81).svg}</g>`;
    }
  });
  const css = `${TILE_CSS}
.rail{stroke-dasharray:1;animation:draw 1.400s ${EASE} both}
.climb{animation:climb 4.500s ${EASE} 1.500s infinite both}
@keyframes climb{0%{opacity:0;transform:none}8%{opacity:1}80%{opacity:1;transform:translateY(${-(y1 - y0)}px)}90%,100%{opacity:0;transform:translateY(${-(y1 - y0)}px)}}
@media (prefers-reduced-motion:reduce){.climb{opacity:0}}`;
  const alt = PATH.map((p) => `${p.when}: ${p.role}, ${p.org}, ${p.place}. ${p.desc}`).join(' ');
  return svg(H, t, `The path so far. ${alt}`, b, css);
}

// ---- the stack ------------------------------------------------------------
const STACK = [
  ['Languages & frameworks', 'what the products are written in', 'blue', 'code', ['Laravel', 'React', 'Vue.js', 'Next.js', 'NestJS', 'Node.js', 'React Native', 'TypeScript', 'PHP', 'Python', 'Tailwind CSS']],
  ['Data & APIs', 'where the data lives and how it travels', 'green', 'db', ['PostgreSQL', 'MySQL', 'MongoDB', 'REST', 'GraphQL', 'Prisma']],
  ['Tooling & delivery', 'how it gets to production', 'warm', 'cube', ['Git & GitHub', 'Docker', 'AWS', 'Vercel', 'CI/CD', 'Postman', 'Jira']],
  ['Design & modelling', 'how it is thought through first', 'purple', 'bezier', ['Figma', 'UML', 'Merise', 'StarUML', 'Photoshop']],
];
function stack(t) {
  const S = 56, X = S + 20;
  let y = 0, b = '';
  STACK.forEach(([title, why, color, icon, items], g) => {
    b += `<g class="in" style="--i:${g * 2}">${tile(0, y, S, color, icon, g, 14)}`;
    b += runs([
      { t: title, f: F.bold, size: 16.5, cls: 'fg', ls: -0.02 },
      { t: '   ', f: F.sans, size: 14, cls: 'faint' },
      { t: why, f: F.italic, size: 17, cls: 'muted' },
    ], X, y + 19).svg + `</g>`;
    const c = chips(items, X, y + 31, W - X, { base: 200 + g * 140 });
    b += c.svg;
    y += Math.max(S, 31 + c.height) + 22;
  });
  const alt = STACK.map(([a, , , , i]) => `${a}: ${i.join(', ')}`).join('. ');
  return svg(y - 22, t, `The stack I ship with. ${alt}.`, b, TILE_CSS);
}

// ---- grids: certifications and services -----------------------------------
function grid(cards, title) {
  return (t) => {
    const cols = 3, gap = 12, cw = (W - gap * (cols - 1)) / cols, ch = 96, S = 48;
    let b = '';
    cards.forEach((c, i) => {
      const x = n((i % cols) * (cw + gap)), y = Math.floor(i / cols) * (ch + gap);
      const tx = x + 16 + S + 14, tw = cw - (16 + S + 14) - 12;
      const tl = wrap(c.title.split(' '), F.bold, 14.5, tw).slice(0, 2);
      const bl = wrap(c.body.split(' '), F.sans, 12.5, tw).slice(0, tl.length > 1 ? 1 : 2);
      const bh = tl.length * 18 + 4 + bl.length * 16;
      let ty = y + (ch - bh) / 2 + 13;
      b += `<g class="in" style="--i:${i}"><rect class="panel" x="${x}" y="${y}" width="${n(cw)}" height="${ch}" rx="14"/>${tile(x + 16, y + (ch - S) / 2, S, c.color, c.icon, i, 12)}`;
      tl.forEach((l) => { b += text(l.join(' '), tx, ty, F.bold, 14.5, 'fg', { ls: -0.02 }); ty += 18; });
      ty += 3;
      bl.forEach((l) => { b += text(l.join(' '), tx, ty, F.sans, 12.5, 'muted'); ty += 16; });
      b += `</g>`;
    });
    const rows = Math.ceil(cards.length / cols);
    return svg(rows * ch + (rows - 1) * gap, t, `${title} ${cards.map((c) => `${c.title}: ${c.body}`).join('. ')}.`, b, TILE_CSS);
  };
}
const CERTS = [
  { title: 'Quantum Machine Learning', body: 'IBM  ·  Oct 2026', color: 'pink', icon: 'bloch' },
  { title: 'Google AI Professional Certificate', body: 'Google  ·  Jun 2026', color: 'blue', icon: 'spark' },
  { title: 'Claude Code in Action', body: 'Anthropic  ·  Jan 2026', color: 'warm', icon: 'terminal' },
  { title: 'Model Context Protocol: Advanced Topics', body: 'Anthropic  ·  Jan 2026', color: 'purple', icon: 'nodes' },
  { title: 'Arduino: Foundations', body: 'LinkedIn Learning  ·  Apr 2026', color: 'green', icon: 'chip' },
  { title: 'Postman API Fundamentals Student Expert', body: 'Postman  ·  Mar 2025', color: 'ink', icon: 'swap' },
];
const SERVICES = [
  { title: 'Frontend development', body: 'Responsive interfaces in React and Vue.js.', color: 'blue', icon: 'browser' },
  { title: 'Backend development', body: 'Secure APIs and databases, Laravel and Node.js.', color: 'green', icon: 'server' },
  { title: 'Full-stack development', body: 'Complete applications, from UI to deployment.', color: 'purple', icon: 'layers' },
  { title: 'Mobile apps', body: 'One codebase for iOS and Android, with React Native.', color: 'warm', icon: 'phone' },
  { title: 'E-commerce', body: 'Stores with payments, inventory and dashboards.', color: 'pink', icon: 'bag' },
  { title: 'Consulting & review', body: 'Architecture guidance and code reviews.', color: 'ink', icon: 'search' },
];

// ---- a year in dots -------------------------------------------------------
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function year(data) {
  return (t) => {
    const PX = 32, weeks = data.days;
    const pitch = (W - PX * 2) / weeks.length;
    const flat = weeks.flat();
    const counts = flat.map((d) => d[1]).filter(Boolean).sort((a, b) => a - b);
    const q = (p) => counts[Math.min(counts.length - 1, Math.floor(counts.length * p))] || 1;
    const cuts = [q(0.25), q(0.5), q(0.75)];
    const level = (v) => (v === 0 ? 0 : v <= cuts[0] ? 1 : v <= cuts[1] ? 2 : v <= cuts[2] ? 3 : 4);
    const R = [1.300, 2.600, 3.700, 4.800, 5.900], O = [0.38, 0.62, 0.76, 0.9, 1];

    // Three plain facts read off the same calendar
    const active = counts.length;
    const best = flat.reduce((a, d) => (d[1] > a[1] ? d : a), flat[0]);
    const bd = new Date(best[0] + 'T00:00:00Z');
    let streak = 0;
    for (let i = flat.length - 1; i >= 0; i--) {
      if (flat[i][1] > 0) streak++; else if (i === flat.length - 1) continue; else break;
    }

    const top = 132, foot = top + pitch * 7 + 24, H = n(foot + 62);
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
        if (lastMonth !== -1 || first.getUTCDate() <= 7) labels += text(MONTHS[m], PX + pitch * x + 1, foot, F.sans, 13, 'w', { extra: 'fill-opacity=".85"' });
        lastMonth = m;
      }
    });
    b += today + labels;

    // Facts on the left, the key on the right
    const facts = runs([
      { t: String(active), f: F.bold, size: 14, cls: 'w' }, { t: ' active days', f: F.sans, size: 14, cls: 'w' },
      { t: '      ', f: F.sans, size: 14, cls: 'w' },
      { t: String(best[1]), f: F.bold, size: 14, cls: 'w' }, { t: ` on the busiest, ${bd.getUTCDate()} ${MONTHS[bd.getUTCMonth()]} ${bd.getUTCFullYear()}`, f: F.sans, size: 14, cls: 'w' },
      { t: '      ', f: F.sans, size: 14, cls: 'w' },
      { t: String(streak), f: F.bold, size: 14, cls: 'w' }, { t: streak === 1 ? ' day in the current streak' : ' days in the current streak', f: F.sans, size: 14, cls: 'w' },
    ], PX, foot + 36);
    b += `<g class="in" style="--i:9">${facts.svg}</g>`;
    const kx = W - PX;
    b += `<g class="in" style="--i:10">${text('more', kx, foot + 36, F.sans, 13, 'w', { anchor: 'end', extra: 'fill-opacity=".85"' })}`;
    const mw = width('more', F.sans, 13);
    R.slice().reverse().forEach((r, i) => { b += `<circle class="w" cx="${n(kx - mw - 14 - i * 15)}" cy="${foot + 31.5}" r="${r}" fill-opacity="${O[4 - i]}"/>`; });
    b += text('less', kx - mw - 14 - 4 * 15 - 12, foot + 36, F.sans, 13, 'w', { anchor: 'end', extra: 'fill-opacity=".85"' }) + `</g>`;

    const css = `.w{fill:#fff}.col{animation:pop .5s ${EASE} both}@keyframes pop{from{opacity:0;transform:translateY(8px)}}
.today{fill:none;stroke:#fff;stroke-width:1.500;transform-box:fill-box;transform-origin:center;animation:today 2.400s ease-out 1.500s infinite both}
@keyframes today{from{opacity:.9;transform:scale(.6)}80%,to{opacity:0;transform:scale(2.200)}}
@media (prefers-reduced-motion:reduce){.today{opacity:0}}`;
    return svg(H, t, `${data.total} contributions in the last twelve months, across ${data.repos} public repositories and ${data.stars} stars. ${active} active days, ${best[1]} contributions on the busiest day, ${streak} days in the current streak. Each dot is a day; larger dots are busier days.`, b, css);
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
emit('now', now);
emit('path', path);
emit('certs', grid(CERTS, 'Recent certifications.'));
emit('services', grid(SERVICES, 'Services.'));
emit('stack', stack);
emit('year', year(data));
for (const [k, label, primary] of BUTTONS) emit(`btn-${k}`, button(label, primary));
emit('close', close);
console.log(`Built assets for ${data.total} contributions, ${data.repos} repositories, ${data.stars} stars.`);
