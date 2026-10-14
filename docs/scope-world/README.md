# Scope World: Entrega 1, «el universo»

Estado: **pendiente de la aprobación del propietario.** Es una fase de diseño:
- no hay cambios en producción;
- no se han tocado el modelo, el rig, las animaciones ni el loader de Scope;
- no hay commits.

La documentación anterior, en `docs/redesign/`, queda intacta.

**Abre [`index.html`](index.html)**, el tablero visual. No necesita servidor; las fuentes vienen
de Google Fonts.

| Entregable (§19, Entrega 1) | Dónde |
|---|---|
| Revisión del contexto, premisas y elección | [01-concepto.md](01-concepto.md) §1–3 |
| Historia (las 12 preguntas) | [01-concepto.md](01-concepto.md) §4 |
| Identidad del mundo, reglas, materiales, paleta y escala | [02-biblia.md](02-biblia.md) §1 |
| Geografía | [02-biblia.md](02-biblia.md) §2 · `renders/map-ui.jpg` |
| Render principal (12.1) | `renders/main.jpg` |
| Home con interfaz real (12.2) y versión móvil (12.8) | `board/home.html`, `board/home-mobile.html` → `renders/home-ui.jpg`, `renders/home-mobile-ui.jpg` |
| Mapa (12.3) | `board/map.html` → `renders/map-ui.jpg` |
| Storyboard (12.4) y capacidades del rig | `renders/sb1…sb9.jpg` · [03-storyboard.md](03-storyboard.md) |

## Cómo se generó

1. **Texturas.** `node docs/scope-world/blender/textures.mjs` genera la letra a lápiz de las
   preguntas reales, los bocetos y el patrón. Usa sharp a través de next: no añade
   dependencias.
2. **Renders.** `sh docs/scope-world/blender/render-all.sh` lanza Blender 5.2 headless con
   Cycles por CPU.
   - `blender/pliego.py` construye el mundo de forma procedural alrededor del `.blend` aprobado,
     abierto en solo lectura y sin guardar nunca.
   - Para un plano suelto:
     `blender --background --factory-startup --python docs/scope-world/blender/pliego.py -- --shot main --res 1920 --samples 96`.
   - `--project 1` escribe sin renderizar dónde cae cada lugar en la imagen; lo usa el mapa.
3. **Composición.** Las páginas de `board/` ponen la interfaz HTML real sobre los renders. Se
   fotografiaron con Playwright (Chrome) a 1920×1080, 390×844 a 2× y 1920×1200.

Los PNG originales (16 bits, sin compresión) están en `renders/raw/`; el tablero usa JPG
derivados.

## Estado de los renders

| Imagen | Estado |
|---|---|
| `main` | **Final** (1920×1080, 96 muestras). Hay que repetirla: la hoja «· · ·» ya está corregida en la escena (`renders/preview/main.jpg`) |
| `home`, `home-m` y sus composiciones | **Finales** |
| `map` y `sb1-night` | **Finales** |
| Storyboard `sb2…sb9` | **Vistas previas** (640 px, 12 muestras) en `renders/preview/` |

La cola final se detuvo porque el sistema se quedó sin memoria. No se ha relanzado: para
completarla basta con `sh docs/scope-world/blender/render-all.sh`, quitando las líneas ya
hechas.

## Límites de esta entrega

- **Sin GPU:** nada se ha probado en tiempo real. Son imágenes fijas, no animación.
- **Poses:** las que no existen como clip están señaladas (`03-storyboard.md` §2).
- **Luces auxiliares declaradas:**
  - el alcance de la luz de los ojos en las escenas nocturnas;
  - un rebote del papel.
- **Pendiente para la Entrega 2:**
  - interacciones;
  - secuencia con un objeto;
  - rutinas autónomas;
  - transformaciones;
  - proyecto integrado;
  - propuesta técnica.
