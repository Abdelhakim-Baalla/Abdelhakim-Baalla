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
    line: '#d5d5d0', green: '#128a4b', btn: '#0b0b0c', btnFg: '#fbfbfa', btn2: '#f0f0ed', paper: '#f6f6f3', strip: '#ecece8',
  },
  dark: {
    fg: '#f4f4f2', soft: '#d3d3d6', muted: '#a1a1a8', faint: '#6f6f77',
    accent: '#8fa7ff', panel: '#161a22', dot: '#ffffff', dotO: 0.14,
    line: '#3a3f4a', green: '#4ade80', btn: '#f4f4f2', btnFg: '#0b0b0c', btn2: '#1c212b', paper: '#12161d', strip: '#1a1f29',
  },
};

const W = 880;
const EASE = 'cubic-bezier(0.16,1,0.3,1)';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const n = (v) => +v.toFixed(2);

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

function svg(h, t, title, body, css = '', w = W) {
  const c = THEMES[t];
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<style>
.fg{fill:${c.fg}}.soft{fill:${c.soft}}.muted{fill:${c.muted}}.faint{fill:${c.faint}}.accent{fill:${c.accent}}
.panel{fill:${c.panel}}.green{fill:${c.green}}.btn{fill:${c.btn}}.btnfg{fill:${c.btnFg}}.btn2{fill:${c.btn2}}.paper{fill:${c.paper}}.strip{fill:${c.strip}}
.s-accent{stroke:${c.accent}}.s-muted{stroke:${c.muted}}.s-fg{stroke:${c.fg}}.s-line{stroke:${c.line}}.s-btnfg{stroke:${c.btnFg}}
.ico{fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.in{animation:rise .8s ${EASE} both;animation-delay:calc(var(--i,0)*80ms)}
@keyframes rise{from{opacity:0;transform:translateY(16px)}}
${css}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>
${body}
</svg>
`;
}
const emit = (name, fn) => {
  for (const t of Object.keys(THEMES)) writeFileSync(join(OUT, `${name}-${t}.svg`), fn(t, THEMES[t]));
};
const arrow = (x, y, s, cls) =>
  `<path class="ico ${cls}" transform="translate(${x} ${y}) scale(${s / 24})" d="M7 17 17 7M9 7h8v8"/>`;

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
const dotsDef = (c) => `<pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="11" cy="11" r="1.1" fill="${c.dot}" fill-opacity="${c.dotO}"/></pattern>`;
function hero(data) {
  return (t, c) => {
    const H = 566, STRIP = 104, PX = 40;
    const portrait = readFileSync(join(ROOT, 'scripts', 'portrait.jpg')).toString('base64');
    let b = `<defs>${dotsDef(c)}
<clipPath id="card"><rect width="${W}" height="${H}" rx="22"/></clipPath>
<clipPath id="ph"><rect x="0" y="0" width="236" height="296" rx="2"/></clipPath>
<filter id="lift" x="-30%" y="-20%" width="160%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#101014" flood-opacity="${t === 'dark' ? 0.6 : 0.2}"/></filter>
</defs>
<g clip-path="url(#card)"><rect class="paper" width="${W}" height="${H}"/><rect width="${W}" height="${H - STRIP}" fill="url(#dots)"/><rect class="strip" y="${H - STRIP}" width="${W}" height="${STRIP}"/></g>
<g transform="translate(${PX} 14)">`;

    b += `<g class="in" style="--i:0">${text('Abdelhakim', -4, 128, F.bold, 100, 'fg', { ls: -0.04 })}</g>`;
    const baw = width('Baâlla', F.italic, 118, -0.01);
    b += `<g class="in" style="--i:1">${text('Baâlla', -2, 236, F.italic, 118, 'fg', { ls: -0.01 })}
<rect class="accent sq" x="${n(baw + 6)}" y="220" width="16" height="16"/></g>`;

    const lead = 'I build ';
    const lw = width(lead, F.mono, 23);
    b += `<g class="in" style="--i:2">${text(lead, 0, 302, F.mono, 23, 'muted')}`;
    PHRASES.forEach((p, i) => {
      b += `<g class="swap" style="animation-delay:${i * 3}s">${text(p, lw, 302, F.mono, 23, 'fg')}</g>`;
    });
    b += `</g>`;

    b += `<g class="in" style="--i:3"><circle class="green ping" cx="9" cy="359" r="6"/><circle class="green" cx="9" cy="359" r="6"/>
${text('Tech Lead & AI Systems Architect', 26, 366, F.medium, 22, 'fg')}
${runs([{ t: 'at  ', f: F.sans, size: 22, cls: 'muted' }, { t: 'Ton avenir au maroc', f: F.medium, size: 22, cls: 'fg' }, { t: '   ·   Agadir, Morocco', f: F.sans, size: 22, cls: 'muted' }], 26, 398).svg}</g>`;

    b += `<g class="in" style="--i:2"><g transform="translate(556 96) rotate(2.200 126 160)">
<rect x="0" y="0" width="252" height="320" rx="3" fill="#fbfbfa" filter="url(#lift)"/>
<g transform="translate(8 8)" clip-path="url(#ph)"><image width="236" height="354" xlink:href="data:image/jpeg;base64,${portrait}" href="data:image/jpeg;base64,${portrait}" preserveAspectRatio="xMidYMin slice"/></g>
</g></g>`;

    b += `<g transform="translate(-56 -8)"><g class="note" transform="rotate(-5 760 60)">
${text('open to select work,', 846, 46, F.hand, 29, 'muted', { anchor: 'end' })}
${text('say hello', 846, 76, F.hand, 29, 'muted', { anchor: 'end' })}
</g>
<path class="ico s-muted draw" pathLength="1" d="M812 84c22 2 38 12 44 30m0 0-11-6m11 6 3-12"/></g>`;
    b += `</g>`;

    // The strip: four true figures
    const cells = [
      [String(data.repos), 'public repositories'],
      ['15', 'certifications'],
      ['4', 'spoken languages'],
      ['24h', 'typical reply'],
    ];
    const cw = (W - PX * 2) / cells.length;
    cells.forEach(([fig, label], i) => {
      const x = PX + cw * i, y = H - STRIP;
      b += `<g class="in" style="--i:${5 + i}">${text(fig, x - 2, y + 52, F.bold, 38, 'fg', { ls: -0.04 })}${text(label, x, y + 80, F.sans, 17, 'muted')}</g>`;
    });

    const css = `
.swap{opacity:0;animation:swap 15s ${EASE} infinite both}
@keyframes swap{0%{opacity:0;transform:translateY(10px)}2.600%{opacity:1;transform:none}17.400%{opacity:1;transform:none}20%,100%{opacity:0;transform:translateY(-10px)}}
.ping{transform-box:fill-box;transform-origin:center;animation:ping 2.400s ease-out infinite}
@keyframes ping{from{opacity:.55;transform:scale(1)}80%,to{opacity:0;transform:scale(2.600)}}
.sq{transform-box:fill-box;transform-origin:center;animation:stamp .5s ${EASE} .5s both}
@keyframes stamp{from{opacity:0;transform:scale(.2)}}
.note{animation:fade .6s ease-out .9s both}
@keyframes fade{from{opacity:0}}
.draw{stroke-dasharray:1;animation:draw .7s ${EASE} 1.300s both}
@keyframes draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@media (prefers-reduced-motion:reduce){.swap{opacity:0}.swap:first-of-type{opacity:1}.ping{opacity:0}}`;
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
    const size = 50;
    const r = runs([
      { t: a, f: F.bold, size, cls: 'fg', ls: -0.035 },
      { t: i, f: F.italic, size: size * 1.14, cls: 'fg', ls: -0.01 },
      { t: '.', f: F.bold, size, cls: 'accent' },
    ], -2, 62);
    const nw = width(note, F.hand, 28);
    const nx = W - 8 - nw;
    const b = `<g class="in">${r.svg}</g>
<g class="note"><g transform="rotate(-3 ${n(nx + nw / 2)} 50)">${text(note, nx, 56, F.hand, 28, 'muted')}</g>
<path class="ico s-muted" d="M${n(nx - 12)} 56c-10 7-22 7-32-1m0 0 9-1m-9 1 3 9"/></g>`;
    return svg(84, t, `${a}${i}.`, b, `.note{animation:fade .6s ease-out .5s both}@keyframes fade{from{opacity:0}}`);
  };
}

// ---- selected work --------------------------------------------------------
// Each project gets a field of colour and one motif drawn from its subject.
const ring = (cx, cy, r, count, br) => Array.from({ length: count }, (_, k) => {
  const a = (Math.PI * 2 * k) / count - Math.PI / 2;
  return `<circle class="mf" cx="${n(cx + r * Math.cos(a))}" cy="${n(cy + r * Math.sin(a))}" r="${br}"/>`;
}).join('');
const qr = () => {
  const s = 12, ox = 42, oy = 46;
  const finder = (c, r) => `<rect class="mo" x="${ox + c * s + 2}" y="${oy + r * s + 2}" width="${s * 3 - 4}" height="${s * 3 - 4}" rx="3"/><rect class="mf" x="${ox + c * s + 12}" y="${oy + r * s + 12}" width="12" height="12" rx="1"/>`;
  const cells = [[3, 0], [3, 2], [4, 3], [6, 3], [3, 4], [5, 4], [4, 5], [6, 5], [3, 6], [5, 6], [0, 3], [2, 3]];
  return finder(0, 0) + finder(4, 0) + finder(0, 4) + cells.map(([c, r]) => `<rect class="mf" x="${ox + c * s + 1}" y="${oy + r * s + 1}" width="${s - 2}" height="${s - 2}" rx="2"/>`).join('');
};
const MOTIF = {
  sprout: () => `<path class="mo" d="M32 130q52-18 104 0M46 146q38-12 76 0M84 126V80"/><path class="mf" d="M84 98c-22 0-32-12-32-30 20 0 32 10 32 30zM84 84c0-20 12-32 32-32 0 20-12 32-32 32z"/>`,
  qr,
  wave: () => [[40, 26], [64, 42], [88, 34], [112, 60]].map(([x, h]) => `<rect class="mf" fill-opacity=".4" x="${x}" y="${136 - h}" width="16" height="${h}" rx="4"/>`).join('') + `<path class="mo" d="M34 84c16-22 30-22 46 0s30 22 54-18"/><circle class="mf" cx="134" cy="66" r="6"/>`,
  crescent: () => `<path class="mf" d="M96 36a32 32 0 1 0 24 50 26 26 0 1 1-24-50z"/><path class="mo" stroke-opacity=".45" d="M36 140q48-34 96 0"/>` + [[36, 140], [60, 127.2], [84, 123], [108, 127.2], [132, 140]].map(([x, y]) => `<circle class="mf" cx="${x}" cy="${y}" r="4.5"/>`).join(''),
  atom: () => [0, 60, 120].map((a) => `<ellipse class="mo" cx="84" cy="88" rx="50" ry="19" transform="rotate(${a} 84 88)"/>`).join('') + `<circle class="mf" cx="84" cy="88" r="8"/><circle class="mf" cx="134" cy="88" r="5"/>`,
  beads: () => ring(84, 78, 38, 15, 5) + `<path class="mo" d="M84 122v16"/><circle class="mf" cx="84" cy="146" r="7"/>`,
};
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
    const H = 176, T = 168, L = T + 30, R = W - 30;
    const ink = p.ink ? p.ink[k] : '#ffffff';
    let b = `<defs><clipPath id="card"><rect width="${W}" height="${H}" rx="16"/></clipPath></defs>
<g clip-path="url(#card)"><rect class="panel" width="${W}" height="${H}"/><rect width="${T}" height="${H}" fill="${p.field[k]}"/></g>
<g class="motif">${MOTIF[p.motif]()}</g>`;
    b += text(p.name, L, 54, F.bold, 34, 'fg', { ls: -0.03 });
    b += arrow(R - 24, 26, 26, 's-accent');
    b += text(p.kind, R - 36, 52, F.italic, 26, 'muted', { anchor: 'end' });
    wrap(p.desc.split(' '), F.sans, 20, R - L).forEach((line, i) => {
      b += text(line.join(' '), L, 90 + i * 27, F.sans, 20, 'soft');
    });
    const st = [];
    p.stack.forEach((s, i) => {
      if (i) st.push({ t: '   ·   ', f: F.sans, size: 17, cls: 'faint' });
      st.push({ t: s, f: F.medium, size: 17, cls: 'muted' });
    });
    b += runs(st, L, 152).svg;
    b += text(p.year, R, 152, F.mono, 17, 'muted', { anchor: 'end' });
    const css = `.mo{fill:none;stroke:${ink};stroke-width:3.500;stroke-linecap:round;stroke-linejoin:round}.mf{fill:${ink}}
.motif{transform-box:fill-box;transform-origin:center;animation:motif .9s ${EASE} .15s both}@keyframes motif{from{opacity:0;transform:scale(.86)}}`;
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
  const pitch = 88, top = 44, X = 168, H = top + pitch * (PATH.length - 1) + 60;
  const yEnd = top + pitch * (PATH.length - 1);
  let b = `<path class="s-line rail" pathLength="1" fill="none" stroke-width="2" stroke-linecap="round" d="M${X} ${yEnd}V${top}"/>`;
  PATH.forEach(([y1, y2, role, org, place], i) => {
    const y = top + pitch * i;
    const label = y2 ? `${y1} — ${y2}` : y1;
    b += `<g class="in" style="--i:${PATH.length - 1 - i}">`;
    b += text(label, X - 30, y + 8, F.mono, 19, i ? 'muted' : 'fg', { anchor: 'end' });
    if (!i) b += `<circle class="accent ping" cx="${X}" cy="${y}" r="7"/>`;
    b += `<circle class="${i ? 'fg' : 'accent'}" cx="${X}" cy="${y}" r="${i ? 5 : 7}"/>`;
    b += text(role, X + 32, y + 8, F.bold, 25, 'fg', { ls: -0.025 });
    b += runs([
      { t: org, f: F.italic, size: 24, cls: 'soft' },
      { t: '   ·   ', f: F.sans, size: 19, cls: 'faint' },
      { t: place, f: F.sans, size: 19, cls: 'muted' },
    ], X + 32, y + 40).svg;
    b += `</g>`;
  });
  const css = `
.rail{stroke-dasharray:1;animation:draw 1.400s ${EASE} both}
@keyframes draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
.ping{transform-box:fill-box;transform-origin:center;animation:ping 2.400s ease-out infinite}
@keyframes ping{from{opacity:.55;transform:scale(1)}80%,to{opacity:0;transform:scale(2.600)}}
@media (prefers-reduced-motion:reduce){.ping{opacity:0}}`;
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
  const X = 300, size = 22, lh = 36, gap = 30;
  let y = 34, b = '';
  STACK.forEach(([title, items], g) => {
    const lines = wrap(items, F.medium, size, W - X, '   ·   ');
    b += `<g class="in" style="--i:${g}">`;
    b += text(title, 0, y, F.italic, 27, 'muted');
    lines.forEach((line, li) => {
      const parts = [];
      line.forEach((w, i) => {
        if (i) parts.push({ t: '   ·   ', f: F.sans, size, cls: 'faint' });
        parts.push({ t: w, f: F.medium, size, cls: 'fg' });
      });
      b += runs(parts, X, y + li * lh).svg;
    });
    b += `</g>`;
    y += lines.length * lh + gap;
  });
  const alt = STACK.map(([a, i]) => `${a}: ${i.join(', ')}`).join('. ');
  return svg(y - gap - 8, t, `The stack I ship with. ${alt}.`, b);
}

// ---- a year in dots -------------------------------------------------------
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function year(data) {
  return (t) => {
    const PX = 40, weeks = data.days;
    const pitch = (W - PX * 2) / weeks.length;
    const counts = weeks.flat().map((d) => d[1]).filter(Boolean).sort((a, b) => a - b);
    const q = (p) => counts[Math.min(counts.length - 1, Math.floor(counts.length * p))] || 1;
    const cuts = [q(0.25), q(0.5), q(0.75)];
    const level = (v) => (v === 0 ? 0 : v <= cuts[0] ? 1 : v <= cuts[1] ? 2 : v <= cuts[2] ? 3 : 4);
    const R = [1.400, 2.900, 4, 5.100, 6.200], O = [0.38, 0.62, 0.76, 0.9, 1];

    const big = runs([
      { t: data.total.toLocaleString('en-US'), f: F.bold, size: 84, cls: 'w', ls: -0.04 },
      { t: '  contributions', f: F.italic, size: 48, cls: 'w' },
    ], PX - 3, 112);
    const top = 196, H = top + pitch * 7 + 76;
    let b = `<rect width="${W}" height="${n(H)}" rx="22" fill="#2d5cff"/><g class="in">${big.svg}</g>`;
    b += `<g class="in" style="--i:1">${text(`in the last twelve months, across ${data.repos} public repositories and ${data.stars} stars.`, PX, 152, F.sans, 21, 'w', { extra: 'fill-opacity=".86"' })}</g>`;

    let lastMonth = -1, labels = '';
    weeks.forEach((wk, x) => {
      const cx = n(PX + pitch * x + pitch / 2);
      b += `<g class="col" style="animation-delay:${n(0.25 + x * 0.014)}s">`;
      wk.forEach(([date, v]) => {
        const dow = new Date(date + 'T00:00:00Z').getUTCDay();
        const l = level(v);
        b += `<circle class="w" cx="${cx}" cy="${n(top + dow * pitch + pitch / 2)}" r="${R[l]}" fill-opacity="${O[l]}"/>`;
      });
      b += `</g>`;
      const first = new Date(wk[0][0] + 'T00:00:00Z');
      const m = first.getUTCMonth();
      if (m !== lastMonth && x < weeks.length - 2) {
        if (lastMonth !== -1 || first.getUTCDate() <= 7) labels += text(MONTHS[m], PX + pitch * x + 2, top + pitch * 7 + 30, F.sans, 16, 'w', { extra: 'fill-opacity=".82"' });
        lastMonth = m;
      }
    });
    b += labels;
    const css = `.w{fill:#fff}.col{animation:pop .5s ${EASE} both}@keyframes pop{from{opacity:0;transform:translateY(8px)}}`;
    return svg(n(H), t, `${data.total} contributions in the last twelve months, across ${data.repos} public repositories and ${data.stars} stars. Each dot is a day; larger dots are busier days.`, b, css);
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
    const size = 19, pad = 22, H = 52;
    const tw = width(label, F.medium, size);
    const w = Math.ceil(pad + tw + 12 + 18 + pad);
    const b = `<rect class="${primary ? 'btn' : 'btn2'}" width="${w}" height="${H}" rx="12"/>
${text(label, pad, 33, F.medium, size, primary ? 'btnfg' : 'fg')}
${arrow(pad + tw + 10, 16, 20, primary ? 's-btnfg' : 's-fg')}`;
    return svg(H, t, label, b, '', w);
  };
}

// ---- the close ------------------------------------------------------------
// Inverted against the page: an ink field on light, a paper field on dark.
function close(t) {
  const H = 452, PX = 40, size = 62;
  let b = `<defs><clipPath id="card"><rect width="${W}" height="${H}" rx="22"/></clipPath></defs><g clip-path="url(#card)"><rect class="btn" width="${W}" height="${H}"/>`;
  b += `<g class="in">${text('Let’s build something', PX - 3, 100, F.bold, size, 'btnfg', { ls: -0.04 })}</g>`;
  const l2 = runs([
    { t: 'worth ', f: F.bold, size, cls: 'btnfg', ls: -0.04 },
    { t: 'shipping', f: F.italic, size: size * 1.14, cls: 'btnfg', ls: -0.01 },
    { t: '.', f: F.bold, size, cls: 'blue' },
  ], PX - 3, 172);
  b += `<g class="in" style="--i:1">${l2.svg}</g>`;
  b += `<g class="note" transform="rotate(-4 720 110)">${text('usually a reply', W - PX, 104, F.hand, 30, 'btnfg', { anchor: 'end', extra: 'fill-opacity=".72"' })}${text('within 24 hours', W - PX, 136, F.hand, 30, 'btnfg', { anchor: 'end', extra: 'fill-opacity=".72"' })}</g>`;
  const ws = 330;
  const ww = width('Baâlla', F.italic, ws, -0.02), sq = 40, total = ww + 16 + sq, x = (W - total) / 2;
  b += `<g class="in" style="--i:3">${text('Baâlla', x, H + 38, F.italic, ws, 'btnfg', { ls: -0.02, extra: 'fill-opacity=".16"' })}<rect class="blue" x="${n(x + ww + 16)}" y="${H - sq - 28}" width="${sq}" height="${sq}"/></g></g>`;
  const css = `.blue{fill:#2d5cff}.note{animation:fade .6s ease-out .5s both}@keyframes fade{from{opacity:0}}`;
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
