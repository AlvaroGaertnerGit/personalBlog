# Scope World · fase 3: prototipo interactivo

Estado: **prototipo para que lo pruebes; la decisión es tuya.** No es la web definitiva.
Producción no se ha tocado: ni la landing, ni las rutas, ni el modelo de Scope, ni sus
animaciones. No hay commits, despliegues ni dependencias nuevas.

Las capturas de `captures/` son **fotogramas del prototipo en tiempo real**, no renders de
Blender. Se hicieron sin GPU, con SwiftShader: la imagen es exacta, pero la fluidez no se puede
juzgar con ellas.

## 1. Dónde está

`docs/redesign/scope-world/prototype/`, aislado del sitio. No es una ruta de Next y no se
despliega.

| Ruta | Qué es |
|---|---|
| `index.html` | La página del prototipo |
| `src/main.ts` | Coordina el mundo, la cámara, a Scope y el HTML |
| `src/world/` | Carga del mundo, materiales (shaders), luz y posproceso |
| `src/camera/camera-rig.ts` | La cámara: ruta, parallax y enfoque |
| `src/scope/` | `mind.ts` (máquina de estados), `presence.ts` (mirada), `scope-actor.ts` (Scope en el mundo), `nav.ts` (caminos) y sus tests |
| `src/ui/` | Loader, puntos interactivos, hoja del proyecto, notas y vista de lectura |
| `assets/` | `world.glb`, `world.json`, `height.bin` (suelo) y `nav.bin` (dónde puede estar Scope), exportados del Blender aprobado |
| `dist/app.js` | El paquete ya compilado |
| `tools/` | `export_world.py` (Blender), `build.mjs`, `serve.mjs` (puerto 3100), `verify.mjs` (prueba de navegador) y `capture.mjs` (capturas) |
| `../captures/` | Fotogramas del prototipo |

## 2. Cómo se ejecuta

Desde la raíz del repositorio, con las dependencias ya instaladas (`pnpm install`):

```
node docs/redesign/scope-world/prototype/tools/serve.mjs
```

Abre **http://localhost:3100/** en Chrome o Edge, en un equipo con GPU. El servidor se cierra
con `Ctrl+C`. Usa el puerto 3100 y nunca el 3000.

| Para | Comando |
|---|---|
| Probarlo en tu ordenador, de forma automática | `node docs/redesign/scope-world/prototype/tools/verify.mjs --headed`. Arranca y detiene el servidor, recorre los seis momentos, mide y hace capturas. Deja `report.json` y las imágenes en `%TEMP%\scope-world-verify` |
| Los tests | `node --test docs/redesign/scope-world/prototype/src/scope/mind.test.ts docs/redesign/scope-world/prototype/src/scope/nav.test.ts` |
| Recompilar tras cambiar `src/` | `node docs/redesign/scope-world/prototype/tools/build.mjs`. Usa el esbuild que ya está en `node_modules` como dependencia transitiva; no instala nada |
| Regenerar el mundo desde Blender | `"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup --python docs/redesign/scope-world/prototype/tools/export_world.py`. Headless, un único Blender, unos 2 minutos |
| Rehacer las capturas | `node docs/redesign/scope-world/prototype/tools/capture.mjs` |

Parámetros de URL para revisarlo:

| Parámetro | Efecto |
|---|---|
| `?debug` (o la tecla **D**) | Panel con el estado de Scope, lo que hace y por qué, la mirada, los clips, la cámara, los FPS y las llamadas de dibujo |
| `?reduced` | Se comporta como con `prefers-reduced-motion` |
| `?fallback` | La experiencia sin WebGL |
| `?force3d` | Ejecuta el 3D aunque el renderizado sea por software |
| `?tier=high` o `?tier=medium` | Fuerza un nivel de calidad |
| `#mathview` | Abre el proyecto al entrar; también funciona como enlace directo y con el botón Atrás |

## 3. Tecnología y por qué

| Elección | Motivo |
|---|---|
| **three.js 0.180** (ya es dependencia) | El motor de Scope ya está escrito en three. Reutilizarlo tal cual vale más que cualquier ventaja de React Three Fiber, que añadiría React y un reconciliador a un bucle que no necesita estado de React |
| **TypeScript sin framework, empaquetado con esbuild** | Importa en solo lectura los módulos reales de `src/` (animador, capa secundaria, carga del modelo, loader y contenido) sin pasar por Next. Así no toca ni rutas ni la configuración del sitio |
| **El mundo exportado de Blender** | Es la misma escena que los renders aprobados (`mundo.py`); no se ha remodelado nada. Los materiales de Cycles se reconstruyen en shaders con las mismas reglas: líneas de cuaderno, margen, la ley de cocción de la lámpara y las curvas de nivel de MathView |
| **El mapa de navegación también sale de Blender** | `nav.bin` marca dónde puede estar Scope: cada pieza más baja que él (16 cm), ensanchada con su radio (6 cm), y los huecos que el kirigami dejó en el pliego. Lo que mide menos de 3 cm (los ejes tumbados de MathView, su tarjeta, el lápiz) se puede saltar. Scope y la cámara comparten así el mismo espacio |

### 3.1 Navegación: qué elegí y qué descarté

| Mecanismo | Decisión |
|---|---|
| **Recorrido por cuatro lugares** (rueda, deslizar, ← → o la cinta) | **Sí.** Es una curva continua por los lugares de la ruta en S. La rueda avanza con amortiguación y, al soltarla, la cámara se asienta en el lugar más cercano. Nunca avanza sola. La página no tiene scroll, así que no secuestra ninguno |
| **Parallax real con el ratón** | **Sí.** La cámara se desplaza unos centímetros en su propio plano; las hojas cercanas se deslizan sobre las lejanas porque la escena es 3D de verdad |
| **Objetos interactivos** | **Sí.** MathView, cinco preguntas del cuaderno, la pregunta sin escribir y el propio Scope. Responden al puntero y además son botones HTML reales colocados sobre cada objeto |
| **Controles accesibles** | **Sí.** La cinta de lugares, el tabulador entre objetos, Intro, Esc, Inicio y Fin |
| Órbita o vuelo libre | **No.** Desorienta, permite encuadres feos y en el móvil compite con el gesto de deslizar |
| Una película ligada al scroll | **No.** El brief la descarta, y además rompe la sensación de lugar |

**Cámaras.** «The margin» y «The light» usan las cámaras de los renders aprobados (`home` y
`c1-place`). El primer plano de MathView parte de `c2-close`, y en el móvil el margen usa
`home-m`. **«Questions» se ha movido** respecto a `a2-inside`: el mapa de navegación demostró
que desde esa cámara no se ve ningún trozo de suelo donde Scope pueda estar. «The long fold» es
nueva.

## 4. Qué es 3D real y qué no

| Parte | Tipo |
|---|---|
| El pliego, las preguntas, el libro abierto, el hilo y las etiquetas, el banco, el mirador, el círculo de la lámpara, MathView, Tournamently, el dial y la lámpara | **3D real.** Es la geometría exportada del Blender aprobado (66 000 triángulos, 137 piezas) con luz y sombras en tiempo real |
| Scope | **3D real.** Es el GLB de producción, con su rig, sus clips, el muelle de la antena, la deriva y los parpadeos |
| Las líneas, el margen, la cocción, el anillo tostado y las curvas de nivel | **Shaders en tiempo real**, con las mismas reglas que los nodos de Cycles |
| Las letras de las notas y de las portadas | Texturas: las mismas imágenes de los renders |
| El loader | Es **el de producción**: un Scope prerenderizado (sprites) y la línea. Al terminar da paso al Scope 3D en el mismo sitio de la pantalla, al mismo tamaño y con los ojos en arco |
| La hoja del proyecto, las notas, la cinta de lugares y la barra | **HTML superpuesto**, accesible y seleccionable. La hoja se despliega desde la proyección en pantalla de la tarjeta 3D de MathView y vuelve a plegarse en ella |
| La vista de lectura y el modo sin WebGL | HTML con los **renders prerenderizados** de la Entrega 1.5 como imagen de cada lugar |
| Elementos 2.5D | Ninguno: no hay capas planas fingiendo profundidad |

## 5. Qué interacciones funcionan de verdad

1. **Entrar.**
   - El loader de producción espera a que el mundo esté cargado.
   - Scope termina su gesto y salta; la pantalla se funde sobre el **mismo Scope en 3D**, en el mismo sitio y con los ojos en arco. Detrás está el pliego, de noche.
   - Se enciende la lámpara: una luz que calienta, con un pequeño parpadeo del filamento, en lugar de un corte. Scope la mira.
   - La cámara baja hasta su altura, en el margen.
2. **Explorar.**
   - Rueda, deslizar, ← → o la cinta de lugares para moverse entre los cuatro lugares.
   - Parallax con el ratón.
   - Al pasar el puntero o enfocar con el teclado aparecen las etiquetas, con la pregunta real y su estado.
3. **Ver a Scope reaccionar.** Ver §6.
4. **MathView.**
   - Al pasar el puntero, sus curvas de nivel se encienden un poco.
   - Al abrirlo (clic, Intro o `#mathview`):
     - la cámara se acerca a la pieza;
     - las curvas se encienden con un frente de luz que sale de la tarjeta;
     - la tarjeta se levanta;
     - Scope va hacia la pieza y la mira.
   - La hoja del proyecto se despliega desde la tarjeta. Tiene el contenido real de `projects-content.ts` y es un diálogo con el foco atrapado. Los enlaces aún son `#` y aparecen como «link pending»; el stack también figura como provisional.
5. **Volver.**
   - Esc, el botón o Atrás del navegador cierran la hoja, que vuelve a plegarse en la tarjeta.
   - La cámara vuelve a «The light», Scope sigue junto a MathView y te mira, y el foco vuelve al punto de MathView.
   - La pieza conserva un rastro de luz: has estado allí.
6. **Las preguntas.**
   - Al abrir una, aparece su nota real del cuaderno (`notebook-content.ts`) junto al libro, y Scope va a leerla también.
7. **Vista de lectura.**
   - El mismo contenido como página.
   - Es la experiencia sin WebGL o con renderizado por software, y una opción para cualquiera.

## 6. Comportamiento de Scope implementado

`src/scope/mind.ts` es una máquina de estados pura con 12 tests. Tiene dos capas que nunca se
pisan: la **actividad** controla dónde está y los gestos (clips); la **atención** controla solo
la mirada.

| Estado | Prioridad | Cuándo | Qué hace |
|---|---|---|---|
| reposo | 0 | Siempre, por defecto | Respira, deriva y parpadea (el motor aprobado). Cada 3,5–7 s mira algo cercano durante 1,4–2,6 s |
| exploración | 1 | Tras 7–13 s de reposo, al señalar algo cercano o cuando el visitante cambia de lugar | Va a saltitos hasta un punto de interés del lugar del visitante, lo inspecciona con un gesto (Focus, Tilt o LookAround) y se queda un rato. Si viene a tu lugar, al llegar se gira y te mira |
| seguimiento | 2 | El puntero sigue moviéndose más de 1,2 s | Mira **lo que señalas en el mundo**, no el cursor en la pantalla. Lo hace como mucho 6,5 s y luego descansa 3,5–7 s |
| curiosidad | 3 | La lámpara se enciende, señalas o enfocas un objeto, el puntero llega cerca o se posa sobre él | Mira el estímulo. Si el estímulo es él, te mira a ti y se gira si estabas de lado |
| interacción | 4 | Clic sobre él, se abre un proyecto o se cierra | Se gira hacia ti y hace ClickReaction (Stretch → Laugh); va a MathView y alterna entre mirarlo y mirarte; te recibe con BlinkDouble al volver |

**Cómo se mueve.**

- **Los ojos van antes que el cuerpo.**
  - Ojos: muelle 260/18/0,5.
  - Cuerpo (`look`): muelle 90/16/1,2, con un retardo de 90 ms. Limitado a ±10° de giro y ±8° de cabeceo.
- **La antena tiene inercia.** El muelle de producción reacciona solo a ese movimiento.
- **El cuerpo se gira con un saltito** si lo que mira queda a más de 35° durante más de 0,6 s.
- **Durante los clips, la mirada pierde fuerza.**
  - Clip: ojos al 35 % y cuerpo al 30 %.
  - Reacción al clic: ojos al 0 % y cuerpo al 10 %.
  - Son las cifras de `06-plan-tecnico.md` §1.4.
- **Prioridades.**
  - Un gesto empieza en el suelo, nunca en el aire.
  - Si el gesto va dirigido a algo que queda a más de 50°, antes se gira hacia ello.
  - Un estado superior no corta un salto a medias.
  - Ni el puntero ni otro objeto interrumpen un proyecto abierto o la reacción al clic.
- **Caminos.**
  - A* sobre el mapa de navegación exportado de Blender, con rejilla de 1 cm y simplificación por línea de visión.
  - Los saltitos son de 6 cm en recorridos cortos y de 8,5 cm, más rápidos, en los largos (unos 13 cm/s).
  - Un test recorre el mapa real y comprueba que ningún camino atraviesa papel.
- **Movimiento reducido.** No hay mirada ni paseos. Si cambia de sitio, aparece en el corte de cámara.

## 7. Qué falta (y qué he aproximado)

| Pieza | Estado | Qué haría falta |
|---|---|---|
| **Ciclo de andar** | **No existe.** Scope se desplaza a saltitos: el clip aprobado `Bounce` más la traslación de la raíz entre `push` y `landing` | Un clip `Hop` o `Walk` hecho en Blender y validado con `validate_scope.py`. Es la pieza más importante para que parezca un habitante |
| **Mirada sobre el cristal curvo** | **Aproximada.** No existe la tabla 9×9 del plan técnico. Ajusto la superficie con las pistas de ojos de los clips aprobados (mínimos cuadrados, cuadrática). Error: **0,002 mm RMS sobre 942 muestras** | Exportar la tabla 9×9 desde Blender y validarla contra los clips |
| **Gancho de la Presence** | El motor no tiene un punto donde enganchar la mirada entre la deriva y la antena. El prototipo envuelve el método privado `applyDrift` **solo en su propia instancia** | Añadir ese gancho a `scope-3d-secondary.ts`. Sería el único cambio del motor de producción |
| **Libros que se abren y capas que suben** | No están animados. `q-context` aparece abierto (como en `a1-wide`) y los demás, cerrados | Exportar los libros con esqueleto o animarlos en el cliente |
| **Gesto «Nudge»** (empujar con la cara) | No existe; que Scope abra una pregunta no está implementado | Un clip nuevo |
| **Tournamently y Sport Coach** | Están en el mundo como objetos y bloquean el paso, pero no se pueden abrir | El mismo patrón que MathView |
| **Iluminación horneada** | No la hay: luz en tiempo real (ventana y lámpara, con sombras) más un entorno suave. Es la mayor diferencia visual con los renders: el contacto suave y el rebote de luz cálida | Hornear lightmaps o AO del pliego en Blender: casi coste cero en tiempo de ejecución |
| **Materiales** | Sin translucidez del papel a contraluz, sin capa de barniz (solo rugosidad), sin profundidad de campo ni grano | Un shader de papel con transmisión falsa; profundidad de campo solo en el nivel alto |
| **Compresión del mundo** | `world.glb` pesa 2,2 MB (1,07 MB con gzip), sin meshopt | `gltf-transform` con meshopt y KTX2. No está instalado y no lo he añadido |
| **Paquete JS** | 699 KB (186 KB con gzip), porque incluye three entero | En producción: el chunk de three que el sitio ya carga, e importaciones por módulo |
| **Contenido sin JavaScript** | La vista de lectura se genera con JS a partir de los módulos de contenido | En producción, el contenido lo renderiza Next en el servidor y el mundo es una mejora encima |

## 8. Pruebas y resultados

**Qué se ha podido comprobar aquí.** Este equipo no tiene GPU. Chrome usa SwiftShader
(renderizado por CPU), así que:

- todo lo funcional está probado;
- **el rendimiento real no está medido** (§8.3).

### 8.1 Automáticas

| Prueba | Resultado |
|---|---|
| `mind.test.ts`: 12 tests | Prioridades; reposo dominante; el clic gana y no se acumula; la reacción cuenta desde que empieza de verdad; seguir con descansos; mirar al visitante; ir a ver lo señalado; acompañar al visitante; proyecto y vuelta; movimiento reducido. **Pasan todos** |
| `nav.test.ts`: 3 tests | Rodear un muro; **todos los lugares de Scope son alcanzables en el mapa real sin cruzar papel**; longitud máxima del salto. **Pasan todos** |
| `tsc --noEmit` del proyecto completo, que incluye el prototipo | Sin errores |
| ESLint sobre `src/` y `tools/` del prototipo | Sin errores ni avisos |

### 8.2 Navegador (`tools/verify.mjs --software`)

Ejecutado aquí sin GPU (SwiftShader, `?force3d&tier=low`). **20 de 20 comprobaciones pasan y no
hay errores de consola.** Recorre los seis momentos del brief, el móvil, el movimiento reducido y
el modo sin WebGL:

| # | Comprobación | Resultado |
|---|---|---|
| 1 | El loader da paso al mundo; la cámara baja hasta el margen | Pasa |
| 2 | La ruta por teclado llega a los cuatro lugares (`aria-current` y la migaja se actualizan) | Pasa |
| 3a | Con el puntero moviéndose, Scope pasa a curiosidad y seguimiento | Pasa |
| 3b | Los ojos y el cuerpo responden (p. ej. ojos −2,9 / 0,9 mm, cuerpo −3,8°) | Pasa |
| 3c | Clic: se gira hacia ti (Bounce) y hace ClickReaction, en estado interacción | Pasa |
| 3d | Al cambiar de lugar, Scope te acompaña | Pasa |
| 4 | MathView: el punto es alcanzable, se abre como diálogo con el contenido real, el foco entra y la URL pasa a `#mathview` | Pasa |
| 5 | Esc cierra; la cámara vuelve a «The light» (la misma estación) y el foco vuelve al punto de MathView | Pasa |
| 6a | Móvil (iPhone 13, táctil): ruta y proyecto utilizables | Pasa |
| 6b–c | Movimiento reducido: la cámara corta sin vuelo y la mirada no se mueve | Pasa |
| 6d | Sin WebGL: proyectos y preguntas como página | Pasa |
| — | Consola sin errores | Pasa |

**Revisión visual** de las capturas (`captures/`):

- La entrada nocturna coincide con el loader.
- El margen y «The light» reproducen el encuadre de los renders aprobados.
- La hoja de MathView, con las curvas encendidas, y la vuelta con Scope junto a la pieza.
- El móvil en vertical.

**Qué no he visto bien en esas capturas:**

- **Llega tarde.** Por la lentitud de SwiftShader, en «Questions» y «The long fold» Scope aún
  iba de camino al capturar.
- **De espaldas o de tres cuartos.** En el margen, mientras lee el cuaderno abierto, se le ve
  de espaldas o de tres cuartos.

**Ajustes durante las pruebas:**

- La reacción al clic se hacía de espaldas: ahora se gira antes.
- El foco no volvía al cerrar MathView.
- La luz del círculo quedaba quemada.
- Varios lugares de Scope quedaban fuera del suelo transitable.
- Un error de tipos del prototipo habría roto `tsc` del sitio.

### 8.3 Rendimiento: lo que sé y lo que no

| Medida | Valor | Fiabilidad |
|---|---|---|
| Transferencia inicial (gzip) | HTML 1,3 KB + JS 186 KB + mundo 1,07 MB + suelo y navegación unos 70 KB + Scope 364 KB ≈ **1,7 MB** | Medida en el servidor local con gzip |
| Carga y parseo del mundo y de Scope (local) | 0,8–0,9 s | Medida aquí. No incluye la red real |
| Por fotograma | 66 000 triángulos del mundo; unas 116 llamadas de dibujo (con las dos pasadas de sombra) | Medida (`renderer.info`) |
| FPS | Entre 0,8 y 3 FPS en SwiftShader a 1440×900 | **No significa nada**: es la CPU dibujando |
| FPS con GPU real | **Sin medir** | Ejecuta `verify.mjs --headed` en tu ordenador; el informe guarda la media y el p95 del tiempo de fotograma |

**Adaptación incluida.**

- Tres niveles de calidad. El nivel alto tiene dos sombras, bloom y DPR 2; el bajo, una sombra, sin bloom y DPR 1.
- Si la media de fotograma pasa de 30 ms, la resolución baja sola.
- Si el renderizado es por software, se muestra la vista de lectura.

## 9. Riesgos técnicos

| Riesgo | Por qué importa | Mitigación |
|---|---|---|
| **Rendimiento sin medir en GPU modestas** | Dos mapas de sombra, bloom con MSAA en HDR y 66 000 triángulos pueden costar en un portátil con gráfica integrada o en un Android medio | Medirlo primero. Después: luz horneada (una sola sombra, la de Scope), meshopt y KTX2, y sin bloom en el nivel medio |
| **El tsconfig del sitio incluye `docs/**/*.ts`** | Next comprueba los tipos de este prototipo al compilar producción. Un error aquí rompería un despliegue (ya pasó una vez en esta fase y lo corregí) | Antes de seguir: excluir `docs/` del `tsconfig` o sacar el prototipo de la raíz del proyecto. No lo he hecho porque es configuración de producción |
| **ESLint también analiza `docs/`** | El paquete lleva `/* eslint-disable */` y las fuentes pasan, pero un commit con lint-staged los analizará | Igual que el anterior |
| **Locomoción a saltitos** | Es lo que más puede parecer «muñeco» | Un clip de paso propio |
| **Gancho privado en el motor** | Envolver `applyDrift` depende de un detalle interno | Un gancho público en `scope-3d-secondary.ts` |
| **Mundo denso** | El mapa deja poco suelo libre: los huecos del kirigami son grandes y las piezas están juntas. Varios lugares se han tenido que recolocar | En la Entrega 2, diseñar el pliego pensando en el suelo transitable, no solo en el encuadre |
| **La entrada depende de dos coincidencias** | El Scope del loader y el 3D tienen que coincidir en tamaño y posición. Calculo la cámara a partir del rectángulo del loader, y lo he comprobado a 1440×900 y 1280×800 | Probar más proporciones de pantalla |
| **Accesibilidad de un mundo** | Los puntos interactivos siguen el orden del DOM, no el espacial. La rueda no desplaza la página | Hay enlace para saltar al contenido, vista de lectura, diálogo accesible y cinta de lugares. Falta una auditoría con lector de pantalla real |

## 10. Recomendación

**Sí: esta dirección puede convertirse en la web definitiva, con condiciones.** El prototipo
demuestra lo que había que demostrar: el pliego es un lugar con su propia lógica. La cámara
recorre la ruta, Scope anda por el mismo suelo, esquiva el mismo papel, mira lo que señalas y
acude a lo que abres. Un proyecto se abre desde su objeto y se vuelve al mismo sitio.

Antes de comprometerse con ella haría, por este orden:

1. **Medir en tu ordenador** con `verify.mjs --headed`, y en un portátil medio y un móvil real. Si con GPU no llega a unos 50 FPS en escritorio y 30 en móvil, recortar primero las sombras en tiempo real.
2. **Un clip de paso para Scope** (y «Nudge»). Es lo que convierte a Scope de figura animada en habitante.
3. **Hornear la luz del pliego en Blender.** Acerca la imagen a los renders y abarata cada fotograma.
4. **Integrarlo en Next como una isla cliente sobre contenido renderizado en el servidor.** La capa HTML ya está separada del canvas, así que el contenido no dependería del 3D.
5. **Resolver la exclusión de `docs/` en `tsconfig` y ESLint** antes de que el prototipo conviva más tiempo con producción.

Me detengo aquí para que lo pruebes. No avanzo hacia producción sin tu aprobación.
