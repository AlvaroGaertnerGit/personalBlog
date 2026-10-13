import { readFile } from "node:fs/promises";
import path from "node:path";

// Serves the approved Scope GLB straight from the 3D pipeline output, so the
// lab always shows exactly what export_scope.py produced (no copy in /public
// to fall out of sync). Dev-only, like the rest of /scope-lab.
const GLB_PATH = path.join(process.cwd(), "assets/scope-3d/exports/scope.glb");

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }
  try {
    const data = await readFile(GLB_PATH);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "model/gltf-binary",
        "Content-Length": String(data.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Scope GLB not found at assets/scope-3d/exports/scope.glb", { status: 404 });
  }
}
