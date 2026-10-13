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
- **Ojos:** una sola malla (`Scope_Eyes`) con dos shape keys:
  - `Blink`: la cápsula se cierra en una línea fina, como el parpadeo 2D por altura, pero
    como transformación suave.
  - `Laugh`: la cápsula se curva en un arco luminoso con extremos afilados.
- **Compatibilidad web:** sin constraints ni drivers. Todo está horneado en huesos (TRS) y
  morph targets, que three.js reproduce de forma nativa.

## 3. Clips

Escritos como curvas de tiempo con el vocabulario del código 2D (`scripts/scope3d/clips.py`)
y horneados a 30 fps. Todos empiezan y terminan exactamente en reposo (verificado), así que la
web puede **sumarlos en modo aditivo sobre Idle** sin saltos.

| Clip | Dur. | Intención | Origen | Claves del movimiento |
|---|---|---|---|---|
| `Idle` | 8,4 s (bucle) | Respiración | 2D: breathe 4,2 s espejo | squash 1,013, sube 1,3 mm, roll −0,55° |
| `LookAround.L/.R` | 1,5 s | Exploración | Hoja: LOOK AROUND | los ojos van primero (±4,5 mm), el cuerpo gira ±13° con ligera inclinación, pausa, el otro lado, vuelta |
| `Tilt.L/.R` | 1,2 s | Curiosidad | Hoja: TILT; 2D tiny-tilt | anticipación −1,1°, inclinación 7° + giro 4°, pausa, recuperación; los ojos se abren un 7 % |
| `Bounce` | 0,9 s | Saltito espontáneo | Hoja: BOUNCE; 2D bounce | squash 0,90 → impulso 1,065 → vuelo de 11 mm con las patas recogidas → aterrizaje 0,925 → recuperación |
| `BlinkDouble` | 1,0 s | Parpadeo cálido | Hoja: BLINK (DOUBLE); 2D double-blink | dos transformaciones cápsula → línea y vuelta, con un mínimo asentamiento del cuerpo |
| `Focus.L/.R` | 1,3 s | Atención concentrada | Hoja: FOCUS; 2D observe | una sola dirección, mantenida: giro 8,5°, se inclina 3,2° hacia delante y avanza 2 mm, ojos convergen y se abren un 13 %, la antena se adelanta |
| `Stretch` | 1,6 s | **Solo clic** | Hoja: STRETCH; 2D touch fase 2 | anticipación 0,93 → estiramiento 1,11 con ojos entornados, la antena sube y se alarga → retroceso elástico |
| `Laugh` | 1,5 s | **Solo clic** | Nuevo (aprobado) | ojos → arcos, risitas rítmicas (squash 3,3 Hz + balanceo 1,65 Hz), boca algo más ancha, la antena acompaña |
| `ClickReaction` | 2,5 s | **Solo clic** | Stretch + Laugh | una sola reacción continua: la risa empieza a 1,0 s, mientras los ojos siguen cerrados por el estiramiento |

Las variantes `.L` / `.R` son espejos (giran hacia la izquierda o la derecha de Scope).

**Movimiento secundario de la antena:** no está animado a mano. Un muelle amortiguado de dos
segmentos (2,6 Hz / ζ 0,32 y 3,8 Hz / ζ 0,30) responde a la aceleración angular del cuerpo, a
la aceleración vertical del salto y a los giros, y se hornea en cada clip. En los clips no
cíclicos se desvanece en sus últimos 0,25 s para que el clip termine en reposo.

## 4. Capa procedural (web, no horneada)

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
- `scope-3d-behavior.test.ts`: 10 pruebas con `node --test`, sin dependencias nuevas. Cubren:
  - Stretch, Laugh y ClickReaction nunca salen del selector aleatorio;
  - nunca hay tres repeticiones seguidas, ni con un generador aleatorio adversario;
  - la distribución respeta los pesos (±3 %);
  - los intervalos y las variaciones respetan sus rangos;
  - la prioridad del clic y que se ignoran los clics repetidos;
  - el temporizador se reinicia tras la reacción;
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
  máquina de estados y fundidos de 180–250 ms. La capa procedural escribe en `look` y en los
  ojos después de `mixer.update()`.
- **Respaldo:** si no hay WebGL o el dispositivo es muy limitado, se queda el Scope 2D actual.
  El 2D sigue siendo además la imagen de carga.
- **Coste:** pixel ratio ≤ 1,5; render solo cuando Scope está visible (IntersectionObserver)
  y con la pestaña activa.
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

## 8. Limitaciones conocidas

- **Asiento de los ojos:** la comprobación "ojos sobre el cristal" usa la misma función de
  cristal que el horneado. Confirma que todo es coherente, pero no es una medición
  independiente.
- **Cámara de las hojas:** se renderizaron desde una sola cámara (hero) y a baja resolución.
  Aún no hay previsualización en vídeo ni reproducción en el navegador.
- **`allowImportingTsExtensions` en `tsconfig.json`:** es necesario, porque las pruebas se
  ejecutan con el soporte nativo de TypeScript de Node (sin dependencias) y eso obliga a
  importar con extensión `.ts`. TypeScript solo lo admite con `noEmit`, que el proyecto ya
  usa. Si en el futuro se adopta un runner como Vitest, se puede volver a los imports sin
  extensión y retirar la opción.
- **TypeScript, ESLint y build sin ejecutar:** `node_modules` no está instalado y npm no puede
  descargar (certificado autofirmado en la red). Pendiente: `npx tsc --noEmit`,
  `npm run lint` y `npm run build` cuando haya dependencias.
- **Pendiente para la web:** el material mineral y el bloom son procedurales o de compositor;
  en la web hacen falta texturas horneadas y un bloom de postproceso (o un halo falso).
