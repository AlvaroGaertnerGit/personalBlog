# C. Análisis de referencias

## 0. Qué se ha podido inspeccionar y qué no

| Referencia | Estado | Método |
|---|---|---|
| agrumeafarm.it/en | **Parcial.** Solo se inspeccionaron la portada en movimiento y la estructura del marcado. El scroll virtual (Lenis) no avanzó en este navegador sin GPU, así que **no se han visto las escenas interiores**. | Chrome + SwiftShader (8 capturas a lo largo de ~30 s), marcado (WebFetch), ficha oficial de CSSDA |
| secure-the-unknown.cyera.com/unsupported | **Inspeccionada**: es la página de navegador no soportado. | Captura |
| secure-the-unknown.cyera.com | **No inspeccionable aquí.** Redirige a la misma página «Your browser is not supported» en este equipo. | Captura + ficha de CSSDA |
| WOTD recientes de portfolios: EddyOS, Lee Holmes, Cristiana Araújo | Portadas y primeras secciones | Chrome + SwiftShader, fichas de CSSDA |

Todo lo que se dice de las escenas de Agrumea y Cyera que no aparecen en las capturas procede de
sus fichas oficiales y del marcado. **No se describen escenas que no se hayan visto.**

Capturas: `evidence/refs/`.

---

## 1. CSS Design Awards: criterios verificables y conclusiones propias

### Criterios oficiales (fuente: cssdesignawards.com/about, /submit y fichas de sitios)

- **Website of the Day (WOTD):** media del jurado **superior a 8,00**; el umbral «varía según
  la calidad de los sitios presentados». Los WOTD mejor puntuados entran en la carrera por el
  **Website of the Month (WOTM)**. Los WOTM y algunos WOTD pasan al **Website of the Year**.
- **Special Kudos:** media superior a 6 e inferior a 8.
- **Premios del público (UI, UX, Innovation):** más de 20 votos en una o varias categorías y
  una media del jurado superior a 6.
- Definiciones oficiales: **UI** = «User Interface design such as aesthetics and effects»;
  **UX** = «User Experience and functionality»; **Innovation** = «the use of new development
  and design ideas».
- Requisitos de envío: «Sites must be complete and the work must be original». Se permiten
  plantillas, pero el éxito depende de la originalidad. Categoría **Solo** (1 persona + 1
  colaborador), 50 USD.
- Cada ficha muestra UI, UX, Innovation y la nota final del jurado, con el desglose por juez.

### Nivel competitivo actual (WOTD, del 27 de septiembre al 14 de octubre de 2026)

Las 18 notas de WOTD del periodo van de **8,01 a 8,58**. Fichas consultadas:

| Sitio | Tipo | UI | UX | INN | Final | Etiquetas oficiales |
|---|---|---|---|---|---|---|
| Agrumea Farm (Studio K95) | Marca / e-commerce | 8,37 | 8,58 | 8,17 | 8,37 | Parallax, Scroll, WebGL, Three.js, Nuxt, GSAP, Lenis |
| Cyera AI Guardian (Active Theory) | Microsite | 8,30 | 8,21 | 8,30 | 8,27 | Animated, Illustrated, WebGL |
| EddyOS (Eddy Naboulet) | **Portfolio dev** | 8,02 | 8,13 | **8,76** | 8,30 | Animated, Typographic, WebGL |
| Lee Holmes | **Portfolio diseñador/dev** | 7,89 | 8,44 | 8,30 | 8,21 | Animated, Typographic, WebGL |
| Cristiana Araújo | **Portfolio diseñadora** | 8,16 | 8,00 | 7,88 | 8,01 | Animated, Minimal, Typographic |

### Conclusiones propias (no son criterios del jurado)

1. **Los portfolios individuales ganan WOTD con una idea, no con un despliegue.** EddyOS tiene
   la Innovation más alta de la tabla (8,76) con una sola metáfora llevada hasta el final: su
   web es un sistema operativo, con secuencia de arranque, ventanas y un 404 jugable. Lee
   Holmes gana en UX con tipografía y un posicionamiento muy concreto. Ninguno compite con
   Active Theory en producción 3D.
2. **«Typographic» aparece en 3 de los 3 portfolios premiados.** La tipografía con carácter
   es la condición mínima, no un extra.
3. **En los tres, la identidad se lee en la primera pantalla:** nombre, oficio y tono en menos
   de tres segundos. Es justo lo que hoy falta en alvarogaertner.com (ID-1).
4. **El UX pesa tanto como el UI.** Agrumea tiene su nota más alta en UX (8,58), no en UI. El
   espectáculo sin claridad no basta.
5. Scope y la ingeniería de la entrada son un activo poco común en un portfolio. **Innovation
   es la categoría donde esta web puede ser más fuerte**, siempre que el 3D se integre en una
   idea y no sea un adorno.

---

## 2. Agrumea Farm: qué se ha visto

Capturas: `evidence/refs/agrumea-0.jpg`, `agrumea-3.jpg`.

- **Composición:** los productos 3D (tarros) giran en primer plano sobre una forma plana de
  color burdeos, con texto circular («…PRESERVE · WE GROW…») que recorre su borde. **El 3D y el
  2D comparten paleta** (los tarros tienen los mismos rojos, naranjas y cremas que el fondo y
  la tipografía) y **comparten plano**: el texto curvo pasa por detrás de los tarros y la forma
  burdeos funciona como suelo o escenario.
- **Iluminación:** suave, de estudio, sin sombras duras; el fondo crema es el color del
  «cuarto» y no un blanco de interfaz.
- **Interfaz mínima y fija:** idioma (IT/EN), logotipo centrado, MENU, privacidad y «SCROLL
  TO DISCOVER». Todo lo demás es escena.
- **Desenfoque de profundidad:** los tarros de los bordes están desenfocados (profundidad de
  campo), lo que crea capas espaciales sin construir ninguna habitación.
- **Tipografía:** familias de la casa Ivy (`ivystyle-sans`, `ivymode`), serif expresiva para
  la marca y sans para la interfaz.
- **Accesibilidad:** «Skip to content» presente en el marcado.

**Principios transferibles:**

1. El objeto 3D y la interfaz se integran mediante **paleta y plano compartidos**, no mediante
   un suelo realista.
2. Hay **una forma de color que hace de escenario**, a medio camino entre el 2D y el 3D.
3. La profundidad se crea con **desenfoque de campo y escala**, sin habitación 3D.
4. La interfaz se repliega a los bordes y la escena manda.

## 3. Cyera: qué se ha visto

Captura: `evidence/refs/cyera-unsupported-0.jpg`. Según su ficha oficial, la experiencia es
un microsite donde se explora la seguridad de la IA a través de tres planetas con
minijuegos y retos.

Lo único verificable desde aquí es su **página de no soportado**: texto plano en Times New
Roman, sin marca ni alternativa. Es un contraejemplo útil: incluso un WOTD de Active Theory
no degrada con elegancia en equipos sin GPU.

**Principio transferible:** la degradación también es diseño. La web de Álvaro ya lo hace
mejor (la imagen prerenderizada de Scope en su sitio, en ~1 s). Hay que mantenerlo como
**requisito no negociable** en cualquier dirección y presentarlo como parte del oficio: un
jurado que la abra en un portátil modesto verá una web completa.

## 4. Portfolios WOTD: patrones observados

- **EddyOS** (`evidence/refs/eddyos-0.jpg`): una metáfora total (un SO con CRT), tipografías
  pixel (DotGothic16, Jacquard 12), una secuencia de arranque como entrada y una interacción
  inicial explícita («PRESS ANY KEY TO ENTER»). Aquí la entrada es la idea, no un trámite.
- **Lee Holmes** (`leeholmes-0.jpg`, `leeholmes-2.jpg`): un titular gigante de mucho
  carácter, un posicionamiento ultraespecífico («Custom software for alternative clothing
  brands») y un cuerpo enorme en NeueMontreal. La tipografía hace de imagen.
- **Cristiana Araújo** (`cristiana-0.jpg`, `cristiana-2.jpg`): producto real a sangre
  (capturas de app, fotografía de uso), navegación con contador («Work (8)») y una sección
  «Wall of love». El trabajo real es el protagonista.

**Principios transferibles:**

1. Una metáfora que organiza toda la experiencia (EddyOS), si es honesta con el perfil.
2. Un posicionamiento en una frase, a gran escala.
3. El trabajo real a sangre, con capturas y vídeo, no ilustraciones de sustitución.

---

## 5. Síntesis: principios aplicables a esta web

| Principio | Referencia | Aplicación a alvarogaertner.com |
|---|---|---|
| El 3D y la interfaz comparten paleta y plano | Agrumea | La interfaz adopta los materiales de Scope (marfil, noche, ámbar) y Scope se apoya en superficies reales de la página |
| Una forma escenario entre 2D y 3D | Agrumea | Un «plinto de luz»: la luz cálida de los ojos de Scope define la superficie donde vive |
| Profundidad por escala y desenfoque | Agrumea | Capas: Scope nítido, el contenido observado nítido y los elementos lejanos atenuados, sin habitación 3D |
| Una metáfora total y honesta | EddyOS | «Scope» = mira, lente, alcance. Ver la web a través de su lente (dirección C) |
| Identidad en 3 segundos | los tres portfolios | Nombre, oficio y una frase, con Scope en el primer viewport |
| Trabajo real a sangre | Cristiana Araújo | Capturas y vídeo reales de Tournamently, Sport Coach y MathView |
| Degradación diseñada | Cyera (contraejemplo) | Mantener la imagen de respaldo como estándar en todas las direcciones |
| La interfaz se repliega y la escena manda | Agrumea | Menos paneles y menos marcos: la tipografía y Scope hacen la composición |
