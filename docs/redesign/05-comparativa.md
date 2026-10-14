# E. Comparativa y recomendación

Las puntuaciones van de 1 a 10. Son **una herramienta de decisión propia**, no una simulación
del jurado de CSSDA ni una promesa de premio. Como referencia, el estado actual de la web
está puntuado con el mismo criterio.

| Criterio | Actual | A · Margen | B · Estudio nocturno | C · A través de Scope |
|---|---|---|---|---|
| Originalidad | 4 | 5 | 7 | **9** |
| Calidad estética | 5 | 8 | **9** | 8 |
| Coherencia visual | 4 | **9** | 8 | 8 |
| Integración del 3D | 4 | 7 | **9** | 8 |
| Interactividad | 5 | 5 | 7 | **9** |
| Narrativa | 6 | 6 | 7 | **9** |
| Calidad de movimiento | 6 | 7 | **8** | 8 |
| Usabilidad | 6 | **9** | 6 | 8 |
| Accesibilidad | 6 | **9** | 6 | 8 |
| Rendimiento | 7 | **9** | 5 | 8 |
| Viabilidad técnica | — | **9** | 4 | 7 |
| Potencial en CSSDA | 3 | 6 | 8 | **9** |
| **Media** | **5,1** | **7,4** | **7,0** | **8,3** |

## Por qué cada puntuación

**A.**

- Corrige todo lo verificable con el menor riesgo. Por eso saca la nota más alta en
  coherencia, usabilidad, accesibilidad, rendimiento y viabilidad.
- Su techo está en la originalidad. Una monografía bien compuesta es exactamente lo que hacen
  muchos portfolios premiados con «Typographic»: compite en el terreno de Lee Holmes o
  Cristiana Araújo, donde la ventaja la da la ejecución y no la idea.
- Scope gana integración (la regla, la sombra y la mirada), pero sigue siendo «un personaje
  en el margen».

**B.**

- Es la que mejor resuelve la queja original (Scope «pegado») y la más cinematográfica.
- Lo paga en rendimiento (WebGL a pantalla completa y DOM en perspectiva), en legibilidad (la
  penumbra) y en usabilidad (scroll guiado).
- Su viabilidad es baja en este contexto. No hay GPU para validarla aquí y necesita props 3D
  nuevos.
- Además, compite contra agencias especializadas en su propio terreno.

**C.**

- Es la única que tiene **una idea que solo puede ser de esta web**: Scope (la lente) × el
  oficio (enseñar workflows con IA) × el material real del proyecto (docs, sprints, rig,
  commits).
- Es la mejor candidata para Innovation, la categoría donde los portfolios WOTD recientes
  sacan sus mejores notas (EddyOS: 8,76).
- Hereda de A la legibilidad y el rendimiento.
- Pierde algo de usabilidad y accesibilidad frente a A porque añade un modo nuevo que hay que
  aprender y hacer accesible.
- Su riesgo principal no es técnico: es **editorial** (que los reversos sean buenos).

## Recomendación

### Dirección C, construida sobre el sistema de A, con dos principios tomados de B

Razones:

1. **Da a la web una razón para existir visualmente** (criterio 12 del brief). Ninguna otra
   web puede ser «la web que enseña su reverso a través de su mascota».
2. **Scope deja de ser decoración.** Su mirada tiene una función (señala lo que se revela) y su
   nombre, un significado. Además, se respeta el canon: no habla y solo observa.
3. **El orden de implementación reduce el riesgo.** La fase 1 es literalmente la dirección A.
   Si la lente no convenciera, la web ya habría mejorado de 5,1 a 7,4 en esta matriz.
4. **Rendimiento y degradación quedan intactos.** La lente es CSS (`clip-path`/máscara sobre
   una capa dispersa) y no añade WebGL.
5. **Es honesta con el perfil.** No se presenta como una agencia inmersiva, sino como alguien
   que construye con IA y lo enseña.

De **B** se adoptan solo dos principios baratos:

- **Una luz común.** Hay una dirección de luz clave para toda la web (arriba a la izquierda,
  como en el render de Scope), su luz cálida tiñe las superficies cercanas (una variable CSS)
  y Scope proyecta sombra de contacto sobre superficies reales de la página.
- **Continuidad con la noche.** El modo oscuro y el reverso usan la noche azul de la entrada.

### Qué cambiaría y qué conservaría

| Conservar | Cambiar |
|---|---|
| El modelo 3D, el rig, los clips, la entrada y su señal de disponibilidad | El hero completo: nombre a escala de cartel, sin marco de cristal, con Scope en el primer viewport |
| Geist, Geist Mono (por fin en uso) y Newsreader | La paleta: de gris de croma 0 a marfil, noche y ámbar derivados de Scope |
| Una sola instancia de Scope que viaja (el sistema de docks) | Los docks pasan de estar «dentro de cajas» a estar «sobre superficies» (reglas, bordes de imagen) |
| El orden narrativo: quién → trabajo → libreta → carta | Las tarjetas de cristal se sustituyen por la composición editorial |
| La carta del Contact y su secuencia | El contraste papel/mesa, el peso del CTA y un pie real |
| Los tokens de movimiento y el muelle `companion` | `fadeInUp` universal → reglas que se dibujan + titulares por línea |
| La imagen de respaldo como degradación | Los mundos vectoriales de proyecto se sustituyen por capturas y vídeo reales |
| El Notebook como ruptura de ritmo | La navegación: cabecera con firma e índice; desaparece la píldora móvil que tapaba texto |
| El 2D de Scope solo en el email (allí es necesario) | El Scope 2D de la tarjeta Sport Coach |
