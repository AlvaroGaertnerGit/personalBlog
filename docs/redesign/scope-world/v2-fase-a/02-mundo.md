# 2. El mundo ampliado: el escritorio entero

## 2.1 La idea: crecer hacia dentro, hacia arriba y hacia fuera

No hay que hacer el pliego más grande: sería escalar lo que ya existe, y a la escala de Scope
2 × 1,4 m ya son 13 × 9 cuerpos. El mundo crece aprovechando lo que el papel y la mesa ya
permiten según la biblia:

| Dirección | Qué es | Por qué cumple la biblia |
|---|---|---|
| **Hacia dentro** | Interiores: el libro abierto, el aula, las gradas de Tournamently | Las preguntas ya son libros desplegables (Entrega 1.5) |
| **Hacia arriba** | Arquitectura de papel por la que se camina: la galería del margen, el mirador y las gradas | Regla 1: todo está cortado y plegado de la misma hoja. Una tira del margen puede levantarse sin despegarse |
| **Hacia atrás** | **El rizo:** el borde trasero del pliego se curva hacia arriba y hacia atrás, sobre la mesa. Debajo queda una bóveda de papel iluminada a contraluz | El papel se riza solo en los bordes. Regla 4: lo escrito se lee a contraluz |
| **Hacia fuera** | La mesa: se baja por **la esquina doblada** hasta el pie de la lámpara | La lámpara y el lápiz ya son canon («los objetos de Álvaro») |

Así el mundo pasa de un plano con una diagonal a **tres niveles** (la mesa, el pliego y la
arquitectura plegada) y una bóveda, sin un solo material ni regla nuevos.

## 2.2 Comparación con la 1.0

| Medida | 1.0 (medido) | 2.0 (objetivo del diseño) |
|---|---|---|
| Lugares | 4 encuadres | **7 zonas** con 21 paradas |
| Longitud del recorrido | 2,03 m | **≈ 5,6 m** en línea recta entre paradas (×2,8); algo más por los caminos reales |
| Superficie caminable para Scope | 1,18 m² | **≈ 2,0 m²** (+70 %), en tres niveles |
| Niveles | 1 | 3 + la bóveda del rizo |
| Rincones escondidos | 0 | 8 |
| Proyectos que se pueden experimentar | 0 (MathView es una hoja) | 3 instalaciones + 3 peanas libres |
| Recorrer de punta a punta | unos 30 s | ≈ 2,5 min sin detenerse; 8–12 min explorando |
| Hora del día | noche → día | noche → amanecer → mañana → día → atardecer → noche de lámpara |

Las cifras de 2.0 son objetivos del diseño. Se comprueban en la entrega 2.0-A, con la maqueta
caminable (ver `07-blender-y-hoja-de-ruta.md`).

## 2.3 Las siete zonas

Coordenadas en metros, como en la biblia: el origen está en el centro del pliego, +X a la
derecha y +Y al fondo. El pliego ocupa x −1…1, y −0,7…0,7. La lámpara tiene el pie en
(1,38, 0,14).

| # | Zona (narrativa) | Lugar en el mundo | Dónde | Escala | Contenido real | Hora |
|---|---|---|---|---|---|---|
| 1 | **El despertar** | El margen | Delante a la izquierda (−0,95…−0,55, −0,7…−0,3) | Abierta, baja | Llegada; Scope | Noche → amanecer |
| 2 | **El umbral** | La galería del margen | Borde izquierdo, hacia el fondo (−0,95…−0,6, −0,3…0,5) | Pasillo cubierto | Quién soy: nombre, qué hago, docencia, filosofía (`about-content.ts`) | Amanecer |
| 3 | **El territorio de las ideas** | El campo de preguntas, el pliegue largo y el taller de pliegues | Centro izquierda y delante en el centro | La más abierta | Cómo pienso y construyo: las preguntas actuales y el método real con el que hago esta web | Mañana |
| 4 | **El distrito de proyectos** | El círculo de la lámpara | Centro derecha (centro 0,45, 0,18; radio 0,36) | Plaza | MathView, Tournamently, Sport Coach y peanas para los próximos | Día |
| 5 | **El cuaderno** | Bajo el rizo | Fondo, detrás del círculo (−0,1…0,65, 0,55…0,9) | **Íntima**, cubierta | Las seis líneas de investigación al completo: hallazgos, hipótesis, lo que falló, próximos pasos y, cuando existan, artículos | Mediodía, a contraluz |
| 6 | **El espacio de enseñanza** | El aula | Fondo a la derecha (0,55…1,0, 0,4…0,7) | Pequeña, ordenada | Docencia en FP: SMR y ASIR, en GSD Guadarrama | Atardecer |
| 7 | **El lugar de encuentro** | El pie de la lámpara | Sobre la mesa, fuera del pliego (1,15…1,6, −0,2…0,6) | Abierta, oscura y cálida | Contacto | Noche de lámpara |

El recorrido dibuja una S continua, sin saltos:

```
margen ─► galería del margen ─► campo ─► pliegue largo / taller ─► círculo
   ─► bajo el rizo ─► aula ─► esquina doblada ─► pie de la lámpara
```

Desde cualquier zona siguen viéndose la boca de la lámpara, el resplandor del círculo y la
silueta del rizo. **El mundo se sigue viendo más allá del encuadre.**

### 1 · El despertar: el margen

- **Qué ocurre.**
  - Llegada de noche, con el loader de producción y el Scope prerenderizado.
  - Se enciende la lámpara y Scope te mira.
  - El nombre y una frase aparecen en HTML, sobre el mundo.
- **Paradas.**
  - **1a** el recorte de Scope.
  - **1b** la línea bermellón, mirando hacia la galería.
- **Reacciona al acercarte.** Nada aquí se mueve por su cuenta: solo Scope y la lámpara.
- **Rincón ✦ «El hueco de Scope».** Junto a su recorte queda el hueco de su silueta en el papel.
  Si lo señalas, Scope se acerca, se mete en su propio hueco, encaja y sale con un BlinkDouble.
  Los clips ya existen; hace falta el gesto de «encajar», ver §4.
- **Ya existe en la 1.0.** Solo se ajusta la cámara para que el arco de la galería se vea al
  fondo.

### 2 · El umbral: la galería del margen

- **Qué es.** La línea bermellón del margen está cortada a lo largo de 70 cm: una tira se
  levanta y forma una **galería de arcos sucesivos** que recorre el borde izquierdo hacia el
  fondo. Bajo los arcos hay cuatro hojas de pie, una por cada faceta real de
  `about-content.ts`: «Ahora enseño», «Ahora construyo», «Ahora exploro» y «Cómo pienso».
- **Por qué funciona.**
  - Es un pasillo cubierto entre la apertura del margen y la del campo: hay contraste de escala.
  - Lo que se ve a contraluz entre los arcos es el campo, que espera.
  - **Termina en el mirador que ya existe** (−0,68, 0,15; 9 cm de alto): el primer punto elevado
    del recorrido, desde donde se ve todo el campo antes de entrar en él.
- **Reacciona al acercarte.** Las hojas están tumbadas en el pliego. Al llegar a su altura, cada
  una se levanta sobre su pliegue, y la luz de los ojos de Scope hace legible su letra
  (regla 4). La causa eres tú al avanzar; nada pasa por un temporizador.
- **HTML.** El texto real de cada faceta, seleccionable, junto a su hoja.
- **Paradas.**
  - **2a** la entrada de la galería.
  - **2b** dentro, entre las hojas.
  - **2c** el mirador, a la salida hacia el campo.
- **Rincón ✦ «El dorso».** El dorso de la última hoja tiene bocetos a lápiz de Scope. Solo si
  apruebas usar sus referencias reales (`docs/scope-docs/scope/references/`).

### 3 · El territorio de las ideas: el campo, el pliegue y el taller

- **El campo de preguntas** (ya existe) es **la zona más abierta del mundo**.
  - Las preguntas son libros desplegables de pie, unidos por el hilo rojo.
  - Muestra **la pregunta y su estado**; la profundidad está en el cuaderno, bajo el rizo.
  - El hilo rojo de cada pregunta **atraviesa el rizo** y lleva hasta sus notas.
- **El taller de pliegues** (nuevo) está a lo largo del pliegue largo. Es una fila de formas a
  medio plegar, cada una un paso más allá que la anterior: hoja plana, marcada, plegada, en el
  borde tostado y cocida.
  - Representa **el método real con el que trabajo**, que ya está escrito en el `CLAUDE.md` de
    esta web: entender, buscar lo que existe, diseñar, construir, revisar, refactorizar y
    verificar.
  - No es un dato inventado: es el proceso con el que se ha hecho esta propia web.
- **Reacciona al acercarte.** Al pasar junto a cada forma, se pliega un paso. El taller se
  «construye» a medida que avanzas, y vuelve a su estado cuando te alejas.
- **Paradas.**
  - **3a** la entrada al campo, desde la galería.
  - **3b** entre las preguntas.
  - **3c** dentro del libro abierto ✦.
  - **3d** el pliegue largo.
  - **3e** el final del taller, en el borde tostado.
- **Rincones.**
  - **✦ «Dentro del libro».** La cámara entra en el libro abierto de «¿Cuánto contexto basta de
    verdad?»: sus capas suben a tu alrededor.
  - **✦ «La mirilla».** Por un hueco del kirigami se ve la página de debajo: allí están, tachadas,
    las suposiciones que no funcionaron (`failedAssumption` del cuaderno). Lo descartado vive
    debajo.

### 4 · El distrito de proyectos: el círculo de la lámpara

- **Qué es.** La plaza cocida.
  - Cada proyecto es una **instalación de porcelana con su propio esmalte**; ver
    `03-proyectos.md`.
  - El anillo tostado del borde tiene **peanas de papel todavía sin cocer**, reservadas para los
    próximos proyectos.
  - Cuando se añade un proyecto, su peana se cuece. Así, el sistema de proyectos forma parte del
    propio mundo.
- **Instalaciones.**
  - **MathView:** la función de celadón sobre la que se puede caminar (ya existe).
  - **Tournamently:** las gradas del cuadro, en terracota (ya existen; se vuelven jugables).
  - **Sport Coach:** el dial negro tinta (ya está en el mundo; se vuelve abrible).
- **Reacciona al acercarte.**
  - Las peanas vacías se calientan, como papel junto a la bombilla.
  - La instalación más cercana se «despierta»: en MathView se encienden las curvas de nivel, en
    Tournamently se iluminan los partidos de las gradas.
- **Paradas.**
  - **4a** la entrada desde el taller.
  - **4b** MathView.
  - **4c** Tournamently.
  - **4d** Sport Coach y las peanas.
- **Rincón ✦ «La pelota».** Sobre la final de Tournamently hay una pelota de porcelana. Cuando
  el cuadro tiene campeón, Scope la empuja con la cara, la pelota rueda gradas abajo y el cuadro
  vuelve a empezar. Necesita el gesto «Nudge»; ver §4.

### 5 · El cuaderno: bajo el rizo

- **Qué es.** El borde trasero del pliego se riza hacia arriba y hacia atrás, sobre la mesa.
  Debajo queda una **bóveda de papel de unos 25 cm de alto**:
  - el suelo es la mesa lacada, de noche;
  - el techo es el dorso del pliego, iluminado por la lámpara desde fuera.
- **Lo que se ve.** A contraluz se lee lo que está escrito en el dorso (regla 4). De él cuelgan,
  con el hilo rojo, las notas de cada línea de investigación.
- **Es la zona íntima del mundo.**
  - Es lenta y está cubierta.
  - Tiene la luz más cálida del recorrido: filtrada por el papel y sin una sombra dura.
- **HTML.** Vista editorial completa de cada línea: pregunta, estado, último hallazgo,
  hipótesis, lo que no funcionó, próximo experimento y notas. Los artículos se añadirán cuando
  existan (hoy no hay ninguno; no me invento ninguno).
- **Reacciona al acercarte.** Al mirar Scope hacia arriba, su luz se suma a la de la lámpara y la
  nota que tiene encima se vuelve legible.
- **Paradas.**
  - **5a** la boca del rizo.
  - **5b** el centro de la bóveda.
  - **5c** la salida hacia el aula.
- **Rincón ✦ «La pregunta sin escribir».** Es la hoja «· · ·» del margen. Se levanta un poco más
  con cada zona que visitas, como indicador de progreso dentro del mundo. Desde la bóveda se ve
  su sombra en el techo.

### 6 · El espacio de enseñanza: el aula

- **Qué es.** Filas de piezas pequeñas e imperfectas, todas plegadas desde un mismo patrón,
  frente a la hoja del patrón. Viene de la biblia, §2.
- **Contenido real.** Doy clase en FP de informática, en los ciclos de SMR (Sistemas
  Microinformáticos y Redes) y ASIR (Administración de Sistemas Informáticos en Red), en GSD
  Guadarrama: sistemas, redes, bases de datos, programación y seguridad. El aula complementa mi
  perfil de desarrollo de software, no lo sustituye.
  - Como son ciclos de sistemas y redes, **las piezas del aula están unidas entre sí por hilos**,
    como una red: cada alumno pliega su pieza y la conecta a las demás.
  - No hay ningún nombre de alumno ni trabajo concreto sin permiso.
  - **Aviso:** `about-content.ts` de producción dice «Software Development»; habría que
    corregirlo cuando toque producción.
- **Interacción.** Plegar tu propia pieza siguiendo el patrón, en tres pasos con clic o teclado.
  Es lo que hace un alumno, y explica en diez segundos qué significa enseñar a construir.
- **Reacciona al acercarte.** Al mirar Scope una pieza torcida, ladea la cabeza (Tilt) y la
  pieza se endereza un poco. Es la luz de Scope, su canal canónico; él nunca la toca.
- **Paradas.**
  - **6a** delante del patrón.
  - **6b** entre las filas.
- **Rincón ✦ «La pieza torcida».**

### 7 · El lugar de encuentro: el pie de la lámpara

- **Qué es.** Se baja por **la esquina doblada**: la esquina trasera derecha del pliego está
  doblada hasta la mesa y hace de rampa.
- **Lo que hay.** Sobre la mesa, al pie de la lámpara de esmalte azul tinta:
  - una nota en blanco, pautada;
  - el lápiz de Álvaro.
- Ver `05-contacto.md`.
- **Paradas.**
  - **7a** la esquina doblada, mirando la mesa.
  - **7b** la nota.
- **Rincón ✦ «Las virutas».** Detrás del pie de la lámpara hay virutas del lápiz.

## 2.4 Las transiciones entre zonas

Ninguna zona termina en un corte. Cada paso es arquitectura:

| De → a | Elemento | Cambio de escala |
|---|---|---|
| Margen → galería | El primer arco | De abierto a cubierto |
| Galería → campo | El último arco se abre al campo | De cubierto a lo más abierto |
| Campo → taller | El pliegue largo, un valle | Se estrecha en un camino |
| Taller → círculo | El anillo tostado: el papel cambia de material bajo los pies | Umbral de material |
| Círculo → rizo | La boca del rizo, detrás de MathView | De plaza a bóveda íntima |
| Rizo → aula | Sale por el lado derecho de la bóveda | De bóveda a sala pequeña |
| Aula → mesa | La esquina doblada: una rampa | Del papel a la mesa: otro nivel |

## 2.5 Reglas para lo que reacciona

Tanto la biblia como el canon de Scope (`BEHAVIOUR.md`: «el mundo no se anima solo») exigen
que todo cambio tenga una causa visible:

1. **Cambia porque te acercas**: las hojas del umbral, las formas del taller y las peanas.
2. **Cambia porque Scope lo mira o lo empuja**: la letra a contraluz, la pieza del aula y la
   pelota.
3. **Cambia porque lo abres**: los proyectos y las notas.
4. **Nada se mueve por un temporizador.** No hay papel que aletee porque sí.
5. Todo vuelve a su estado cuando te alejas, **salvo la cocción**. Lo que has abierto conserva
   un rastro de luz, como ya hace MathView.

## 2.6 Navegación

- **El índice siempre visible**, con nombres claros, no poéticos:
  - Inicio, Sobre mí, Cómo trabajo, Proyectos, Cuaderno, Clases y **Contacto**.
  - La migaja usa los nombres del mundo («El Pliego › Bajo el rizo»).
- **Saltar a cualquier zona.**
  - La cámara vuela en menos de 1,2 s.
  - Con movimiento reducido, corta.
  - Nunca obliga a recorrer el camino.
- **Dentro de una zona.**
  - Con rueda, deslizar o ← →, de parada en parada.
  - Con Re Pág y Av Pág, de zona en zona.
  - Con el tabulador, entre los objetos.
  - La página no tiene scroll propio, así que no se secuestra nada.
- **Direcciones e historial.**
  - Cada zona tiene una URL (`#/proyectos`) y cada proyecto la suya (`#/proyectos/tournamently`).
  - Zonas y proyectos crean entradas de historial; las paradas, no (usan `replaceState`).
  - Atrás cierra lo abierto y vuelve a la parada en la que estabas.
- **En el móvil.** Las mismas paradas en vertical, con encuadres propios. La galería y el rizo
  usan cámaras de retrato, como `home-m` en la 1.0.
