# B. Mapa de discrepancias

Tabla priorizada. Los IDs remiten a `01-auditoria.md`. **Gravedad:** Crítico (bloquea
presentarla a un premio o rompe la confianza) · Alto (degrada claramente la calidad
percibida) · Medio · Bajo. **Tipo:** D = defecto verificado · A = valoración de dirección de
arte. **Riesgo:** riesgo técnico de la corrección.

## Los diez problemas que más perjudican la calidad

| # | ID | Problema | Por qué importa |
|---|---|---|---|
| 1 | ID-1 | El nombre del autor no aparece en la página | Un portfolio sin autor visible no cumple su función básica, y el jurado lo nota en los primeros 3 s |
| 2 | UX-1 | Cinco enlaces `#` con aspecto de CTA | Rompe la credibilidad y parece una web sin terminar; CSSDA exige que el sitio esté «complete» |
| 3 | MA-1 / CO-4 | Tres lenguajes visuales sin luz común (cerámica PBR, cristal neutro, vector de 1,5 px) | Es la causa raíz de que Scope parezca «pegado» |
| 4 | CO-1 / CO-2 | Hero: Scope pequeño en una caja vacía; en móvil, debajo del pliegue | El primer encuentro con el elemento más distintivo es débil o no ocurre |
| 5 | CO-3 | Los mundos de proyecto están vacíos mientras Scope está en otro dock | Dos de cada tres composiciones parecen incompletas |
| 6 | ID-2 / ID-3 | Paleta gris de croma 0 + rejilla, grano y cristal de plantilla | No hay reconocimiento inmediato; parece «otro portfolio Next.js» |
| 7 | MO-6 | Scope 3D no percibe el cursor | El personaje parece un vídeo en bucle y no un ser que observa, que es su razón de ser |
| 8 | TY-1 / TY-2 | La jerarquía se derrumba después del hero; 11 tamaños sin escala | Las secciones no tienen peso; la lectura es plana |
| 9 | CO-10 / UX-2 | Sin pie, sin landmarks y sin cierre | Final abrupto, y fallo de a11y que cualquier auditoría automática detecta |
| 10 | ID-5 / MO-1 | La entrada azul noche y el sitio blanco o gris no se conectan; dos entradas encadenadas | La transición más vista de la web es un corte en lugar de una continuidad |

## Inventario completo

| ID | Gravedad | Tipo | Ubicación | Evidencia | Solución recomendada | Impacto | Riesgo |
|---|---|---|---|---|---|---|---|
| ID-1 | Crítico | D | `src/app/page.tsx` (hero) | `evidence/desktop-xl-light-hero.jpg`; DOM | Firma visible: nombre como marca en la cabecera + presentación en el hero | Muy alto | Bajo |
| UX-1 | Crítico | D | `sections/projects-content.ts` | DOM: 5 × `a[href="#"]` | URLs reales u ocultar el enlace (renderizar solo `href !== "#"`) | Muy alto | Bajo |
| MA-1 | Alto | A | Scope × interfaz × mundos | `evidence/laptop-light-card-mathview.jpg` | Una sola luz y un solo material para toda la web (ver direcciones) | Muy alto | Medio |
| CO-1 | Alto | D | `hero/hero.tsx` `HeroMedia` | `evidence/desktop-xl-light-hero.jpg` | Eliminar el marco; Scope a escala de protagonista sobre una superficie | Alto | Bajo |
| CO-2 | Alto | D | Hero móvil/tablet | `evidence/mobile-light-hero.jpg` | Scope dentro del primer viewport en todos los tamaños | Alto | Bajo |
| CO-3 | Alto | A | `sections/worlds/*` | `evidence/laptop-light-fullpage.jpg` | Composiciones que funcionen sin Scope y que «le esperen» (luz, huella, objeto observado) | Alto | Medio |
| ID-4 | Alto | D | `worlds/sport-coach-world.tsx` | `evidence/desktop-xl-light-projects.jpg` | Sustituir por la captura real del producto o por el render 3D de Scope | Alto | Bajo |
| ID-2 | Alto | D | `globals.css` | tokens `oklch(… 0 0)` | Paleta propia derivada de Scope (marfil, noche, ámbar) | Alto | Bajo |
| ID-3 | Alto | A | `layout/background.tsx`, paneles | todas las capturas | Retirar rejilla, grano y cristal como lenguaje por defecto | Alto | Bajo |
| MO-6 | Alto | D | `scope-3d/engine` | `SCOPE_3D_ANIMATION.md` §4 | Capa Presence 3D (diseño en `06-plan-tecnico.md`) | Alto | Medio |
| TY-1 | Alto | D | H2 de las secciones | capturas | Escala tipográfica con H2 de 48–96 px y un sistema modular | Alto | Bajo |
| CO-10 | Alto | D | `page.tsx` | `evidence/laptop-light-page-end.jpg` | Pie con firma, enlaces, idioma y el cierre de Scope | Medio-alto | Bajo |
| UX-2 | Alto | D | `layout.tsx`, `page.tsx` | DOM: solo `NAV` | `<header>`, `<main id="content">`, `<footer>`, enlace «saltar al contenido» | Medio-alto | Bajo |
| ID-5 | Alto | A | entrada ↔ sitio | tokens | La noche de la entrada es la atmósfera de la web (o el hero «amanece» desde ella) | Alto | Medio |
| MO-1 | Alto | D | entrada + `StaggerGroup` | LCP 968 ms = retirada de la entrada | La salida de la entrada es la entrada del hero: el hero ya está visible debajo | Alto | Medio |
| CO-11 | Alto | D | `section-navigator-mobile.tsx` | `evidence/mobile-dark-about.jpg` | Barra inferior con fondo y reserva de espacio, o navegación en la cabecera | Medio | Bajo |
| CO-5 | Medio | A | proyectos | capturas | Imagen o vídeo real de cada producto; composición editorial no repetitiva | Alto | Bajo |
| CO-8 | Medio | D | `contact-desk.tsx` | `evidence/laptop-light-page-end.jpg` | Contraste papel/mesa, CTA principal con peso y uso del espacio vacío | Medio | Bajo |
| CO-9 | Medio | D | Contact móvil | `evidence/mobile-light-contact.jpg` | Dock de contact fuera del área del papel en móvil | Medio | Bajo |
| TY-2 | Medio | D | global | 11 tamaños medidos | Escala modular de 6–7 pasos con tokens | Medio | Bajo |
| TY-3 | Medio | A | eyebrows | capturas | Índice de sección en Geist Mono («01 / About»), no un eyebrow repetido | Medio | Bajo |
| TY-5 | Medio | A | — | — | Geist Mono como voz de metadatos | Medio | Bajo |
| MO-2 | Medio | A | `Reveal` | código | Revelados específicos por escena; menos revelados en total | Medio | Bajo |
| MO-4 | Medio | D | worlds, `globals.css` | código | Pasar los muelles y ciclos a `src/lib/motion` | Bajo | Bajo |
| MO-5 | Medio | A | ambientales | código | Presupuesto de movimiento: un solo movimiento ambiental por escena; pausar fuera de la vista | Medio | Bajo |
| ID-6 | Medio | D | Sport Coach, entrada | DOM | Decidir el idioma (EN + ES con `lang`) y aplicarlo a todo | Medio | Bajo |
| UX-3 | Medio | D | layout | DOM | Enlace «saltar al contenido» | Medio | Bajo |
| UX-4 | Medio | D | `about-workbench.tsx` | código | Activar con clic, foco o flechas; el hover solo previsualiza | Medio | Bajo |
| UX-6 | Medio | A | proyectos | — | Páginas de caso (Sprint 5 de la hoja de ruta) | Alto | Medio |
| PE-1 | Medio | Riesgo | entrada | — | Medición de campo; LCP independiente del 3D (ver MO-1) | Alto | Medio |
| MA-2 | Medio | A | global | — | Luz direccional común (dirección de la luz clave de Scope) | Medio | Bajo |
| MA-3 | Medio | A | docks | — | Superficies reales donde Scope apoya (sombra de contacto) | Medio | Medio |
| MA-4 | Medio | A | modo oscuro | `evidence/*-dark-*.jpg` | Oscuro = noche azul de Scope, no gris neutro | Medio | Bajo |
| CO-4 | Medio | A | MathView | `evidence/laptop-light-card-mathview.jpg` | Scope y la curva en el mismo plano, con escala y luz compartidas | Alto | Medio |
| CO-6 | Medio | A | About | capturas | Más contenido visible; no esconder la biografía tras pestañas | Medio | Bajo |
| CO-7 | Medio | A | Notebook | `evidence/laptop-light-notebook.jpg` | Mantener la ruptura, pero diseñada como cambio de escena | Medio | Bajo |
| CO-12 | Medio | A | global | capturas | Rejilla editorial asimétrica con elementos que rompan el contenedor | Medio | Bajo |
| TY-4 | Bajo | A | Notebook | — | Presentar Newsreader antes (citas) para que el Notebook sea un clímax | Bajo | Bajo |
| TY-6 | Bajo | A | hero | — | Reescritura del copy (nombre + qué hace + prueba) | Medio | Bajo |
| TY-7 | Bajo | D | hero móvil | `evidence/mobile-light-hero.jpg` | Eyebrow más corto en móvil | Bajo | Bajo |
| MA-5 | Bajo | A | acentos | — | Sistema de acentos (foco, selección, estado, datos) | Medio | Bajo |
| MA-6 | Bajo | D | Tournamently | código | Token para la bola o un color del sistema | Bajo | Bajo |
| ID-7 | Bajo | A | selector de tema | capturas | Integrarlo en la cabecera, junto a la firma | Bajo | Bajo |
| MO-3 | Bajo | A | `project-card.tsx` | código | Hover con información (vista previa, cursor contextual) o ninguno | Bajo | Bajo |
| MO-7 | Bajo | A | navegación | — | Transiciones de escena al saltar de sección | Medio | Medio |
| UX-5 | Bajo | A | navegación escritorio | — | Índice visible desde el hero | Medio | Bajo |
| UX-7 | Bajo | A | entrada | — | Versión corta de la entrada si ya se vio en la sesión | Bajo | Bajo |
| PE-2 | Bajo | D | `scope-entry-screen.tsx` (preload) | Resource Timing | Precargar el GLB solo si hay WebGL por hardware | Bajo | Bajo |
| PE-4 | Bajo | D | entrada | CLS 0,017 | Revisar el gutter en el bloqueo de scroll | Bajo | Bajo |
| PE-5 | Bajo | D | viewer | consola | Comprobar WebGL antes de crear el renderer | Bajo | Bajo |
| PE-3 | Bajo | — | global | 1,5 MB | Presupuesto por dirección (ver plan) | Medio | — |
| favicon | Bajo | D | `src/app/favicon.ico` | 62 KB | ICO de 32/16 px + SVG | Bajo | Bajo |
