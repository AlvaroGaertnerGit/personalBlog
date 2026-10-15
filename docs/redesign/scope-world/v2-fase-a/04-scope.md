# 4. Scope como compañero

## 4.1 Diagnóstico de la 1.0

| Síntoma | Causa |
|---|---|
| Llega siempre tarde | Solo reacciona cuando la cámara ya ha llegado a la nueva parada. Para entonces le faltan 0,4 m o más, y avanza a 13 cm/s |
| Se sale de cuadro | No sabe si se le ve ni a qué distancia está de ti |
| Hace su vida | Explora con un temporizador (cada 7–13 s) hacia puntos de la parada, elegidos sin pensar en ti |
| Se repite | Elige el gesto sin memoria de los anteriores |
| No te espera | No sabe cuándo estás leyendo |
| Parece un muñeco | Se desplaza con `Bounce`, que es un saltito espontáneo, no una forma de andar |

## 4.2 El filtro del canon

Todo lo que sigue pasa por el canon aprobado (`docs/scope-docs/scope/BEHAVIOUR.md`,
`CONSTRAINTS.md`, `SCOPE_3D_ANIMATION.md`). Lo que pide el brief encaja así:

| Pide el brief | Cómo encaja |
|---|---|
| Que te acompañe y reconozca la zona | ✔ Es reaccionar a algo real: tú te has movido |
| Que se adelante a enseñarte algo | ✔ Como mucho una vez por zona, y solo a algo que no hayas visto. Si se repitiera, «pediría atención» |
| Que te mire si llevas un rato quieto | ✔ **Una sola mirada**, sin ir a más. El canon prohíbe lo que crece cuanto más se le ignora |
| Que juegue con el entorno | ⚠ Scope no tiene manos. Actúa con **la luz de sus ojos** (canal canónico), **la cara** (empujar: la pose experimental de la Entrega 1.5) y **el cuerpo** (subirse, encajar, sentarse). El empujón necesita un clip nuevo (§4.9) |
| Que active elementos | ✔ Con su luz: la letra a contraluz, las curvas de MathView, la pieza del aula. Es su único poder sobre el mundo; **no le doy otro** |
| Reacción expresiva al clic | ✔ ClickReaction (Stretch → Laugh) ya está aprobada. Lo nuevo es el contexto: antes de reaccionar se orienta hacia ti, y después mira lo que estaba mirando |
| Sorpresa y timidez | ✔ Con el vocabulario que ya tiene: ojos más altos (`Tall`), un paso atrás, entornar. Sin formas nuevas de ojos |
| Que nunca hable | ✔ Sin bocadillos ni texto |

## 4.3 Capas y prioridades

Se mantiene la idea de la 1.0, con dos capas que nunca se pisan. **La actividad** decide dónde
está y qué gesto hace; **la atención** decide solo la mirada. Las actividades se ordenan así:

| Prioridad | Grupo | Estados | Qué lo interrumpe |
|---|---|---|---|
| 5 | **Guion** | `entrada`, `cierre` (el contacto), `movimiento-reducido` | Nada |
| 4 | **Respuesta** | `reaccion-clic`, `proyecto` (abierto), `nota` | Solo el guion. Nunca se corta un salto en el aire ni un clip a medias: se termina y luego se cambia |
| 3 | **Compañía** | `reagrupar`, `cambio-de-zona`, `guiar`, `esperar` | Una respuesta |
| 2 | **Curiosidad** | `inspeccionar` (objeto cercano), `jugar` (objeto con interacción) | La compañía: si te vas, deja lo que está haciendo |
| 1 | **Vida propia** | `pasear` (cerca, sin alejarse), `descansar` | Todo lo demás |
| 0 | **Reposo** | `idle` | — (es el estado dominante) |

**Reglas de convivencia:**

1. **Leer manda.** Con una ficha o una nota abiertas, o el puntero quieto sobre un texto más de
   2 s, se pasa a `esperar`: no se desplaza ni hace gestos, salvo parpadeos.
2. **Nada de vida propia mientras navegas.** Si la cámara se mueve, la curiosidad se aplaza.
3. **Un objetivo cada vez.** Si cambia el destino a mitad de camino, termina el salto y
   recalcula; nunca da media vuelta en el aire.

## 4.4 El modelo de compañía

La distancia se mide entre Scope y **el ancla del visitante**: el punto del suelo que mira la
cámara en la parada actual. La visibilidad, con su caja en pantalla.

```
      demasiado cerca   cómoda               tensa                 perdido
   |──────0,12 m──────|──────0,45 m─────────|──────0,9 m──────────|────────►
   se aparta un paso   libre: curiosidad,    vuelve hacia ti        reagrupar
   (timidez)           paseo, juego          en 4–8 s, sin prisa    (prioridad 3, con prisa)
```

- **Fuera de cuadro.** Más de 3 s fuera de cuadro en la parada actual equivale a «perdido»,
  aunque esté cerca.
- **Al reagrupar.**
  - Va por el camino, con paso de prisa (§4.9).
  - Al entrar en cuadro aminora.
  - Al llegar, te mira: un BlinkDouble solo si ha tardado más de 4 s.
- **Atajos con sentido.** Si el visitante salta a una zona lejana con el índice, Scope no
  recorre 4 m a saltitos ni aparece de la nada. Usa los huecos del kirigami y el rizo como
  túneles: entra por un hueco cercano y sale por el más próximo al destino. La cámara le ve
  salir.
- **Con movimiento reducido.** Ya está en su sitio cuando la cámara corta.

## 4.5 Coreografía de un cambio de zona

Con ← o la rueda, de la parada 3e (el taller) a la 4a (el círculo):

| t | Visitante | Scope |
|---|---|---|
| 0 | Empieza a moverse | Los ojos siguen la dirección del movimiento (la atención reacciona al instante) |
| 0,25–0,6 s | La cámara vuela | Reacción con retardo variable, que es personalidad: un pequeño impulso (anticipación) y se pone en marcha **con la cámara**, no detrás de ella |
| Durante el vuelo | | Si la zona es nueva para él, va un poco detrás, mirando a los lados. Si la conoce y hay algo sin ver, **se adelanta** |
| Llegada | La cámara se asienta | Si es nueva: LookAround al llegar, la primera vez. Si vuelve: te mira y, si hay algo nuevo, va hacia ello |
| +1,5–4 s | Lees o miras | `esperar` o curiosidad, según lo que hagas |

**Primera visita y vuelta.** Las reacciones distintas salen de la memoria (§4.7):

| | Primera visita a la zona | Vuelta a una zona conocida |
|---|---|---|
| Al llegar | LookAround: descubre | Sin gesto; va directo a su sitio preferido de la zona |
| Si abriste algo allí | — | Lo mira primero y luego a ti: se acuerda |
| Si hay algo que no has visto | Lo inspecciona él primero | Se adelanta para enseñártelo (`guiar`), una vez |

## 4.6 Cuando el visitante no hace nada

| Sin actividad | Scope |
|---|---|
| 0–15 s | Lo normal: reposo, mirada suelta, curiosidad por lo cercano |
| 15–25 s (variable) | **Una mirada a ti**, con los ojos un poco más altos, y vuelta a lo suyo. Una vez por zona |
| 25–60 s | Inspecciona algo cercano que no haya mirado. Nunca se aleja de la zona cómoda |
| Más de 60 s | `descansar`: se asienta más bajo (squash 0,97), respira más despacio y la mirada deriva. Es la «quietud» de `LIVING_SCOPE.md` |
| Al volver tú | Un medio parpadeo y vuelta a la normalidad. **Nada de gestos de bienvenida exagerados** |

## 4.7 Memoria de la sesión

En memoria y en `sessionStorage`. No se guarda nada entre visitas, salvo que lo decidas.

| Recuerdo | Para qué |
|---|---|
| Zonas visitadas: veces y última hora | Primera visita o vuelta |
| Objetos que ha inspeccionado él y que has abierto tú | Guiar, recordar y no repetir |
| Clips recientes (los 4 últimos) | Anti-repetición |
| Clics sobre él (marcas de tiempo) | Reacciones más suaves si insistes |
| Si ya te ha mirado en esta zona por inactividad | No volver a pedirlo |
| Si ya te ha guiado en esta zona | Una vez por zona |

## 4.8 Reacciones al clic, según el contexto

| Contexto | Reacción |
|---|---|
| Normal | Se orienta hacia ti → ClickReaction (Stretch → Laugh) → mira lo que estaba mirando |
| Estás leyendo | Solo BlinkDouble, sin moverse. No te interrumpe |
| Va de camino | Se para, se gira, hace un Bounce corto y sigue |
| Segundo clic en menos de 8 s | Tilt; el tercero, un parpadeo. El canon no premia la insistencia (`BEHAVIOUR.md`, «Scope es paciente») |
| Sobre el dial de Sport Coach | ClickReaction y, al terminar, un Bounce en el centro: está en casa |
| En el contacto, mientras escribes | Te mira y mira la nota. No hace clips largos mientras escribes |

**Anti-repetición:**

- El peso de cada gesto se multiplica por 0,25 si fue el último y por 0,6 si fue el penúltimo.
- Nunca hay dos gestos seguidos de la misma familia.
- Cada familia tiene su enfriamiento: LookAround, 20 s; Tilt, 10 s.
- Los ritmos del canon se mantienen: autónomo cada 8–20 s y el reposo como estado dominante.

## 4.9 Locomoción: propuesta

Hoy se desplaza con `Bounce` (1,2 s, pensado como saltito espontáneo) más la traslación de la
raíz. Para que parezca que tiene peso e intención, propongo **un paso propio de Scope**: ni
andar humano ni rebote de pelota.

### El paso: «pasito con balanceo»

En cada paso (0,26–0,32 s):

1. **Anticipación.** Squash 0,97 durante 40 ms; el cuerpo se inclina hacia el lado del paso.
2. **Despegue.** El hueso `hop` sube 4–6 mm. Las patas delanteras se levantan primero y las
   traseras 0,1 del ciclo después, como en el Bounce aprobado («patas desfasadas»).
3. **En el aire.** Balanceo de ±3,5° alternando lados (`body`, roll). El cuerpo se inclina hacia
   delante según la velocidad, como mucho 6°.
4. **Aterrizaje.** Squash 0,95 y recuperación con un sobreimpulso pequeño.
5. **La antena.** No se anima: el muelle de producción reacciona al movimiento real y le da la
   inercia gratis.
6. **La mirada.** Los ojos van antes que el cuerpo en los giros. La capa de presencia ya lo hace.

| Marcha | Velocidad | Cuándo | Diferencia |
|---|---|---|---|
| Paseo | 7 cm/s | Pasear o inspeccionar cerca | Casi sin vuelo (2–3 mm); el balanceo manda |
| Trote | 13 cm/s | Acompañar | Vuelo de 5 mm |
| Prisa | 22 cm/s | Reagrupar | Saltos de 12–15 mm, más inclinación y más antena |

- **Arranque y parada.** Al arrancar, un agachado previo; al parar, se asienta con un pequeño
  sobreimpulso. Nunca arranca ni para en seco.
- **Giros.** En dos o tres pasitos, con el balanceo hacia dentro de la curva.

### Dos maneras de construirlo

| | **A · Capa procedural en el navegador** (recomendada para empezar) | **B · Clips horneados en Blender** |
|---|---|---|
| Qué es | Una capa como `scope-3d-secondary.ts` que mueve solo los huesos aprobados: `root`, `hop`, `squash`, `body` y las patas | Clips nuevos en `scope-master.blend`: `Step.L/R`, `HopLoop`, `Settle` |
| El modelo | **Intacto:** ni geometría, ni rig, ni GLB | Geometría y rig intactos, pero **cambia el GLB de producción** (+30–60 KB) y el archivo maestro |
| Validación | Comprobar en el navegador que la cara no se deforma (la misma métrica que `validate_scope.py`: 0 mm) y que las patas no atraviesan el suelo | `validate_scope.py` y comprobación de la firma de la geometría |
| Ventaja | Se ajusta en vivo y se adapta a la velocidad y la curva del camino | Arcos y tiempos de calidad de animación, revisados fotograma a fotograma |
| Riesgo | Puede quedar mecánico si no se cuida | Menos flexible: un clip por marcha, y fundidos en los giros |

**Recomendación.**

1. Empezar por **A**, en una página de laboratorio que ponga a Scope en bucle con las tres
   marchas junto al Bounce actual, para que lo juzgues tú.
2. Si no te convence, pasar a **B**, que necesita tu aprobación expresa porque toca archivos de
   producción.

En ningún caso se modifica la geometría.

### Gestos nuevos que pide el mundo

Todos son **clips nuevos en Blender** y, por tanto, **requieren tu aprobación**:

| Gesto | Para qué | Base en el canon |
|---|---|---|
| **Nudge** (empujar con la cara) | La pelota de Tournamently y las piezas | Pose experimental aprobada como tal en la Entrega 1.5 (`b4-push`) |
| **Settle** (sentarse, asentarse) | Esperar mientras lees y descansar | La «quietud» de `LIVING_SCOPE.md`; hoy es un squash procedural |
| **Fit** (encajar en su hueco) | El rincón «El hueco de Scope» | Usa `hop` y `squash`; podría resolverse con la capa A |
| **Peek** (asomarse) | Asomarse por los huecos al usar los atajos | Inclinación de `body` hacia delante; podría resolverse con la capa A |

## 4.10 Pruebas que tendrá la máquina de estados

Ampliaré los 12 tests de `mind.test.ts`. Algunos casos:

- Nunca está «perdido» más de 6 s.
- Al cambiar de zona, se pone en marcha antes de que la cámara llegue.
- Con una ficha abierta, ningún gesto ni desplazamiento.
- La mirada por inactividad, una vez por zona.
- Guía como mucho una vez por zona.
- Nunca dos gestos seguidos de la misma familia.
- El tercer clic seguido no lanza ClickReaction.
- Los atajos siempre entran y salen por un hueco del mapa.
- Movimiento reducido: sin desplazamientos visibles.
- En una sesión simulada de 10 minutos, `idle` ocupa más del 50 % del tiempo.
