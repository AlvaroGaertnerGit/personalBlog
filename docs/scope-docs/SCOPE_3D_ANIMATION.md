# Scope 3D — Rig, animación y personalidad

Estado: **rig, 12 clips y máquina de estados aprobados como base definitiva. NO integrado
en la web**: el Scope 2D sigue siendo el de producción.

Archivo maestro: `assets/scope-3d/blender/scope-master.blend`, regenerable con
`scripts/build_scope.py`. El script reconstruye la geometría aprobada (descrita en
`SCOPE_3D_MODEL.md`), comprueba su firma contra `scripts/approved-geometry.json`, añade el rig
y hornea los clips.

---

## 1. Excepciones al canon aprobadas por el propietario

Documentadas aquí en lugar de editar los documentos canónicos:

| Excepción | Canon previo | Decisión (2026-10-13) |
|---|---|---|
| **Risa con ojos en arco (∩)** | `CONSTRAINTS.md` / `EVOLUTION.md`: "nunca una curva ni un cambio de forma de los ojos" (la propuesta de ojos en medialuna se rechazó) | Permitida **solo** en la reacción al clic (Laugh). Sin dientes ni boca nueva; la boca solo se ensancha un poco. En el resto de comportamientos los ojos siguen siendo cápsulas que solo cambian de altura |
| **Stretch solo al hacer clic** | 2D: `stretch` forma parte del repertorio aleatorio del idle; el clic es una progresión de "confianza" en 3 fases | En 3D, Stretch nunca es aleatorio: clic → Stretch → Laugh → Idle |
| **Ritmo autónomo 8–20 s** | 2D: 3–7 s; `VISUAL_LANGUAGE.md`: 8–15 s | 8–20 s, configurable |

Todo lo demás del canon sigue vigente: sin texto, sin brazos, sin "mascota", nada que pida
atención, y el idle como estado dominante.

## 2. Rig

```
root            suelo; la web coloca a Scope moviendo este hueso
└─ hop          saltos (pivote en el suelo)
   └─ squash    squash & stretch con volumen constante (x,y = 1/√z), pivote en el suelo
      ├─ look   RESERVADO para la web: orientación procedural hacia el cursor (ningún clip lo anima)
      │  └─ body          inclinación / giro / inclinación hacia delante; pivote en el centro de la carcasa
      │     ├─ eye.L / eye.R   mirada (se deslizan sobre el cristal curvo) y altura (entornar / abrir)
      │     ├─ mouth           anchura
      │     └─ antenna.1 └─ antenna.2   antena flexible de dos segmentos
      └─ foot.FL / FR / BL / BR        patas plantadas (cuelgan de squash, no de body)
```

- **Integridad de la cara:** cristal y borde pesan 100 % en `body`; la cavidad solo puede
  moverse rígidamente o escalar con el cuerpo, así que no puede romperse ni separarse.
  Medido: 0,0000 mm de desviación en todos los fotogramas de todos los clips.
- **Patas:** los pesos pasan gradualmente de `body` (base con faldón) al hueso de la pata
  (punta), y salen del propio crecimiento de las patas en `faceshell.py`. Al inclinarse el
  cuerpo, las patas siguen plantadas y se deforman de forma orgánica.
- **Ojos (v2, 2026-10-13):** una sola malla (`Scope_Eyes`) **envuelta sobre el cristal curvo**
  con 0,5 mm de separación en el contorno, y huesos que giran con la normal del cristal al mover
  la mirada. El cristal es opaco: en v1 la lente plana quedaba hasta 1,6 mm por debajo y el
  cristal recortaba su contorno en cada movimiento (`reports/POLISH_REVIEW.md` §2). Huella
  visible conservada de v1: 14 × 23,7 mm. Tres shape keys, todos envueltos:
  - `Blink`: la cápsula se cierra en una línea fina, como el parpadeo 2D por altura, pero
    como transformación suave.
  - `Laugh`: la cápsula se curva en un arco luminoso con extremos afilados.
  - `Tall`: abrir los ojos (`eye_h` > 1); entornar sigue siendo escala del hueso.
  `validate_scope.py` comprueba en cada fotograma que ningún contorno quede bajo el cristal.
- **Compatibilidad web:** sin constraints ni drivers. Todo está horneado en huesos (TRS) y
  morph targets, que three.js reproduce de forma nativa.

## 3. Clips

Escritos como curvas de tiempo con el vocabulario del código 2D (`scripts/scope3d/clips.py`)
y horneados a 30 fps. Todos empiezan y terminan exactamente en reposo (verificado), así que la
web puede **sumarlos en modo aditivo sobre Idle** sin saltos.

Principios (v2): curvas con *ease in/out*, *moving holds* (nada se congela), acción solapada
(los ojos guían, el cuerpo sigue ~0,1 s después, la inclinación y la antena llegan detrás),
sobreimpulsos pequeños y asentados.

| Clip | Dur. | Intención | Origen | Claves del movimiento |
|---|---|---|---|---|
| `Idle` | 8,4 s (bucle) | Respiración | 2D: breathe 4,2 s espejo | squash 1,013, sube 1,3 mm, roll −0,55°. La vida no repetitiva va encima, en runtime (§4) |
| `LookAround.L/.R` | 2,6 s | Exploración curiosa y pausada | Hoja: LOOK AROUND | los ojos guían (±4,5 mm), el cuerpo gira ±12–13° y se inclina detrás; mirada larga con deriva a cada lado; medio parpadeo en el cambio de lado; vuelta con un leve sobreimpulso |
| `Tilt.L/.R` | 1,9 s | Curiosidad | Hoja: TILT; 2D tiny-tilt | anticipación −1,3°, inclinación 7° que llega a 7,8° y se asienta, recuperación elástica; los ojos se adelantan y se abren un 9 % |
| `Bounce` | 1,2 s | Saltito espontáneo | Hoja: BOUNCE; 2D bounce | squash 0,91 → impulso 1,07 → vuelo de 11 mm → aterrizaje 0,925 con cabeceo → recuperación; patas desfasadas (delanteras primero, ganancias 0,82–1) |
| `BlinkDouble` | 1,2 s | Parpadeo cálido | Hoja: BLINK (DOUBLE); 2D double-blink | cierre rápido, pausa y apertura lenta; el ojo baja 1 mm al cerrar (párpado superior); el segundo, más suave |
| `Focus.L/.R` | 2,4 s | Atención concentrada | Hoja: FOCUS; 2D observe | una sola dirección: giro 5°, inclinación 5° y 3,5 mm hacia delante, y **quietud**; ojos se entornan un instante, luego se abren 15 % y convergen; la antena se adelanta y se mantiene |
| `Stretch` | 1,8 s | **Solo clic** | Hoja: STRETCH; 2D touch fase 2 | subida lenta hasta 1,11 con los ojos cerrándose (shape key Blink), antena arriba y alargada → dos rebotes decrecientes |
| `Laugh` | 1,8 s | **Solo clic** | Nuevo (aprobado) | ojos: línea → arco (Blink + Laugh = 1); risitas a 3 Hz que se suavizan, los ojos acompañan; boca algo más ancha; al final el arco vuelve a línea y se abre |
| `ClickReaction` | 2,8 s | **Solo clic** | Stretch + Laugh | una sola reacción continua; la risa empieza a 1,0 s. Los ojos tienen su propio camino continuo: entornados → línea → arco |

Las variantes `.L` / `.R` son espejos (giran hacia la izquierda o la derecha de Scope). Todas
las duraciones son fotogramas enteros a 30 fps (las lee la máquina de estados).

**Movimiento secundario de la antena:** ya no se hornea. Lo simula el visor en runtime
(`engine/scope-3d-secondary.ts`, §4) a partir del movimiento real del cuerpo, para que también
reaccione entre clips, en fundidos e interrupciones.

## 4. Capa procedural (web, no horneada)

**Implementado (`engine/scope-3d-secondary.ts`, después del mezclador):**

| Capa | Qué hace |
|---|---|
| Muelle de la antena | Dos segmentos (2,6 Hz / ζ 0,36 y 3,8 Hz / ζ 0,34) movidos por la inercia del cuerpo (no por la pose animada de la antena); flexión pico: Bounce 9,5°, Laugh 4,4°, Tilt 3,1°, LookAround 1,4° |
| Deriva de postura | Hueso `look`: ±1,6° de giro, ±0,7° de cabeceo, ±0,5° de inclinación, con senos inconmensurables de 0,06–0,15 Hz (nunca se repite); al 30 % mientras suena un clip; desactivada con movimiento reducido |
| Parpadeos sueltos | Cada 3,6–8,5 s, uno de cada siete más lento; nunca durante un clip ni en el segundo posterior |

El `PropertyMixer` de three.js solo escribe una propiedad cuando su valor mezclado cambia, así
que esta capa guarda el valor del clip para no reaplicarse sobre su propio resultado.

**Pendiente para la integración** (capa Presence del 2D):

Reimplementa la capa Presence del 2D (`use-scope-presence.ts`) sobre los huesos reservados:

| Comportamiento | Hueso | Constantes (del 2D, convertidas) |
|---|---|---|
| Orientación hacia el cursor | `look` (yaw/pitch) | alcance 600 px; ±10° yaw / ±8° pitch; muelle 90/16/1,2 |
| Mirada | `eye.L/R` (suma al clip) | ±4,5 mm; muelle 260/18/0,5; anticipación por velocidad 45 ms; jitter permanente 0,3 mm (senos de 5,2 s / 6,3 s) |
| Vaivén de la antena | `antenna.1` (suma) | sigue al yaw de `look` con muelle 50/10/0,8 |
| Acento púrpura | material emisivo | intensidad = proximidad del cursor (muelle 60/20), 0 en reposo |

La posición de los ojos sobre el cristal se calcula con el polinomio del cristal
(`faceshell.py`). Habrá que exportar sus coeficientes junto al GLB para que la mirada
procedural no se hunda ni flote.

## 5. Máquina de estados

`src/components/scope-3d/behavior/`: TypeScript puro, sin React ni three.js, y no importado
desde producción.

- `scope-3d-config.ts`: intervalo (8–20 s), pesos (30/20/15/20/15), máximo 2 repeticiones
  seguidas, variación (velocidad 0,9–1,1, amplitud 0,85–1,1, dirección L/R), duraciones y
  marcador de la risa.
- `scope-3d-behavior.ts`: `IDLE → RANDOM_ANIMATION → RETURN_TO_IDLE → IDLE`, y con clic
  `CLICK_STRETCH → CLICK_LAUGH → RETURN_TO_IDLE`.
  - Devuelve comandos (`play` / `stop` con nombre exacto del clip, velocidad, peso y fundido).
  - Tiempo y azar se inyectan.
  - El clic cancela con fundido la animación en curso, ignora clics repetidos y reinicia el
    temporizador al terminar.
  - Con `prefers-reduced-motion` solo hay parpadeos, y el clic responde con un parpadeo.
- `schedule(now, delay?)` reprograma el temporizador mientras está en IDLE (lo usa el laboratorio
  para "disparar ya" y al reactivar el modo autónomo).
- `scope-3d-behavior.test.ts`: 11 pruebas con `node --test`, sin dependencias nuevas. Cubren:
  - Stretch, Laugh y ClickReaction nunca salen del selector aleatorio;
  - nunca hay tres repeticiones seguidas, ni con un generador aleatorio adversario;
  - la distribución respeta los pesos (±3 %);
  - los intervalos y las variaciones respetan sus rangos;
  - la prioridad del clic y que se ignoran los clics repetidos;
  - el temporizador se reinicia tras la reacción;
  - `schedule` solo actúa en IDLE;
  - el comportamiento con movimiento reducido;
  - las duraciones coinciden con las horneadas en Blender (lee `exports/scope-clips.json`).

Para ejecutarlas: `node --test src/components/scope-3d/behavior/scope-3d-behavior.test.ts`.

## 6. Propuesta de integración (pendiente de autorización)

- **Motor:** three.js directo (GLTFLoader + AnimationMixer) en un componente cliente aislado,
  cargado con `next/dynamic` (`ssr: false`) solo cuando Scope está en pantalla. React Three
  Fiber añadiría unos 150 KB y una segunda forma de hacer las cosas para un solo objeto; solo
  compensa si después llegan más escenas 3D.
- **Mezcla:** `Idle` en bucle como capa base. Los comportamientos se reproducen como clips
  aditivos (`AnimationUtils.makeClipAdditive`), con el peso y la velocidad que dicte la
  máquina de estados. Los fundidos se suavizan con `smootherstep`: entrada de 250 ms,
  interrupción por clic de 350 ms y entrada de la reacción de 120 ms. Los clips terminados se
  liberan después de `mixer.update()`, nunca dentro del evento `finished` (§9). La capa procedural escribe en `look` y en los
  ojos después de `mixer.update()`.
- **Respaldo:** si no hay WebGL o el dispositivo es muy limitado, se queda el Scope 2D actual.
  El 2D sigue siendo además la imagen de carga.
- **Coste (implementado en el visor):**
  - canvas a píxeles físicos exactos, más supermuestreo adaptativo resuelto tras el tone
    mapping (`engine/scope-3d-resolution.ts`);
  - regulador por mediana de FPS;
  - render solo cuando Scope está visible y con la pestaña activa;
  - en modo web se rechazan los renderizadores WebGL por software, y entonces se queda el 2D.
- **Antes de integrar:** precalcular la envolvente de encuadre como constante. Hoy se mide al
  cargar y bloquea unos 380 ms.
- **Antes de integrar, versión web:**
  - retopología de la carcasa (hoy ~45 k vértices, objetivo ~8–12 k con mapa de normales);
  - hornear el material mineral a texturas (WebP/KTX2);
  - compresión Draco o meshopt;
  - reducir el muestreo de las animaciones.
  - El GLB actual (`exports/scope.glb`) pesa 2,9 MB sin compresión ni texturas.

## 7. Validación

- `reports/VALIDATION.md` (generado por `scripts/validate_scope.py`): 11/11 PASS. Pesos que
  suman 1, cara 100 % body, inicio y final en reposo en los 12 clips, ningún vértice bajo el
  suelo (mínimo −0,04 mm), cara rígida (0,0000 mm). El GLB de prueba lleva 12 animaciones,
  2 morph targets y 14 joints (`exports/scope.glb`, exportado con `scripts/export_scope.py`), y se reimporta bien.
- Hojas de contacto: `assets/scope-3d/renders/animation/sheet-<clip>.png` (6 fotogramas
  clave por clip) y `sheet-click-sequence.png` (12 fotogramas repartidos por toda la reacción).

## 8. Laboratorio `/scope-lab` (solo desarrollo)

Visor WebGL real del GLB aprobado para revisar clips, transiciones y personalidad antes de
integrar nada. En producción la página y su GLB devuelven 404.

- `src/app/scope-lab/`: página, paneles y `scope.glb/route.ts`, que sirve
  `assets/scope-3d/exports/scope.glb` sin copiarlo a `public/`.
- `src/components/scope-3d/engine/`: three.js puro, reutilizable para la integración.
  - `scope-3d-stage.ts`: escena, cámara orbital, las luces del estudio de Blender convertidas,
    sombras VSM y bloom.
  - `scope-3d-model.ts`: carga y estadísticas.
  - `scope-3d-ceramic.ts`: grano mineral procedural aproximado.
  - `scope-3d-animator.ts`: `AnimationMixer`, Idle de base y clips aditivos o de sustitución.
  - `scope-3d-director.ts`: un único reloj; ejecuta los comandos de la máquina de estados.
  - `scope-3d-framing.ts`: envolvente de la silueta de todo el movimiento, para encuadrar una
    cámara fija sin recortes.
- `scope-3d-viewer.tsx`: componente cliente (cargarlo con `next/dynamic`, `ssr: false`), con dos
  modos: `studio` (órbita, fondo de la hoja) y `preview` (canvas transparente, cámara fija,
  como en la web).
- Una sola fuente de decisión: la máquina de estados. Reproducir un clip a mano desde el panel
  apaga el modo autónomo en lugar de competir con él.
- **Modos Studio y Web Preview.** Web Preview muestra `/scope-lab/preview` en un iframe, para que
  los breakpoints vean un viewport real: escritorio o móvil de 390 px.
  - Contexto real: fondo del layout, Hero, About y `AboutWorkbench`, con sus mismos componentes.
  - Tamaños de 80 a 200 px, temas oscuro y claro, pixel ratio y lupa de píxeles.
  - Al cambiar de modo se desmonta el otro visor: nunca hay dos máquinas de estados a la vez.
  - Los ajustes viajan por URL y `postMessage`, así que cambiar de tamaño no recarga el GLB.
- Nitidez: todo pasa por el `EffectComposer` a resolución interna (`ssaa`× el canvas, con
  MSAA), y `Scope3DOutputPass` hace el tone mapping por muestra antes de reducir. Se compara en
  Performance (Studio) o en Sharpness (Web Preview). Ver `reports/POLISH_REVIEW.md` §1.
- Paneles nuevos: *Secondary motion* (muelle e Idle vivo) y, en Performance, supersampling,
  resolución interna, coste del hilo principal y estado del regulador.
- Compensaciones del visor (no cambian el GLB):
  - el bloom del canvas transparente se compone premultiplicado con el mismo color que en Studio;
  - las influencias de morph se limitan a [0, 1], porque el peso de amplitud de hasta 1,1
    pasaba el parpadeo de "cerrado";
  - la rugosidad del clearcoat del cristal sube a 0,3, porque con luces puntuales el 0,16
    aprobado dibuja un arco blanco que parece una boca.

Abrir: `pnpm dev` → `http://localhost:3000/scope-lab`. La vista previa también funciona sola,
por ejemplo en un móvil de la misma red: `/scope-lab/preview?size=160&scene=hero&theme=dark`.
Revisiones: `assets/scope-3d/reports/LAB_REVIEW.md` (animaciones) y
`assets/scope-3d/reports/WEB_PREVIEW_REVIEW.md` (escala web, nitidez y píxeles de la cara).
Pulido final (nitidez, ojos, movimiento, rendimiento): `assets/scope-3d/reports/POLISH_REVIEW.md`.

## 9. Limitaciones conocidas

- **Asiento de los ojos:** la comprobación "ojos sobre el cristal" usa la misma función de
  cristal que el horneado. Confirma que todo es coherente, pero no es una medición
  independiente.
- **Cámara de las hojas:** se renderizan desde una sola cámara (hero) y a baja resolución, y
  no incluyen el muelle de la antena (es de runtime). Hay vídeos del navegador en
  `assets/scope-3d/renders/web/videos/`.
- **Trampas de three.js (resueltas):**
  - liberar una acción dentro del evento `finished` hace que otra acción se salte un
    fotograma;
  - el mezclador no reescribe las pistas constantes.
  Lo cubre `engine/scope-3d-animator.test.ts` (`node --test`).
- **Mediciones reproducibles:** `node assets/scope-3d/scripts/web/measure-web.mjs <url>`
  (nitidez frente a una referencia 8×, continuidad, muelle, patas y rendimiento).
- **`allowImportingTsExtensions` en `tsconfig.json`:** es necesario, porque las pruebas se
  ejecutan con el soporte nativo de TypeScript de Node (sin dependencias) y eso obliga a
  importar con extensión `.ts`. TypeScript solo lo admite con `noEmit`, que el proyecto ya
  usa. Si en el futuro se adopta un runner como Vitest, se puede volver a los imports sin
  extensión y retirar la opción.
- **TypeScript, ESLint y build:** ejecutados el 2026-10-13 (`npx tsc --noEmit`, `pnpm lint`,
  `pnpm build`), sin errores. El proyecto usa pnpm (`packageManager` en `package.json`).
- **Pendiente para la web:** el material mineral y el bloom son procedurales o de compositor;
  en la web hacen falta texturas horneadas y un bloom de postproceso (o un halo falso).
