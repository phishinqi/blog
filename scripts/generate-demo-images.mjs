// Generates the abstract demonstration images used by the sample albums. They are drawn from
// code, so the theme ships no photographs with unclear rights. Run: node scripts/generate-demo-images.mjs
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const C = {
  paper: '#f8f5ef',
  surface: '#f0ebe3',
  sand: '#d8cbb6',
  line: '#ddd6ca',
  ink: '#29251f',
  muted: '#71675b',
  accent: '#964630',
  clay: '#d08a62',
  sage: '#7d8a74',
  slate: '#3d4852',
  night: '#1d2026',
};
let seed = 7;
const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const svg = (w, h, body, bg = C.paper) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="${bg}"/>${body}</svg>`;

const images = {
  'city-corners/window-grid': [
    1200,
    1600,
    (w, h) => {
      let out = `<rect x="140" y="120" width="${w - 280}" height="${h - 120}" fill="${C.sand}"/>`;
      for (let r = 0; r < 7; r++)
        for (let c = 0; c < 4; c++) {
          const lit = r === 4 && c === 2;
          out += `<rect x="${210 + c * 215}" y="${200 + r * 200}" width="130" height="140" fill="${lit ? C.clay : C.slate}" opacity="${lit ? 1 : 0.82}"/>`;
        }
      return out;
    },
  ],
  'city-corners/evening-stairs': [
    1600,
    1067,
    (w, h) => {
      let out = '';
      for (let i = 0; i < 9; i++) {
        const y = 180 + i * 95;
        out += `<rect x="${i * 150}" y="${y}" width="${w}" height="${h}" fill="${i % 2 ? C.sand : C.line}"/>`;
        out += `<polygon points="${i * 150},${y} ${i * 150 + 90},${y} ${i * 150 + 420},${y + 95} ${i * 150 + 330},${y + 95}" fill="${C.muted}" opacity="0.35"/>`;
      }
      return out + `<circle cx="1360" cy="150" r="70" fill="${C.clay}"/>`;
    },
  ],
  'city-corners/neon-dusk': [
    1080,
    1350,
    () => {
      let out = `<rect y="900" width="1080" height="450" fill="#15171b"/>`;
      for (const [x, y, r, color] of [
        [300, 420, 150, C.accent],
        [690, 560, 110, C.clay],
        [520, 760, 60, C.sand],
      ])
        out += `<circle cx="${x}" cy="${y}" r="${r * 1.8}" fill="${color}" opacity="0.12"/><circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="0.9"/>`;
      return out;
    },
    C.night,
  ],
  'city-corners/crosswalk': [
    1600,
    900,
    (w, h) => {
      let out = `<rect width="${w}" height="${h}" fill="${C.slate}"/>`;
      for (let i = 0; i < 9; i++)
        out += `<rect x="${120 + i * 160}" y="260" width="90" height="420" fill="${C.paper}" opacity="0.92"/>`;
      return out + `<rect x="0" y="720" width="${w}" height="18" fill="${C.clay}"/>`;
    },
  ],
  'city-corners/single-lamp': [
    1000,
    1500,
    () =>
      `<rect x="480" y="360" width="16" height="1140" fill="${C.sand}"/><circle cx="488" cy="330" r="46" fill="${C.clay}"/><circle cx="488" cy="330" r="160" fill="${C.clay}" opacity="0.1"/><rect y="1380" width="1000" height="120" fill="#15171b"/>`,
    C.night,
  ],
  'city-corners/rooftop': [
    1400,
    1400,
    () => {
      let out = '';
      const blocks = [
        [140, 700, 360, 700, C.slate],
        [480, 520, 300, 880, C.muted],
        [760, 840, 480, 560, C.sand],
        [300, 980, 520, 420, C.ink],
      ];
      for (const [x, y, w, h, color] of blocks)
        out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}"/>`;
      return out + `<circle cx="1080" cy="340" r="120" fill="${C.accent}"/>`;
    },
    C.surface,
  ],
  'city-corners/afternoon-wall': [
    1600,
    1200,
    () =>
      `<rect width="1600" height="1200" fill="${C.sand}"/><polygon points="420,160 980,160 1260,860 700,860" fill="${C.paper}" opacity="0.7"/><line x1="700" y1="160" x2="980" y2="860" stroke="${C.sand}" stroke-width="26"/><line x1="560" y1="510" x2="1120" y2="510" stroke="${C.sand}" stroke-width="26"/><rect y="1040" width="1600" height="160" fill="${C.muted}" opacity="0.5"/>`,
  ],
  'city-corners/tram-line': [
    900,
    1600,
    () => {
      let out = `<rect y="820" width="900" height="780" fill="${C.line}"/>`;
      for (const x of [140, 760])
        out += `<line x1="${x}" y1="1600" x2="450" y2="820" stroke="${C.ink}" stroke-width="10"/>`;
      for (let i = 0; i < 12; i++) {
        const y = 840 + i ** 1.6 * 12;
        out += `<line x1="${450 - (y - 820) * 0.4}" y1="${y}" x2="${450 + (y - 820) * 0.4}" y2="${y}" stroke="${C.muted}" stroke-width="${2 + i}"/>`;
      }
      return out + `<line x1="0" y1="400" x2="900" y2="360" stroke="${C.ink}" stroke-width="3"/>`;
    },
    C.surface,
  ],
  'paper/ink-circles': [
    1200,
    1500,
    () => {
      let out = '';
      for (let i = 0; i < 14; i++)
        out += `<circle cx="${300 + random() * 600}" cy="${300 + random() * 900}" r="${80 + random() * 220}" fill="none" stroke="${i === 5 ? C.accent : C.ink}" stroke-width="${i === 5 ? 10 : 3}" opacity="${i === 5 ? 1 : 0.55}"/>`;
      return out;
    },
  ],
  'paper/folded-paper': [
    1500,
    1000,
    () =>
      `<polygon points="220,160 760,110 820,860 260,900" fill="${C.surface}"/><polygon points="760,110 1280,200 1240,880 820,860" fill="${C.line}"/><polygon points="760,110 820,860 790,860" fill="${C.muted}" opacity="0.3"/><circle cx="1060" cy="560" r="80" fill="${C.accent}"/>`,
    C.sand,
  ],
  'paper/terracotta-pattern': [
    1200,
    1200,
    () => {
      let out = '';
      for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++)
          out += `<path d="M${c * 150} ${r * 150 + 150} a75 75 0 0 1 150 0" fill="${(r + c) % 3 ? C.clay : C.accent}" opacity="${(r + c) % 3 ? 0.55 : 0.9}"/>`;
      return out;
    },
  ],
  'paper/line-study': [
    1000,
    1400,
    () => {
      let out = '';
      for (let i = 0; i < 38; i++) {
        const y = 140 + i * 30;
        let d = `M120 ${y}`;
        for (let x = 160; x <= 880; x += 40) d += ` L${x} ${y + (random() - 0.5) * 14}`;
        out += `<path d="${d}" fill="none" stroke="${i === 24 ? C.accent : C.ink}" stroke-width="${i === 24 ? 5 : 2}" opacity="0.8"/>`;
      }
      return out;
    },
  ],
  'paper/still-cup': [
    1400,
    1100,
    () =>
      `<rect y="720" width="1400" height="380" fill="${C.sand}"/><path d="M460 420 h380 v220 a190 150 0 0 1 -380 0 z" fill="${C.paper}" stroke="${C.ink}" stroke-width="6"/><path d="M840 470 a70 70 0 0 1 0 140" fill="none" stroke="${C.ink}" stroke-width="6"/><ellipse cx="650" cy="790" rx="300" ry="36" fill="${C.muted}" opacity="0.35"/><circle cx="1080" cy="660" r="70" fill="${C.accent}"/>`,
    C.surface,
  ],
  'paper/tide-pattern': [
    1600,
    1000,
    () => {
      let out = '';
      for (let i = 0; i < 16; i++) {
        const y = 80 + i * 56;
        out += `<path d="M0 ${y} q100 -40 200 0 t200 0 t200 0 t200 0 t200 0 t200 0 t200 0 t200 0" fill="none" stroke="${i % 5 === 2 ? C.accent : C.sage}" stroke-width="${i % 5 === 2 ? 8 : 4}"/>`;
      }
      return out;
    },
  ],
};

for (const [name, [w, h, draw, bg]] of Object.entries(images)) {
  const file = `public/images/albums/${name}.jpg`;
  await mkdir(file.slice(0, file.lastIndexOf('/')), { recursive: true });
  await sharp(Buffer.from(svg(w, h, draw(w, h), bg)))
    .jpeg({ quality: 84, mozjpeg: true })
    .toFile(file);
  console.log(`${file} ${w}×${h}`);
}
