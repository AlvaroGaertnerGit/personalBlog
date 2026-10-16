# Scope World 2.0 · Entrega 4 · Hito 4A: el mundo y Scope, juntos

Estado: **4A corregido tras la auditoría, pendiente de tu validación.** No he empezado 4B (las siete
zonas), 4C (contenido) ni 4D (pulido).

> **Corrección del 16‑10‑2026:** ver **[CORRECCION_4A.md](CORRECCION_4A.md)** (qué se corrigió, archivos,
> evidencias antes/después, pruebas y lo pendiente). Donde este documento y la corrección difieran,
> vale la corrección: marchas aprobadas (trote 13 y prisa 22 cm/s), luz por lugares, la bola a media
> distancia en el margen, saltos largos a su ritmo y pruebas sin GPU.

- Producción, el GLB de Scope, su rig y sus clips, MathView: **intactos**.
- El `tsconfig` y la configuración de ESLint de la raíz: **intactos**.
- 4A está en el commit `4467e0a entrega4`; la corrección, sin commit. Sin despliegues. Puerto 3130 (nunca el 3000).

## 1. Cómo probarlo

```
node docs/redesign/scope-world/entrega-4-mundo/mundo/tools/build.mjs
node docs/redesign/scope-world/entrega-4-mundo/mundo/tools/serve.mjs
```

Abre **http://localhost:3130/**. `Ctrl+C` cierra el servidor.

Los controles son los del laboratorio:

- la rueda, deslizar, ← → o la cinta de lugares (Inicio y Fin van a su casa y a «La luz»);
- clic sobre Scope o sobre sus cosas;
- **L** para leer la nota del lugar y **D** para el panel de depuración;
- «Tiempo ×4», y los parámetros `?hora=noche`, `?lugar=0…5`, `?reduced` y `?sin3d` (la página sin WebGL).

Prueba recomendada, unos 4 minutos:

1. Entra y mira cómo sale de su casa.
2. Avanza lugar a lugar dejando que te enseñe cada cosa: el gabinete, la bola en el margen, la flor entre las preguntas y el radiómetro en el borde del círculo de la lámpara.
3. Vuelve atrás.
4. Ponlo de noche, vuelve a su casa y quédate quieto (con «Tiempo ×4», unos 15 s) hasta que entre a descansar. Luego muévete.

## 2. Qué es 4A

Un único mundo navegable: **el mundo de papel de la Entrega 2 con el Scope de la Entrega 3**, sus
lugares y sus juguetes.

```
0 La linterna ─ 1 El gabinete ─ 2 El margen ─ 3 Las preguntas ─ 4 El pliegue largo ─ 5 La luz
 su casa         lo que guarda    donde vive,     la flor de luz                       el círculo de la lámpara
                                  su bola                                              y su radiómetro
```

| Lugar | Cámara | Qué ofrece a Scope | Zona (Fase A) |
|---|---|---|---|
| La linterna | La del laboratorio | Su casa: te la enseña y, si te quedas quieto, entra a descansar | 1 · El despertar |
| El gabinete | La del laboratorio | Mira lo que ha encontrado; si la bola ha rodado hasta allí, la pone en su rincón | 1 |
| El margen | La aprobada de la 1.0 (`home`) | Su bola: te la acerca empujándola con la cara | 1 |
| Las preguntas | La de la 1.0 | La flor de luz: la carga con su luz y se abre | 3 · El territorio de las ideas |
| El pliegue largo | La de la 1.0 | Nada propio: investiga lo que haya cerca | 3 |
| La luz | La de la 1.0 (`c1-place`) | El radiómetro, que gira despacio con la lámpara y deprisa con su luz | 4 · El distrito de proyectos |

**Al llegar, Scope está en casa**, sentado en su linterna, y sale por la puerta a recibirte, como
preveía la Fase A (§8.4). Todo el comportamiento de la Entrega 3 está presente y sin simplificar,
porque **es el mismo código**:

- prioridades, compañía, guía, espera, reconocimiento de lo visitado y memoria;
- reacciones al clic según el contexto, curiosidad, refugio, empujar con la cara y la luz;
- movimiento reducido.

## 3. Integración técnica

### Un solo Scope y un solo entorno (`scope-world/core/`)

```
core/
  world-def.ts         qué es un mundo: lugares, ruta, distancias, ritmos (datos)
  env/stage.ts         EL entorno: mundo 1.0 + relieve 2.0, cielo, niebla, cuatro ambientes de luz
  scope/mind/          la mente (pura): prioridades, compañía, atención, memoria
  scope/body/          el cuerpo: locomotor, capa de paso, acciones, actor, presence-hook
  scope/props.ts       la bola, la flor, el radiómetro (física y luz)
  scope/ground.ts      lo que necesita saber del suelo; baked-ground.ts, el suelo horneado
  app/                 la página: visitante, bucle, entrada, panel de depuración
  tools/               build, serve y check comunes
```

| Quién | Antes | Ahora |
|---|---|---|
| Visor de la Entrega 2 | Su propio cielo, papel, ambientes y fusión del relieve | `core/env/stage.ts`. Solo conserva su cámara orbital, sus cinco planos y su HUD |
| Laboratorio de la Entrega 3 | Todo el código de Scope y del entorno | `core/` + su definición (`lab-world.ts`), su suelo compuesto (`lab-ground.ts`) y su banco de pasos |
| Mundo 4A | — | `core/` + su definición (`mundo/src/world-4a.ts`) y su suelo horneado |

El laboratorio y el mundo son **la misma aplicación con dos definiciones de mundo**. Lo
comprueban las pruebas del laboratorio, que siguen pasando igual que antes de unificar:

- 20 de 20 en el navegador;
- los 21 tests de la mente y del locomotor, que ahora usan el laboratorio como caso de prueba del núcleo.

### El mapa de navegación del mundo real (`tools/bake-ground.mjs`)

Se hornea a partir de **la misma geometría que dibuja el navegador**: `world.glb` (1.0) y
`entorno.glb` (2.0). Así, el suelo que pisa Scope es exactamente el papel que ves. Las reglas son
las del exportador 1.0, ampliadas al papel que rodea el pliego:

| Regla | Valor |
|---|---|
| Rejilla | 1 cm, x −1,6…1,8 m, y −1,25…1,25 m (341 × 251) |
| Suelo | La superficie más baja hacia arriba, subiendo capas apiladas a menos de 1,2 cm: papel del mundo, pliego de 1,2 mm, su plato (6,7 mm) y las huellas |
| Obstáculo | Lo que esté entre 1,2 y 16 cm sobre el suelo; un escalón a la casilla vecina de más de 8 mm; una pendiente de más de unos 22°; el lago de tinta |
| Ensanchado | 6 cm (el radio de Scope) para él y 3 cm para la bola |
| Resultado | 6,4 m² transitables, en 0,6 s y sin Blender. Sale en `assets/` (`ground.json`, `floor.bin`, `nav.bin`, `solid.bin`) |

Para regenerarlo: `node docs/redesign/scope-world/entrega-4-mundo/tools/bake-ground.mjs --map`. La
opción `--map` imprime además un mapa ASCII para revisarlo a ojo.

### Escala, radiómetro y superficies

- **Escala.** Los lugares están a unos 0,4 m (los del laboratorio, a 0,27 m):
  - **Bandas:** cómoda 0,30 m y tensa 0,65 m.
  - **Marchas:** las aprobadas, trote 13 cm/s y prisa 22 cm/s. (4A las había subido a 14 y 30 y resbalaban; corregido.)
  - **Cámara:** su muelle se suaviza en los tramos largos, así que se avanza a un paso de visita parecido.
  - **Refugio:** a los 60 s quieto en su casa (90 s en la Fase A, 30 s en el laboratorio).
- **El radiómetro**, en el borde del círculo de la lámpara, en **(0,27, −0,13)**, como en la Fase A. Lo elegí buscando en el suelo horneado un punto que cumpliera tres cosas:
  - Scope puede ponerse a 13 cm de él por varios lados;
  - no corta el paso hacia el círculo (en (0,21, −0,05) lo cerraba: lo encontraron las pruebas);
  - «La luz» lo ve dentro del encuadre (en (0,50, −0,18) quedaba en el borde inferior).

  Además:
  - le llega la luz de la lámpara: gira despacio (0,37 rad/s) y de noche se para;
  - lleva sus tres esquirlas de porcelana como espejos;
  - el radiómetro de la 2.0 (inalcanzable) se retira del mundo; el visor de la Entrega 2 conserva el suyo, tal y como se aprobó.
- **Superficies.** Al pasar del papel del mundo (−1,3 mm) al pliego (0) y al plato (6,7 mm), la altura cambia como mucho 1,67 mm por paso de 1/30 s. La carcasa nunca atraviesa el plano donde se apoya (mínimo +0,01 mm).

### La presencia: una interfaz experimental limpia (`core/scope/body/presence-hook.ts`)

Es **el único punto** que toca el interior del motor de producción:

- engancha la mirada justo después de la deriva y antes del muelle de la antena, en una sola instancia;
- comprueba en tiempo de ejecución que el motor sigue teniendo ese paso, y si no, da un error claro;
- se puede deshacer;
- tiene sus propios tests.

El cambio que propongo para producción, **no hecho**, es una línea: un `afterDrift(dt)` opcional en `Scope3DSecondary`.

### Comprobaciones aisladas (`scope-world/tsconfig.json`, `core/tools/check.mjs`)

No he excluido `docs/` de nada. Scope World tiene **su propia configuración de TypeScript**:

- estricta;
- con `noUnusedLocals`;
- que revisa también los módulos de producción que importa, en solo lectura.

Y **una orden que lo comprueba todo**, sin tocar la configuración de producción:

```
node docs/redesign/scope-world/core/tools/check.mjs
```

Ejecuta, por este orden:

1. TypeScript aislado.
2. ESLint con las reglas del repositorio, solo sobre el código de Scope World y sin los paquetes generados.
3. Todos los `node --test`.

El `tsc` de la raíz sigue pasando.

## 4. Pruebas realizadas

| Prueba | Resultado |
|---|---|
| `core/tools/check.mjs` | TypeScript, ESLint y **43 de 43 tests**: mente, locomotor, suelo horneado, enganche de la presencia y los tests de la 1.0 |
| `tsc` de la raíz del proyecto | Sin errores |
| `mundo/tools/verify.mjs` (mundo 4A, Chrome) | Cifras de la entrega original, **no reproducibles sin GPU** (se colgaba). Tras la corrección: **40 de 40** sin GPU (CORRECCION_4A.md) |
| `lab/tools/verify.mjs` (laboratorio, tras unificar) | Cifra de la entrega original, no reproducible sin GPU. La equivalencia del laboratorio la comprueba ahora `tools/check-approved.mjs` |

Lo que comprueba el mundo:

- Al llegar, Scope sale de su casa (a los 0,03 s).
- En cada tramo se pone en marcha contigo en menos de 0,8 s.
- Se adelanta a enseñarte los cuatro lugares nuevos que tienen algo que enseñar.
- Enseña lo que ofrece cada uno: el gabinete, la bola (empujada), la flor (se abre) y el radiómetro.
- No hay teletransportes: nunca va más rápido que su prisa.
- La altura es continua sobre las tres superficies.
- Tras saltar de su casa a «La luz»: 8,7 s lejos o fuera de cuadro (por encima del criterio aprobado de 6 s; corregido: 0,5–1,7 s).
- El radiómetro responde a la lámpara y a su luz, de día y de noche.
- El refugio: se mete a los 71 s (60 s sin hacer nada y el tiempo que tarda en llegar y acomodarse) y sale en 0,02 s.
- Los clics no van a más y, mientras lees, no se mueve.
- El paso queda dentro del rango aprobado y la carcasa nunca atraviesa el suelo.
- Movimiento reducido, móvil (iPhone 13, táctil) y teclado.
- Sin WebGL, los seis lugares aparecen como HTML.
- El visor de la Entrega 2 sigue funcionando con el módulo compartido.

**Revisión visual**, con capturas:

- la llegada a la linterna;
- «La luz» con el radiómetro y su espejo de porcelana;
- la flor abierta, de noche, en las preguntas;
- el móvil en vertical.

**Rendimiento medido, con GPU (GTX 1660 Ti, 1440 × 900, mundo completo de 4A)** — cifras de la entrega original; no las he podido reproducir (el equipo de la corrección no tiene GPU):

| Lugar | FPS | p95 | Llamadas | Triángulos |
|---|---|---|---|---|
| La linterna | 179 | 6,1 ms | 34 | 180 k |
| El gabinete | 180 | 6,0 ms | 53 | 182 k |
| El margen | 180 | 5,8 ms | 100 | 204 k |
| Las preguntas | 180 | 6,1 ms | 164 | 212 k |
| El pliegue largo | 176 | 7,0 ms | 158 | 210 k |
| La luz | 178 | 6,2 ms | 133 | 208 k |

Carga: 0,3 s en local (mundo 2,2 MB, entorno 1,1 MB, suelo horneado 0,5 MB sin comprimir).

**No vale como garantía**: 180 FPS parece el tope de refresco de esta ventana, así que la cifra
útil es el p95 de unos 6 ms. Además, es una gráfica de escritorio y 4A aún no contiene las siete
zonas.

## 5. Frente a los laboratorios

| | Visor (Entrega 2) | Laboratorio (Entrega 3) | Mundo 4A |
|---|---|---|---|
| Entorno | El aprobado | El mismo, copiado a mano | El mismo, **desde un solo módulo** que ahora usan los tres |
| Scope | El 1.0 (saltitos) | El vivo | **El mismo vivo**, sin simplificar |
| Recorrido | Cinco planos sueltos | 1 m delante del pliego | **Seis lugares en S** desde su casa hasta la lámpara, con las cámaras aprobadas de la 1.0 |
| Suelo | El de la 1.0 (solo el pliego) | El de la 1.0, compuesto a mano | **Horneado de la geometría real**, pliego y papel alrededor |
| Radiómetro | En (0,10, 0,30), sin suelo cerca | Una copia en la franja delantera | **En el borde del círculo de la lámpara**, alcanzable y en la luz de la lámpara |
| Juguetes | — | En la franja delantera | **Donde vive**: la bola en el margen, la flor entre las preguntas |
| Llegada | — | Scope en la puerta | **Scope en casa**: sale a recibirte |
| Rendimiento | — | 172–180 FPS · 83 llamadas | 176–180 FPS · 34–164 llamadas |

## 6. Limitaciones conocidas

- **Aún no hay zonas, contenido ni proyectos.** Es 4A: el mundo y Scope.
  - La galería, el cuaderno, el aula y el contacto son de 4B y 4C.
  - Las preguntas y MathView se ven, pero no se abren.
  - No he tocado MathView.
- **El pliegue largo no tiene nada propio**: Scope solo investiga lo que haya cerca. Encaja con la zona 3 de 4B.
- **Saltos largos.** Tras la corrección, la vista viaja a su ritmo: cruzar el mundo entero dura ~10,5 s y él no se pierde más de ~4 s. Los atajos por los huecos del kirigami (Fase A §4.4) son para 4B.
- **La flor y la bola son del laboratorio**, ahora en el mundo: no forman parte del Blender aprobado.
- **El suelo horneado no conoce la escalera del mirador** (sus escalones superan 8 mm): es inalcanzable, y le tocará en 4B (zona 2). Tampoco hay ajuste del pie al suelo (IK): en el borde del pliego, una pata puede quedar 1 mm dentro.
- **No lo he probado en un móvil real** (solo emulado) ni en GPU modestas.
- **Rendimiento:** todavía no hay carga por zonas, luz horneada ni niveles de calidad propios del mundo. Es 4D. Con 4B el mundo crecerá y habrá que medirlo de nuevo.
- **Sin WebGL**, la página muestra los lugares y sus notas. La vista de lectura completa, con el contenido real, es de 4C y 4D.
- **El radiómetro del laboratorio** ahora también lleva espejos, porque comparte el objeto con el mundo.

## 7. Siguiente paso

Prueba 4A y dime si reconoces las dos cosas que aprobaste: el mundo de papel y el Scope vivo. **No
avanzo a 4B hasta que lo apruebes.**

Para 4B propondría, en este orden:

1. Hornear el suelo de las nuevas zonas con la misma herramienta.
2. Añadir sus lugares como `offer` sin tocar la mente.
3. Los atajos por los huecos para los saltos largos.
4. La carga por zonas.
