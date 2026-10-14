# Scope World: concepto y propuesta narrativa

Estado: **Entrega 1, pendiente de aprobación.** Esta fase es solo de diseño: no hay cambios en
producción ni en el modelo, el rig, las animaciones o el loader.

## 1. Qué he revisado antes de inventar

| Fuente | Qué he tomado de ella |
|---|---|
| `docs/scope-docs/scope/` (SCOPE, VISUAL_LANGUAGE, WORLD, PERSONALITY, CONSTRAINTS) | Scope es «curiosity, made physical»: un ser diminuto, sin brazos ni voz, de cerámica marfil, con la cara negra y ojos ámbar que son luz. Nunca guía ni explica; no es el protagonista. WORLD.md: el mundo es un solo lugar continuo, sus objetos existen porque un momento los necesita y «not everything in Scope's world is about Scope». |
| `assets/scope-3d/` (`.blend`, GLB, `clips.py`, `render_loader.py`) | Escala real: un cuerpo de unos 150 mm. Rig `root › hop › squash › look › body › ojos, antena 1–2 y 4 pies`; 12 clips aprobados (§5 de `03-storyboard.md`). |
| Loader («Scope está explorando») | La noche azul marino en la que Scope explora antes de que llegues. Este mundo empieza exactamente ahí. |
| `src/components/sections/*-content.ts` | Hechos reales: Álvaro, docente de Desarrollo de Software en Gredos San Diego Guadarrama; Tournamently, Sport Coach, MathView y esta web. El cuaderno abierto, con 6 líneas de investigación (pregunta, estado y relaciones). La carta de contacto que Scope se lleva. La filosofía: «Everything I learn turns into something I build or something I teach.» |
| `docs/redesign/` (fase 1) | La auditoría y la dirección C («el reverso»). Su idea sobrevive aquí como mecánica (el contraluz), no como estética. |

## 2. Premisas exploradas y descartadas

| Premisa | Por qué no |
|---|---|
| **Observatorio:** Scope como telescopio y un cielo de ideas | Fondo espacial convencional, justo lo que pide evitar el brief. Sin relación física con el trabajo real. |
| **La casa de habitaciones** (WORLD.md tal cual) | Coherente, pero reproduce las «cinco habitaciones independientes» que el brief rechaza. |
| **El reverso** (dirección C de la fase 1) | Muy potente como idea, pero es una capa, no un lugar. Se conserva como regla del mundo: lo escrito se lee a contraluz. |
| **El taller con horno:** el papel se cuece en un horno | Tenía el material correcto, pero el horno era un objeto ajeno a una mesa de trabajo. Lo sustituye una regla mejor: la luz de la lámpara cuece. |

## 3. Propuesta elegida: **Pliego**

> Un pliego es una hoja grande de papel, y también lo que queda al plegarla.

**Scope World es un pliego enorme sobre la mesa de Álvaro, bajo su lámpara.** Todo lo que hay
en él está cortado y plegado de esa misma hoja (kirigami): no se pega nada, todo se levanta del
papel y deja su hueco.

Rige una sola ley:

> **El papel es lo que todavía no existe. La luz sostenida el tiempo suficiente lo cuece en
> porcelana.**

- El papel son las preguntas, los bocetos y las notas.
- Bajo la lámpara hay un círculo donde el pliego ya se ha cocido: ahí están las cosas
  construidas, los proyectos.
- En el borde del círculo, el papel se tuesta y lo que lo cruza es mitad papel, mitad
  porcelana.
- Scope es de porcelana porque fue **la primera pieza que se coció entera**. Su silueta
  recortada sigue en el margen del pliego, el sitio del que salió.

### Por qué esta y no otra

| Nivel | Cómo lo cumple |
|---|---|
| **Narrativo** | Traduce literalmente la filosofía real de Álvaro: aprender (preguntas de papel) → construir (piezas cocidas) → enseñar (el patrón para que otros plieguen la suya). La conversación final (la nota) cierra el ciclo con una pregunta nueva. Nada sucede «porque sí»: la luz, el plegado y la cocción son las únicas causas del mundo. |
| **Visual** | Tiene una firma que se reconoce **sin Scope**: papel marfil pautado, el margen bermellón, el anillo tostado y la porcelana vidriada dentro del círculo de luz. La paleta y el material salen del propio Scope (cerámica marfil, ámbar, la noche del loader). No hay neones, ni cristal, ni plataformas flotantes. |
| **Interactivo** | Cada estado tiene una consecuencia física y legible. Una hoja puede estar plana, levantándose, de pie, plegándose, cruzando el borde o cocida. La luz revela lo escrito; acercar algo a la lámpara lo cuece. Scope no tiene brazos y su herramienta es la luz de sus ojos: su atención también ilumina. |
| **Viabilidad** | La geometría es casi toda plana (hojas, pliegues, recortes) y los materiales son tres (papel, porcelana y la noche de la mesa). Hay una luz principal y otra de ambiente. Es de las escenas más baratas posibles en WebGL; sus límites se tratan en la Entrega 2 (§16 del brief). |
| **Fidelidad a Scope** | Escala real: el mundo cabe en una mesa porque Scope mide 15 cm. No se modifica nada del personaje. Sigue siendo silencioso, curioso y secundario: el mundo es de Álvaro y Scope lo habita y lo cuida. |

## 4. Las doce preguntas (§4.1 del brief)

1. **¿Qué es Scope World?** El pliego de trabajo de Álvaro: una sola hoja, cortada y plegada,
   donde esperan las cosas que aún no existen.
2. **¿Por qué existe?** Porque todo lo que Álvaro construye empieza como una pregunta escrita a
   lápiz. Es el lugar donde se piensa antes de construir.
3. **¿Qué papel ocupa Scope?** Es el único nativo: la primera pieza cocida, hecha del mismo
   pliego. No es dueño, ni guía, ni narrador. Es el habitante que lo recorre por curiosidad y lo
   cuida.
4. **¿Qué hace cuando está solo?**
   - De noche recorre el margen leyendo la pauta con la luz de sus ojos.
   - Vigila las hojas que empiezan a levantarse.
   - Sigue los pliegues.
   - Se para en el borde tostado, donde el papel cambia.
   - Se recoge en su propio recorte.
5. **¿Qué relación tiene con su creador?** El mundo es su mesa y la lámpara, su atención. Álvaro
   nunca aparece, pero deja huellas:
   - su letra a lápiz en las preguntas;
   - el lápiz de verdad, a escala real;
   - el hilo rojo que une ideas;
   - el patrón del aula.
6. **¿Por qué existen los lugares?** Cada uno es una fase real del trabajo: preguntarse (campo de
   preguntas), construir (círculo de la lámpara), enseñar (aula) y conversar (pie de la
   lámpara). El margen es el borde por donde se entra en la hoja.
7. **¿Cómo están conectados?** Por un único pliegue largo que cruza la hoja en diagonal, desde
   el margen hasta la luz, y por el anillo tostado. La lámpara se ve desde cualquier punto.
8. **¿Qué provoca los cambios?** Solo tres causas:
   - la hora, marcada por la ventana;
   - la lámpara, encendida o apagada;
   - lo que se pliega o se cuece.
9. **¿Qué descubre el visitante?** Quién es Álvaro, qué se pregunta, qué ha construido, cómo
   enseña y que él también puede escribir.
10. **¿Qué evolución tiene el recorrido?** Es un día de trabajo: noche → amanecer → día →
    atardecer → noche de lámpara. El contenido avanza en paralelo: pregunta → pieza → patrón →
    conversación.
11. **¿Qué sucede al terminar?** El visitante deja una nota plegada al pie de la lámpara. Scope
    la lleva al campo y la planta de pie entre las preguntas: es una pregunta nueva. La lámpara
    se apaga.
12. **¿Cómo continúa la vida de Scope?** Con la luz de sus ojos, como en el loader. Si el
    visitante vuelve, su nota sigue plegada donde Scope la dejó. Solo él la ve: se guarda en su
    navegador, nunca se publica y nunca se lee.

## 5. Qué queda fuera de esta entrega

Estos puntos son de la Entrega 2:
- interacciones detalladas;
- secuencia de un objeto;
- rutinas autónomas;
- renders de transformación;
- escenas de proyectos;
- propuesta técnica completa.

Esta entrega fija el mundo, su historia y su geografía, y los muestra.
