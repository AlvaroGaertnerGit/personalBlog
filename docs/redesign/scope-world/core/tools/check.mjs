// Every check of Scope World's experimental code, in one command, isolated from
// production's (whose root tsconfig and ESLint config stay as they are):
//   1. TypeScript: docs/redesign/scope-world/tsconfig.json (strict, unused locals)
//   2. ESLint: the repo's own rules, on Scope World's sources only (bundles excluded)
//   3. node --test: the mind, the locomotor, the baked ground
//   node docs/redesign/scope-world/core/tools/check.mjs
import { spawnSync } from "node:child_process"
import { readdirSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const world = path.resolve(here, "..", "..")
const repo = path.resolve(world, "..", "..", "..")
const rel = (p) => path.relative(repo, p).replaceAll("\\", "/")

function tests(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f)
    if (f === "node_modules" || f === "dist") continue
    if (statSync(p).isDirectory()) tests(p, out)
    else if (f.endsWith(".test.ts")) out.push(rel(p))
  }
  return out
}

const steps = [
  ["TypeScript", process.execPath, [path.join(repo, "node_modules", "typescript", "bin", "tsc"), "-p", rel(path.join(world, "tsconfig.json"))]],
  ["ESLint", process.execPath, [path.join(repo, "node_modules", "eslint", "bin", "eslint.js"), "--max-warnings=0", "--ignore-pattern", "**/dist/**", rel(path.join(world, "core")), rel(path.join(world, "entrega-2-entorno", "visor", "src")), rel(path.join(world, "entrega-2-entorno", "visor", "tools")), rel(path.join(world, "entrega-3-comportamiento", "lab")), rel(path.join(world, "entrega-4-mundo"))]],
  ["node --test", process.execPath, ["--test", ...tests(world)]],
]
let failed = 0
for (const [name, cmd, args] of steps) {
  const t0 = Date.now()
  const r = spawnSync(cmd, args, { cwd: repo, stdio: "pipe", encoding: "utf8" })
  const ok = r.status === 0
  if (!ok) failed++
  const tail = `${r.stdout ?? ""}${r.stderr ?? ""}`.split("\n").filter((l) => l.trim() && !/ExperimentalWarning|MODULE_TYPELESS|Reparsing|trace-warnings|To eliminate this warning/.test(l))
  const summary = name === "node --test" ? tail.filter((l) => /^ℹ (tests|pass|fail)/.test(l)).join(" · ") : ""
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)${summary ? `  ${summary}` : ""}`)
  if (!ok) console.log(tail.slice(-25).join("\n"))
}
process.exitCode = failed ? 1 : 0
