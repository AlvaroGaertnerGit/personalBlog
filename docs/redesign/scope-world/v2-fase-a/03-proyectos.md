# 3. Proyectos: experiencias, no folios

## 3.1 Qué he comprobado de cada proyecto (2026-10-15, actualizado con tus respuestas)

Antes de diseñar nada he buscado qué existe de verdad. **Una instalación no puede prometer más
de lo que el proyecto tiene.**

| | MathView | Tournamently | Sport Coach |
|---|---|---|---|
| Código | `github.com/AlvaroGaertnerGit/MathView-Frontend` (Angular 20 + Plotly) y `MathView-API` (Django, NumPy, SciPy, SymPy, mpmath; un servicio de OpenAI para describir funciones) | `github.com/AlvaroGaertnerGit/tournamently`, **público** | `github.com/AlvaroGaertnerGit/sport-app`, enlazado en producción |
| Web en funcionamiento | **No.** El frontend llama a `mathview-backend.azurewebsites.net`, que hoy **no resuelve en DNS**. Sin API no calcula nada | **`https://tournamently.vercel.app` responde 200** | No hay enlace (`#`) |
| ¿Se puede incrustar? | — | **Hoy sí:** no envía `X-Frame-Options` ni `frame-ancestors`. Puede cambiar, así que hay que volver a comprobarlo al construir | — |
| Funciones (leídas en el código) | Visualizador de **funciones complejas**: superficie 3D de altura \|f(z)\| coloreada por la fase arg f(z) en la rejilla −2…2 (100 × 100), vista 2D, mostrar magnitud o fase, calculadora con sen, cos, tg, log, ln, e^x, ∫, ∂ y Γ, **análisis de ceros y polos**, el **conjunto de Mandelbrot** (con exponente) y la **función zeta de Riemann**. **Ojo:** en el código no hay Matlab, aunque la web de producción lo mencione | Fase de grupos con clasificación única, **motor de cuadros puro y probado** (`src/lib/bracket.ts`, 306 líneas, sin dependencias), avance y campeón, jornada de jugadores (QR de pista, código de pareja, resultado confirmado por el rival) y precios. **Ojo:** según su documentación, la migración de la jornada de jugadores no está aplicada en el Supabase de producción | La descripción del sitio: rotaciones, temporizadores en directo y un coach con IA que propone. Scope es su identidad |
| Recursos visuales reales | Ninguno publicado; se pueden generar capturas reales si se levanta la API en local | Logotipos SVG (`public/brand/`), su propio sistema visual («Tiza y arcilla») y capturas que puedo hacer de las páginas públicas | Ninguno localizado |
| Pantallas de ejemplo | — | Las `/dev/*` usan componentes reales con datos de ejemplo, pero **solo existen en desarrollo** (`dev/layout.tsx` devuelve 404 en producción) | — |

**Consecuencia:**

- Tournamently se puede experimentar de verdad desde ya.
- MathView tiene código real y público, pero **hoy no hay demo**: su API está caída. Su
  instalación representa **su método real** (|f(z)| y fase) y enlaza los dos repositorios. La
  demo incrustada llegará cuando la API vuelva a estar en línea.
- Sport Coach tiene repositorio, pero no demo.

## 3.2 Tres sellos obligatorios

Cada experiencia lleva siempre un sello visible, que el sistema calcula a partir del manifiesto
(§3.4) y no se escribe a mano:

| Sello | Significa |
|---|---|
| **Producto real** | Lo que ves es la aplicación de verdad: incrustada o enlazada |
| **Motor real · datos de ejemplo** | El código que se ejecuta es el del proyecto; los equipos, nombres o cifras son de muestra |
| **Representación** | Es una instalación del portfolio inspirada en el proyecto. No es el producto ni una de sus funciones |

Así nadie confunde una escultura con una demo, que era tu condición.

## 3.3 Las instalaciones

### MathView: «La función que se pisa» (celadón)

- **Ya existe en la 1.0.**
  - Una superficie de porcelana celadón.
  - Sus curvas de nivel se encienden al abrirla.
  - Scope camina por encima.
- **En la 2.0 la pieza pasa a ser lo que MathView dibuja de verdad.**
  - La superficie es **|f(z)|** de una función compleja.
  - Su vidriado cambia de tono con la **fase arg f(z)**: en lugar del arcoíris de Plotly, una
    gama de esmaltes (celadón, ámbar, lavanda) para no salirse de la paleta.
  - Los **ceros** son hoyos que tocan el suelo y los **polos**, picos que se pierden hacia
    arriba. Scope se asoma a un cero y mira hacia arriba en un polo.
  - **Interacción · Representación.** Eliges entre unas pocas funciones de ejemplo, como z,
    z² − 1 y (z² − 1)/(z² + 1). La pieza cambia de forma con el mismo cálculo que hace la API
    de MathView (rejilla −2…2, magnitud y fase), recreado en el navegador. El sello lo dice:
    es una representación de su método, no la aplicación.
  - **Producto real · repositorio.** Los dos repositorios enlazados.
  - **Producto real · demo (pendiente).** Cuando la API vuelva a estar en línea, la «pantalla
    de porcelana» incrusta la aplicación de verdad. Recomiendo volver a desplegar la API (es
    Django sin estado) o generar con ella, en local, capturas y un vídeo reales.
  - **Editorial.** Lo saco del código: qué calcula, para qué alumnos y qué decidiste (cálculo
    simbólico en el servidor y Plotly en el cliente). Lo revisas tú.
- **Scope.**
  - Al acercarte, se adelanta, se sube a la pieza y se asoma a un cero.
  - Al abrir el proyecto, mira primero la pieza y luego a ti.

### Tournamently: «Las gradas del cuadro» (terracota)

- **Qué es.** **Ya existe en el mundo aprobado** (`pliego_base.py`, `bracket()`, en 0,50, −0,02).
  Son ocho peanas de bizcocho de terracota que convergen ronda a ronda, cada ronda más alta que
  la anterior, con la pelota sobre la final. En la 2.0 cada peana pasa a ser un partido que se
  puede seleccionar, y la final se ensancha para que Scope quepa encima.
- **Experiencia 1 · Motor real · datos de ejemplo.**
  - Eliges ganadores tocando los partidos.
  - La resolución (quién juega cada partido, el avance, los «byes» y el campeón) la calcula
    **`resolveBracket`, el motor real de Tournamently**, copiado en el prototipo con su
    procedencia (repositorio y commit `7c78642`) y sus tests.
  - Las parejas son de ejemplo y lo dicen.
  - Es la función central del producto, ejecutándose de verdad.
- **Experiencia 2 · Producto real.**
  - «Abrir Tournamently» muestra `tournamently.vercel.app` en un marco a pantalla completa
    (`sandbox`, carga solo a petición), con «Abrir en una pestaña nueva».
  - Solo las páginas públicas: nada de cuentas ni del panel.
- **Editorial.** Lo saco de su documentación de producto (`docs/product/*.md`,
  `docs/design/matchday-os.md`) y lo revisas tú.
- **Scope.**
  - Sube las gradas a saltitos detrás de la pareja que eliges, ronda a ronda, hasta la final.
  - ✦ Cuando hay campeón, empuja la pelota con la cara. La pelota rueda gradas abajo y el
    cuadro vuelve a empezar.
- **Resuelto:** el repositorio es público; se copia `bracket.ts` con su procedencia y se incrusta
  la web.

### Sport Coach: «El dial» (negro tinta y marfil)

- **Ya está en el mundo** como dial negro tinta: los colores de la cara de Scope.
- **Experiencias.**
  - **Producto real · enlace:** el repositorio.
  - Si me pasas capturas o vídeo propios, la ficha los muestra (sello **Producto real**).
  - Mientras no haya demo, nada del dial se presenta como función de la aplicación.
- **Scope.** Comportamiento especial: **es su casa**, porque Scope es la identidad de Sport
  Coach. Se sube al centro del dial y hace su Bounce espontáneo, el único sitio del mundo donde
  lo hace sin que se lo pidas.

### Peanas libres: los próximos proyectos

- Hay tres peanas de papel crudo en el anillo tostado.
- Al añadir un proyecto con el arquetipo genérico, su peana se cuece y aparece la pieza.

## 3.4 El sistema: manifiesto + instalación

**Es un modelo híbrido:** infraestructura común para todo y dirección artística propia para los
proyectos principales.

```
content/projects/<id>.ts  ──► ProjectManifest ──┬─► Panel HTML (ficha, sellos, enlaces, editorial)
                                                ├─► Instalación: arquetipo «pieza cocida» (sin Blender)
                                                │               o módulo propio (mathview-surface, bracket-terraces…)
                                                ├─► Peana (slot) en el círculo: posición, mapa caminable, cámara
                                                ├─► Comportamiento de Scope (al acercarse / al abrir / especial)
                                                └─► Vista de lectura, metadatos y versión móvil
```

### Manifiesto

Es un borrador: el código real se escribirá en la Fase B, y en producción vivirá en `src/`,
como fuente única para la web clásica y para el mundo.

```ts
interface ProjectManifest {
  id: string                         // "tournamently"
  title: string                      // nombre propio, sin traducir
  category: "producto" | "herramienta" | "docencia" | "experimento"
  status: "en producción" | "en desarrollo" | "en pausa"
  summary: string                    // una frase, en español
  editorial: { problem: string; audience: string; role: string; decisions: string[]; learned?: string }
  links: { live?: CheckedLink; repo?: CheckedLink; demo?: CheckedLink }
  media: RealMedia[]                 // solo recursos reales: capturas propias, vídeo, logotipos
  experiences: Experience[]          // por orden de preferencia
  installation:
    | { kind: "archetype"; form: "cuenco" | "torre" | "losa" | "arco"; glaze: string; emblem?: string }
    | { kind: "custom"; module: string }        // "mathview-surface", "bracket-terraces", "rotation-dial"
  placement: { slot: SlotId; order: number }    // peana del círculo y orden en el índice
  scope: { onApproach?: BehaviourId; onOpen?: BehaviourId; special?: BehaviourId }
  a11y: { alt: string; fallbackImage?: string; mobile: "ficha" | "pantalla-completa" | "enlace" }
}

interface CheckedLink { href: string; label: string; checkedOn: string; embeddable?: boolean }

type Experience =
  | { kind: "embed"; url: string }                                     // sello: Producto real
  | { kind: "link"; url: string }                                      // sello: Producto real
  | { kind: "media"; items: RealMedia[] }                              // sello: Producto real
  | { kind: "engine"; module: string; source: string; sampleData: true } // sello: Motor real · datos de ejemplo
  | { kind: "concept"; module: string }                                // sello: Representación
```

### Contrato de una instalación propia

```ts
interface Installation {
  load(ctx: WorldContext): Promise<void>  // carga su propio trozo de geometría (bajo demanda)
  approach(t: number): void               // 0…1 según la cercanía del visitante: «despertar»
  open(): Promise<void>                   // la cámara ya está allí; arranca la experiencia
  close(): Promise<void>
  scopeSpots(): Spot[]                    // dónde puede ponerse Scope (validado contra el mapa caminable)
  dispose(): void
}
```

### Cómo se añade un proyecto

1. Crear `content/projects/<id>.ts` con el manifiesto.
2. Dejar los recursos reales en su carpeta (capturas, vídeo, logotipo).
3. Elegir un arquetipo (forma + esmalte + emblema) o escribir un módulo propio.
4. Ejecutar la comprobación. Falla si:
   - la peana está ocupada;
   - falta un texto alternativo;
   - un enlace no responde o ya no se deja incrustar;
   - una experiencia `concept` no lleva su módulo;
   - un sitio de Scope cae fuera del suelo.
5. Las capturas automáticas enseñan la pieza nueva.

**No hace falta Blender ni volver a exportar el mundo**:

- las peanas ya tienen su hueco en el mapa caminable;
- la pieza del arquetipo se genera en el navegador a partir del manifiesto.

Con más de seis proyectos habría que añadir peanas, y eso sí requiere exportar de nuevo. Es
poco frecuente, y está previsto.

## 3.5 Al abrir un proyecto

1. La cámara se acerca a la instalación.
2. Scope mira la pieza y después a ti.
3. **La experiencia va primero:** el cuadro que se puede jugar, la superficie o la web
   incrustada. La editorial está a un clic, en la misma ficha.
4. Para salir hay tres caminos, con el mismo resultado: Esc, «Volver al círculo» y Atrás. La
   cámara vuelve a la parada y el foco al objeto.
5. **En el móvil:** ficha a pantalla completa con la experiencia arriba. Lo que se incrusta abre
   en pantalla completa o como enlace, según el manifiesto.
6. **Sin WebGL:** la misma ficha en la vista de lectura, con los mismos sellos.
