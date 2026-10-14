// Paper textures for the Pliego scenes: the maker's pencil handwriting on the
// question sheets (real research questions from src/components/sections/notebook-content.ts),
// rendered from SVG with sharp (resolved through next, no new dependency).
// Run: node docs/scope-world/blender/textures.mjs
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, "../../..")
const req = createRequire(createRequire(path.join(ROOT, "package.json")).resolve("next/package.json"))
const sharp = req("sharp")
const OUT = path.resolve(HERE, "../textures")

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;")

// [file, lines, fontSize]: each sheet carries one thread's current question, as written.
const SHEETS = [
  ["q-context", ["How much context", "is actually enough?"]],
  ["q-agents", ["When should one AI agent", "become two?"]],
  ["q-mcp", ["Can one shared protocol", "replace a pile of", "one-off integrations?"]],
  ["q-local", ["Where's the real quality gap", "between a local model", "and a frontier one?"]],
  ["q-ux", ["Can an interface be built", "around what a model can do?"]],
  ["q-arch", ["Can an AI understand", "architecture instead of", "simply generating code?"]],
  ["q-next", ["· · ·"]],
]

async function sheet(name, lines, { w = 1024, h = 1400 } = {}) {
  const size = 74
  const top = 260
  const text = lines
    .map((l, i) => `<text x="110" y="${top + i * size * 1.45}" transform="rotate(-1.2 110 ${top})">${esc(l)}</text>`)
    .join("")
  // Pencil: dark warm grey, slightly transparent so the paper grain shows through.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="100%" height="100%" fill="white"/>
    <g font-family="Ink Free" font-size="${size}" fill="#2b2a2e" fill-opacity="0.82">${text}</g>
    <path d="M110 ${top + lines.length * size * 1.45 + 30} q 220 -14 420 4" stroke="#2b2a2e" stroke-opacity="0.45" stroke-width="5" fill="none" stroke-linecap="round"/>
  </svg>`
  await sharp(Buffer.from(svg)).greyscale().png().toFile(path.join(OUT, `${name}.png`))
}

for (const [name, lines] of SHEETS) await sheet(name, lines)
console.log("textures ->", OUT)

// The classroom's pattern: the same small fold every student piece is made from
// (solid = cut, dashed = fold), drawn by hand in pencil.
const pattern = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1000">
  <rect width="100%" height="100%" fill="white"/>
  <g stroke="#2b2a2e" stroke-opacity="0.8" fill="none" stroke-linecap="round" stroke-width="7">
    <path d="M300 260 L1100 260 L1100 740 L300 740 Z"/>
    <path d="M300 500 L1100 500" stroke-dasharray="26 22"/>
    <path d="M700 260 L700 380 M700 620 L700 740" stroke-dasharray="26 22"/>
  </g>
  <g font-family="Ink Free" font-size="64" fill="#2b2a2e" fill-opacity="0.8">
    <text x="300" y="190">fold here, then make it yours</text>
    <text x="1130" y="515" font-size="52">↺</text>
  </g>
</svg>`
await sharp(Buffer.from(pattern)).greyscale().png().toFile(path.join(OUT, "pattern.png"))

// Drafts: unlabelled pencil sketches (boxes, arrows, a curve) — working marks, no claims.
const sketches = {
  "sketch-a": `<g stroke="#2b2a2e" stroke-opacity="0.7" fill="none" stroke-width="6" stroke-linecap="round">
      <rect x="160" y="300" width="260" height="170" rx="18"/><rect x="600" y="300" width="260" height="170" rx="18"/>
      <rect x="380" y="700" width="260" height="170" rx="18"/>
      <path d="M420 385 L590 385 M560 360 L592 385 L560 410"/><path d="M290 470 Q300 640 380 760"/><path d="M730 470 Q720 640 640 760"/>
      <path d="M160 1050 Q 360 960 520 1060 T 880 1040" stroke-opacity="0.5"/></g>`,
  "sketch-b": `<g stroke="#2b2a2e" stroke-opacity="0.65" fill="none" stroke-width="6" stroke-linecap="round">
      <path d="M150 1100 L150 300 M150 1100 L900 1100"/>
      <path d="M150 950 C 330 940 380 520 560 560 S 800 340 880 330"/>
      <circle cx="560" cy="560" r="14" fill="#2b2a2e"/><path d="M200 220 L420 220" stroke-dasharray="20 18"/></g>`,
}
for (const [name, body] of Object.entries(sketches)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1400"><rect width="100%" height="100%" fill="white"/>${body}</svg>`
  await sharp(Buffer.from(svg)).greyscale().png().toFile(path.join(OUT, `${name}.png`))
}
