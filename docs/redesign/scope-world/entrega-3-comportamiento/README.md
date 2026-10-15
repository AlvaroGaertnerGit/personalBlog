# Scope World 2.0 · Entrega 3: dar vida a Scope

Estado: **laboratorio para que lo pruebes.** No es la integración en el mundo (eso es la
Entrega 4, que no he empezado).

- Producción, el modelo de Scope, su GLB, su rig y sus clips: **intactos**.
- El prototipo 1.0, el visor de la Entrega 2 y MathView: **intactos** (se importan en solo lectura).
- Sin commits, sin despliegues, sin dependencias nuevas. Puerto 3120 (nunca el 3000).

## 1. Cómo probarlo

Desde la raíz del repositorio:

```
node docs/redesign/scope-world/entrega-3-comportamiento/lab/tools/build.mjs
node docs/redesign/scope-world/entrega-3-comportamiento/lab/tools/serve.mjs
```

Abre **http://localhost:3120/** (Chrome o Edge, mejor con GPU). `Ctrl+C` cierra el servidor.

| Para | Cómo |
|---|---|
| Recorrer su rincón | Rueda, deslizar, ← → o los botones de lugar |
| Tocarle | Clic sobre él, o sobre la bola, la flor, el radiómetro, la linterna, el gabinete o el suelo |
| Leer | «Leer la nota» o la tecla **L** |
| Ver qué piensa | **D** o `?debug`: estado, prioridad, por qué, mirada, distancia, memoria y decisiones |
| Probar rutinas lentas | «Tiempo ×4» (el refugio llega a los 30 s quieto en la linterna) |
| Comparar con la 1.0 | «Banco de pasos» o `?banco` |
| Otros | `?hora=noche` · `?lugar=0…4` · `?reduced` · `?ligero` (sin el relieve 2.0) |

Prueba recomendada (unos 3 minutos): entra, espera a que te enseñe su casa, avanza un lugar
cada vez dejando que te enseñe cada cosa, vuelve atrás, tócale varias veces, abre una nota, y
quédate quieto en la linterna (de noche) hasta que entre a descansar; luego muévete.

## 2. Qué hay

```
lab/
  index.html                 la página (HUD accesible, responde en móvil)
  src/main.ts                la página: la app común de Scope World con la definición del laboratorio
  src/lab-world.ts           lugares, ruta, bandas de compañía, tiempos (coordenadas Blender)
  src/lab-ground.ts          el suelo compuesto (el mapa 1.0 y los obstáculos del laboratorio)
  ../../core/                desde la Entrega 4, el código de Scope y del entorno es común (core/):
                             scope/mind (la mente), scope/body (locomotor, paso, acciones, actor),
                             scope/props.ts (bola, flor, radiómetro), env/stage.ts, app/
  src/bench.ts               el banco de pasos (2.0 junto al ScopeActor 1.0, sin modificar)
  tools/                     build.mjs · serve.mjs · verify.mjs
DISEÑO.md                    el diseño que aprobaste (sigue vigente)
```

**El escenario** es el rincón real de Scope en el mundo aprobado: el pliego 1.0, el relieve y
el cielo de la Entrega 2, **su linterna y su gabinete reales**. Son del laboratorio la bola de
papel, la flor de luz y una copia del radiómetro. El radiómetro está **movido**: en su sitio de
la 2.0 no hay suelo transitable a menos de 15 cm (ver §6).

## 3. Comportamientos implementados

### Mente: prioridades sin contradicciones

Dos capas que no se pisan: **la actividad** (dónde está y qué hace) y **la atención** (solo la
mirada). Seis grupos de prioridad:

| Prioridad | Grupo | Estados |
|---|---|---|
| 4 | Respuesta | reacción al clic · acudir a lo que señalas · sorpresa |
| 3 | Compañía | salir del refugio · guiar · reagrupar · acompañar · esperar (leyendo) · volver a tu lado |
| 2 | Curiosidad | enseñar lo que ofrece el lugar · recordar · investigar |
| 1 | Vida propia | refugio · descansar |
| 0 | Reposo | reposo |

- Un grupo superior solo entra **cuando el cuerpo lo permite**: nunca a mitad de un empujón,
  de un meneo o de un clip (los gestos de reposo sí se funden si tiene que irse contigo).
- Uno inferior nunca interrumpe: el comportamiento actual sigue mientras tenga sentido.
- **Los lugares declaran lo que ofrecen** (`STATIONS[].offer`): añadir uno no toca la mente.
- Cada decisión deja una frase legible en el panel («vas hacia «La flor de luz», que aún no
  has visto: se adelanta para enseñártelo»).

### Acompañamiento

| Cuando tú… | Scope… |
|---|---|
| Te pones en marcha | Lo reconoce al instante (la mirada) y arranca **con** la cámara, no detrás (medido: 0,02 s) |
| Vas hacia un lugar que no has visto | **Se adelanta** con prisa, te espera allí alternando la mirada entre la cosa y tú, y al llegar te la enseña. Una vez por lugar |
| Avanzas por lugares vistos | Va contigo, un poco por delante, mirando el camino y comprobando de vez en cuando que vienes |
| Te paras | Si está cerca y se le ve, **se queda donde está**; si no, vuelve a tu lado sin prisa |
| Te quedas leyendo | No se mueve ni hace gestos; a los 8 s se asienta a esperar (en la linterna, entra a descansar) |
| Saltas lejos de golpe | Abre los ojos (sorpresa) y reagrupa con prisa: nunca más de 6 s lejos (medido: 3,4 s) |
| Vuelves a un lugar visto | Te mira al dar la vuelta y luego mira lo que hizo allí; al llegar, lo recuerda (un Focus) |
| No haces nada | Una sola mirada por visita a cada lugar, investiga una cosa cercana, y a los 45 s descansa |

Bandas (escala del laboratorio, lugares a ~0,27 m): cómoda ≤ 0,22 m, tensa ≤ 0,5 m, perdido
más allá o más de 3 s fuera de cuadro. «Demasiado cerca» se mide **a la cámara**, no al ancla.

### Locomoción: «pasito con balanceo»

- **Movimiento continuo de la raíz** (`locomotor.ts`): acelera y frena dentro de límites, llega
  frenando hasta cero exactamente en su sitio, gira con velocidad limitada; si el camino empieza
  a su espalda, gira primero sobre el sitio a pasitos.
- **Anticipación**: antes del primer paso se recoge 0,12–0,2 s (squash y peso atrás).
- **Tres marchas** (`gait.ts`): paseo (7 cm/s, pasos diagonales, casi sin vuelo, manda el
  balanceo), trote (13 cm/s, pasos más rápidos) y prisa (22 cm/s, saltitos de 7 mm con squash al
  despegar y al aterrizar).
- **Sin deslizar**: la pata apoyada retrocede a la velocidad del cuerpo, así que queda plantada.
  La cadencia sube con la velocidad (pasitos cortos) para no estirar la pata más de 9 mm.
- **Peso e inercia**: inclinación con la velocidad y la aceleración, balanceo con cada paso,
  hacia dentro de las curvas; todo por muelles, así que al parar se asienta con un pequeño
  sobreimpulso. La antena no se anima: el muelle de producción reacciona al movimiento real.
- **Huesos aprobados, nada más**: `hop` (elevación), `squash` (volumen constante) y `body`
  (inclinación, con pivote en el centro, como los clips) y las cuatro patas. Escritos después del
  mezclador con la misma regla de capas que la capa secundaria de producción.

### Las tres interacciones

| Acción | Fases | Lo que responde |
|---|---|---|
| **Encajar en su hueco** (la linterna) | va a la puerta → se cuadra con ella (es solo un poco más ancha que él) → entra agachándose un poco → sube al plato (7 mm) → se da la vuelta a pasitos → se acomoda con un meneo que se apaga y se hunde un poco | La linterna brilla con **su** luz desde dentro. Sale en 0,02 s si te mueves: se asoma, y sale por la puerta |
| **Empujar con la cara** (la bola) | se coloca detrás → se cuadra → se prepara (se agacha, peso atrás) → embiste 3,5 cm con la cara → se recupera → la mira rodar | Física 2D: el cuerpo de Scope es un colisionador en movimiento; la bola recibe el impulso de **su velocidad real** en el contacto (medido: 0,29–0,34 m/s, rueda 10–16 cm), rebota en lo sólido y se frena. Si la golpea sin querer, también se mueve; si le llega rodando, se sorprende |
| **Activar con su luz** (la flor, el radiómetro) | se coloca a un lado (nunca tapándolo) → se orienta → reúne su luz (anticipación) → ilumina → reacciona si funcionó → apaga | Un foco real sale de su cara. La flor y el radiómetro reciben la irradiancia **de ese mismo cono**: la flor la acumula y se abre (y su semilla brilla); el radiómetro gira con ella (21 rad/s con su luz, 0,3 rad/s solo con la lámpara) y se frena si él aparta la luz (1,5 rad/s a los 12 s) |

### Personalidad

- **Clic, según el contexto**: normal, se gira hacia ti y hace ClickReaction; de camino, se
  para, te mira y da un saltito; en su casa, se asoma; mientras lees, solo parpadea. Segundo toque
  en 8 s: ladea la cabeza; del tercero en adelante, solo parpadea (no premia la insistencia).
- **Cuando le miras** (el puntero sobre él más de 0,5 s) te devuelve la mirada; si sigues, vuelve
  a lo suyo y no te mira otra vez en 12 s.
- **Le llama la atención** lo que se mueve o cambia cerca (la bola rodando, el radiómetro, la flor
  al abrirse), y se acostumbra.
- **Memoria de la visita**: lugares visitados, guiados y enseñados, lo último que hizo en cada
  uno, clics recientes y los últimos clips (anti-repetición: nunca dos gestos seguidos de la
  misma familia, con enfriamientos).
- **Según la zona**: en la linterna te enseña su casa y descansa en ella; en el gabinete mira lo
  que ha encontrado (o devuelve la bola a su rincón si ha rodado hasta allí); en la bola, te la
  acerca; en la flor y el radiómetro, experimenta con su luz.
- **Puede estar tranquilo**: en 10 minutos simulados, la calma ocupa más de la mitad del tiempo.
  Lo que enseña un lugar se enseña una vez por visita, no en bucle.

## 4. Frente al comportamiento anterior (1.0)

| | 1.0 | Entrega 3 |
|---|---|---|
| Desplazamiento | Saltitos con el clip Bounce y la raíz teletransportada entre `push` y `landing` | Raíz continua, tres marchas de pasitos, anticipación, frenada, giros a pasitos |
| Peso | Ninguno entre saltos | Inclinación con velocidad y aceleración, balanceo, sobreimpulso al parar, antena por inercia |
| Compañía | Reaccionaba al llegar la cámara; exploraba con un temporizador | Arranca contigo, se adelanta a enseñarte, va a tu lado, te espera, vuelve si se aleja |
| Objetos | Los miraba | Los empuja, los ilumina, se mete en su casa; responden por física y por luz |
| Memoria | Ninguna | Lugares, cosas hechas, clics, clips |
| Clic | Siempre ClickReaction | Según contexto e insistencia |
| Reposo | Igual en todas partes | Una mirada por visita, investigar, descansar, refugio |

El **banco de pasos** (`?banco`) pone los dos uno junto al otro recorriendo la misma distancia.

## 5. Pruebas realizadas

**Automáticas** (desde la Entrega 4 están en `core/` y se ejecutan con `node docs/redesign/scope-world/core/tools/check.mjs`, o con `node --test docs/redesign/scope-world/core/scope/body/locomotor.test.ts docs/redesign/scope-world/core/scope/mind/mind.test.ts`): **21 de 21**.
Continuidad de velocidad (incluido el último fotograma), sin teletransportes, anticipación,
giro sobre el sitio, reobjetivo sin reinicio, frenada; arranca contigo, nunca perdido más de 6 s,
guía una vez, enseña una vez por visita, leyendo quieto, clics sin escalada, un clic no corta un
empujón, refugio (entra solo tras el tiempo, sale en menos de 1 s), reconoce el regreso, una
mirada por visita, anti-repetición, movimiento reducido, la calma domina.

**Navegador** (`node docs/redesign/scope-world/entrega-3-comportamiento/lab/tools/verify.mjs`,
arranca y cierra su propio servidor en el 3121): **20 de 20**, consola sin errores ni avisos.
Usa la simulación paso a paso (`window.__lab.advance`), así que el resultado no depende de los
FPS. Incluye móvil (iPhone 13, táctil), movimiento reducido, banco de pasos y la integridad del
paso: squash 0,958–1,012 (Bounce aprobado: 0,91–1,07), vuelo 7 mm (Bounce: 11 mm), la carcasa
nunca atraviesa el plano donde se apoya (mínimo +0,04 mm).

**Rendimiento medido con GPU** (GTX 1660 Ti, 1440×900, mundo completo): **143 FPS, p95 7,1 ms**,
83 llamadas de dibujo, 189 000 triángulos. Es un equipo de escritorio: falta medir en un
portátil con gráfica integrada y en un móvil real.

**Probado a mano en el navegador**, con capturas revisadas: los cinco lugares, la guía, el
empujón, la flor y el radiómetro de día y de noche, el refugio de noche, la salida, los clics
repetidos, el salto rápido con la rueda y el arrastre, el móvil en vertical.

**Corregido gracias a las pruebas**: el foco de su luz nacía a 1 m de su cara (los focos de
three.js empiezan en (0, 1, 0)); las demostraciones se repetían cada 40 s; oscilaba de camino a
casa; el empujón mandaba la bola 33 cm; tapaba la flor al iluminarla; un muro invisible de 1,5 cm
en el borde del mapa 1.0 obligaba a rodeos largos; inclinarse desde `hop` hundía las patas de un
lado (ahora se inclina desde `body`, como los clips).

## 6. Limitaciones conocidas

- **No lo he visto en un móvil real** ni medido en GPU modestas. El táctil se probó emulado.
- **El paso es procedural.** Para mi gusto ya no se desliza ni se teletransporta, pero un animador
  lo afinaría más con clips horneados (Fase A §4.9, opción B). Eso tocaría el archivo maestro y
  el GLB, así que necesita tu aprobación.
- **Sin IK por pata**: en el borde del pliego (1,2 mm de grosor) una pata puede quedar un
  milímetro dentro del escalón.
- **Encuadres**: al iluminar el radiómetro se le ve de perfil (detrás no hay suelo). Para ponerse
  detrás de la bola a veces da un rodeo de varios segundos.
- **«Noche»** se ve poco oscura en el laboratorio: es el mundo 1.0 con la lámpara apagada.
- La flor, la bola y la copia del radiómetro son **solo del laboratorio**. Las imágenes del
  refugio y los mecanismos son de mi revisión; no hay galería de capturas en el repositorio.
- El laboratorio expone `window.__lab` (incluido el actor) para las pruebas.

## 7. Qué haría falta para integrarlo en Scope World (Entrega 4)

1. **Un sitio con suelo para el radiómetro.** En (0,10, 0,30) no hay suelo transitable a menos de
   15 cm en `nav.bin`. Hay que moverlo o abrir suelo en el Blender del mundo.
2. **Un mapa de navegación del mundo 2.0** exportado de Blender, que incluya el papel alrededor
   del pliego, la linterna (con el interior solo accesible por la puerta) y el gabinete. Ahora el
   laboratorio compone el mapa 1.0 con obstáculos a mano (`lab-ground.ts`).
3. **Escala de las bandas**: las del laboratorio son para lugares a 0,27 m; en el mundo, a
   1–2 m, vuelven a las de la Fase A (0,45 / 0,9 m) y harán falta los atajos por los huecos.
4. **Un módulo compartido del entorno**: `stage.ts` duplica el montaje del visor de la
   Entrega 2, cuyo `main.ts` no es reutilizable.
5. **Un gancho público en `scope-3d-secondary.ts`** para la presencia (hoy se envuelve
   `applyDrift` en la propia instancia), y decidir si la capa de paso pasa al motor de producción.
6. **Ofertas para los lugares reales**: MathView, las preguntas, la lámpara… se añaden como
   `offer` sin tocar la mente.
7. **Excluir `docs/` del `tsconfig` y de ESLint** antes de que el laboratorio conviva más con
   producción (riesgo ya anotado en la 1.0; ahora mismo `tsc` y ESLint pasan).

## 8. Recomendación

1. **Pruébalo tú** con la prueba recomendada de §1 y el banco de pasos, y dime qué marcha y qué
   tiempos te convencen. Los números están juntos en `config.ts` y al principio de `gait.ts`.
2. Si el paso te convence, **integrarlo así** (procedural) en la Entrega 4. Si te parece aún
   mecánico, pasar a clips horneados en Blender (necesita tu aprobación expresa).
3. Medir en un portátil medio y en un móvil real antes de integrar.
4. Para la Entrega 4: primero el mapa de navegación 2.0 y el sitio del radiómetro (§7, 1 y 2).
