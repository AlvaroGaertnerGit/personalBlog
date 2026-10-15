# 8. Revisión: el mundo de Scope

> **El portfolio es el mundo de Scope.** El visitante no ve una web con un personaje: visita
> el lugar donde vive alguien, y mientras lo recorre descubre quién es Álvaro, qué construye y
> cómo piensa.

Esta revisión cambia la premisa espacial de la Fase A, **no su contenido**. Las zonas, las
instalaciones, el sistema de proyectos, el contacto y el comportamiento de Scope siguen igual.
Lo nuevo es lo que rodea al pliego y los lugares que pertenecen a Scope.

Las imágenes son **estudios de volumen y atmósfera** renderizados en Blender (Cycles por CPU).
Usan el mundo aprobado de la Entrega 1.5 sin modificarlo
(`entorno/entorno.py` lo importa y lo amplía) y el modelo de Scope intacto. No son arte final:
las cordilleras, sobre todo, todavía tienen el facetado de un bloqueo; ver §8.8.

## 8.1 El problema: un tablero en el vacío

Desde la Entrega 1, el pliego descansa sobre una mesa lacada casi negra que se pierde en la
oscuridad. En los renders se leía como noche; en tiempo real, con la cámara en movimiento, se
lee como **una maqueta suspendida**, porque se ven los cuatro bordes del pliego contra el negro.

| | Antes (`renders/v-antes.jpg`) | Después (`renders/v-despues.jpg`) |
|---|---|---|
| Lo que hay más allá del pliego | Nada: negro | Papel en blanco hasta el horizonte, con dunas, hojas en blanco de pie, colinas plegadas, cordilleras y un lago de tinta |
| Horizonte | No existe | Siempre presente, en el tercio superior |
| Atmósfera | Neblina a 4 m | Perspectiva aérea a 30 m: lo lejano se funde en el color del aire de cada hora |
| Límites | Los cuatro bordes del pliego, siempre | El borde del pliego es el borde de **lo escrito**, no del mundo |

## 8.2 La nueva premisa: el pliego sin bordes

**El mundo entero es papel.** El pliego pautado, con su margen, sus preguntas y su círculo de
luz, es solo la parte que ya se ha escrito. Alrededor, la misma hoja sigue en blanco hasta el
horizonte.

- Lo que aún no existe es papel en blanco: es la regla 2 de la biblia, «papel = todavía no»,
  llevada a la escala del paisaje.
- Las cordilleras son pliegues de esa hoja enorme: la regla 1, «una sola hoja».
- La mesa lacada no desaparece del todo. **Se convierte en el lago de tinta**: el mismo azul
  noche, ahora remansado en un valle, que refleja la lámpara.
- La lámpara sigue siendo la única luz construida. Su pie se apoya en el papel en blanco, y
  desde cualquier sitio se ve su brazo recortado contra el cielo.

**Lo que cambia del lenguaje artístico, y por qué.**

- La premisa de escala pasa de «un mundo de mesa» a «un mundo de papel». La biblia decía que
  todo era medible a escala de escritorio; eso se mantiene cerca y se suelta en la distancia.
- Los materiales, la paleta, las reglas y el modelo **no cambian**.
- **Es la única desviación** del lenguaje aprobado, y la justifica el problema de §8.1.

**El contraste nocturno se conserva:**

- la hora cambia por zonas (de noche a noche de lámpara);
- el lago de tinta es el negro azulado del loader;
- de noche, el horizonte es una silueta azul con la linterna de Scope encendida (`v-linterna.jpg`).

## 8.3 Cómo se construye la sensación de amplitud (y cuánto cuesta)

El mundo se organiza en **tres anillos**:

| Anillo | Distancia | Qué hay | Cómo se hace en tiempo real | Coste previsto |
|---|---|---|---|---|
| **Cercano** | 0–2 m | El pliego, las zonas, los lugares de Scope | Geometría completa, caminable y con luz horneada (lo de la Fase A) | Lo ya presupuestado |
| **Medio** | 2–10 m | Dunas de papel, unas 45 hojas en blanco de pie («las preguntas que nadie ha hecho aún»), colinas plegadas, el lago | Una malla de terreno de unos 6 000 triángulos; **las hojas, una sola geometría instanciada**; colinas de pocas caras con oclusión en los colores de vértice; sin sombras en tiempo real | ≈ 12 000 triángulos, 4 llamadas de dibujo, ≈ 150 KB |
| **Lejano** | 12–33 m | Dos capas de cordilleras plegadas | Mallas muy simples con niebla. Más allá de 25 m, opcional: un panorama cilíndrico prerenderizado por hora (2048 × 512, WebP) | ≈ 4 000 triángulos o ≈ 150 KB por panorama |
| **Cielo y aire** | — | Gradiente por hora, franja de horizonte, niebla | Un shader de cielo sin texturas y la niebla de three.js ajustada a la misma curva que el render | Despreciable |

**Total del entorno:** ≤ 20 000 triángulos, ≤ 8 llamadas de dibujo y ≤ 400 KB con gzip.
Es un objetivo; se mide en la entrega 2.0-A. Con eso, el presupuesto global de la Fase A sigue
siendo válido (≤ 200 000 triángulos, ≤ 120 llamadas, ≤ 4,5 MB).

**El lago:** sin reflejos planares, que duplicarían el coste de la escena. Basta un material
muy brillante que refleje el cielo (el mapa de entorno) y un brillo falso de la lámpara.

**Reglas de composición**, para que la cámara nunca delate los límites:

1. **El horizonte siempre a la vista** en las paradas de recorrido: tercio superior en
   escritorio y cuarto superior en móvil.
2. **Ninguna cámara mira hacia abajo más de 30°**, salvo las vistas generales del índice, donde
   el entorno ya rodea al pliego.
3. **El borde del pliego nunca se ve recto y solo:** siempre lo cruza o lo tapa algo (una hoja,
   una huella, la linterna).
4. **La niebla y el cielo usan la misma curva por hora**, para que el terreno y el aire nunca
   tengan una costura.

## 8.4 Los lugares de Scope

Responden a lo que preguntabas con el escenario, no con texto. Están **fuera de lo escrito**,
en el papel en blanco junto al margen: Scope vive justo donde termina el trabajo de Álvaro y
empieza lo que aún no existe.

### 1 · La linterna: dónde vive y dónde descansa (`renders/v-linterna.jpg`)

- **Qué es.** Un farol de papel plisado de unos 30 cm, con su puerta orientada hacia el pliego.
- **Dentro hay** un plato de porcelana: el sitio donde se asienta. Es lo primero que se coció
  junto a él.
- **De noche,** su propia luz atraviesa el papel: la regla 4, lo escrito se lee a contraluz, aplicada a
  su casa.
- **En el recorrido.**
  - **Es el loader.** Antes de que llegues, Scope está dentro: solo se ve la linterna encendida
    en el horizonte nocturno. Cuando el mundo carga, sale por la puerta. Esto sustituye la
    noche vacía del loader actual por un sitio.
  - **Si te quedas mucho tiempo quieto en la zona 1,** entra a descansar. Su luz sigue
    encendida y **se asoma en cuanto te mueves**. Nunca desaparece sin razón.

### 2 · El gabinete: lo que guarda (`renders/v-gabinete.jpg`)

- **Qué es.** Escalones de papel plegado, junto a la linterna, con lo que ha encontrado en la
  mesa de Álvaro:
  - una gota de tinta seca;
  - una viruta de lápiz;
  - una grapa;
  - una esquirla de porcelana (de una pieza que se rompió al cocerse);
  - una miga de grafito.
- **Qué cuenta.** Que el mundo es una mesa de trabajo y que Scope la recorre con cuidado.
  No hay ningún texto.
- **Cuando no hay nadie,** Scope ordena el gabinete: empuja con la cara una pieza que se ha
  movido (Nudge). Si llegas mientras lo hace, termina y te mira.
- **Rincón descubrible.** Al visitar ciertos sitios aparece un objeto nuevo en el gabinete. Por
  ejemplo, la pelota de Tournamently tras jugar el cuadro, o un trocito de celadón tras abrir
  MathView. Es la memoria de la visita, hecha objeto.

### 3 · El radiómetro: lo que investiga y lo que ha construido (`renders/v-radiometro.jpg`)

- **Qué es.** Un molinete de luz: una ampolla de vidrio sobre una peana de porcelana, con cuatro
  aspas blancas y negras que giran con la luz.
- **Física real.** Funciona así de verdad: es un radiómetro de Crookes. El mundo no se anima
  solo, porque **la causa es la luz**.
- **Dónde está.** En el borde del círculo de la lámpara, rodeado de tres esquirlas de porcelana
  que Scope ha colocado como espejos.
- **Cómo se mueve.**
  - Con la lámpara gira despacio.
  - Cuando Scope lo mira, su luz lo acelera.
  - Es su experimento: entender la luz que convierte el papel en porcelana.
- **Es el mismo canal** con el que activa todo lo demás, y nunca otro poder.

### 4 · La atalaya: el lugar que considera especial (`renders/v-horizonte.jpg`)

- **Qué es.** Un punto del papel en blanco, detrás del borde norte del pliego, desde donde se ve
  todo el horizonte y el lago.
- **Qué hace allí.** Va al atardecer y cuando el visitante lleva un rato quieto lejos de él.
  Mira las cordilleras.
- **Por qué importa.** Es el único sitio donde **no le interesas tú, sino el mundo**. Por eso
  dice tanto de él.

### 5 · Las huellas: lo que hace cuando no hay visitantes

- **Qué son.** Rastros suaves de grafito gastados en el papel. Van de la linterna a su sitio
  del margen, del margen al mirador y de la linterna al gabinete.
- **Qué cuentan.** Que esos caminos existen porque los recorre cada día, haya alguien o no.
- **Coste.** Es una textura, sin ningún coste.

## 8.5 Lugares que solo dan vida al mundo

No muestran nada sobre Álvaro, pero hacen que el resto tenga sentido. Todos tienen una causa
física:

| Lugar o acontecimiento | Qué ocurre | Causa |
|---|---|---|
| **Las hojas en blanco** | Unas 45 hojas de pie en el anillo medio, como un bosque de preguntas sin escribir. Si Scope ilumina una, no aparece nada: ladea la cabeza y sigue | Su luz (regla 4); que no haya nada escrito también es información |
| **El lago de tinta** | Refleja la lámpara. De noche, su orilla es lo más oscuro del mundo | La mesa, hecha paisaje |
| **El polvo en el cono de la lámpara** | Motas que flotan y suben despacio dentro de la luz | El calor de la bombilla. Solo dentro del cono |
| **El radiómetro** | Gira | La luz |
| **La linterna encendida a lo lejos** | Desde cualquier zona, de noche, se ve dónde está su casa | Él está dentro |
| **Las cordilleras al atardecer** | La luz rasante dibuja sus pliegues | El sol bajo, por zonas |

Nada se mueve por un temporizador.

## 8.6 Interacciones físicas de Scope con su mundo

| Acción | Dónde | Gesto o canal | Necesita |
|---|---|---|---|
| Salir de la linterna al llegar tú; entrar a descansar | Linterna | Paso + Fit (encajar), aprobado | Capa procedural |
| Asomarse por la puerta cuando te mueves | Linterna | Peek | Capa procedural |
| Ordenar una pieza del gabinete | Gabinete | Nudge (empujar con la cara), aprobado | Clip nuevo (aprobado) |
| Acelerar el radiómetro con la mirada | Radiómetro | Su luz | Lo implementa el mundo; no hace falta clip |
| Iluminar una hoja en blanco y no encontrar nada | Anillo medio | Luz + Tilt | Clips aprobados |
| Mirar el horizonte al atardecer | Atalaya | Settle + mirada larga | Capa procedural |
| Subirse a MathView, a las gradas o al dial | Distrito | Paso | Capa procedural |
| Empujar la pelota | Gradas | Nudge | Clip nuevo |
| Esperarte en la puerta de un lugar importante | Entradas de zona | Paso + mirada | — |
| Enseñarte algo que no has visto | Toda zona | `guiar` (una vez por zona) | — |

**Comportamiento por lugar.** Cada lugar suyo tiene una entrada en la memoria de sesión (§4.7)
y reacciones propias:

- **En su linterna:** reposo más profundo.
- **En el gabinete:** curiosidad por lo nuevo que haya aparecido.
- **En la atalaya:** atención al horizonte, y no a ti.

**Prioridades.** Todo esto pertenece a «Vida propia» y «Curiosidad», por debajo de la compañía.
**Nada de esto interrumpe tu navegación ni tu lectura.**

## 8.7 Proyectos y contacto en el mundo nuevo

- **Las instalaciones no se mueven:** siguen en el círculo de la lámpara, en el centro del
  pliego. Ahora son lo que son en la historia: **los lugares más especiales de un mundo que ya
  existe**, y no piezas en un tablero.
- **El contacto, al pie de la lámpara,** queda sobre el papel en blanco: fuera de lo escrito,
  en el sitio de Álvaro.
  - Desde allí se ve el lago y el horizonte de noche.
  - La nota que escribes cruza el pliego y queda de pie junto a «· · ·». Una pregunta nueva en
    el borde de lo escrito.
- **El sistema de proyectos no cambia.** Las peanas libres siguen en el anillo tostado. Si un
  día el círculo se queda pequeño, el mundo tiene sitio: el papel en blanco es literalmente
  espacio para lo que vendrá.
- **La navegación accesible tampoco cambia:** el índice, las URLs, el historial, la vista de
  lectura y el contacto inmediato.

## 8.8 Lo que todavía no está bien en estos estudios

| Pieza | Problema | Cómo se resuelve en la Fase B |
|---|---|---|
| **Cordilleras** | Facetado de bloqueo: pueden recordar a un paisaje de videojuego *low poly* | Pliegues de verdad: tiras de papel plegadas en acordeón con bordes limpios, translucidez a contraluz y menos picos más grandes. Es un pase de arte en Blender (2.0-C) |
| **Terreno** | Demasiado uniforme de cerca | Textura de grano y huellas, y un poco más de tono en las dunas |
| **Lago** | Apenas se lee en el plano general | Más superficie a la vista desde las paradas y el reflejo de la lámpara |
| **Gama de color** | Demasiado gris a la hora del amanecer | Etalonaje por hora hacia la paleta de la biblia (marfil, lavanda, ámbar) |
| **Scope de noche** | En `v-linterna` se ve casi en silueta | Es intencionado (contraluz), pero en tiempo real su capa de presencia le da un rebote cálido |

## 8.9 Cambios en la hoja de ruta (Fase B)

| Entrega | Cambio |
|---|---|
| **2.0-A · Maqueta caminable** | **Incluye el entorno en bloque:** los tres anillos, el cielo por hora, la niebla y las reglas de composición. Es lo primero que se juzga, porque es lo que hace que el mundo sea un mundo |
| **2.0-B · Scope compañero** | Añade los lugares de Scope a la memoria y su vida propia: linterna, gabinete, radiómetro, atalaya y huellas, con prioridades por debajo de la compañía. El loader pasa a ser «Scope dentro de su linterna» |
| **2.0-C · Arte I** | Añade el pase de arte del entorno (cordilleras de papel de verdad, lago, etalonaje) y los lugares de Scope con luz horneada |
| **2.0-D, E, F** | Sin cambios de alcance. El contacto se ve desde el lago de noche |

## 8.10 Respuestas incorporadas

| Pregunta | Respuesta | Consecuencia |
|---|---|---|
| Mundo ampliado | Aprobado | Base de esta revisión |
| MathView | `github.com/AlvaroGaertnerGit/MathView-Frontend` y `MathView-API` | Inspeccionados; ver `03-proyectos.md` §3.1. **La API apunta a un servidor de Azure que hoy no resuelve**: no hay demo en vivo |
| Tournamently | Repositorio público | Se copia `bracket.ts` con su procedencia y se incrusta la web |
| Contacto | `contact@alvarogaertner.com`, LinkedIn y GitHub confirmados | Sin pendientes |
| Docencia | FP de SMR y ASIR en GSD Guadarrama | El aula cambia de contenido (ver `02-mundo.md`). **Aviso:** `about-content.ts` de producción dice «Software Development», que no coincide |
| Locomoción | A mi criterio | Capa procedural (A) primero, clips solo si hacen falta |
| Acciones de Scope | Aprobadas | Fit, Nudge y su luz como único poder |
| `docs/` en `tsconfig` y ESLint | Aprobado | Se hará al empezar la Fase B, como primer cambio de configuración |
