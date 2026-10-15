# 7. Trabajo en Blender y hoja de ruta

## 7.1 Qué necesita Blender

Todo se hace sin interfaz (`--background`, Cycles por CPU), con un único Blender a la vez y
sobre una copia del mundo aprobado. El nuevo script `mundo2.py` extiende `mundo.py` igual que
este extendió `pliego_base.py`. **El modelo de Scope no se toca.**

### Mundo: geometría nueva

| Pieza | Zona | Tipo | Notas |
|---|---|---|---|
| Galería del margen: tira de 70 cm con 5–6 arcos y su corte en el pliego | 2 | Kirigami | Deja ver la página de debajo por el corte (regla 1). Termina en el mirador, que ya existe |
| Cuatro hojas de presentación con pliegue de pie | 2 | Kirigami (instanciable) | Se levantan con un hueso por hoja o en el cliente |
| Taller de pliegues: 5 formas en estados de plegado | 3 | Papel → porcelana | La última, a medias, cruzando el anillo tostado |
| Libro abierto transitable por dentro | 3 | Interior | Amplía el libro de `q-context` de la Entrega 1.5 |
| Mirilla y página de debajo con suposiciones tachadas | 3 | Detalle | Textura con texto real del cuaderno |
| Gradas del cuadro: cada peana como pieza seleccionable y la final más ancha | 4 | Ya existe | Bloques instanciables; la pelota debe poder rodar |
| Tres peanas de papel crudo en el anillo | 4 | Papel | Su sitio queda libre en el mapa caminable |
| Sport Coach: el dial con su centro accesible | 4 | Ya existe | Ajuste para que Scope pueda subirse |
| **El rizo**: el borde trasero curvado, unos 25 cm de bóveda | 5 | Papel | Dorso escrito; hilos y notas colgando |
| El aula: unas 24 piezas pequeñas desde un patrón y la hoja del patrón | 6 | Papel (instancias) | Una torcida |
| **La esquina doblada**, la rampa a la mesa | 6 → 7 | Papel | |
| La mesa ampliada, la nota en blanco y las virutas | 7 | Mesa lacada y papel | El lápiz ya existe |
| El hueco de la silueta de Scope en el margen | 1 | Corte | Ya existe el recorte; falta el hueco con su forma |
| Siluetas lejanas de todas las zonas | núcleo | Simplificación | Unos 5 000 triángulos en total |

### Luz y exportación

| Tarea | Notas |
|---|---|
| Hornear AO y luz indirecta por zona, a su hora | Un mapa de luz de 1024² por zona (WebP); comprobar el peso con el presupuesto |
| Exportar un GLB por zona más el núcleo | Ampliar `export_world.py` |
| Mapa caminable y de alturas ampliado a la mesa | 270 × 170 celdas; atajos entre huecos |
| Renders de referencia por zona | Para la vista de lectura, los metadatos y la revisión |

### Scope: animación

| Elemento | Dónde | ¿Toca producción? | Aprobación |
|---|---|---|---|
| Paso procedural (paseo, trote, prisa) | Navegador, capa nueva | No | La de esta fase |
| Fit y Peek | Navegador, con la misma capa | No | La de esta fase |
| Nudge (empujar con la cara) | Clip en `scope-master.blend` | **Sí: GLB de producción** | **Expresa** |
| Settle (asentarse) | Clip, o procedural si basta | Depende | **Expresa si es clip** |
| Clips de paso horneados (opción B) | Clip | **Sí** | **Expresa**, solo si la A no convence |

## 7.2 Hoja de ruta (Fase B)

Cada entrega se puede probar en el navegador en `http://localhost:3100/`. Lleva su propia
comprobación automática y **se detiene hasta que la apruebes**.

| Entrega | Qué incluye | Qué podrás hacer | Cómo se verifica |
|---|---|---|---|
| **2.0-A · Maqueta caminable** | El mapa completo en volúmenes grises desde Blender. Las 7 zonas y 21 paradas, el índice, las URLs y el historial, la carga por zonas y las siluetas lejanas. Scope 1.0 tal cual | Recorrer el mundo entero y saltar a cualquier zona. Juzgar el tamaño, el ritmo y las transiciones antes de que haya arte | Tiempo de recorrido; las 21 paradas alcanzables con el teclado; transferencia por zona; **fotograma p95 en tu GPU**; Atrás y Adelante coherentes |
| **2.0-B · Scope compañero** | La máquina de estados nueva (compañía, espera, memoria, anti-repetición, atajos), la capa de paso y una página de laboratorio de marchas | Moverte y ver que te acompaña; comparar el paso nuevo con el Bounce | Los tests de §4.10; una sesión simulada de 10 min; capturas de los cambios de zona; la cara intacta (0 mm) |
| **2.0-C · Arte I: despertar, umbral e ideas** | La galería, el taller, el libro por dentro, la mirilla y la luz horneada de esas zonas | Ver las tres primeras zonas con el acabado final | Comparación con los renders; presupuesto por zona; contraste del HTML |
| **2.0-D · Distrito de proyectos** | Manifiestos, arquetipo, peanas, las gradas con el motor real, el iframe de Tournamently, la representación de MathView y el dial | Jugar el cuadro, abrir Tournamently de verdad y añadir un proyecto de prueba con el arquetipo | Comprobación de manifiestos; tests del motor copiado; sellos visibles; Esc, Atrás y el foco |
| **2.0-E · Cuaderno y aula** | El rizo, la editorial del cuaderno, el aula y plegar tu pieza | Leer las seis líneas completas bajo el rizo; plegar una pieza | Lectura sin WebGL; teclado; Scope espera mientras lees |
| **2.0-F · Encuentro y cierre** | El contacto, el formulario con `mailto:`, el cierre de demostración, la vista de lectura completa, el plan de integración en Next, la auditoría con lector de pantalla y el rendimiento en dispositivos reales | Escribir de verdad desde tu correo; ver el cierre | Contacto en menos de 1,2 s desde cualquier parada; NVDA o VoiceOver; movimiento reducido; p95 en tu GPU y en un móvil real |

**Lo que no haré sin tu aprobación** en ninguna entrega:

- tocar producción, desplegar o hacer commits;
- modificar el modelo de Scope o su GLB;
- cambiar la dirección artística.
