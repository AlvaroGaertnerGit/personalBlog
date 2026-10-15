# Entregable B: Scope abre una pregunta

Scope no tiene manos, así que usa lo único que tiene: el cuerpo, la cara y la curiosidad. **Mete
la cara entre las páginas** de una pregunta cerrada y la abre. Dentro se levantan las notas
reales y el hilo rojo tira de la pregunta relacionada.

## 1. Por qué esta acción

- **Motivación:** la tapa de «When should one AI agent become two?» se curva un poco con la luz.
  Es un cambio físico pequeño, y Scope es curiosidad hecha forma.
- **Personalidad:** no rompe nada ni lo explica. Se asoma, empuja con suavidad y mira. Después
  vuelve a lo suyo o sigue el hilo.
- **Reglas del mundo:** el papel reacciona a la luz. El libro se abre por el lomo, sin cortes
  nuevos, y lo de dentro ya estaba plegado.
- **Contenido:** abre una línea real del cuaderno (hipótesis, suposición fallida y siguiente
  experimento de `ai-agents`). El hilo rojo la une con `mcp-ecosystem`, como en `relatedIds`.
- **Web:** es la misma acción que puede hacer el visitante al pulsar o enfocar la pregunta. Si
  la hace el visitante, Scope llega después a mirar. Si no, la hace Scope.

## 2. Storyboard

Hay tres cámaras. La amplia, alta y en tres cuartos desde el suroeste, se usa en los fotogramas
1, 2, 5 y 6. El fotograma 3 es un plano de inserto junto a la tapa, y el 4 se rueda desde dentro
del libro. Objetos y posiciones no cambian entre fotogramas: en el 6 el libro abierto sigue
exactamente donde estaba en el 1.

| # | Fotograma | Qué pasa | Pose | Estado |
|---|---|---|---|---|
| 1 | `b1-rest` | Scope descansa sobre «Local Models», tumbada porque está *Paused*. El libro de los agentes está cerrado | Pose sostenida: ojos bajos (`eye_h` 0,88), ligero cabeceo y aplastamiento | Canales existentes, dentro de los rangos |
| 2 | `b2-notice` | La tapa se curva un poco. Scope gira la mirada hacia ella | `Focus.L` t = 1,0 s | **Clip existente** |
| 3 | `b3-approach` | Ya junto a la tapa, se inclina y la antena se adelanta | `Focus.R` t = 1,3 s | **Clip existente**; el desplazamiento del banco a la tapa no está animado |
| 4 | `b4-push` | Mete la cara entre las páginas, que se entreabren 45° | `pitch` 8°, `fwd` 3,6 mm, `ant_pitch` 9°, `squash` 0,97 | **Pose experimental**: el `pitch` supera los 5° que alcanza Focus |
| 5 | `b5-open` | El libro se abre a 150°: se levantan las capas. El hilo hacia «MCP» se tensa y esa pregunta se entreabre | `Bounce` t = 0,47 s (ápice del salto) | **Clip existente** |
| 6 | `b6-follow` | Scope se asoma por el lado y lee. Luego levanta la mirada hacia la pregunta relacionada | Pose sostenida: mirada arriba y al lado | Canales dentro de los rangos de Presence |

## 3. Autonomía e intervención del visitante

| Situación | Qué hace Scope |
|---|---|
| Nadie interviene | Completa la secuencia él solo, como mucho una vez cada pocos minutos y solo con preguntas que aún no estén abiertas |
| El visitante abre él mismo la pregunta antes | Scope interrumpe el acercamiento, se para, ladea la cabeza (`Tilt`) y llega a mirar cuando el libro ya está abierto. No repite la acción |
| El visitante está leyendo (scroll quieto o foco en un texto) | No empieza la secuencia: espera a que no haya lectura activa |
| El visitante pulsa sobre Scope | Reacción al clic existente (`ClickReaction`) y vuelta a la actividad en curso |

## 4. Lo que existe, lo experimental y lo que falta

| Pieza | Estado |
|---|---|
| Mirar, inclinarse, botar y ladear la cabeza | **Existe** (clips aprobados) |
| Pose de empuje (fotograma 4) | **Experimental**: solo en memoria en `mundo.py`, nunca guardada en el `.blend` |
| Desplazamiento banco → tapa → lateral del libro | **No existe**. Sería traslación del `root` con saltitos de Bounce encadenados, a validar |
| Clip «Nudge» (empujar con la cara y sostener) | **Clip nuevo**, con anticipación, contacto, sostén y retirada |
| Apertura del libro (páginas y capas) | **Animación nueva del objeto**: rotación de dos páginas y el progreso de las capas, ligado al ángulo de apertura |
| Sincronía Scope ↔ libro | Necesaria: el ángulo de las páginas sigue al `fwd` y al `pitch` de Nudge durante el contacto. Después el libro termina de abrirse solo, con su propio muelle |
| Hilo que se tensa y la pregunta relacionada que se entreabre | Animación del objeto disparada por el evento «abierto». Es independiente de Scope |
| Curvatura de la tapa (el aviso) | Deformación del objeto (shape key o shader). Aquí está incorporada a la malla |

**Qué es demostración y qué podría funcionar de verdad.** Los seis fotogramas son imágenes
fijas. Lo que podría ejecutarse con lo que ya existe es la mirada, los clips y la apertura del
libro como animación del objeto. El empuje y el desplazamiento necesitan clips nuevos. **Nada de
esto está implementado.**
