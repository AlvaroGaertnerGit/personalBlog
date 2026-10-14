# D. Tres direcciones artísticas

Las tres parten de la misma base no negociable:

- El modelo 3D aprobado, sin tocarlo.
- Geist, Geist Mono y Newsreader.
- El contenido y los proyectos.
- Una sola instancia de Scope.
- La pantalla de entrada.
- La degradación a la imagen prerenderizada.
- Accesibilidad completa.

Las tres corrigen además los defectos verificados del mapa (nombre visible, enlaces reales,
landmarks, pie, navegación móvil, jerarquía tipográfica). Lo que cambia entre ellas es
**qué es la web**.

Material visual comparativo: `mockups/index.html` (composiciones esquemáticas en HTML,
identificadas como tales, con los renders reales de Scope) y sus capturas en
`mockups/renders/`.

---

## Dirección A — «Margen» (evolución editorial)

**Concepto.** La web como una publicación técnica bien compuesta. Scope es **el lector del
margen**: ocupa la columna de las notas, como alguien que lee a tu lado, y mira lo que tú lees.

**Idea narrativa.** «Lo que enseño, lo que construyo y lo que todavía no sé», contado como una
monografía en cinco capítulos. La línea de exploración de la entrada **se convierte en la
regla del hero sobre la que Scope aterriza**: la entrada termina donde empieza la web, sin
corte.

**Personalidad visual.** Papel marfil (el color de la carcasa de Scope llevado a la página),
tinta casi negra cálida, un único acento ámbar (sus ojos), reglas finas de 1 px como única
estructura. Nada de cristal, rejilla ni grano.

**Tratamiento de Scope.**

- Escala constante (unos 120 px) en la columna de margen.
- Siempre **sentado sobre una regla** (la regla actúa de suelo, con su sombra de contacto
  proyectada sobre el papel).
- Viaja de capítulo en capítulo, siempre por el margen, con el muelle `companion` actual.
- Mira al cursor y, sin cursor, mira el párrafo que está en pantalla.

**Sistema de composición.**

- Rejilla editorial de 12 columnas, asimétrica: columna de margen de 2 columnas (Scope,
  índices y notas) y columna de texto de 7.
- Las imágenes de proyecto rompen a sangre por la derecha.
- Titulares a escala de cartel (clamp de 56 a 160 px) con tracking negativo.
- Índices en Geist Mono («01 — Quién», «02 — Trabajo»).
- Citas en Newsreader cursiva.

**Fondos.** Papel liso con una viñeta cálida mínima en la dirección de la luz clave de Scope
(arriba a la izquierda). El oscuro es **la noche azul de la entrada** (`#090d16`), no gris
neutro.

**Movimiento.**

- Pocos gestos y siempre los mismos: las reglas se dibujan de izquierda a derecha (400 ms,
  `easing.out`) y los titulares aparecen línea a línea con máscara.
- Las imágenes entran con un recorte vertical.
- No hay `fadeInUp` genérico.
- Un solo movimiento ambiental por pantalla: Scope.

**Navegación.** Cabecera fija mínima con firma («Álvaro Gaertner»), índice de capítulos
numerados y el selector de atmósfera. En móvil se convierte en un menú a pantalla completa
con el mismo índice. La píldora flotante desaparece.

**Home.**

1. Nombre a escala de cartel + oficio en una línea, con Scope sentado en la regla bajo el
   nombre.
2. «Quién»: biografía corta visible, sin pestañas.
3. «Trabajo»: tres filas editoriales con captura real a sangre, número, título, una frase y
   el stack en Mono.
4. «Libreta»: el Notebook como capítulo en serif.
5. «Escríbeme»: la carta, con el papel contrastado sobre la mesa.
6. Pie con la firma y Scope despidiéndose sobre la última regla.

**Páginas interiores** (casos de proyecto, Sprint 5): misma maqueta de monografía, con margen
de notas donde Scope acompaña, figuras numeradas y capturas a sangre.

**Móvil.** La columna de margen se convierte en una franja superior por capítulo: Scope a la
izquierda del índice del capítulo, sobre la regla. Scope en el primer viewport, bajo el nombre.

| Ventajas | Riesgos |
|---|---|
| Corrige todos los defectos con poco riesgo; tipografía con carácter; máxima legibilidad; rápida | Puede quedarse en «muy bien hecha» sin un momento memorable; la originalidad depende de la ejecución tipográfica |

**Coste estimado:** 2–3 semanas. **Diferenciación:** media.

---

## Dirección B — «Estudio nocturno» (experiencia espacial)

**Concepto.** Toda la web es **un único estudio de noche**, la misma noche azul de la
entrada, iluminado por dos fuentes: una luz clave cálida desde arriba a la izquierda (la del
render de Scope) y **la luz de los ojos de Scope**. El contenido son superficies físicas
(papel, cerámica mate) dispuestas en profundidad, y Scope recorre ese espacio.

**Idea narrativa.** Una visita guiada en silencio: la cámara avanza con el scroll de mesa en
mesa (bench → mundos → libreta → escritorio) y Scope va delante. La entrada no se
desvanece: **la cámara se retira** y el estudio aparece alrededor de Scope.

**Personalidad visual.** Penumbra cálida, materiales mates, profundidad de campo, polvo en
suspensión mínimo y luz con caída real. Es cinematográfica, pero sobria.

**Tratamiento de Scope.**

- Vive en una **capa WebGL fija a pantalla completa** (un renderer, una escena) y se desplaza
  en x, y y **z**.
- Proyecta sombra sobre las superficies del DOM: un plano de sombra alineado con el
  rectángulo de cada superficie.
- Su luz tiñe las superficies cercanas: un degradado radial en CSS calculado desde su
  posición en pantalla en cada fotograma, que cuesta una sola variable CSS.

**Sistema de composición.** Planos a tres profundidades, en perspectiva CSS:

- Fondo: arquitectura difusa.
- Medio: superficies de contenido.
- Primer plano: Scope y algún objeto desenfocado.

Las composiciones son de plano y contraplano, como un storyboard.

**Fondos.** Noche azul con iluminación volumétrica falsa (degradados), viñeta y profundidad
de campo por capas (desenfoque CSS precalculado, no en tiempo real).

**Movimiento.**

- La cámara avanza con el scroll (animaciones vinculadas al scroll, nativas donde se pueda).
- Paralaje por profundidad.
- La luz sigue a Scope.
- Las transiciones entre secciones son movimientos de cámara (dolly, pan).
- Riesgo de vértigo: requiere un modo de movimiento reducido completo.

**Navegación.** Un minimapa de «estaciones» en la esquina, y los saltos de sección son
movimientos de cámara. Cabecera mínima con firma.

**Home.**

1. Scope en primer plano, el nombre proyectado en la pared como un rótulo iluminado.
2. El banco de trabajo (About) como una mesa con fichas.
3. Los proyectos como **dioramas**: MathView es una curva de luz en 3D por la que Scope
   camina; Tournamently, una pista en perspectiva con su bola; Sport Coach, un anillo de
   temporizador. Son props nuevos que se construyen en Blender headless, sin tocar a Scope.
4. La libreta, en un escritorio bajo una lámpara.
5. La carta, en el escritorio final.

**Páginas interiores.** Cada caso es una «sala» propia con la misma luz; el contenido largo se
lee en una superficie plana y frontal para conservar la legibilidad.

**Móvil.** La cámara se simplifica a un recorrido vertical, sin transformaciones 3D del DOM,
con Scope más pequeño. En equipos modestos, cada estación es una imagen prerenderizada.

| Ventajas | Riesgos |
|---|---|
| La mejor integración del 3D posible; atmósfera memorable; continuidad total con la entrada | Coste alto; rendimiento y batería; legibilidad en penumbra; scroll guiado que puede incomodar; mucha superficie de error sin GPU para probarlo aquí; se parece más a las webs de agencia (Active Theory) que a un portfolio personal |

**Coste estimado:** 6–8 semanas + props 3D. **Diferenciación:** alta, aunque en un terreno con
mucha competencia (webs inmersivas de agencia).

---

## Dirección C — «A través de Scope» (concepto experimental)

**Concepto.** *Scope* significa mira, lente, alcance. **La web tiene dos caras y Scope es la
lente que deja ver la de atrás.** Delante está lo terminado (lo que enviaste a producción).
Detrás está cómo se hizo con IA:

- prompts;
- decisiones (ADR);
- notas de sprint;
- borradores descartados;
- el rig de Scope;
- los commits.

Es exactamente lo que Álvaro enseña («I teach the AI-native workflows I use»), demostrado en
lugar de afirmado. Y el material existe y es real: `docs/CONTEXT.md`, las notas SPR-xxx, el
historial git, los informes de validación de Scope y las hojas de contacto de Blender.

**Idea narrativa.** «Toda página tiene un reverso.» El visitante descubre que puede mirar
**debajo** de cualquier cosa. Scope no explica nada (canon: nunca habla); solo **mira**, y
donde mira, la web se vuelve transparente.

**Personalidad visual.** Dos materiales en contraste:

- **Anverso:** el papel marfil editorial de la dirección A.
- **Reverso:** la noche azul de la entrada, en Geist Mono, con anotaciones ámbar (la luz de
  Scope), como un plano técnico o una radiografía.

El paso de uno a otro es **una lente circular**: un recorte circular con borde de luz ámbar.

**Tratamiento de Scope.**

- Es el portador de la lente. En escritorio, la lente sigue al cursor **y Scope la mira**:
  ojos primero, cuerpo después y antena con inercia (la capa Presence; ver
  `06-plan-tecnico.md`).
- Cuando la lente está sobre Scope, se ve **su propio reverso**: el wireframe y el rig, con
  la hoja de contacto de un clip. Es el momento memorable, y es honesto: así se hizo.
- Fuera del modo lente, Scope se comporta como en la dirección A.

**Sistema de composición.** El de A (rejilla editorial, margen de Scope) más **una capa de
reverso dispersa**: no es un duplicado de toda la página, sino notas ancladas a elementos
concretos (el H1, cada proyecto, Scope, la libreta y el formulario), posicionadas igual que
su anverso.

**Fondos.** Anverso de papel, reverso de noche. La entrada, que ya es de noche, se lee ahora
como **el reverso de la web**: al terminar, el anverso «se coloca encima».

**Movimiento.**

- La lente: radio que crece con un muelle al activarse y borde de luz que respira con los
  ojos de Scope.
- Al revelar, las anotaciones de Mono se escriben carácter a carácter, como una terminal
  rápida, en 200–300 ms.
- Todo lo demás, el sistema sobrio de A.

**Navegación.** La de A más **un solo control nuevo**: «Mirar debajo» (tecla `L` o un botón
en la cabecera). Con el teclado, el botón conmuta toda la página al reverso y el foco de
cada elemento muestra su nota en un panel lateral, accesible y anunciado con `aria-live`.

**Home.** Igual que A en estructura. Cada capítulo tiene un reverso:

- **Hero:** los tres borradores descartados del titular y el prompt que los produjo.
- **Proyectos:** arquitectura, número de commits, tests y la decisión técnica más difícil.
- **Libreta:** las notas que no se publican.
- **Contact:** qué pasa con tu mensaje (el flujo real hasta Resend).

**Páginas interiores.** Los casos de proyecto se construyen con la misma doble cara. El
reverso de un caso es su diario técnico.

**Móvil.** No se simula un cursor:

- **un escáner**: una barra horizontal con el borde de luz que se arrastra con el dedo de
  arriba abajo y revela el reverso bajo ella;
- o el botón «Mirar debajo», que voltea la página entera.

Scope mira hacia la barra.

| Ventajas | Riesgos |
|---|---|
| Idea única y propia (no se puede trasladar a otro portfolio); une a Scope, el nombre «Scope», el oficio de Álvaro y la honestidad del proceso; Innovation muy alta; el 3D tiene una función, no es adorno; la base es la de A, así que hay un buen resultado aunque la lente se recorte | Producir el contenido del reverso (curación real, no relleno); el riesgo de «gimmick» si los reversos son pobres; hacer accesible el contenido oculto (resuelto con el botón y las notas en foco); pide disciplina para no saturar |

**Coste estimado:** 4–6 semanas (incluye la base de A) + curación de contenido.
**Diferenciación:** muy alta.
