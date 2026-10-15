# Entregable E: sistema de comportamiento de Scope

El principio es **más vida, no más ruido**. Scope pasa la mayor parte del tiempo en pausa o
mirando. Las actividades son raras, tienen motivo y casi siempre se pueden interrumpir.

## 1. Capas, de más a menos prioritaria

| Capa | Qué la dispara | Ejemplo |
|---|---|---|
| **Reacción** | Clic sobre Scope o un evento fuerte del mundo | `ClickReaction`, que ya existe |
| **Atención al visitante** | Llegada, cursor cerca, foco del teclado, el visitante abre algo | Levantar la mirada; ir a mirar lo que abriste (capa Presence, ya diseñada) |
| **Actividad** | Un estímulo del mundo y tiempo sin interacción | Las tres actividades de §2 |
| **Reposo** | Siempre | Respiración (`Idle`), parpadeos y deriva de postura, que ya existen |

**Atención contextual:**
- Si el visitante está leyendo (scroll quieto, foco en texto o selección), Scope no inicia
  actividades y baja la frecuencia de miradas.
- Si se mueve el cursor, Scope lo percibe, pero no lo sigue todo el rato: mira, vuelve y lo
  revisa de vez en cuando.
- Si no pasa nada durante 8–15 s, retoma lo que estaba haciendo. Es el mismo intervalo que
  VISUAL_LANGUAGE.md propone para los gestos en reposo.

**Interrupción y recuperación:** toda actividad guarda su paso. Si una reacción la interrumpe,
Scope vuelve al punto anterior estable, nunca a mitad de un contacto.

## 2. Las tres actividades

| | Frecuente: **leer la pauta** | Exploración: **seguir el hilo** | Especial: **abrir una pregunta** |
|---|---|---|---|
| Qué es | Inclinarse sobre las líneas del papel cerca de donde está, parpadear y avanzar unos centímetros | Ir de una pregunta a otra relacionada siguiendo el hilo rojo, detenerse bajo una etiqueta y mirarla | La secuencia del Entregable B: la tapa se curva, Scope se acerca, la empuja y se abren las capas |
| Disparador | Reposo de más de 8 s | Un hilo con etiquetas a la vista y más de 30 s sin interacción | Una tapa curvada (estímulo programado) y que esa pregunta no esté abierta |
| Frecuencia | Habitual, con variación | Ocasional | Como mucho una vez cada pocos minutos; nunca dos seguidas |
| Consecuencia | Ninguna. Es carácter | La cámara no se mueve; quien mire ve a Scope en otro sitio | **Visible y duradera**: la pregunta queda abierta durante la visita |
| Clips existentes | `Focus`, `BlinkDouble`, `Idle` | `LookAround`, `Tilt`, `Focus` | `Focus`, `Bounce`, `Tilt` |
| Clips nuevos | Ninguno | Desplazamiento a saltitos (Bounce encadenado + traslación del root), a validar | «Nudge» (empujar con la cara) + desplazamiento |
| Objetos | Nada | Etiquetas que se balancean al pasar (física simple) | Apertura del libro, capas, hilo tenso y pregunta relacionada entreabierta |

**Otras actividades posibles, dentro de las mismas reglas:**
- subir al mirador para mirar la lámpara;
- acercarse al borde tostado sin cruzarlo;
- descansar en el banco de *Paused*;
- por la noche, recorrer el margen con la luz de sus ojos (el loader).

## 3. Necesidades técnicas

| Necesidad | Detalle |
|---|---|
| Planificador | Ampliar `scope-3d-behavior.ts`, que ya tiene pesos e intervalos, con actividades de varios pasos (máquina de estados por actividad) y con «lugares» del mundo como objetivos |
| Navegación | Un grafo de puntos sobre el pliego (márgenes, bordes, el banco, el mirador). Sin pathfinding general: rutas precalculadas por el pliegue largo |
| Locomoción | Saltitos: Bounce encadenado + traslación del root. Hay que validar el contacto de los pies y la velocidad. Es la pieza nueva más importante |
| Clips nuevos | Nudge, LookUp, Rest (ojos cerrados sostenidos) y Plant (agacharse y retroceder). Todos se crearían en una copia del `.blend` y se validarían contra `approved-geometry.json` como los actuales |
| Objetos animados | El libro (páginas y capas), las etiquetas y el hilo, exportados como GLB con su propio esqueleto o con animación procedural en el cliente |
| Sincronía | Eventos de contacto en los clips (marcadores, como `release` en `Focus`) que disparan la animación del objeto |
| Movimiento reducido | Sin desplazamientos: las actividades se sustituyen por cambios de estado instantáneos con fundido. Scope solo respira y parpadea |
