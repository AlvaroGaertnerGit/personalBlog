# A. Informe de auditoría — alvarogaertner.com

Fecha: 2026-10-14 · Alcance: home (`/`, único recorrido público), entrada «Scope está
explorando…», `/scope` y `/scope-lab` (solo como contexto técnico) · Build de producción
local (`next build` + `next start -p 3100`).

## Cómo se ha auditado

| Qué | Cómo | Evidencia |
|---|---|---|
| Recorrido visual | Playwright + Chrome real, 4 dispositivos (1920×1080, 1366×768, 820×1180, 390×844 @2×), tema claro y oscuro, scroll completo (para disparar todas las animaciones de entrada y los viajes de Scope) y captura por sección | `evidence/<dispositivo>-<tema>-<sección>.jpg`, `evidence/*-fullpage.jpg` |
| Recortes de detalle | Tarjetas de proyecto, workspace del Notebook, final de página | `evidence/laptop-light-card-*.jpg`, `…-notebook-workspace.jpg`, `…-page-end.jpg` |
| Métricas de laboratorio | `PerformanceObserver` (LCP, CLS), Resource Timing, orden de tabulación, landmarks, encabezados, tipografías y tamaños computados | Tabla «Rendimiento» abajo |
| Código | Lectura de `src/app`, `src/components/{hero,layout,sections,navigation,scope,scope-3d,theme}`, `src/lib/motion`, `globals.css`, `docs/CONTEXT.md` | Rutas citadas en cada hallazgo |

**Límite importante del entorno:** este equipo no tiene GPU. En producción el sitio rechaza
WebGL por software (decisión ya documentada), así que **en todas las capturas Scope aparece
como su imagen prerenderizada**, renderizada con la misma cámara y la misma iluminación que el
3D en vivo. La silueta, el encuadre y el material son los mismos; lo que no se ve es el
movimiento. Ninguna conclusión de este informe depende de la animación en vivo, salvo las de
motion, que salen del código.

Cada hallazgo indica su tipo:

- **[Defecto]**: comprobado y reproducible. No es cuestión de gusto.
- **[Dirección de arte]**: valoración crítica argumentada. Es discutible por definición.

---

## Valoración general

La web está bien construida, pero visualmente no tiene identidad propia. La ingeniería que
hay debajo es de nivel alto: tokens de movimiento, sistema de docks, una única instancia de
Scope que viaja, accesibilidad cuidada y una pantalla de entrada que espera al primer
fotograma real. Lo que ve el visitante, en cambio, es una plantilla «shadcn + Geist + rejilla
+ tarjetas de cristal» con un personaje 3D muy bueno colocado dentro de cajas.

Los tres problemas de fondo son:

1. **No se sabe de quién es la web.** El nombre «Álvaro Gaertner» no aparece en ningún texto
   visible de la página; solo está en el `<title>`. No hay cabecera, firma ni pie.
2. **Scope está metido en cajas, no habita un espacio.** Cada sección le ofrece un marco
   neutro (un cuadrado de cristal vacío, una tarjeta con una línea dibujada) y Scope, con su
   iluminación de estudio, se superpone a él. Como solo hay un Scope que viaja, dos de cada
   tres «mundos» se ven vacíos mientras está en otra parte.
3. **Un único material para todo.** Hero, About, las tres tarjetas, el Contact y la
   navegación usan el mismo panel de cristal con borde a 60 %, gradiente `muted` y desenfoque.
   Sin contraste entre escenas no hay ritmo y no hay momentos memorables.

Frente al nivel de los Website of the Day recientes (ver `03-referencias.md`), hoy la web
quedaría por debajo del umbral de Special Kudos en **UI**, aproximadamente en ese umbral en
**UX** y por encima solo en **Innovation**, gracias a la ingeniería de Scope. Esto es una
estimación propia, no una predicción del jurado.

---

## 1. Identidad visual

| # | Hallazgo | Tipo |
|---|---|---|
| ID-1 | El nombre del autor no aparece en la página visible. El H1 habla de lo que enseña, no de quién es. | Defecto (verificado: `document.body.innerText` no contiene «Álvaro»/«Alvaro») |
| ID-2 | Paleta de sistema sin marca: todos los tokens base son grises de croma 0 (`oklch(… 0 0)`, la paleta neutra por defecto de shadcn). El único color propio es el de Scope (`--scope-warm`, `--scope-accent`) y se usa en puntos de 4 px. | Defecto de sistema (`src/app/globals.css`) |
| ID-3 | Repertorio genérico: rejilla de 48 px con máscara radial, grano SVG y paneles de cristal. Es el lenguaje por defecto de los portfolios de desarrolladores de 2023–2026 y debilita el reconocimiento inmediato. | Dirección de arte |
| ID-4 | Dos Scopes distintos en la misma página: el 3D (cerámica con iluminación de estudio) y el 2D plano en la tarjeta de Sport Coach (`ScopeStatic`), uno encima del otro al hacer scroll. | Defecto de coherencia (`evidence/desktop-xl-light-projects.jpg`) |
| ID-5 | Discontinuidad de atmósfera: la entrada es azul noche (`--scope-night`, #090d16) y la web es blanca o gris neutro (#0a0a0a en oscuro). La transición más vista de la web pasa de un mundo a otro sin relación. | Defecto de coherencia |
| ID-6 | Mezcla de idiomas: la web está en inglés (`lang="en"`), pero la descripción de Sport Coach y la entrada («Scope está explorando…») están en español, sin `lang` en ese párrafo. | Defecto (contenido + a11y) |
| ID-7 | El selector de tema es el único elemento de interfaz fijo arriba. Una píldora sin etiqueta en una esquina se lee como un adorno, no como una marca. | Dirección de arte |

## 2. Tipografía

Familias en uso: **Geist** (todo), **Newsreader** (solo en el Notebook) y **Geist Mono**
(cargada, pero sin uso visible en la home).

| # | Hallazgo | Tipo |
|---|---|---|
| TY-1 | Jerarquía que se derrumba después del hero: H1 de 72 px y todos los H2 de 24/30 px (`text-2xl sm:text-3xl`), con un salto de 2,4×. Las secciones parecen subtítulos de tarjeta. | Defecto de escala |
| TY-2 | Escala sin sistema: 11 tamaños distintos en la home (12, 12,8, 14, 16, 18, 20, 24, 30, 48, 60 y 72 px). El 12,8 px viene del `Badge`. | Defecto (medido) |
| TY-3 | El mismo eyebrow («— TEXTO EN VERSALES») se repite cuatro veces, idéntico, como única marca de sección. Es un patrón de plantilla. | Dirección de arte |
| TY-4 | El serif del Notebook aparece a 60 px sin haberse presentado antes. Funciona como ruptura, pero el salto de voz no se prepara ni se retoma después. | Dirección de arte |
| TY-5 | Geist Mono está cargada y no se usa, aunque es la voz natural para metadatos (índices, fechas, estados, stack) en una web de ingeniería. | Oportunidad |
| TY-6 | Hero: el H1 ocupa 4 líneas de entre 3 y 4 palabras y la descripción repite «I teach…» justo debajo. Hay tres «teach» en la primera pantalla. | Dirección de arte / copy |
| TY-7 | En móvil, el eyebrow del hero ocupa dos líneas en versales con tracking amplio; se lee peor que el propio H1. | Defecto menor (`evidence/mobile-light-hero.jpg`) |

**Se conservan las tres familias.** Geist es neutra a propósito. El problema no es la
familia, sino que se usa a escala y peso de plantilla. Tiene recorrido suficiente (tracking
negativo en tamaños grandes, Mono para metadatos) y no hay justificación para cambiarla.

## 3. Composición y layout

| # | Sección | Hallazgo | Tipo |
|---|---|---|---|
| CO-1 | Hero | Scope ocupa unos 140 px dentro de un marco cuadrado de unos 512 px. Dos tercios del marco están vacíos y el marco no representa nada; `CONTEXT.md` lo reconoce como deuda («placeholder variant»). | Defecto (`evidence/desktop-xl-light-hero.jpg`) |
| CO-2 | Hero (móvil/tablet) | Scope queda **por debajo del primer pliegue**. La primera pantalla móvil no tiene ningún elemento de identidad. | Defecto (`evidence/mobile-light-hero.jpg`, `tablet-light-hero.jpg`) |
| CO-3 | Proyectos | Las composiciones de cada «mundo» están diseñadas alrededor de un dock que está vacío la mayor parte del tiempo. Tournamently queda como «un arco y una bola», MathView como «unos ejes con un seno», y el tercio derecho está vacío. | Defecto de concepto (`evidence/laptop-light-fullpage.jpg`) |
| CO-4 | MathView | Scope abajo a la izquierda y la gráfica centrada, sin relación espacial: no comparten suelo, escala ni luz. Es exactamente lo que se percibe como «3D pegado sobre una interfaz plana». | Dirección de arte (`evidence/laptop-light-card-mathview.jpg`) |
| CO-5 | Proyectos | Tres tarjetas idénticas, a ancho completo y apiladas, sin imagen real del producto. Hay proyectos reales (Tournamently, Sport Coach) y no se ven. | Dirección de arte / contenido |
| CO-6 | About | Es la sección con más información y la más pequeña; el panel derecho tiene una sola frase visible a la vez. | Dirección de arte |
| CO-7 | Notebook | La intro ocupa un 70vh casi vacío y el workspace es la única sección sin marco. La ruptura de ritmo es intencional, pero no se distingue del resto de cambios bruscos. | Dirección de arte |
| CO-8 | Contact | El papel de la carta tiene casi el mismo valor que el panel (blanco sobre blanco), el botón «Pass it to Scope» es el elemento con menos peso de la sección y la mitad derecha del escritorio está vacía. | Defecto de contraste/jerarquía (`evidence/laptop-light-page-end.jpg`) |
| CO-9 | Contact (móvil) | Scope se monta sobre el borde superior del papel y tapa el clip. | Defecto (`evidence/mobile-light-contact.jpg`) |
| CO-10 | Final de página | No hay pie: la página termina en el panel del formulario, sin firma, enlaces, ©, ni cierre narrativo. | Defecto (`evidence/laptop-light-page-end.jpg`) |
| CO-11 | Navegación móvil | La píldora flotante inferior **tapa texto de lectura** en About y en el índice del Notebook. | Defecto (`evidence/mobile-dark-about.jpg`) |
| CO-12 | Global | Los márgenes son correctos, pero todo está centrado en un contenedor de 1280 px. No hay sangrías, columnas asimétricas ni ningún elemento que salga del contenedor. Es una composición «de documento». | Dirección de arte |

## 4. Color, materiales e iluminación

| # | Hallazgo | Tipo |
|---|---|---|
| MA-1 | **Tres lenguajes visuales conviven.** (a) Scope: cerámica PBR, tone mapping AgX, luz clave cálida de estudio, bloom en los ojos. (b) Interfaz: cristal neutro con desenfoque y bordes de 1 px. (c) Mundos de proyecto: dibujo vectorial de 1,5 px (ejes, arco, seno). Ninguno comparte fuente de luz, sombra ni paleta con los demás. | Defecto de coherencia, causa raíz de la queja sobre MathView |
| MA-2 | Scope se ilumina desde arriba a la izquierda (luz clave del estudio), pero la página no tiene luz direccional: las sombras de las tarjetas son planas y el gradiente es vertical y neutro. | Dirección de arte |
| MA-3 | La sombra de contacto de Scope (VSM sobre un suelo invisible) solo existe con el 3D en vivo; la imagen de respaldo la incluye horneada. Ninguna de las dos «apoya» a Scope sobre una superficie de la interfaz, porque no hay superficie: Scope flota sobre un panel vertical. | Dirección de arte |
| MA-4 | En oscuro, el gris neutro (#0a0a0a) apaga la calidez de la cerámica marfil; la noche azul de la entrada le sienta mucho mejor (ver la propia entrada). | Dirección de arte |
| MA-5 | Los acentos de Scope (`--scope-warm` ámbar, `--scope-accent` violeta) aparecen en puntos de 4–10 px y en el selector de tema. Son la única marca cromática, pero se usan como adorno, no como sistema (estados, foco, selección, datos). | Oportunidad |
| MA-6 | La bola de Tournamently es `#DDFB3A` codificado: el único color fuera del sistema. | Defecto menor (`worlds/tournamently-world.tsx`) |

## 5. Motion design

Inventario (del código):

| Animación | Mecanismo | Duración / física |
|---|---|---|
| Entrada «Scope está explorando…» | Sprite sheets + WAAPI | ≥ 0,6 s + salida ≤ 1,15 s + fundido 0,6 s |
| Entrada del hero | `StaggerGroup` (framer) | `heroStagger*` |
| Revelado de secciones | `Reveal` → `fadeInUp` (24 px, `enter`) | 0,4–0,6 s, **la misma en todos los bloques** |
| Viaje de Scope entre docks | `springs.companion` (55/16/1,6) | ~1,5 s |
| Hover de tarjetas | CSS `translate -1` | 150 ms |
| Spotlight de About | variables CSS en `pointermove` | — |
| Bola de Tournamently | muelles a medida (340/16 y 260/14) | fuera de los tokens |
| Punto de MathView | `useTime`, ciclo de 16 s | lineal |
| Fondo | `background-breathe` 24 s | infinito |
| Cortina de tema | secuencia con Scope | — |
| Navegación lateral | `springs.layout` | — |

| # | Hallazgo | Tipo |
|---|---|---|
| MO-1 | Dos entradas encadenadas: la pantalla de carga se desvanece y **después** el hero vuelve a entrar desde opacidad 0 con stagger. El LCP medido (968 ms en laboratorio) coincide con la retirada de la pantalla y no con la llegada del HTML. La salida del loader debería ser la entrada del hero, no ir antes de ella. | Defecto de continuidad (medido) |
| MO-2 | `fadeInUp` idéntico en cada bloque de cada sección. Es el gesto más genérico de la web y no dice nada distinto en cada sitio. | Dirección de arte |
| MO-3 | El hover `-translate-y-1` de 150 ms en tarjetas de 600 px de alto apenas se percibe y no aporta información. | Dirección de arte |
| MO-4 | Física fuera del sistema: muelles de la bola, ciclo de MathView y `background-breathe` no salen de `src/lib/motion`, en contra de la regla del propio proyecto (CONTEXT §9). | Defecto de sistema |
| MO-5 | Varios movimientos ambientales compiten: el fondo respira, la bola salta cada 2–3,5 s, el punto recorre el seno y Scope tiene su vida autónoma cada 8–20 s. Ninguno se calma cuando el usuario lee. | Dirección de arte |
| MO-6 | **Scope todavía no reacciona al cursor** en 3D (la capa Presence del 2D no está portada; `SCOPE_3D_ANIMATION.md` §4 «Pendiente»). Es la ausencia que más se nota en escritorio: el personaje no percibe al visitante. | Defecto funcional (ver la solución técnica en `06-plan-tecnico.md`) |
| MO-7 | La navegación por secciones hace scroll, pero no hay transición de escena: el cambio de sección es solo desplazamiento. | Dirección de arte |

## 6. Experiencia de usuario

| # | Hallazgo | Tipo |
|---|---|---|
| UX-1 | Cinco enlaces `href="#"` con aspecto de CTA («Live site», «GitHub») en las tarjetas de proyecto. No hacen nada. Es el defecto de credibilidad más grave para un jurado. | Defecto (verificado en el DOM) |
| UX-2 | No hay landmarks: ni `<main>`, ni `<header>`, ni `<footer>`; solo hay un `<nav>`. Los lectores de pantalla no pueden saltar al contenido. | Defecto a11y (verificado) |
| UX-3 | No existe un enlace «saltar al contenido». | Defecto a11y |
| UX-4 | About activa pestañas con `onMouseEnter`: al cruzar la lista con el ratón cambia el contenido sin intención y Scope «reconoce» cada paso. | Defecto de interacción (`about-workbench.tsx`) |
| UX-5 | La navegación de escritorio solo aparece después del hero, sin etiquetas visibles hasta el hover. No hay forma de saber qué contiene la web desde la primera pantalla. | Dirección de UX |
| UX-6 | Los proyectos no enlazan a ningún detalle (case study). El recorrido termina en la tarjeta. | Contenido / arquitectura |
| UX-7 | La entrada solo se muestra en `/` y una vez por carga. Correcto. Aun así, cada recarga muestra la pantalla al menos ~1 s, incluso cuando el usuario ya la ha visto en la sesión. | Decisión a revisar |
| UX-8 | El foco es visible en todos los elementos tabulables (anillo `ring/50`) y el orden de tabulación es lógico. | Correcto (verificado) |

## 7. Calidad técnica y rendimiento

Medido en el build de producción local, sin limitar la red ni la CPU, en este equipo sin GPU
(es decir, en la ruta de respaldo).

| Métrica | Escritorio 1366 | Móvil 390 @2× | Nota |
|---|---|---|---|
| FCP | 124 ms | 156 ms | pantalla de entrada (SSR) |
| LCP | 968 ms (H1) | 1008 ms (H1) | ligado a la retirada de la entrada + el stagger del hero (MO-1) |
| CLS | 0,017 | 0 | dos desplazamientos en el contenedor y el selector de tema, a 229 ms y a 990 ms (bloqueo/desbloqueo del scroll y el gutter) |
| Peticiones | 26 | 26 | |
| Transferido | 1,50 MB | 1,50 MB | |
| JS transferido | 426 KB | 426 KB | incluye three.js (chunk de 150 KB) |
| Hojas del loader | 532 KB (AVIF) | 532 KB | se descargan en cada carga de `/` |
| GLB | 356 KB | 356 KB | **se descarga también cuando se usa la imagen de respaldo** |
| favicon.ico | 62 KB | 62 KB | sobredimensionado |
| Fuentes | 100 KB (woff2) | 100 KB | |
| Retirada de la entrada | 995 ms | 1045 ms | ruta de respaldo |

**No medido (requiere un entorno real):** el LCP, INP y CLS de campo (CrUX / Vercel Speed
Insights), el tiempo hasta el primer fotograma 3D con GPU real, el coste por fotograma del
render en dispositivos de gama media y baja, y la memoria con WebGL activo. **No invento estas
cifras.**

| # | Hallazgo | Tipo |
|---|---|---|
| PE-1 | Con GPU, el LCP quedará **detrás de la disponibilidad del 3D** (primer fotograma + salida de hasta ~1,15 s + fundido 0,6 s). Es un riesgo estructural de Core Web Vitals que debe medirse en campo antes de dar el diseño por cerrado. | Riesgo |
| PE-2 | El GLB se precarga y se descarga aunque el dispositivo vaya a usar la imagen de respaldo (sin WebGL o con software). | Defecto menor de eficiencia |
| PE-3 | 1,5 MB y 26 peticiones para una página de texto con un personaje; casi la mitad son la entrada (532 KB) y el GLB (356 KB). | Coste aceptable para la propuesta, pero cada dirección nueva debe ajustarse a un presupuesto |
| PE-4 | CLS 0,017: bueno (< 0,1), pero no es cero y tiene causa conocida (el gutter de la barra de scroll). | Defecto menor |
| PE-5 | three.js escribe 2 errores en la consola cuando rechaza el contexto. Para un jurado que abra las DevTools da mala impresión. | Defecto menor |
| PE-6 | Degradación: la ruta de respaldo funciona y es rápida (~1 s). Correcto y muy superior al «Your browser is not supported» de una de las referencias (ver `03-referencias.md`). | Correcto |
