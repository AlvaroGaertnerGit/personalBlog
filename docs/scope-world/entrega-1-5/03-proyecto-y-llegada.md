# Entregables C y D: un proyecto descubierto y los primeros segundos

## C. MathView dentro del círculo de la lámpara

**Qué es en el mundo.** Una gráfica cocida, una función hecha porcelana celadón sobre la que se
puede estar de pie. Lleva su cuadrícula grabada en el esmalte, ejes de porcelana con marcas y una
tarjeta de papel junto a la esquina donde está escrito su nombre. El texto real del proyecto es
«A place to actually see the math, not just read it», y ese es el principio de diseño: **la
gráfica no se ilustra, se pisa**.

**Activación (obedece la ley de la luz).** Al abrir el proyecto, la luz de la lámpara recorre
las **curvas de nivel** de la superficie y se encienden en ámbar. Antes se veía un objeto; ahora
se ven sus matemáticas. Scope, de pie encima, baja la mirada a las líneas.

| Paso | Imagen | Qué ocurre |
|---|---|---|
| Ubicación | `c1-place` | El círculo desde el este, con MathView, el bracket de Tournamently, la esfera de Sport Coach y el anillo tostado. Scope entra por la puerta del círculo |
| De cerca | `c2-close` | Scope sobre la gráfica; ejes y cuadrícula; la esfera de Sport Coach en primer término |
| Activación | `c3-active` | **La misma cámara**: las curvas de nivel encendidas. Es la transformación del antes y el después |
| Contenido | `c4-content-ui` (`board/mathview.html?state=content`) | De la tarjeta se despliega una **hoja del pliego** (papel pautado con su margen bermellón) con el contenido real |
| Regreso | `c5-return-ui` (`?state=return`) | `Esc` o «Back to the light»: la hoja se pliega y la cámara sube al círculo. Una marca dice «you were here». La ruta sigue en «The light» |

**Contenido real usado** (`projects-content.ts`):
- el nombre;
- la descripción completa;
- el stack: Angular, Python, Matlab. El propio archivo dice que **está sin confirmar**, así que
  habría que validarlo antes de publicarlo;
- los enlaces, que en el código siguen siendo `#`. Por eso la composición los muestra como «link
  pending» en lugar de inventar URLs.

**El mismo lenguaje para los otros proyectos.** Cada pieza se activa según su propia naturaleza:
- **Tournamently**, un bracket de pádel convertido en arquitectura: al activarse, la luz sube
  ronda a ronda hasta la final.
- **Sport Coach**, una esfera de rotación con los colores de la cara de Scope (es su identidad):
  al activarse, la aguja recorre la rotación.

Los tres comparten porcelana, círculo y hoja desplegable. Los diseño en detalle en la Entrega 2
si apruebas este lenguaje.

## D. Los primeros segundos (animatic)

`board/animatic.html` encadena los fotogramas con los tiempos reales y la interfaz encima. Los
fotogramas sueltos están en `renders/d-frame0…3-ui.jpg`.

| t | Imagen | Mundo | Interfaz |
|---|---|---|---|
| 0,0 s | `d2-lampon` | **Es el loader**: la home de noche, con la misma cámara. Scope lee el margen con la luz de sus ojos (lo que estaba haciendo antes de que llegaras) | Ya está toda: nombre, navegación y «Walk in», en marfil. **El contenido está disponible desde el primer instante** |
| ≈ 0,9 s (al estar la escena lista) | `d3-home` | Se enciende la lámpara (fundido de luz, sin corte). Scope **levanta la mirada hacia ti**: así detecta tu presencia | El texto pasa a tinta sobre el papel |
| ≈ 3 s | `d4-invite` | Lo que se mueve en el mundo: la hoja «· · ·», la pregunta sin escribir, se levanta un poco más. Scope la mira de reojo | «Walk in» emite un único pulso ámbar: la invitación |
| Sin interacción (≈ 12 s) | (descrito, sin render) | Scope vuelve a lo suyo: leer el margen y luego su rutina (ver `04-comportamiento.md`) | Sin cambios; ningún aviso insistente |
| Primer scroll | `a2-inside` | La cámara sigue el pliegue largo y entra en el campo de preguntas | Aparece «Open notebook.» y la ruta pasa a «Questions» |

**Reglas:**
- Nada bloquea la lectura.
- La transición noche → lámpara solo ocurre una vez por sesión.
- Con movimiento reducido se muestra directamente el estado iluminado.
- Si no hay GPU, los fotogramas se sirven prerenderizados (son estos).
