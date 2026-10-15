# Entrega 3 · Prototipo de comportamiento de Scope: diseño

Estado: **solo diseño.** No hay código escrito ni se ha tocado el personaje. Se construye cuando
lo apruebes.

## 1. Qué tendrás que comprobar

Una demostración aislada, en `entrega-3-comportamiento/lab/` y en el puerto 3110 cuando no lo
use el visor, con estas seis piezas:

| Pieza | Cómo se ve en la demo |
|---|---|
| **Acompañamiento** | Mueves al visitante (un ancla en el suelo, con flechas o arrastrando) y Scope te sigue según las bandas de compañía: cómoda, tensa, perdido y reagrupar |
| **Locomoción** | El «pasito con balanceo» en tres marchas (paseo, trote y prisa) y su comparación directa con el Bounce actual |
| **Interacción con objetos** | La pelota y una pieza del gabinete: Scope las empuja con la cara (Nudge) |
| **Activación por luz** | El radiómetro acelera cuando Scope lo mira |
| **Refugio** | La linterna: entra a descansar si no haces nada, se asoma cuando te mueves y sale |
| **Reacciones con contexto** | El clic sobre Scope en cada situación de la tabla de la Fase A (§4.8): normal, leyendo, de camino, sobre el dial e insistiendo |

Un panel de depuración muestra en todo momento:

- el estado y la prioridad;
- por qué está haciendo lo que hace;
- la distancia al visitante y la banda;
- si se le ve;
- la memoria de la sesión;
- los últimos clips.

## 2. Arquitectura

```
lab/
  index.html · src/main.ts           escena mínima: un trozo de pliego + linterna, gabinete,
                                     radiómetro, pelota y dial (reutilizando las piezas de la Fase A)
  src/mind2.ts                       la máquina de estados nueva (pura: sin three.js ni DOM)
  src/mind2.test.ts                  tests con node --test
  src/gait.ts                        la capa de paso procedural (huesos aprobados, en tiempo de ejecución)
  src/places.ts                      lugares y objetos: qué ofrecen y cómo responden (luz, empujón, encaje)
```

**La máquina de estados** sigue el diseño de la Fase A (§4.3):

- Hay seis grupos de prioridad: guion, respuesta, compañía, curiosidad, vida propia y reposo.
- Dos capas que no se pisan: la actividad y la atención.
- Es extensible porque **los lugares declaran lo que ofrecen**. Por ejemplo:
  - `linterna: { descansar, asomarse }`;
  - `radiómetro: { encender con luz }`;
  - `gabinete: { ordenar }`.

  La mente elige entre ofertas puntuadas. Añadir un lugar no toca la máquina.
- **Memoria de la sesión:** zonas, objetos, clics y los últimos cuatro clips.
- **Anti-repetición:** los pesos de la Fase A (×0,25 para el último gesto, ×0,6 para el penúltimo).
- **Enfriamientos** por familia de gesto.

## 3. Locomoción sin tocar el personaje

**La capa `gait.ts`:**

- Escribe solo en los huesos aprobados (`root`, `hop`, `squash`, `body` y las cuatro patas)
  **después** del mezclador de animaciones, igual que la capa secundaria de producción.
- No modifica el GLB, ni el rig, ni los clips, ni `scope-master.blend`.
- Los clips aprobados siguen sonando por encima. La capa solo añade el desplazamiento.

**Cómo se valida:**

- **Integridad de la cara.** Se mide la misma métrica que `validate_scope.py` en cada fotograma
  de un recorrido de prueba: 0 mm de desviación.
- **Pies.** Nunca bajo el suelo, comprobado con el mapa de alturas.
- **Comparación lado a lado** con el Bounce en la página.

Los gestos **Fit** (encajar) y **Peek** (asomarse) también salen de esta capa. **Nudge** (empujar)
se intentará primero de forma procedural: inclinación de `body` y avance de `root`. **Si no
convence, propondré un clip nuevo en un documento aparte, antes de tocar el archivo del
personaje**, como pediste.

## 4. Pruebas

Ampliación de las de la Fase A (§4.10):

- Nunca está «perdido» más de 6 s.
- Arranca antes de que la cámara llegue.
- Con lectura activa: ni gestos ni desplazamientos.
- Una sola mirada por inactividad en cada zona.
- Nunca dos gestos seguidos de la misma familia.
- El tercer clic no lanza ClickReaction.
- Movimiento reducido: sin desplazamientos visibles.
- En 10 minutos simulados, el reposo ocupa más del 50 % del tiempo.
- **Nuevas:**
  - entra en la linterna solo tras más de 90 s de inactividad en la zona 1;
  - sale en menos de 1 s si te mueves;
  - el radiómetro solo acelera mientras Scope lo mira;
  - Nudge solo se lanza si el objeto está a su alcance y en su sitio caminable.

## 5. Lo que necesitaré aprobar contigo antes de construir

- Que el laboratorio pueda usar el puerto 3110 (el del visor) o el que prefieras.
- Si Nudge procedural no convence: un documento con la propuesta de clip, antes de tocar el
  archivo del personaje.
