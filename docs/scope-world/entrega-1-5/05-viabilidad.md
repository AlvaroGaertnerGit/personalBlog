# Entregable F: viabilidad

No he medido nada en tiempo real: este equipo no tiene GPU. Las cifras de esta tabla son
**estimaciones de diseño** que habría que validar en un equipo con GPU y en un móvil real.

## 1. Qué puede funcionar en tiempo real y qué no

| Elemento | Tiempo real | Cómo |
|---|---|---|
| El pliego y las hojas | **Sí** | Planos con pocos polígonos; los pliegues van en la malla o en un normal map. Sin booleanos en el cliente: los huecos se cortan en Blender y se exportan |
| Papel translúcido (contraluz) | **Sí, aproximado** | Un shader propio con «wrap lighting» + transmisión falsa por mapa de espesor. Sin subsurface real |
| Ley de cocción (papel → porcelana con borde tostado) | **Sí** | Un uniform (centro y radio del círculo) en el shader del papel; es la misma lógica que en `pliego.py` |
| Iluminación | **Sí, con horneado** | Luz y sombras estáticas horneadas (lightmaps). Una sola luz dinámica con sombra: la lámpara o los ojos de noche. La hora del día es un cambio de tono, no de sombras |
| Libros que se abren y capas pop-up | **Sí** | Pocas mallas por libro; animación por huesos o procedural. La letra va en texturas (atlas KTX2/Basis) |
| Curvas de nivel de MathView | **Sí** | Se calculan en el shader a partir de la altura. Coste casi nulo |
| Hilo y etiquetas | **Sí** | Líneas o tubos finos; las etiquetas con un balanceo simple |
| Scope | **Sí, ya existe** | El GLB actual (698 KB con meshopt) y su rig |
| Profundidad de campo y bloom de los renders | **Parcial** | Bloom ligero en postproceso; profundidad de campo solo en escritorio potente, o falseada |
| Un render de la calidad de Cycles | **No** | Las imágenes de esta entrega son el techo visual, no la apariencia en tiempo real. El 3D en vivo será más plano. La dirección (materiales simples, una luz) se eligió para que la diferencia sea pequeña |

## 2. Estrategia de carga y rendimiento

1. **El primer pintado es HTML y una imagen prerenderizada** de la home de noche, como el loader
   actual. El LCP no depende de WebGL.
2. **Carga por lugares:** primero el margen y el campo. El círculo, el aula y el pie de la
   lámpara se cargan cuando el visitante se acerca.
3. **Presupuesto orientativo**, a validar: escena inicial de 1,5 MB o menos (geometría + texturas
   comprimidas, sin Scope); menos de 100 draw calls; una sola luz con sombra.
4. **Memoria:** se liberan las texturas de los lugares lejanos y se comparte un único atlas de
   papel.

## 3. Alternativas por dispositivo

| Caso | Qué recibe |
|---|---|
| Escritorio con GPU | El mundo 3D completo |
| Móvil con GPU | Menos hojas por lugar, sin profundidad de campo, DPR limitado y cámara vertical propia (ver la home móvil de la Entrega 1) |
| Sin WebGL o con renderizado por software | **Planos prerenderizados** (este mismo pipeline de Blender) con la interfaz HTML encima. El contenido es el mismo |
| Movimiento reducido | Sin vuelos de cámara ni desplazamientos de Scope: cortes con fundido; Scope solo respira y parpadea |
| Teclado | Cada lugar y cada objeto (pregunta, pieza) es un elemento enfocable. El foco mueve la cámara y Scope mira el foco |

## 4. Lo que se puede comprobar aquí y lo que no

| Aquí (sin GPU) | Solo con GPU real |
|---|---|
| Composición, escala, materiales y luz en Cycles | Rendimiento (FPS, memoria) y el aspecto del shader de papel en tiempo real |
| Que el contenido y el HTML funcionan sin 3D | Si la locomoción a saltitos resulta creíble a 60 fps |
| Tamaño de los archivos | Coste real de las sombras y del contraluz en móvil |
