# Biblia de Scope World: **Pliego**

## 1. Identidad

**Premisa.** Un pliego de papel sobre la mesa de Álvaro, bajo su lámpara. Lo que aún no existe
es de papel; lo que la luz ha sostenido lo suficiente se ha cocido en porcelana. Scope, la
primera pieza cocida, vive allí.

**Historia (la que el visitante deduce, nunca leída).** Cada pregunta de Álvaro se levantó del
pliego a lápiz. Las que maduraron se plegaron en una forma y se deslizaron por el pliegue largo
hasta la luz, donde se cocieron: son sus proyectos. De cada pieza cocida quedó un patrón, para
que otros plieguen la suya: es su aula. Scope fue lo primero que se coció entero. Su recorte
sigue en el margen y, desde entonces, recorre la hoja.

**Atmósfera.** Un estudio silencioso a escala diminuta. Hay quietud, papel que respira con la
luz, el calor de la lámpara y la noche alrededor de la hoja. Es más poético que mágico: nada
brilla porque sí.

### Reglas (las leyes del mundo)

1. **Una sola hoja.** Todo está cortado y plegado del pliego: nada se pega ni aparece de la
   nada. Lo que se levanta deja su hueco, y por el hueco se ve la página de debajo.
2. **Papel = todavía no.** Preguntas, bocetos y notas son de papel: translúcidos, ligeros y
   escritos a lápiz.
3. **Luz sostenida = construido.** Dentro del círculo de la lámpara el papel se ha cocido en
   porcelana vidriada. El borde tuesta el papel y lo que lo cruza es mitad y mitad. La cocción
   no tiene vuelta atrás.
4. **Lo escrito se lee a contraluz.** La letra se vuelve legible cuando la luz atraviesa la
   hoja: la de la lámpara, la de la ventana o la de los ojos de Scope.
5. **La lámpara es la atención de Álvaro.** Encendida, es de día de trabajo. Apagada, solo
   quedan la luz de la ventana (la hora) y los ojos de Scope.
6. **Scope no tiene manos.** Actúa con la mirada (ilumina), el cuerpo (empuja, se apoya, se
   sienta) y la antena (toca y nota). Nunca habla.

### Materiales

| Material | Dónde | Carácter |
|---|---|---|
| **Papel pautado** | El pliego y las hojas | Marfil cálido, grano fino, translúcido a contraluz; pauta gris azulada y margen bermellón |
| **Lápiz (grafito)** | Letra, bocetos, el patrón | Gris cálido, ligeramente transparente: la mano de Álvaro |
| **Papel tostado** | El anillo del borde | Marrón tabaco, irregular, como papel que se ha acercado a una bombilla |
| **Porcelana vidriada** | Todo lo de dentro del círculo y Scope | Lo construido: el marfil de Scope con brillo de esmalte |
| **Esmaltes de proyecto** | Las piezas | Celadón con la cuadrícula grabada (MathView), terracota de bizcocho (Tournamently) y negro tinta con marcas marfil, los colores de la cara de Scope (Sport Coach, cuya identidad es Scope) |
| **Hilo rojo** | Entre preguntas relacionadas | El mismo bermellón del margen, tomado de las `relatedIds` del cuaderno |
| **Esmalte de lámpara y lápiz** | Los objetos de Álvaro | Azul tinta, mate satinado: lo único que no es del pliego |
| **La noche** | La mesa bajo la hoja | Azul marino casi negro, lacado (el del loader y la cara de Scope) |

### Arquitectura

Kirigami. Los tipos:
- hojas de pie, que son las preguntas y los bocetos;
- arcos, tiras dobladas que forman puertas sobre el camino;
- tiendas, tarjetas plegadas;
- formas a medio plegar, que son ideas en tránsito;
- el plano cocido, el suelo del círculo.

No hay muros, techos ni plataformas. La escala la dan la altura de las hojas (3–5 veces Scope) y
el lápiz real.

### Iluminación

Hay dos fuentes y sus temperaturas cuentan la historia:
- **La lámpara:** cálida, 2700 K, un cono que dibuja el círculo. Su boca se ve en el cielo como
  un sol.
- **La ventana:** fría por la mañana y naranja al atardecer, con sombras largas.

De noche no hay más luz que la de los ojos de Scope.

### Paleta

| Token | Valor | Uso |
|---|---|---|
| papel | `#EDE6D8` | Superficie dominante |
| pauta | `#8E9BB0` al 35 % | Líneas del pliego |
| margen | `#9A3B2A` | El margen y el hilo; acento mínimo |
| grafito | `#2B2A2E` | Letra y UI en claro |
| porcelana | `#F1EBDF` + brillo | Lo construido |
| tostado | `#6B4423` | El borde del círculo |
| ámbar | `#F2B65A` | Ojos de Scope y lámpara: luz, nunca decoración |
| noche | `#0B1220` | La mesa y la noche (el loader) |
| lavanda | `#5E5A73` | Aire de amanecer; púrpura atmosférico muy sutil (VISUAL_LANGUAGE.md) |

**Tipografía de la interfaz.** Se conservan Geist, Geist Mono y Newsreader (Newsreader en
cursiva para la voz de Álvaro). La letra de mano de las hojas es diegética: forma parte de las
texturas del mundo y nunca de la interfaz. En los renders es una fuente del sistema (Ink Free),
a sustituir por una manuscrita con licencia web en producción.

**Escala.**
- Scope: unos 150 mm de cuerpo.
- Pliego: 2,0 × 1,4 m.
- Hojas: 0,25–0,8 m de alto.
- Lámpara: la cabeza a 1,25 m.

Todo es medible y coherente: un mundo de mesa visto a la altura de Scope.

**Elementos recurrentes.**
- La pauta y el margen.
- Los huecos de lo que se levantó.
- El hilo rojo.
- El anillo tostado.
- La boca de la lámpara.
- Los ojos ámbar.
- La silueta recortada de Scope.

## 2. Geografía

Coordenadas en metros sobre el pliego: el origen está en el centro, +X a la derecha y +Y al
fondo. El mapa visual está en `index.html#mapa`.

| # | Lugar | Dónde | Qué es | Contenido real |
|---|---|---|---|---|
| 1 | **El margen** | Borde delantero izquierdo (−0,9…−0,4, −0,7…−0,3) | La entrada. Papel pautado, la línea bermellón, el recorte de Scope y la hoja «· · ·» que empieza a levantarse | Quién es Álvaro (home) |
| 2 | **El campo de preguntas** | Centro izquierda | Hojas de pie, una por cada línea de investigación, escritas a lápiz y unidas por el hilo rojo; bocetos sin título; dos puertas en arco | El cuaderno abierto, con las 6 preguntas reales |
| 3 | **El pliegue largo** | Diagonal desde el margen hasta la luz | Un pliegue en valle: el camino | Navegación |
| 4 | **El círculo de la lámpara** | Centro derecha (centro 0,45, 0,18; radio 0,36) | El suelo cocido y las piezas vidriadas; el anillo tostado en el borde. La pregunta en estado *Building* (AI-native UX) está justo encima del borde: mitad cocida | Proyectos: MathView, Tournamently, Sport Coach (y esta web) |
| 5 | **El aula** | Fondo derecha | Filas de piezas pequeñas plegadas por otros desde un mismo patrón, frente a la hoja del patrón | Docencia (Gredos San Diego) |
| 6 | **El pie de la lámpara** | Borde derecho | Una nota en blanco plegada y el lápiz | Contacto |

**Continuidad.** Hay una sola hoja y una sola luz. Desde cualquier lugar se ven la boca de la
lámpara y el resplandor del círculo, y desde el círculo se ven el campo a contraluz y el margen.
El recorrido dibuja una S:

    margen → pliegue largo → campo → borde → círculo → aula → pie de la lámpara

Después vuelve al campo para plantar la nota.

**Posiciones de reposo de Scope.**
- Margen: sentado junto a su recorte.
- Campo: frente a una pregunta.
- Borde del círculo: donde el papel cambia.
- Sobre MathView: es la única pieza que se puede pisar.
- Aula: entre las filas.
- Pie de la lámpara: junto a la nota.

## 3. Narrativa del recorrido principal

| Momento | Hora | Qué ocurre | Sección |
|---|---|---|---|
| Inicio | Noche | Scope recorre el margen con la luz de sus ojos (es el loader) | Entrada |
| Llegada | Amanecer | La lámpara se enciende y Scope levanta la mirada. Aparece el nombre | Home |
| Desarrollo | Mañana | El pliegue lleva al campo. Scope se inclina ante una pregunta y su luz la hace legible | Cuaderno |
| Descubrimiento | Día | Una hoja que maduró se pliega en una forma y se desliza hacia la luz. Scope la sigue | Transición |
| Transformación | Día | En el borde, la forma se tuesta y se cuece por la mitad | Regla del mundo |
| Momento memorable | Día | Scope camina sobre la porcelana de MathView, una gráfica en la que se puede estar de pie | Proyectos |
| Desarrollo | Atardecer | En el aula, piezas pequeñas e imperfectas plegadas por otros. Scope ladea la cabeza ante una torcida | Docencia |
| Final | Noche de lámpara | Al pie de la lámpara hay una nota en blanco y el lápiz: el visitante escribe | Contacto |
| Cierre | Noche | Scope planta la nota plegada en el campo: una pregunta nueva. La lámpara se apaga y él sigue con sus ojos | Después |

## 4. Interacción (esbozo; se desarrolla en la Entrega 2)

| Objeto | Estados | Lo que hace el visitante | Lo que hace Scope | Consecuencia |
|---|---|---|---|---|
| Hoja de pregunta | Plana → levantándose → de pie → plegándose → cruzando el borde → cocida | Pasar la luz o enfocarla: la letra se lee a contraluz; abrirla da paso a la vista editorial del hilo | Se acerca, se inclina (Focus) y la ilumina | Contenido real del cuaderno; el hilo rojo lleva a las relacionadas |
| Pieza cocida | Fría → iluminada → abierta | Seleccionarla: la cámara se acerca y se abre la vista del proyecto | Se interesa, la rodea y se sube a MathView | Información real del proyecto y vuelta al círculo |
| Lámpara | Apagada → encendida | Encenderla al entrar (la home); apagarla al salir | Levanta la mirada | La hora del mundo y la cocción |
| Patrón del aula | Plano | Verlo y plegar el suyo (opcional) | Mira las piezas | Docencia y qué enseña |
| Nota | En blanco → escrita → plegada → plantada | Escribir (formulario real) | La lleva y la planta | Envío real y una pregunta nueva en el campo (solo visible para quien la escribió) |

**Navegación libre.** Un índice siempre visible (Work, Notebook, Teaching, About, Contact)
lleva la cámara directamente a cada lugar. La historia es el orden recomendado, no una
obligación.

**Comportamientos alternativos.**
- **Teclado:** el foco mueve la cámara.
- **Movimiento reducido:** cortes con fundido en lugar de vuelos.
- **Sin GPU:** los renders prerenderizados como planos fijos.
- **Móvil:** cámara vertical y lugares como capítulos deslizables.
