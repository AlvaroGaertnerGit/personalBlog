# Scope World 2.0 · Entrega 4A · Corrección tras la auditoría

Fecha: 16 de octubre de 2026. Punto de partida: `master` en `4467e0a entrega4` y la auditoría
(`../AUDITORIA_ENTREGA_4A.md`). **Sin commits, sin push, sin despliegue.** No he empezado 4B.

> **Condiciones de prueba.** Este equipo **no tiene GPU** (adaptador básico de Microsoft). Todas las
> pruebas en navegador son con Chrome + SwiftShader (render por CPU, escala 0,5, **sin sombras**).
> Nada de este documento está validado con GPU ni en un móvil real: el móvil es un iPhone 13
> emulado. Donde digo «visto» me refiero a capturas reales de SwiftShader; donde digo «medido», a
> pruebas automáticas. **La validación visual definitiva es tuya, con GPU.**

---

## 0. Cómo probarlo

```
node docs/redesign/scope-world/entrega-4-mundo/mundo/tools/serve.mjs
```

Abre **http://localhost:3130/** (`Ctrl+C` para cerrar). El paquete `mundo/dist/mundo.js` ya está
reconstruido; solo hace falta `mundo/tools/build.mjs` si cambias las fuentes.

Prueba recomendada, unos 5 minutos:

1. Entra: es de noche en su linterna y sale a recibirte.
2. Avanza lugar a lugar con → y mira cómo amanece al salir y cómo se hace de día hacia la lámpara.
3. En **El margen**, quédate quieto: te acerca la bola empujándola con la cara, de frente, a media distancia.
4. Pulsa **Fin** (salto a «La luz») y luego **Inicio**: la vista viaja a su ritmo y él corre a tu lado.
5. Toca la flor en «Las preguntas».
6. Prueba el móvil (o la ventana estrecha) en «El margen».

Comprobaciones automáticas (ninguna necesita GPU; todas cierran sus servidores al terminar):

```
node docs/redesign/scope-world/core/tools/check.mjs                         # TypeScript, ESLint, 55 tests
node docs/redesign/scope-world/entrega-4-mundo/mundo/tools/verify.mjs --software    # 40 pruebas en Chrome, ~3 min
node docs/redesign/scope-world/entrega-4-mundo/tools/check-approved.mjs --software  # E2 y E3 siguen siendo las aprobadas, ~3 min
```

Con GPU, quita `--software` (el informe dice siempre con qué renderizador se ejecutó).

---

## 1. Antes de modificar: qué había y qué debía quedar intacto

- **Commit `4467e0a entrega4`** (15‑10‑2026, 21:49, identidad git del propietario): 58 ficheros, todos
  en `docs/redesign/scope-world/`. Crea `core/` y `entrega-4-mundo/`, añade a git el laboratorio de la
  Entrega 3 ya unificado sobre `core/` y refactoriza el visor de la Entrega 2 sobre `core/env/stage.ts`.
  No toca producción, el GLB, el rig, los clips ni MathView.
- **Referencia recuperable del estado de 4A antes de corregir:** el propio commit `4467e0a` (HEAD). No
  he hecho commits: todos los cambios están en el árbol de trabajo, así que `git diff` muestra
  exactamente la corrección y `git stash` / `git checkout -- <ruta>` devuelven el 4A auditado. No he
  tocado el historial.
- **Debían quedar intactos:** `entrega-2-entorno/**`, `entrega-3-comportamiento/**`, `public/scope/**`,
  `assets/scope-3d/**`, `src/**` (producción) y MathView. Comprobado al final (§5.4).

### Estado recuperable de los laboratorios (punto 6 del encargo)

| Entrega | Versión aprobada recuperable | Qué cambió `4467e0a` | Qué he hecho |
|---|---|---|---|
| E2 · visor | `71c7151:…/entrega-2-entorno/visor/` (código y `dist/visor.js` originales) | `src/main.ts` (−282 líneas: su escenario pasó a `core/env/stage.ts`), `dist/visor.js` reconstruido, `tools/build.mjs` y `serve.mjs`, una línea del README | Nada. No he reconstruido su paquete |
| E3 · laboratorio | **Solo la forma de `4467e0a`.** El código anterior a la unificación nunca estuvo en git (tampoco en objetos inalcanzables) | Llega a git ya unificado | Nada. No he reconstruido su paquete |

No he reconstruido ninguna «versión anterior» supuesta. Para el laboratorio, la única comparación
honesta es con lo que hay en git (§5.4).

### La arquitectura que conserva las versiones aprobadas

El núcleo `core/` sigue siendo compartido, pero **todo lo nuevo es opcional y solo lo activa 4A**:

- `WorldDef.refine` es un objeto de mejoras, cada una documentada en `core/world-def.ts`.
- `Station.mood` es la luz de cada lugar.

Un mundo que no las declara (el laboratorio) ejecuta exactamente el código de antes. Los paquetes
aprobados (`lab.js`, `visor.js`) siguen siendo los de git, byte a byte. Y como alguien podría
reconstruirlos desde las fuentes, `tools/check-approved.mjs` compara los aprobados con los
reconstruidos (§5.4).

---

## 2. Problemas corregidos

### H1 · Invasión de cámara en «El margen» — corregido

**Causa** (confirmada midiendo): la bola empezaba **más cerca de la cámara que su destino**
(«hacia ti» = el ancla más un 25 % hacia el ojo). Para empujarla, Scope se ponía *entre la bola y el
objetivo*. Además:

- la cámara del margen está a 10 cm del papel;
- la del móvil, a 24 cm del punto del visitante;
- el camino desde el gabinete pasa justo por debajo del objetivo.

**Corrección** (composición, posición y comportamiento; Scope nunca se oculta):

1. **La bola vive a media distancia** del margen, en (−0,66, −0,20): a unos 52 cm de la cámara de
   escritorio y 50 cm de la del móvil, en el centro del encuadre aprobado, con suelo libre detrás. La
   empuja **hacia ti**: de frente a la cámara, que es lo más expresivo.
2. **Distancia de seguridad a la cámara**, 34 cm (`refine.cameraClearance`):
   - ningún destino suyo queda más cerca: se lleva al borde;
   - sus caminos rodean el primer plano de la cámara del lugar al que vas, y de la actual cuando está quieta;
   - si ya está dentro, se evita la parte más cercana que él, así que sale alejándose, nunca por debajo;
   - un empujón que exigiría ponerse en el primer plano no se hace;
   - la bola se acerca «hacia ti» solo hasta 37 cm;
   - «demasiado cerca» (`bands.tooClose`) pasa a ser esa misma distancia.
3. **Cámara de móvil del margen:** la misma regla que los otros cinco lugares (`portraitOf`: un poco
   más atrás y más alta). La de la Entrega 1 (`home-m`) estaba a 24 cm del visitante y no dejaba sitio
   delante. **La de escritorio, la aprobada, no cambia.**
4. Si llegas al margen antes que él, **termina su carrera** en vez de pasar a andar despacio
   (`refine.finishRun`). Si está junto a la cámara y fuera de cuadro, vuelve al trote en lugar de
   «apartarse un paso» al paso.

| Medida (60 s por caso, 3 semillas, `correccion-4a/datos/camara.json`) | Antes (auditoría) | Después |
|---|---|---|
| Cabeza–objetivo, mínimo **mientras se le ve**, en los 6 lugares × escritorio y móvil × quieto y llegando | 5,8 cm (móvil, margen) · 24,9 cm (escritorio, margen) | **34,2 cm** (escritorio, «Las preguntas», llegando). Margen: 43 cm escritorio · 59 cm móvil |
| La bola, lo más cerca de la cámara | ~22 cm, en primer plano | 43 cm escritorio · 60 cm móvil |
| Empujones en el margen | 1 | 2 (escritorio) · 3 (móvil) |

Capturas: `correccion-4a/capturas/despues-margen-bola-*` y `despues-*-lugar-2.jpg`, frente a las de la
auditoría `auditoria-4a/capturas/movil-lugar-2.jpg` y `clic-real-scope-lugar-2-sin-panel.jpg`.

**Residual, documentado (§4):** al llegar al margen *desde el gabinete*, la espera del gabinete está a
13 cm de donde se coloca la cámara del margen. Scope rodea el objetivo **por detrás** (llega a 24–27 cm
de él, **sin estar en cuadro**) y aparece a los 2,8 s (escritorio) o 4,0 s (móvil). Está por debajo del
criterio aprobado de «perdido» (6 s), pero en el móvil supera los 3 s con los que la mente considera
que está fuera de cuadro.

### H2 · Iluminación por zonas — recuperada

Cada lugar lleva la luz que le dio la Entrega 2 (su README: «amanecer en el margen, día claro en el
círculo, noche con la linterna»; renders `e2-linterna`, `e2-home`, `e2-dia`):

| Lugar | Luz | Fuente |
|---|---|---|
| La linterna | Noche (su casa se ilumina por dentro) | `e2-linterna`, plano «La linterna» del visor |
| El gabinete | Amanecer (al salir de casa) | Zona 1, «El despertar» |
| El margen | Amanecer | `e2-home`, plano «El margen» del visor |
| Las preguntas · El pliegue largo · La luz | Día | `e2-dia` (el círculo de la lámpara) |

- **Transiciones:** la luz sigue a la vista por la ruta, mezclando los ambientes de dos lugares en la
  mitad central de cada tramo, y además se suaviza en el tiempo (τ 0,8 s). Así, con movimiento
  reducido (la cámara corta), la luz también funde. El mayor cambio medido es de 0,043 en 0,1 s (de
  noche a amanecer).
- **Atardecer:** la Entrega 2 lo asignó al lado del aula, que es de 4B. Sigue disponible en el botón
  de luz y en `?hora=atardecer`.
- **El botón «Luz»** recorre «la del lugar», Amanecer, Día, Atardecer y Noche. Antes alternaba
  atardecer y noche.
- **Coste:** ninguna luz nueva. Se cambian los mismos parámetros que ya cambiaba `setMood`, sin
  recompilar *shaders*.
- **Interacciones con la luz de Scope**, comprobadas:
  - el radiómetro gira despacio con la lámpara de día (0,37 rad/s) y deprisa con su luz (23 rad/s);
  - de noche se para cuando él se va;
  - la flor se abre;
  - el refugio de noche, en su casa, a los 71 s.
- **Código:** `core/env/moods.ts` (nuevo, puro: los cuatro ambientes, `mixMoods` y `routeLight`),
  `stage.applyMood`, el bucle de `core/app/app.ts` y `Station.mood` en `world-4a.ts`.

Capturas: `despues-escritorio-lugar-0…5`, `despues-transicion-linterna-margen-1s…3s` y
`despues-luz-boton-*`. Compáralas con `auditoria-4a/capturas/visor-margen-amanecer.jpg` (visor de la
Entrega 2 con la misma cámara) y con `entrega-2-entorno/renders/e2-*.jpg`.

### M1 · Recuperación en saltos largos — ≤ 6 s, sin acelerar a Scope

Causas medidas (antes de tocar nada, con las marchas aprobadas restauradas, el salto casa → «La luz»
daba **10,3 s**):

1. Al pulsar «Fin», la mente lo mandaba a **guiar hacia el gabinete** (el lugar siguiente, en
   dirección contraria) y se quedaba allí esperando 4 s.
2. Junto a la puerta de la linterna, cada vez que replanificaba se creía dentro y **daba vueltas en el
   umbral** (~4 s).
3. Al cambiar de rumbo casi parado, giraba 180° en un arco lento en lugar de girar sobre sí mismo.
4. La vista cruzaba 1,9 m de ruta en ~3,8 s: a la prisa aprobada (0,22 m/s) es **físicamente
   imposible** seguirla.

Correcciones (rutas, transiciones y selección de marcha; **las marchas y el ciclo de pasos son los
aprobados**):

| | Opción (`refine`) | Qué hace |
|---|---|---|
| 1 | `followTarget` | Sabe adónde vas. Un salto de más de un lugar es una carrera hacia allí (un lugar por delante de la vista), no «guiar al siguiente». Si la rueda te lleva más allá del lugar al que guiaba, deja de esperarte allí |
| 2 | `doorFromInside` | Sale por la puerta solo si está dentro de la linterna |
| 3 | `restartBelow` | Un camino nuevo casi parado (< 3 cm/s) empieza como desde parado: giro sobre sí mismo, el comportamiento aprobado del locomotor al arrancar |
| 4 | `visitorMaxSpeed` | **Solo en saltos de más de un lugar**, la vista viaja por la ruta al 90 % de su prisa (0,198 m/s). El último lugar y los pasos de un lugar al siguiente siguen con el muelle aprobado, idéntico (test) |

Con la vista a la prisa exacta (100 %) arrancaba un poco tarde y no la alcanzaba nunca: en el móvil,
estrecho, iba 8 s fuera de cuadro. Con un 26 % más rápida, 7,6 s.

| Salto (escritorio y móvil, 3 semillas, `datos/saltos.json`) | Antes | Después |
|---|---|---|
| Casa → La luz | 8,8 s perdido | **0,5 s** escritorio · **1,7 s** móvil |
| La luz → casa | 7,0 s | **2,2–3,2 s** · **1,5–2,6 s** |
| Gabinete → La luz (nuevo) | — | **1,3–3,9 s** · **2,1–4,1 s** |
| Casa → Las preguntas | — | 0 s |
| Ráfaga de rueda (nuevo) | ≤ 2,3 s | 0 s |

«Perdido» es el criterio aprobado: lejos (> 0,65 m, la banda «perdido» de 4A) **o** fuera de cuadro.
Umbral: 6 s, el de la Entrega 3; la prueba de 4A lo había relajado a 9 s y ya no. **Coste, para tu
decisión:** cruzar el mundo entero con «Fin» o «Inicio» tarda ahora **10,4–10,9 s** (antes 3,8 s). Es
un viaje con él; si lo prefieres más rápido, el único parámetro es `visitorMaxSpeed` en `world-4a.ts`,
y las pruebas dirán cuánto se pierde.

### M2 · Deslizamiento de las patas — recuperado

Las marchas vuelven a las aprobadas: trote 0,13 m/s y prisa 0,22 m/s. 4A las había subido a 0,14 y
0,30, por encima del límite sin deslizar del paso. Mismo método que la auditoría: velocidad de la pata
apoyada, mediana (`datos/patas.json`):

| | Laboratorio aprobado | 4A antes | 4A después |
|---|---|---|---|
| Paso | 0,15 cm/s | 0,13 | 0,18–0,19 |
| Trote | 1,58 | **3,93** | **1,25–2,27** |
| Prisa | 10,08 | **13,15** | **10,34–10,48** |

Anticipación, peso, frenada y giros son los del locomotor y la capa de paso aprobados, sin cambios. El
rango del paso sigue dentro del Bounce aprobado (squash 0,958–1,011; vuelo 7,0 mm).

### M3 · Pruebas reproducibles sin GPU — corregido

- **Causa del cuelgue:** cada `advance()` dibujaba un fotograma, y el bucle en tiempo real seguía
  avanzando la simulación entre llamadas, así que el resultado tampoco era determinista.
- **Ganchos nuevos de prueba** (`window.__lab`):
  - `advance(dt, { render: false })`;
  - `pause()`: detiene el bucle en tiempo real;
  - `render()`;
  - `screenOf(objeto)`: el punto de pantalla donde hacer un clic real.
- **Fallo de medición encontrado y corregido:** sin dibujar, la cámara no actualizaba sus matrices y
  «visible» se calculaba con la vista del último fotograma. En pausa, cada paso las actualiza; en
  tiempo real no cambia nada.
- **`mundo/tools/verify.mjs`, reescrito:**
  - tiempo máximo por prueba, con error claro («tiempo agotado») y sin bloquear el resto;
  - vigilante global de 20 min;
  - cierre de Chrome y de los servidores en cualquier salida, también con `Ctrl+C`;
  - `Math.random` con semilla;
  - **umbrales aprobados fijos**, declarados al principio del fichero;
  - informa de si había GPU.
- **Resultado:** 40/40 en **2 min 40 s sin GPU**. Antes se colgaba tras 7 de 22.
- **El `verify.mjs` del laboratorio aprobado no lo he tocado** (es de la Entrega 3) y sigue colgándose
  sin GPU. Su comportamiento lo comprueba `check-approved.mjs`.

### M4 · Tests de 4A — añadidos

`mundo/src/world-4a.test.ts`: 12 tests sin WebGL. Usan la mente real, el suelo horneado real y las
cámaras reales (matemática de three.js, sin dibujar):

- marchas sin acelerar;
- esperas fuera del primer plano;
- la bola y su camino;
- luz por lugares y transición gradual;
- el muelle aprobado de un paso;
- el giro desde parado;
- 6 saltos con el criterio de 6 s.

**Control negativo:** con la bola mal colocada falla 1 test («a 0,33 m de una cámara»), y sin el
límite de la vista fallan 7 (perdido 6,1–6,5 s). Los tests distinguen; no pasan por umbrales relajados.

### Menores (B1–B10, M5, M6)

| | Problema | Decisión |
|---|---|---|
| B1 | La flor no se podía tocar | **Corregido** (`refine.flowerPick`): una columna invisible alrededor, como la linterna y el gabinete. Clic real comprobado |
| B2 | El radiómetro 2.0 retirado seguía horneado como obstáculo invisible | **Corregido**: `bake-ground.mjs` lo excluye, igual que el escenario. Suelo rehorneado: solo cambian 268 casillas alrededor de (0,10, 0,30), todas a libres |
| B3 | Luz de la linterna fija en `stage.ts` | **Para 4D.** Coincide con la linterna de los dos mundos; tocarlo cambia el escenario compartido sin beneficio hoy |
| B4 | `visor.js` no reconstruido | **No se reconstruye a propósito:** es el paquete aprobado de la Entrega 2 y se conserva tal cual |
| B5 | `index.html` y `verify.mjs` duplicados entre laboratorio y mundo | **Para 4D.** Unificarlos obliga a tocar el laboratorio aprobado |
| B6 | Bola facetada | **Para 4D (estética).** Ya no está en primer plano (≥ 43 cm) |
| B7 | El README de E3 cita un `config.ts` inexistente | **No tocado:** es documentación de una entrega aprobada |
| B8 | El README de 4A decía «sin commits» | **Corregido** |
| B9 | Simulación no determinista | **Corregido para las pruebas** (semilla y bucle en pausa). En uso real, la aleatoriedad de gestos es intencionada |
| B10 | Sin aviso de «sin GPU» | **Corregido:** el texto del prototipo 1.0, en la tarjeta de presentación, solo sin tarjeta gráfica |
| M5 | Se modificaron los artefactos aprobados | Ver §1: sus paquetes se conservan y se verifica la equivalencia |
| M6 | Sin acceso por teclado a Scope ni a sus juguetes | **Para 4D (pase de accesibilidad).** El laboratorio aprobado tampoco lo tenía; añadir esa capa es funcionalidad nueva. Se navega por teclado (← → Inicio Fin Intro, L, D) |

---

## 3. Archivos modificados

Todos en `docs/redesign/scope-world/`. Nada fuera.

**Núcleo compartido** (cambios opcionales; sin `refine` ni `mood` el comportamiento es idéntico):

| Fichero | Cambio |
|---|---|
| `core/world-def.ts` | `Station.mood`, `Refinements` y `WorldDef.refine` |
| `core/env/moods.ts` (**nuevo**) | Ambientes, `mixMoods` y `routeLight` (movidos de `stage.ts` y ampliados) |
| `core/env/stage.ts` | `applyMood` (`setMood` la usa con los mismos valores); reexporta `MOODS` |
| `core/app/app.ts` | Luz por lugar; cámaras a respetar; columna de la flor; clase `software`; ganchos de prueba (`advance` sin dibujar, `pause`, `render`, `screenOf`); vista actualizada en pausa |
| `core/app/visitor.ts` | Velocidad máxima de la vista en saltos de más de un lugar |
| `core/scope/mind/{mind,companion,types}.ts` | Salto con destino; dejar de guiar si sigues de largo; terminar la carrera; volver al trote si está junto a la cámara; bola hasta la distancia de seguridad |
| `core/scope/body/acts.ts` | Destinos y caminos fuera del primer plano; empujón omitido; puerta solo desde dentro |
| `core/scope/body/locomotor.ts` | `restartBelow` (0 = como antes) |
| `core/scope/body/actor.ts`, `core/scope/ground.ts`, `core/scope/baked-ground.ts` | Zonas a evitar en los caminos (parámetro opcional) |
| `core/scope/baked-ground.test.ts` | La bola exige suelo de bola, no de Scope: está junto a las notas, y dónde se pone él para empujarla lo comprueba `world-4a.test.ts` |

**4A:**

- `mundo/src/world-4a.ts`: marchas aprobadas, `refine`, luces, bola, espera de «Las preguntas» 3,5 cm
  más atrás (estaba a 32 cm de su cámara) y cámara de móvil del margen.
- `mundo/index.html`: aviso sin GPU.
- `mundo/tools/verify.mjs`: reescrito.
- `mundo/src/world-4a.test.ts` (nuevo).
- `tools/bake-ground.mjs`.
- `tools/check-approved.mjs` (nuevo).
- `assets/{ground.json,floor.bin,nav.bin,solid.bin}`: rehorneados.
- `mundo/dist/mundo.js(.map)`: reconstruidos.
- `README.md`.
- Este documento y `correccion-4a/` (29 capturas y 6 ficheros de datos).

**Intactos** (comprobado contra el índice de git del inicio):

- `entrega-2-entorno/**` y `entrega-3-comportamiento/**`;
- `public/scope/**` y `assets/scope-3d/**`;
- `src/**` (producción);
- MathView: ningún fichero suyo modificado hoy.

---

## 4. Regresiones pendientes y limitaciones conocidas

1. **Entrar al margen desde el gabinete:** pasa por detrás de la cámara y tarda 2,8 s (escritorio) o
   4,0 s (móvil) en entrar en cuadro (§2, H1). La causa es geométrica: la cámara aprobada del margen
   está sobre su camino. Mejorarlo más exigiría mover la cámara aprobada o la espera del gabinete;
   no lo he hecho sin tu decisión.
2. **Los saltos largos duran más** (10,4–10,9 s de punta a punta). Es la contrapartida de no acelerar
   a Scope (§2, M1).
3. **Arranque en el tramo gabinete → margen:** empieza a girar a los 0,03 s, pero no anda hasta los
   0,53–0,83 s según la semilla, porque estaba mirando el gabinete y gira 180° sobre sí mismo (el
   comportamiento aprobado del locomotor). La prueba de navegador mide ahora «responde (gira o anda)
   en < 0,8 s» e informa también del momento en que empieza a andar. Con la métrica antigua (solo
   andar), ese tramo da 0,83 s frente a un umbral de 0,8.
4. **Sin GPU todo:** ni el aspecto con sombras ni el rendimiento con GPU están comprobados. Sin GPU:
   8,6–9,2 FPS por lugar (antes 6,7–9,7): no representativo.
5. **El borde del pliego** en tiempo real y sin sombras se sigue leyendo como losa. Es heredado: el
   visor aprobado se ve igual.
6. Para 4D: B3, B5, B6 y M6 (§2).
7. **La compilación de producción** se hizo con `next build --webpack` en una copia aislada. Turbopack
   (el empaquetador por defecto) no admite el `node_modules` enlazado fuera de la copia, y aquí no hay
   pnpm para instalar sin red.

---

## 5. Validación final

### 5.1 Resultados

| Prueba | Resultado | Entorno |
|---|---|---|
| `core/tools/check.mjs` | TypeScript ✔ · ESLint ✔ · **55/55 tests** (43 previos + 12 de 4A) | Node, sin WebGL |
| `tsc --noEmit` de la raíz | 0 errores | — |
| ESLint de la raíz (configuración de producción) | 0 errores; los 2 avisos previos, ajenos a 4A | — |
| `next build --webpack` (copia aislada en `%TEMP%`, borrada después) | Compila; TypeScript ✔; 13 páginas | Producción no tocada; `.next/` del repositorio intacta |
| `mundo/tools/verify.mjs --software` | **40/40**, 2 min 40 s; consola sin errores ni avisos | Chrome + SwiftShader, **sin GPU** |
| `tools/check-approved.mjs --software` | **14/14** | Chrome + SwiftShader, **sin GPU** |
| Con GPU | **No ejecutado** (este equipo no tiene GPU) | — |

### 5.2 Estado de cada requisito de la auditoría

Leyenda:

- **CUMPLIDO (medido)**: probado automáticamente en navegador, sin GPU.
- **CUMPLIDO (visto)**: además, revisado en capturas reales sin GPU.
- **PENDIENTE DE TU VALIDACIÓN**: requiere GPU, un móvil real o tu criterio artístico.

| Requisito | Antes | Ahora |
|---|---|---|
| Composición de cámara (H1) | NO CUMPLIDO en el margen | **CUMPLIDO (medido y visto)**: ≥ 34 cm en cuadro en todos los lugares. Residual §4.1 |
| Iluminación por zonas (H2) | NO CUMPLIDO | **CUMPLIDO (medido y visto)**. El acierto artístico con GPU, pendiente de tu validación |
| Seguimiento y recuperación de la proximidad (M1) | PARCIAL (8,8 s) | **CUMPLIDO (medido)**: ≤ 4,1 s, criterio de 6 s. Contrapartida §4.2 |
| Locomoción sin deslizamiento (M2) | PARCIAL | **CUMPLIDO (medido)**: valores del laboratorio aprobado |
| Paso, anticipación, frenada y giros | CUMPLIDO | CUMPLIDO: mismo código; rango del paso medido |
| Interacciones (bola, flor, radiómetro, refugio, clics, lectura) | CUMPLIDO salvo la flor | **CUMPLIDO (medido)**, flor incluida (clic real) |
| Navegación (teclado, rueda, recarga) | PARCIAL | **CUMPLIDO (medido)** |
| Móvil (iPhone 13 emulado) | PARCIAL | **CUMPLIDO (medido y visto, emulado)**. Móvil real: pendiente |
| Movimiento reducido (preferencia del sistema) | CUMPLIDO | CUMPLIDO (medido) |
| Consola | CUMPLIDO | CUMPLIDO: 0 errores y 0 avisos |
| Pruebas reproducibles (M3, M4) | NO VERIFICADO | **CUMPLIDO**: sin GPU, con tiempos máximos y sin procesos colgados |
| Entregas aprobadas protegidas (M5) | PARCIAL | **CUMPLIDO (medido)**: paquetes intactos; equivalencia 14/14 |
| Producción, GLB, rig, clips y MathView | CUMPLIDO | CUMPLIDO |
| Rendimiento con GPU | NO VERIFICADO | NO VERIFICADO (sin GPU aquí) |
| Accesibilidad de Scope por teclado (M6) | NO CUMPLIDO | Para 4D |

### 5.3 Pruebas en navegador (`verify.mjs`, 40)

Llegada; arranque por tramo; guía; cada lugar enseña lo suyo; la flor se abre; sin teletransportes
(≤ 9,1 mm por 1/30 s, la prisa aprobada en el aire); continuidad de altura; 6 saltos; cámara en 6
lugares × 2 dispositivos × quieto y llegando; fuera de cuadro ya en un lugar; bola en escritorio y
móvil; trote y prisa sin resbalar; luz por lugar; transición sin cortes; botón de luz; radiómetro de
día y de noche; refugio y salida; clics reales sobre Scope, la bola y la flor; lectura; ráfaga de
rueda; recarga; rango del paso; carcasa; movimiento reducido del sistema; toque en el móvil; teclado;
sin WebGL; el visor de la Entrega 2; consola. Más las cifras de rendimiento, solo informativas.

### 5.4 Las entregas aprobadas siguen siendo las aprobadas

`tools/check-approved.mjs` reconstruye el laboratorio y el visor **desde las fuentes de hoy** (con el
núcleo modificado) en `%TEMP%` y los compara con los paquetes de git:

- **Laboratorio E3:** **1 024 instantáneas idénticas**, el estado completo cada 0,25 s en dos guiones
  de 128 s: recorrido, bola, clics, lectura, noche y refugio.
- Esta prueba encontró un fallo mío y lo corregí: la columna de la flor se creaba aunque no se usara,
  y como three.js consume `Math.random` para los identificadores, desplazaba la elección de gestos del
  laboratorio.
- **Visor E2:** 3 planos × 4 ambientes:
  - 9 vistas son idénticas píxel a píxel;
  - la vista general difiere en un 0,004–0,013 % de los píxeles, que son Scope dando saltitos en
    tiempo real.

---

## 6. Necesita tu validación

1. Con GPU: la luz por lugares y la composición del margen (sombras incluidas).
2. En un móvil real: el margen y la entrada.
3. **Decisión:** ¿te parece bien que los saltos largos tarden ~10,5 s para que Scope te acompañe, o
   prefieres más rapidez a costa de que pase más tiempo perdido?
4. **Decisión:** el residual de la entrada al margen desde el gabinete (§4.1).

**No he empezado 4B.**
