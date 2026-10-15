# 6. Estrategia técnica

## 6.1 Arquitectura

```
                        ┌──────────────── HTML (siempre presente, indexable) ───────────────┐
                        │ barra + índice de zonas · secciones por zona · fichas · contacto   │
                        └───────────────▲───────────────────────────────▲───────────────────┘
                                        │ eventos (abrir, foco, zona)   │ estado (zona, parada)
┌───────────── Contenido ─────────────┐ │                               │
│ manifiestos de proyecto             │─┼──► WorldDirector ─────────────┤
│ cuaderno, sobre mí, docencia        │ │     (zona, parada, URL,       │
│ contacto                            │ │      historial)               │
└─────────────────────────────────────┘ │          │                    │
                                        │          ▼                    │
                      ┌─────────────────┴──────────────────────────────┴──────────┐
                      │ Canvas (three.js)                                          │
                      │  ZoneStreamer ─► núcleo + zonas (GLB por zona, bajo demanda)│
                      │  CameraRig (paradas sobre una curva continua por zona)     │
                      │  Installations (módulos de proyecto)                       │
                      │  ScopeActor ◄── ScopeMind (estados, compañía, memoria)     │
                      │             ◄── Gait (capa de paso procedural)             │
                      └────────────────────────────────────────────────────────────┘
```

- **El contenido no depende del canvas.**
  - En el prototipo, el HTML se genera con JS a partir de los mismos datos.
  - En producción lo renderiza Next en el servidor, y el mundo es una isla cliente que se carga
    después.
- **Una única instancia de Scope**, como en la 1.0. El arnés de producción (animador, capa
  secundaria y GLB) se reutiliza en solo lectura.
- **`ScopeMind` sigue siendo puro:** sin three.js ni DOM, con el tiempo y el azar inyectados,
  y con tests.

## 6.2 Técnicas: cuáles sí, cuáles no

| Técnica | ¿La necesitamos? | Por qué |
|---|---|---|
| **Carga progresiva por zonas** | **Sí** | El mundo triplica el recorrido. El núcleo (margen, galería y siluetas lejanas) se carga primero. Las zonas contiguas a la tuya se precargan cuando el navegador está libre (`requestIdleCallback`), y al saltar con el índice se carga la de destino mientras la cámara vuela |
| **Siluetas lejanas (LOD de zona)** | **Sí, solo así** | Para que «el mundo exista más allá del encuadre», el núcleo lleva versiones muy simplificadas de todas las zonas: el rizo, el círculo, el aula y la lámpara, unos 5 000 triángulos en total. Cada zona sustituye su silueta al cargarse. No hace falta LOD por objeto: el papel ya tiene pocos polígonos |
| **Instancias** | **Sí** | Repetición real: las piezas del aula (unas 24), las peanas de las gradas, las hojas de la galería y las peanas. Ahorra llamadas de dibujo, que es lo que más pesa en móvil |
| **Iluminación horneada** | **Sí, la más importante** | Es la mayor diferencia con los renders: contacto suave y rebote cálido. Permite quitar una de las dos sombras en tiempo real y dejar solo la de Scope y los objetos que se mueven. **Cada zona tiene su hora fija**: la hora del día depende del sitio, no del tiempo, así que se hornea por zona sin conflictos |
| **Texturas optimizadas (KTX2)** | **Todavía no** | Hoy casi no hay texturas. Pasa a ser necesario si las texturas superan unos 8 MB en memoria, por los mapas de luz o las capturas de proyectos. Hasta entonces, WebP |
| **Compresión de geometría (meshopt)** | **Sí, al final** | `MeshoptDecoder` ya viene con three (sin dependencia nueva en el navegador). Para comprimir hace falta `gltfpack` o `@gltf-transform/cli` **solo en la compilación**. Lo justifico cuando el mundo pase de 3 MB |
| **Descargar zonas lejanas** | **Solo en móvil y nivel bajo** | En escritorio, el mundo completo cabe en el presupuesto de memoria. En móvil se liberan las zonas a más de dos de distancia |
| **Prerenderizados selectivos** | **Sí, pocos** | Una imagen por zona para la vista de lectura, los metadatos (Open Graph) y el modo sin WebGL. Nunca sustituyen al mundo interactivo |
| **Separación 3D / HTML** | **Sí** (ya existe) | Accesibilidad, indexación y rendimiento: el texto nunca se dibuja en el canvas |

## 6.3 Presupuestos

Los **objetivos** son los límites que me pongo; los **verificados** son lo que he medido. Hoy no
puedo medir con GPU: este equipo usa Microsoft Basic Render Driver.

| Medida | Objetivo 2.0 | Verificado (1.0) |
|---|---|---|
| Transferencia hasta poder interactuar (gzip) | ≤ 2,0 MB | ≈ 1,7 MB |
| Transferencia por zona (gzip) | ≤ 350 KB | — |
| Mundo completo (gzip) | ≤ 4,5 MB | 1,07 MB (4 lugares) |
| JS del prototipo (gzip) | ≤ 220 KB | 186 KB |
| Triángulos visibles | ≤ 200 000 | 66 000 + Scope |
| Llamadas de dibujo, escritorio / móvil | ≤ 120 / ≤ 80 | 93–116 |
| Memoria de GPU (texturas y geometría), escritorio / móvil | ≤ 200 / ≤ 120 MB | sin medir |
| Memoria JS | ≤ 150 MB | sin medir |
| Fotograma p95 en gráfica integrada (tipo Iris Xe) | ≤ 16,7 ms | **sin medir** |
| Fotograma p95 en Android de gama media | ≤ 33 ms | **sin medir** |
| Sin GPU (renderizado por software, escala 0,6) | utilizable | ≈ 60 FPS en reposo, medido hoy en tu Chrome. **No sirve para extrapolar** |

**Cómo se verificará:**

- `verify.mjs` ampliado guarda la transferencia por zona, `renderer.info` y el p95 del tiempo
  de fotograma.
- `performance.measureUserAgentSpecificMemory`, donde exista.
- **Antes de dar por buena cada entrega, la ejecutas tú con `--headed`** en tu ordenador y en un
  móvil real. Un buen resultado en SwiftShader no garantiza fluidez con GPU, y al revés.

## 6.4 Mapa caminable

- **Regla de diseño:** nada caminable queda encima de otra cosa caminable. Se camina **bajo** la
  galería y **bajo** el rizo, nunca por encima. Las gradas, el mirador y la rampa son
  escalones sobre el mismo plano.
- **Consecuencia:** basta con ampliar el mapa 2D actual, más su mapa de alturas, a la mesa:
  - x −1…1,7, y −0,7…1,0;
  - 270 × 170 celdas de 1 cm, unos 46 KB.
  - No hace falta navegación por capas.
- **Los atajos de Scope** (§4.4) son enlaces entre huecos del kirigami, declarados en
  `world.json` y probados en `nav.test.ts`.

## 6.5 Cámara, direcciones e historial

- **La cámara.**
  - Cada zona tiene su curva y sus paradas, con encuadres de escritorio y de retrato.
  - El parallax y la amortiguación de la rueda se mantienen.
  - **Saltar** entre zonas lejanas es un vuelo en arco por encima del pliego, de menos de 1,2 s.
    Nunca atraviesa papel.
- **Direcciones.**
  - Zona: `#/proyectos`.
  - Proyecto: `#/proyectos/tournamently`.
  - Nota: `#/cuaderno/ai-agents`.
  - En producción, rutas reales de Next.
- **Historial.**
  - `pushState` para zonas y para lo que se abre.
  - `replaceState` para las paradas.
  - Atrás cierra lo abierto, y después vuelve a la zona anterior.

## 6.6 Dependencias

- **No hace falta ninguna dependencia nueva en el navegador:** three.js 0.180 ya está.
- **Solo en compilación, y solo si el tamaño lo exige:** `gltfpack` o `@gltf-transform/cli`
  (§6.2).
- **Copia de `bracket.ts`** de Tournamently: es código del mismo autor. Tú decides si se copia
  con un script que compruebe la procedencia o si se publica como paquete. Recomiendo la copia,
  con su commit de origen y sus tests.

## 6.7 Riesgos

| Riesgo | Mitigación |
|---|---|
| **Rendimiento con GPU sin medir** | Medir en la entrega 2.0-A, con la maqueta, antes de poner arte |
| **El techo del rizo, translúcido** | Sin transmisión real: una textura horneada con la letra a contraluz y emisión suave. El efecto es el mismo y no cuesta nada |
| **El iframe de Tournamently** | La web puede cambiar sus cabeceras o tener cookies y sesión. Solo páginas públicas, `sandbox`, carga bajo demanda y siempre el enlace como alternativa. Se comprueba al compilar |
| **Contenido duplicado** (`content-es.ts`) | En producción, una sola fuente con los manifiestos en `src/` |
| **`tsconfig` incluye `docs/**`** | Excluir `docs/` antes de la Fase B (es configuración de producción: **necesito tu permiso**), o compilar el prototipo con un `tsconfig` propio y comprobarlo en cada entrega |
| **Memoria al hornear en Blender** | Una zona por llamada y un único Blender en segundo plano, como en las entregas anteriores |
| **Crecer sin control** | Entregas pequeñas y verificables (`07-blender-y-hoja-de-ruta.md`); cada una se juzga en el navegador |
