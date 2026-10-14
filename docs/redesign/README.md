# Rediseño de alvarogaertner.com: fase 1 (auditoría y dirección)

Estado: **pendiente de la aprobación del propietario.** No se ha modificado código de
producción, ni el modelo 3D, ni la entrada.

| Entregable | Archivo |
|---|---|
| A. Informe de auditoría | [01-auditoria.md](01-auditoria.md) |
| B. Mapa de discrepancias (y los 10 problemas principales) | [02-mapa-discrepancias.md](02-mapa-discrepancias.md) |
| C. Análisis de referencias y de CSS Design Awards | [03-referencias.md](03-referencias.md) |
| D. Tres direcciones artísticas | [04-direcciones.md](04-direcciones.md) |
| E. Comparativa y recomendación | [05-comparativa.md](05-comparativa.md) |
| F. Plan técnico (incluye el seguimiento del cursor) | [06-plan-tecnico.md](06-plan-tecnico.md) |
| G. Propuestas visuales | [mockups/index.html](mockups/index.html) (tablero) · `mockups/renders/` |
| Evidencia | `evidence/`: capturas de la web actual (4 dispositivos × claro/oscuro) y `evidence/refs/` (referencias) |

## Cómo ver las propuestas visuales

Abre `docs/redesign/mockups/index.html` en el navegador; no necesita servidor. Las fuentes se
cargan de Google Fonts, así que hace falta conexión a internet.

- `a-margen.html` y `b-estudio.html` son composiciones estáticas.
- `c-lente.html` es interactivo: la lente sigue al ratón. Con `?band=560px` y un viewport
  móvil se ve el escáner.

Los renders de Scope de `mockups/assets/` son fotogramas del modelo aprobado, renderizados con
`assets/scope-3d/scripts/render_loader.py` (Cycles por CPU, headless) a partir de clips
existentes: still, Focus (fotograma 34 del bucle) y la salida con ojos de Laugh (fotograma 16).
No se ha creado movimiento ni geometría nuevos.

## Cómo se regeneró la evidencia

Con `next build && next start -p 3100`, Playwright con Chrome (scripts en el scratchpad de la
sesión, no versionados) y cuatro viewports: 1920×1080, 1366×768, 820×1180 y 390×844 @2×.
