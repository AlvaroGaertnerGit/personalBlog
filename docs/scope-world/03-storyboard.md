# Storyboard del recorrido principal y capacidades del rig

Son 9 fotogramas de un mismo día y un mismo pliego, cada uno consecuencia del anterior. Están
renderizados en Blender (Cycles por CPU, headless) con el **modelo aprobado sin modificar**,
abierto en solo lectura. Scope solo se coloca (transformación del rig) y se posa con los canales
aprobados de `scope3d/clips.py`.

## 1. Los fotogramas

| # | Archivo | Hora | Qué pasa | Qué cambia en el mundo | Contenido | Pose de Scope |
|---|---|---|---|---|---|---|
| 1 | `sb1-night` | Noche | Scope recorre el margen y lee la pauta con la luz de sus ojos | Solo hay luz de ojos y de luna | Entrada (el loader) | `Focus.L` t = 1,3 s (clip existente) |
| 2 | `sb2-lamp` | Amanecer | La lámpara se enciende al fondo; Scope levanta la mirada hacia ella | Llega el día de trabajo | Home: el nombre | Pose sostenida: mirar arriba (−4° y ojos +1,8 mm) |
| 3 | `sb3-question` | Mañana | Bajo el arco, Scope se inclina ante «How much context is actually enough?» | La hoja se lee a contraluz | Cuaderno (pregunta real) | `Focus.L` t = 1,3 s |
| 4 | `sb4-folding` | Día | Una hoja que maduró se ha plegado en una caja con la tapa abierta; Scope ladea la cabeza | Una pregunta se convierte en forma | Transición pregunta → proyecto | `Tilt.L` t = 0,8 s (pico) |
| 5 | `sb5-firing` | Día | La caja ha llegado al borde del círculo: la línea tostada la cruza | Una mitad es papel y la otra se cuece | La regla del mundo | `Focus.R` t = 1,3 s |
| 6 | `sb6-pieces` | Día | Scope está de pie sobre la porcelana de MathView y mira el bracket de Tournamently | Todo lo construido, vidriado | Proyectos | Pose sostenida (inclinarse y mirar, dentro de rangos) |
| 7 | `sb7-class` | Atardecer | En el aula, Scope ladea la cabeza ante una pieza torcida | La luz se vuelve naranja | Docencia | `Tilt.R` t = 0,8 s |
| 8 | `sb8-note` | Noche de lámpara | Al pie de la lámpara hay una nota en blanco plegada y el lápiz; Scope la observa | Solo queda la lámpara | Contacto (formulario real) | `Focus.R` t = 1,3 s |
| 9 | `sb9-planted` | Noche | La nota está plantada en el campo y Scope la ilumina con los ojos | La lámpara se apaga; hay una pregunta nueva | Final y continuidad | Pose sostenida (mirada baja, ojos algo cerrados) |

Las **poses sostenidas** combinan los canales aprobados (yaw, pitch, mirada, altura de ojos,
antena) con valores dentro de los rangos ya diseñados para la capa Presence:
- `look` hasta ±10° de giro y ±8° de cabeceo;
- ojos hasta ±4,5 mm (`docs/scope-docs/SCOPE_3D_ANIMATION.md`).

No son clips existentes: en el sitio requerirían la capa Presence o un clip nuevo (§2).

**Ayudas de luz declaradas.** Ninguna altera el aspecto de Scope:
- En los planos nocturnos, un foco ámbar delante de la cara representa el alcance de la luz de
  los ojos sobre el papel. Usa light linking para no iluminar a Scope.
- Una tarjeta de rebote suave hace de luz que devuelve el papel.

## 2. Capacidades del rig frente a lo que pide el mundo

| Acción del mundo | Estado | Cómo |
|---|---|---|
| Mirar, inclinarse, ladear la cabeza, parpadear, botar, estirarse, reír (clic) | **Existe** | 12 clips aprobados: Idle, LookAround L/R, Tilt L/R, Bounce, BlinkDouble, Focus L/R, Stretch, Laugh, ClickReaction |
| Leer una hoja | **Existe** | Focus + mirada dirigida; la «luz de lectura» es iluminación de escena, no del rig |
| Seguir algo con la mirada (una hoja que se pliega, el visitante) | **Combinación posible** | Capa Presence sobre los huesos `look` y `eye.L/R` (diseñada en la fase 1, sin implementar) |
| Mirar arriba hacia la lámpara | **Pose posible / clip nuevo** | Canales `pitch` y `eye_dz` dentro de los rangos; falta un clip «LookUp» con anticipación |
| Desplazarse por el pliego | **Combinación posible, a validar** | Traslación del `root` + Bounce encadenado (saltitos), como el viaje del companion en 2D. Hay que validar el contacto de los pies en pendiente |
| Descansar o «dormir» en su recorte | **Clip nuevo** | El canal `blink` y el aplastamiento existen; falta un clip con respiración lenta y ojos cerrados sostenidos |
| Empujar una hoja con el cuerpo | **Clip nuevo + sincronía** | `fwd` solo avanza unos 3,6 mm; hace falta un «Nudge» y sincronizarlo con la animación de la hoja |
| Llevar la nota | **Clip nuevo + acople** | Sin brazos, la nota viaja sobre la cabeza o el lomo: clip de equilibrio y acople al hueso `body` |
| Plantar la nota | **Clip nuevo + objeto animado** | Se agacha (pitch), la nota se despliega de pie y Scope retrocede |
| Pisar superficies curvas (MathView) | **Limitación** | Los pies no se adaptan a la pendiente; Scope solo puede pararse en zonas casi planas. Validado en el render, en una cresta suave |

Nada de esta tabla se presenta como hecho: lo marcado como «clip nuevo» no existe, y los
renders muestran poses fijas, no animación. El diseño del sistema de comportamiento es de la
Entrega 2.
