# Entorno de trabajo — Scope 3D

Comprobado el 2026-10-13 con `scripts/check_env.py` (resultados reales).

| Elemento | Resultado |
|---|---|
| Blender | 5.2.2 LTS — `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe` (no está en PATH) |
| Python de Blender | 3.13.13, numpy 2.3.4, sin PIL (las hojas se montan con numpy dentro de Blender) |
| CPU / RAM / disco | i5‑13400, 16 hilos · 15,8 GB · 382 GB libres |
| GPU | Ninguna utilizable: "Adaptador de pantalla básico de Microsoft" (sin driver OpenGL) |
| `--background` | Funciona; ninguna ventana. Los avisos `libepoxy … WGL_ARB_extensions_string` y `CUEW initialization failed` son inocuos |
| Guardar / reabrir `.blend` | OK |
| Exportar GLB | OK (Draco y meshoptimizer disponibles) |
| Cycles CPU | OK — 128 px de prueba en ~2 s; validación 640 px/48 muestras: 10–28 s por vista |
| Workbench | **Falla**: `EXCEPTION_ACCESS_VIOLATION` en `GPU_fence_signal` (necesita contexto GPU) |
| EEVEE | No usado (mismo requisito de GPU) |
| Compositor (bloom) | OK en CPU (`CompositorNodeGlare`, tipo Bloom, vía node group de 5.x) |

## Blender MCP

El addon (`blender_mcp.py`) está instalado, pero el servidor MCP vive **dentro** de una
instancia de Blender con interfaz: arranca su socket al cargar la UI. Sin GUI no hay servidor,
y la GUI está descartada en este equipo (sin GPU, y por decisión explícita del propietario).
**No se ha usado Blender MCP.** Todo el trabajo se ha hecho con
`blender --background --factory-startup --python <script>`.

(Un intento inicial de abrir la GUI para diagnosticar el MCP mostró errores WGL y se cerró en
cuanto el propietario lo indicó.)

## Hilos

Los renders fijan `threads = cpu_count - 4` (12) para que el equipo siga respondiendo.
