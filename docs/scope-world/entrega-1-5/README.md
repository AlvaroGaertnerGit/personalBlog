# Scope World · Pliego · Entrega 1.5

Estado: **pendiente de aprobación.** Es una fase de diseño: no hay cambios en producción ni
commits. El `.blend` aprobado se abre en solo lectura y nunca se guarda. La Entrega 1
(`docs/scope-world/`, fuera de esta carpeta) queda intacta.

**Abre [`index.html`](index.html)**, el tablero con los antes y después, los renders, los
storyboards y los límites.

| Entregable | Dónde |
|---|---|
| A · Profundidad espacial (3 vistas del campo) | `renders/a1-wide.jpg`, `a2-inside.jpg`, `a3-discovery.jpg` · [01-evolucion.md](01-evolucion.md) |
| B · Scope interactuando (6 fotogramas) | `renders/b1…b6` · [02-interaccion.md](02-interaccion.md) |
| C · Proyecto: MathView | `renders/c1…c3`, `c4-content-ui.jpg`, `c5-return-ui.jpg` · `board/mathview.html` · [03-proyecto-y-llegada.md](03-proyecto-y-llegada.md) |
| D · Primeros segundos | `board/animatic.html` · `renders/d-frame0…3-ui.jpg` · [03-proyecto-y-llegada.md](03-proyecto-y-llegada.md) |
| E · Sistema de comportamiento | [04-comportamiento.md](04-comportamiento.md) |
| F · Viabilidad | [05-viabilidad.md](05-viabilidad.md) |
| G · Tablero | [index.html](index.html) |

## Cómo se generó

- **Texturas.** `node docs/scope-world/entrega-1-5/blender/textures15.mjs` genera las notas
  reales del cuaderno: capas, etiquetas, el estado *Paused* y la tarjeta de MathView.
- **Mundo.** `blender/mundo.py` extiende `blender/pliego_base.py`, una copia de laboratorio del
  script de la Entrega 1 que se puede importar. El original no se ha tocado.
- **Renders.** Un plano por proceso de Blender y **un solo Blender cada vez**:

  ```
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup \
    --python docs/scope-world/entrega-1-5/blender/mundo.py -- --shot b4-push --res 1280 --samples 96 \
    --out docs/scope-world/entrega-1-5/renders/raw
  ```

  Los planos de 1920 px, con 128 muestras, tardan entre 3 y 5 minutos cada uno. Los de 1280 px,
  con 96 muestras, entre 1,5 y 2 minutos. Las pruebas de baja resolución quedan en
  `renders/test/`.
- **Composiciones.** `board/mathview.html` (`?state=content|return`) y `board/animatic.html`
  (`?frame=0…3`), fotografiadas con Playwright a 1920×1080.

Los PNG originales están en `renders/raw/`; el tablero usa JPG derivados.
