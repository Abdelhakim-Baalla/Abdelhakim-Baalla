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
  },
  dark: {
    fg: '#f4f4f2', soft: '#d3d3d6', muted: '#a1a1a8', faint: '#6f6f77',
    accent: '#8fa7ff', panel: '#161a22', dot: '#ffffff', dotO: 0.14,
    line: '#3a3f4a', green: '#4ade80', btn: '#f4f4f2', btnFg: '#0b0b0c', btn2: '#1c212b',
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
.panel{fill:${c.panel}}.green{fill:${c.green}}.btn{fill:${c.btn}}.btnfg{fill:${c.btnFg}}.btn2{fill:${c.btn2}}
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
function hero(t, c) {
  const H = 452;
  const portrait = readFileSync(join(ROOT, 'scripts', 'portrait.jpg')).toString('base64');
  let b = `<defs>
<pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="11" cy="11" r="1.1" fill="${c.dot}" fill-opacity="${c.dotO}"/></pattern>
<clipPath id="ph"><rect x="0" y="0" width="236" height="296" rx="2"/></clipPath>
<filter id="lift" x="-30%" y="-20%" width="160%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#101014" flood-opacity="${t === 'dark' ? 0.6 : 0.2}"/></filter>
</defs>
<rect width="${W}" height="${H}" fill="url(#dots)"/>`;

  // Name
  const s1 = 100;
  b += `<g class="in" style="--i:0">${text('Abdelhakim', -4, 128, F.bold, s1, 'fg', { ls: -0.04 })}</g>`;
  const baw = width('Baâlla', F.italic, 118, -0.01);
  b += `<g class="in" style="--i:1">${text('Baâlla', -2, 236, F.italic, 118, 'fg', { ls: -0.01 })}
<rect class="accent sq" x="${n(baw + 6)}" y="220" width="16" height="16"/></g>`;

  // The line that rewrites itself
  const lead = 'I build ';
  const lw = width(lead, F.mono, 23);
  b += `<g class="in" style="--i:2">${text(lead, 0, 304, F.mono, 23, 'muted')}`;
  PHRASES.forEach((p, i) => {
    b += `<g class="swap" style="animation-delay:${i * 3}s">${text(p, lw, 304, F.mono, 23, 'fg')}</g>`;
  });
  b += `</g>`;

  // Where and what, right now
  const role = runs([
    { t: 'Tech Lead & AI Systems Architect', f: F.medium, size: 21, cls: 'fg' },
    { t: '  at  ', f: F.sans, size: 21, cls: 'muted' },
    { t: 'Ton avenir au maroc', f: F.medium, size: 21, cls: 'fg' },
  ], 26, 372);
  b += `<g class="in" style="--i:3"><circle class="green ping" cx="9" cy="365" r="6"/><circle class="green" cx="9" cy="365" r="6"/>${role.svg}</g>`;
  b += `<g class="in" style="--i:4"><path class="ico s-muted" transform="translate(-3 394)" d="M12 21s-6.5-5.6-6.5-10.5a6.5 6.5 0 0 1 13 0C18.500 15.400 12 21 12 21zM12 13a2.500 2.500 0 1 0 0-5 2.500 2.500 0 0 0 0 5z"/>
${text('Agadir, Morocco  ·  GMT+1', 26, 413, F.sans, 21, 'muted')}</g>`;

  // The photograph, as on the portfolio
  b += `<g class="in" style="--i:2"><g transform="translate(612 104) rotate(2.200 126 160)">
<rect x="0" y="0" width="252" height="320" rx="3" fill="#fbfbfa" filter="url(#lift)"/>
<g transform="translate(8 8)" clip-path="url(#ph)"><image width="236" height="354" xlink:href="data:image/jpeg;base64,${portrait}" href="data:image/jpeg;base64,${portrait}" preserveAspectRatio="xMidYMin slice"/></g>
</g></g>`;

  // The note in the margin
  b += `<g class="note" transform="rotate(-5 760 60)">
${text('open to select work,', 846, 46, F.hand, 29, 'muted', { anchor: 'end' })}
${text('say hello', 846, 76, F.hand, 29, 'muted', { anchor: 'end' })}
</g>
<path class="ico s-muted draw" pathLength="1" d="M812 84c22 2 38 12 44 30m0 0-11-6m11 6 3-12"/>`;

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
  return svg(H, t, 'Abdelhakim Baâlla. I build production web apps, considered interfaces, reliable APIs, open-source tools, things that last. Tech Lead and AI Systems Architect at Ton avenir au maroc, Agadir, Morocco. Open to select work.', b, css);
}

// ---- headings -------------------------------------------------------------
const HEADS = {
  work: ['Things I’ve ', 'built'],
  path: ['The path so ', 'far'],
  stack: ['The stack I ship ', 'with'],
  proof: ['Proof of ', 'practice'],
  year: ['A year in ', 'dots'],
};
function heading(a, i) {
  return (t) => {
    const size = 50;
    const r = runs([
      { t: a, f: F.bold, size, cls: 'fg', ls: -0.035 },
      { t: i, f: F.italic, size: size * 1.14, cls: 'fg', ls: -0.01 },
      { t: '.', f: F.bold, size, cls: 'accent' },
    ], -2, 62);
    return svg(84, t, `${a}${i}.`, `<g class="in">${r.svg}</g>`);
  };
}

// ---- selected work --------------------------------------------------------
const WORK = [
  { slug: 'mahsoul', name: 'Mahsoul', kind: 'Agri-tech platform', year: '2025',
    desc: 'Farmers book agronomists and vets, pay, and order supplies in one place.',
    stack: ['Laravel', 'PHP', 'MySQL', 'Tailwind CSS'] },
  { slug: 'lbaraka', name: 'LBaraka', kind: 'Solidarity app', year: '2026',
    desc: 'Neighbours give, lend and rent everyday objects, with deposits and QR handovers.',
    stack: ['React Native', 'NestJS', 'PostgreSQL', 'MongoDB'] },
  { slug: 'wealthwave', name: 'WealthWave', kind: 'Personal finance', year: '2025',
    desc: 'Budgets, savings goals and expense analytics for a calmer relationship with money.',
    stack: ['Node.js', 'Express', 'MySQL', 'Chart.js'] },
  { slug: 'salat', name: 'Salat Times', kind: 'Linux desktop plugin', year: '2026',
    desc: 'Arabic-first prayer times for Omarchy: adhan, Hijri calendar, Qibla, all offline.',
    stack: ['QML', 'Quickshell', 'JavaScript'] },
  { slug: 'quantum', name: 'Quantum VQE Lab', kind: 'Quantum chemistry', year: '2026',
    desc: 'Reproducible variational quantum eigensolver experiments, with a local lab to run them.',
    stack: ['Python', 'Qiskit', 'Streamlit'] },
  { slug: 'athkar', name: 'Athkar Bot', kind: 'Discord bot', year: '2025',
    desc: 'Daily Athkar reminders, Quranic verses and schedules for Discord communities.',
    stack: ['Python', 'discord.py'] },
];
function work(p) {
  return (t) => {
    const H = 148, L = 30, R = W - 30;
    let b = `<rect class="panel" width="${W}" height="${H}" rx="14"/>`;
    b += text(p.name, L, 56, F.bold, 34, 'fg', { ls: -0.03 });
    b += arrow(R - 24, 28, 26, 's-accent');
    b += text(p.kind, R - 36, 54, F.italic, 27, 'muted', { anchor: 'end' });
    let size = 20;
    while (width(p.desc, F.sans, size) > R - L) size -= 0.5;
    b += text(p.desc, L, 92, F.sans, size, 'soft');
    const st = [];
    p.stack.forEach((s, i) => {
      if (i) st.push({ t: '   ·   ', f: F.sans, size: 17, cls: 'faint' });
      st.push({ t: s, f: F.medium, size: 17, cls: 'muted' });
    });
    b += runs(st, L, 124).svg;
    b += text(p.year, R, 124, F.mono, 17, 'muted', { anchor: 'end' });
    return svg(H, t, `${p.name}, ${p.kind.toLowerCase()}, ${p.year}. ${p.desc} Built with ${p.stack.join(', ')}.`, b);
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
    const weeks = data.days;
    const pitch = W / weeks.length;
    const counts = weeks.flat().map((d) => d[1]).filter(Boolean).sort((a, b) => a - b);
    const q = (p) => counts[Math.min(counts.length - 1, Math.floor(counts.length * p))] || 1;
    const cuts = [q(0.25), q(0.5), q(0.75)];
    const level = (v) => (v === 0 ? 0 : v <= cuts[0] ? 1 : v <= cuts[1] ? 2 : v <= cuts[2] ? 3 : 4);
    const R = [1.5, 3, 4.200, 5.400, 6.600], O = [1, 0.5, 0.68, 0.85, 1];

    const big = runs([
      { t: data.total.toLocaleString('en-US'), f: F.bold, size: 76, cls: 'fg', ls: -0.04 },
      { t: '  contributions', f: F.italic, size: 44, cls: 'fg' },
    ], -3, 70);
    let b = `<g class="in">${big.svg}</g>`;
    b += `<g class="in" style="--i:1">${text(`in the last twelve months, across ${data.repos} public repositories and ${data.stars} stars.`, 0, 110, F.sans, 21, 'muted')}</g>`;

    const top = 150;
    let lastMonth = -1, labels = '';
    weeks.forEach((wk, x) => {
      const cx = n(pitch * x + pitch / 2);
      b += `<g class="col" style="animation-delay:${n(0.25 + x * 0.014)}s">`;
      wk.forEach(([date, v]) => {
        const dow = new Date(date + 'T00:00:00Z').getUTCDay();
        const l = level(v);
        b += `<circle cx="${cx}" cy="${n(top + dow * pitch + pitch / 2)}" r="${R[l]}" class="${l ? 'accent' : 'faint'}"${l ? ` fill-opacity="${O[l]}"` : ' fill-opacity=".45"'}/>`;
      });
      b += `</g>`;
      const m = new Date(wk[0][0] + 'T00:00:00Z').getUTCMonth();
      if (m !== lastMonth && x < weeks.length - 2) {
        if (lastMonth !== -1 || new Date(wk[0][0] + 'T00:00:00Z').getUTCDate() <= 7) {
          labels += text(MONTHS[m], pitch * x + 2, top + pitch * 7 + 28, F.sans, 16, 'muted');
        }
        lastMonth = m;
      }
    });
    b += labels;
    const css = `.col{animation:pop .5s ${EASE} both}@keyframes pop{from{opacity:0;transform:translateY(8px)}}`;
    return svg(top + pitch * 7 + 40, t, `${data.total} contributions in the last twelve months, across ${data.repos} public repositories and ${data.stars} stars. Each dot is a day; larger dots are busier days.`, b, css);
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
function close(t) {
  const size = 62;
  let b = `<g class="in">${text('Let’s build something', -3, 70, F.bold, size, 'fg', { ls: -0.04 })}</g>`;
  const l2 = runs([
    { t: 'worth ', f: F.bold, size, cls: 'fg', ls: -0.04 },
    { t: 'shipping', f: F.italic, size: size * 1.14, cls: 'fg', ls: -0.01 },
    { t: '.', f: F.bold, size, cls: 'accent' },
  ], -3, 142);
  b += `<g class="in" style="--i:1">${l2.svg}</g>`;
  b += `<g class="note" transform="rotate(-4 700 110)">${text('usually a reply', 852, 100, F.hand, 29, 'muted', { anchor: 'end' })}${text('within 24 hours', 852, 130, F.hand, 29, 'muted', { anchor: 'end' })}</g>`;
  const css = `.note{animation:fade .6s ease-out .5s both}@keyframes fade{from{opacity:0}}`;
  return svg(170, t, 'Let’s build something worth shipping. Usually a reply within 24 hours.', b, css);
}
function footer(t, c) {
  const size = 286;
  const w = width('Baâlla', F.italic, size, -0.02);
  const sq = 38, total = w + 14 + sq, x = (W - total) / 2;
  const b = `<defs><pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="11" cy="11" r="1.1" fill="${c.dot}" fill-opacity="${c.dotO}"/></pattern></defs>
<rect width="${W}" height="290" fill="url(#dots)"/>
${text('Baâlla', x, 232, F.italic, size, 'fg', { ls: -0.02 })}
<rect class="accent" x="${n(x + w + 14)}" y="${232 - sq}" width="${sq}" height="${sq}"/>`;
  return svg(290, t, 'Baâlla.', b);
}

// ---- run ------------------------------------------------------------------
const data = await loadData();
emit('hero', hero);
for (const [k, [a, i]] of Object.entries(HEADS)) emit(`head-${k}`, heading(a, i));
for (const p of WORK) emit(`work-${p.slug}`, work(p));
emit('path', path);
emit('stack', stack);
emit('year', year(data));
for (const [k, label, primary] of BUTTONS) emit(`btn-${k}`, button(label, primary));
emit('close', close);
emit('footer', footer);
console.log(`Built assets for ${data.total} contributions, ${data.repos} repositories, ${data.stars} stars.`);
