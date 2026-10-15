# 1. Auditoría de Scope World 1.0

Qué hay hoy en `docs/redesign/scope-world/prototype/`, qué falla y por qué. Los datos salen del
código, de `assets/world.json` y `assets/nav.bin`, y de lo que he medido en tu Chrome el
2026-10-15.

## 1.1 Medidas del mundo actual

| Medida | Valor | Fuente |
|---|---|---|
| Superficie del pliego | 2,0 × 1,4 m (2,8 m²) | `world.json` → `sheet` |
| Superficie por la que puede moverse el centro de Scope | **1,18 m²** (11 838 celdas de 1 cm) | `nav.bin` |
| Longitud de la ruta | **2,03 m** | `world.json` → `route` |
| Paradas de cámara | **4** (margen, preguntas, pliegue, luz) | `config.ts` |
| Gestos de rueda para llegar al final | unos 4–6 | `camera-rig.ts`: cada parada se asienta sola |
| Objetos que se pueden abrir | 7 (6 preguntas + MathView) | `config.ts` → `POIS` |
| Proyectos que se pueden abrir | 1 de 3 (Tournamently y Sport Coach están, pero no se abren) | `config.ts` |
| Mundo | 66 000 triángulos, 137 piezas, 2,2 MB (1,07 MB con gzip) | README del prototipo |
| Transferencia inicial | ≈ 1,7 MB con gzip | README del prototipo |
| Llamadas de dibujo | 93–116 por fotograma | `renderer.info`, medido hoy |

Scope mide unos 15 cm, así que el pliego tiene unos 13 × 9 «Scopes». El problema no es que el
pliego sea pequeño, sino que **la ruta lo recorre en una sola diagonal y se para cuatro veces**.

## 1.2 Limitaciones y su causa

| # | Lo que se siente | Causa en el código o en el diseño |
|---|---|---|
| 1 | **Se acaba en segundos** | Hay 4 paradas sobre una única curva de 2 m. Cada gesto de rueda lleva a la parada siguiente. No hay rincones fuera de la ruta ni capas por encima o por debajo |
| 2 | **Cuatro decorados** | Las paradas son encuadres, no lugares: nada cambia entre ellas, y lo que hay entre una y otra no tiene función |
| 3 | **Scope va por su cuenta** | `mind.ts` solo reacciona a un cambio de lugar cuando la cámara ya ha llegado (`cameraSettled && station !== lastStation`). Como avanza a unos 13 cm/s, **siempre llega tarde** y a menudo fuera de cuadro. Además explora por temporizador (cada 7–13 s) hacia puntos de la parada, sin tener en cuenta dónde está el visitante ni si se le ve |
| 4 | **No hay compañía** | No existe ninguna medida de distancia ni de visibilidad respecto al visitante. Tampoco hay reagrupación, ni espera mientras lees, ni memoria más allá de una lista de puntos visitados |
| 5 | **Se desplaza como un muñeco** | No hay ciclo de andar: se mueve con el clip `Bounce` más la traslación de la raíz |
| 6 | **Los proyectos son folios** | Al abrir MathView aparece una hoja HTML con la descripción. No hay demo, ni medios reales, ni interacción con el producto. Los enlaces están en `#` |
| 7 | **Faltan secciones enteras** | No hay presentación personal, docencia ni contacto. La biblia del mundo ya preveía el aula y el pie de la lámpara (`docs/scope-world/02-biblia.md` §2), pero no se construyeron |
| 8 | **El cuaderno es una nota** | Cada pregunta abre una nota pequeña, sin profundidad ni artículos |
| 9 | **Contenido duplicado** | Al pasar a español, el contenido vive en `src/ui/content-es.ts`, una copia traducida de los módulos de producción. Sirve para un prototipo; en producción tiene que haber una sola fuente |
| 10 | **Sin luz horneada** | Hay dos mapas de sombra en tiempo real. Es la mayor diferencia visual con los renders, y también el mayor coste por fotograma |
| 11 | **Rendimiento con GPU sin medir** | Este equipo no tiene GPU (Microsoft Basic Render Driver). Hoy, sin GPU y a escala 0,6, he medido unos 60 FPS en reposo, y unos 12 FPS a escala 1. Ninguna de las dos cifras dice nada sobre una GPU real |
| 12 | **El prototipo se compila con producción** | El `tsconfig.json` raíz incluye `docs/**/*.ts`: un error de tipos aquí rompería la compilación del sitio |

## 1.3 Lo que hay que conservar

- **La dirección artística:** papel pautado, porcelana, el anillo tostado, la lámpara, la noche y
  la escala de mesa.
- **El modelo de Scope, su rig y sus 12 clips**, sin tocar.
- **La regla de cocción:** papel = todavía no, porcelana = construido.
- **La separación entre el canvas y el HTML.** Todo el contenido ya es HTML real, encima del
  mundo.
- **La navegación por paradas, en vez de cámara libre.** El visitante controla el ritmo y no
  hay scroll secuestrado.
- **La máquina de estados pura y testeable** (`mind.ts`, 12 tests), con dos capas: actividad y
  atención.
- **El mapa caminable exportado de Blender**, compartido por Scope y la cámara.

## 1.4 Conclusión

La 1.0 demuestra que el pliego funciona como lugar. Para la 2.0 faltan cuatro cosas, por orden
de impacto:

1. **Un recorrido con capas y rincones.** Más paradas sobre la misma diagonal no bastan.
2. **Un Scope que acompaña.** Hace falta un modelo de compañía explícito, no un temporizador.
3. **Proyectos que se pueden probar.** Con el producto real donde exista, y una representación
   claramente señalada donde no.
4. **Las tres secciones que faltan:** quién soy, docencia y contacto.
