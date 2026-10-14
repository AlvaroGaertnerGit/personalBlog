// Entrega 1.5 textures. Every sentence is copied from src/components/sections/notebook-content.ts
// (or projects-content.ts for MathView's name); nothing about the maker is invented.
// Run: node docs/scope-world/entrega-1-5/blender/textures15.mjs
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, "../../../..")
const sharp = createRequire(createRequire(path.join(ROOT, "package.json")).resolve("next/package.json"))("sharp")
const OUT = path.resolve(HERE, "../textures")
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
const PEN = `fill="#2b2a2e" fill-opacity="0.85" font-family="Ink Free"`

// a pop-up layer: small label + handwritten lines; strike = crossed out (failed assumption)
async function layer(name, label, lines, { w = 1200, h = 760, size = 66, strike = [], after = null } = {}) {
  const top = 230
  const text = lines.map((l, i) => `<text x="80" y="${top + i * size * 1.4}" ${PEN} font-size="${size}">${esc(l)}</text>`).join("")
  const strikes = strike.map((i) => `<path d="M70 ${top + i * size * 1.4 - size * 0.3} q ${lines[i].length * 15} -10 ${lines[i].length * 31} 4" stroke="#9a3b2a" stroke-width="7" fill="none" stroke-linecap="round"/>`).join("")
  const tail = after ? `<text x="80" y="${top + lines.length * size * 1.4 + 10}" ${PEN} font-size="${size}">${esc(after)}</text>` : ""
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="white"/>
    <g opacity="0.7"><text x="80" y="120" ${PEN} font-size="44" letter-spacing="4">${esc(label.toUpperCase())}</text></g>
    <path d="M80 140 h ${label.length * 30}" stroke="#2b2a2e" stroke-opacity="0.45" stroke-width="4"/>${text}${strikes}${tail}</svg>`
  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, `${name}.png`))
}

// thread "context-engineering"
await layer("ctx-finding", "Latest finding", ["Context scales better", "than prompting."])
await layer("ctx-hypothesis", "Current hypothesis", ["Architecture scales better", "than context, past a", "certain point."])
await layer("ctx-note", "Research note", ["Need more evidence before", "calling this settled."])
// thread "ai-agents"
await layer("ag-hypothesis", "Current hypothesis", ["Splitting by narrow responsibility", "beats one large agent holding", "the whole task."], { size: 60 })
await layer("ag-failed", "Failed assumption", ["More instructions would", "fix coordination."], { strike: [0, 1], after: "It didn't." })
await layer("ag-next", "Next experiment", ["Give two agents conflicting", "goals on purpose and", "see who yields."])

// the agents' pop-up centrepiece: one path that becomes two (the question itself, drawn)
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900"><rect width="100%" height="100%" fill="white"/>
  <g stroke="#2b2a2e" stroke-opacity="0.85" stroke-width="16" fill="none" stroke-linecap="round">
  <path d="M450 860 L450 520 C450 400 300 360 240 160"/><path d="M450 520 C450 400 600 360 660 160"/></g>
  <circle cx="240" cy="140" r="34" fill="#2b2a2e" fill-opacity=".85"/><circle cx="660" cy="140" r="34" fill="#2b2a2e" fill-opacity=".85"/></svg>`)).png().toFile(path.join(OUT, "ag-fork.png"))

// tags hung on the red thread: research notes
const tags = {
  "tag-mcp": ["Fewer one-off", "adapters than", "expected so far."],
  "tag-auto": ["This site's own", "plan, build, review", "loop is the closest", "real test of it."],
  "tag-ux": ["Where memory stops", "being useful is", "still an open", "question."],
}
for (const [name, lines] of Object.entries(tags)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840"><rect width="100%" height="100%" fill="white"/>
    <circle cx="300" cy="70" r="26" fill="none" stroke="#2b2a2e" stroke-opacity=".5" stroke-width="6"/>
    ${lines.map((l, i) => `<text x="50" y="${250 + i * 92}" ${PEN} font-size="64">${esc(l)}</text>`).join("")}</svg>`
  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, `${name}.png`))
}

// Local Models, lying down: its real status is "Paused"
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1400"><rect width="100%" height="100%" fill="white"/>
  <g ${PEN} font-size="70"><text x="100" y="250">Where's the real quality gap</text><text x="100" y="350">between a local model</text><text x="100" y="450">and a frontier one?</text></g>
  <g ${PEN} font-size="52" opacity="0.75"><text x="100" y="700">PAUSED</text><text x="100" y="800">Picked back up whenever a task</text><text x="100" y="880">is boring enough to justify it.</text></g>
  <rect x="80" y="640" width="250" height="80" rx="12" fill="none" stroke="#9a3b2a" stroke-width="6"/></svg>`)).png().toFile(path.join(OUT, "local-paused.png"))

// the MathView card at the edge of its tile
await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="560"><rect width="100%" height="100%" fill="white"/>
  <text x="70" y="250" ${PEN} font-size="150">MathView</text>
  <path d="M70 330 C 250 250 380 420 560 330 S 820 260 930 320" stroke="#2b2a2e" stroke-opacity=".6" stroke-width="9" fill="none"/></svg>`)).png().toFile(path.join(OUT, "card-mathview.png"))
console.log("textures ->", OUT)
