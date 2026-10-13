# Web Preview y píxeles de la cara — 2026-10-13

Validación de Scope 3D a tamaño real del blog (`/scope-lab` → Web Preview) e investigación del
"movimiento de píxeles" observado en la cara en el laboratorio grande. Todo medido en Chromium
con la GTX 1660 Ti (ANGLE/D3D11). **No se ha modificado la geometría, el rig ni los clips.**

## 1. Encuadre a escala web

- La cámara es fija, casi frontal (algo por encima y desde la izquierda de Scope, como el 2D).
- Se encuadra sobre la **silueta real de todo el movimiento**: puntos extremos del modelo con
  piel, medidos en 18 muestras de cada clip, con la amplitud aleatoria máxima (1,1) y con Idle
  respirando debajo.
- **Prueba de recorte:** se renderizaron todos los fotogramas de los 11 clips a 80 px, 160 px @2×
  y 200 px. Resultado: **0 píxeles opacos en el borde del canvas** en todos los casos.
- A 160 px, Scope en reposo ocupa 110 × 131 px (69 % × 82 % de la caja). El resto es el margen
  que necesitan el estiramiento, el salto y los giros.
- **Coste:** medir la envolvente bloquea el hilo principal unos 360 ms en la carga (empezó en
  ~1 s y se redujo muestreando 1 de cada 5 vértices). **Para producción** la envolvente depende
  solo del modelo y de la cámara: debe precalcularse como constante, con coste cero.

## 2. Píxeles de la cara: diagnóstico

Método: con solo Idle (movimiento sub-píxel lento), se calcula la segunda diferencia temporal
`|f0 − 2·f1 + f2|` de fotogramas consecutivos. Un movimiento bien filtrado da ≈ 0; el aliasing da
"saltos". Cada hipótesis se aisló por separado.

| Hipótesis | Prueba | Resultado |
|---|---|---|
| Superficies superpuestas / z-fighting ojo–cristal | Los ojos son lentes aplanadas (7 mm de radio, 1,1 mm de grosor) a 0,4 mm del cristal: el **72 % de sus vértices quedan detrás**, por diseño. Se forzó `polygonOffset` en los ojos | **Descartado.** Píxeles inquietos en la zona del ojo: 7,0 → 6,1 (sin cambio real). Paso de profundidad en la cara: 0,002 mm, frente a 0,315 mm por píxel (unas 160 veces de margen) |
| Errores de profundidad / ruido | La misma pose renderizada dos veces | **Descartado.** Diferencia máxima 0: el render es determinista |
| Grano procedural, sombras | Desactivados uno a uno | **Descartado.** Sin efecto en la cara (62 → 62) |
| Transformaciones de los ojos / blending | Medido en Idle puro, sin clips encima | No es necesario para que aparezca |
| **Antialiasing** | El bloom pasa por el `EffectComposer`, cuyos render targets no tenían MSAA; el `antialias: true` del canvas no se aplica ahí | **Causa principal confirmada.** Con MSAA ×4 en el composer, los píxeles que saltan en la cara bajan de 112 a 62 por fotograma y desaparece un moteado tenue por todo el cristal |
| Cuantización | Anillos concéntricos dentro del cristal, solo visibles con ganancia ×12 | Escalones de 1/255 de un gradiente muy oscuro. **Invisible**; no requiere acción |

**Qué queda:** los contornos de alto contraste (ojo/cristal, boca, cristal/borde beige) siguen
cambiando en escalones de 1/4 de píxel cuando la cara se mueve muy despacio. Es el residuo normal
de MSAA ×4.

### Comparación entre tamaños (energía del temblor = media de la segunda diferencia al cuadrado)

| Tamaño | Sin MSAA | MSAA ×4 | Saltos grandes por fotograma (sin MSAA → con MSAA) |
|---|---|---|---|
| 96 px @1× | 19,8 | 9,1 | 2,0 → 0,7 |
| 160 px @1× | 22,2 | 8,1 | 6,7 → 1,9 |
| 160 px @2× | 19,7 | 7,6 | 24,6 → 6,0 |

**Corrección aplicada:** MSAA ×4 en los render targets del composer. Es un cambio del renderizador
del laboratorio, no del modelo, y queda conmutable en Studio → Performance para comparar.

**¿Visible al tamaño real?**
- Sin MSAA: sí; los contornos de los ojos "hierven" ligeramente.
- Con MSAA y a ≤ 200 px: el movimiento de Idle es de centésimas de píxel por fotograma y el
  residuo queda en el límite de la percepción. Esto debe confirmarse a ojo en la vista previa.

**Si aún se nota**, opciones de menor a mayor coste:
1. Pixel ratio 2 en pantallas de 1×: supermuestreo; a 160 px son 320² píxeles, un coste trivial.
2. FXAA/SMAA tras el bloom.
3. Engrosar ligeramente el bisel del ojo para suavizar el contorno. Esto toca la geometría:
   requiere tu aprobación.

## 3. Nitidez a tamaños pequeños

Revisado con la lupa de píxeles (ampliación ×5 sin suavizado) a 80–200 px, con pixel ratio 1× y 2×.

| Elemento | 80–96 px @1× | 128–200 px @1× | Cualquier tamaño @2× |
|---|---|---|---|
| Ojos | Cápsulas legibles (~4 × 7 px a 80) | Nítidos | Nítidos, con halo limpio |
| Boca | 2 px: casi un punto | Legible | Legible |
| Borde de la pantalla | Escalonado visible | Escalonado leve | Limpio |
| Antena | Tallo de ~1 px, aliasing en la curva | Correcta | Correcta |
| Halo (bloom) | Correcto | Correcto | Correcto |
| Sombra | Muy suave; casi invisible sobre el fondo oscuro, sutil sobre el claro | — | — |

**Pixel ratio en producción:** `min(devicePixelRatio, 2)`, que es el valor actual por defecto.

- Un canvas de 160 px a 2× son 320² píxeles: un coste despreciable.
- Los móviles de 3× se limitan a 2×: no se nota a este tamaño y ahorra 2,25 veces el coste.
- No conviene subir de 2×.

## 4. Transparencia sobre el fondo real (corregido)

- **El bloom de three.js escribe alfa = 1 en todo el fotograma.** Sobre un canvas transparente
  dejaba un cuadrado gris. Ahora el halo usa como alfa su propia luminancia (premultiplicado),
  con un corte suave del velo residual de 1–4/255.
- **La sombra se cortaba en el borde del canvas** (5 % de opacidad, visible como una caja sobre
  el tema claro). Ahora se desvanece radialmente dentro del canvas: alfa en el borde ≤ 2/255.

## 5. Notas

- En desarrollo, React StrictMode monta el visor dos veces: el GLB se pide dos veces y la primera
  petición se aborta. En producción, una sola.
- El tema de la vista previa se aplica en la clase de `<html>` del iframe, sin pasar por
  next-themes, para no sobrescribir la preferencia guardada del blog (mismo origen).
