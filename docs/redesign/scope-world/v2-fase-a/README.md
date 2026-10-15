# Scope World 2.0 · Fase A: diseño de la expansión

> **Revisión del 2026-10-15: el mundo de Scope.** El pliego deja de flotar en el vacío: el
> mundo entero es papel, y lo escrito es solo su centro habitado. Se añaden los lugares de
> Scope (linterna, gabinete, radiómetro, atalaya y huellas). Ver **`08-el-mundo-de-scope.md`**
> y la primera sección de `index.html`. Los renders están en `renders/` y el script que los
> genera, en `entorno/entorno.py`: importa el mundo aprobado sin modificarlo y se ejecuta sin
> interfaz, un Blender cada vez.

Estado: **propuesta pendiente de tu aprobación.** Es solo diseño.

- En esta fase no se ha tocado el prototipo, ni producción, ni el modelo de Scope.
- No hay commits, despliegues ni dependencias nuevas.
- La Fase B no empieza hasta que la apruebes.

## Cómo verlo

Abre **`index.html`** en el navegador, con doble clic: no necesita servidor. Es el tablero
visual, con:

- el mapa a escala real;
- el recorrido desplegado;
- una viñeta por zona;
- los proyectos;
- los diagramas de Scope y la locomoción;
- el contacto;
- la técnica y la hoja de ruta;
- las decisiones que necesito.

Las viñetas son **bocetos esquemáticos** dibujados con las coordenadas reales del mundo, no
renders. El arte final sale de Blender en la entrega 2.0-C.

## Documentos

| Archivo | Contenido |
|---|---|
| `01-auditoria.md` | Medidas de la 1.0, sus limitaciones y la causa de cada una en el código |
| `02-mundo.md` | El mundo ampliado: las 7 zonas, las 21 paradas, transiciones, rincones, reglas de reacción y navegación |
| `03-proyectos.md` | Qué existe de verdad de cada proyecto, las instalaciones, los sellos y el sistema de manifiestos |
| `04-scope.md` | Compañía, prioridades, memoria, reacciones al clic y la propuesta de locomoción |
| `05-contacto.md` | El pie de la lámpara: metáfora, contenido, formulario y la secuencia de Scope |
| `06-tecnica.md` | Arquitectura, técnicas (cuáles sí y cuáles no), presupuestos y riesgos |
| `07-blender-y-hoja-de-ruta.md` | El trabajo de Blender y las seis entregas de la Fase B |
| `08-el-mundo-de-scope.md` | **La revisión:** el pliego sin bordes, los lugares de Scope, la amplitud sin coste, las interacciones físicas y los cambios en la hoja de ruta |

## En una frase por tema

- **Mundo.** Crece hacia dentro, hacia arriba, hacia atrás (el rizo) y hacia fuera (la mesa), sin
  escalar nada.
  - Pasa de 4 a **7 zonas y 21 paradas**.
  - La ruta pasa de 2,0 a **≈ 5,6 m** entre paradas.
  - Hay **8 rincones**.
- **Proyectos.** Tournamently se puede probar de verdad: su motor de cuadros real y su web
  incrustada. MathView será una representación señalada hasta que haya código o demo. Un
  manifiesto por proyecto, y peanas libres para los próximos, sin Blender.
- **Scope.** Un modelo de compañía con bandas de distancia y visibilidad:
  - arranca con la cámara;
  - espera mientras lees;
  - recuerda la sesión;
  - tiene un paso propio, que propongo hacer en el navegador sin tocar el GLB.
- **Contacto.** La nota y el lápiz al pie de la lámpara. Tu mensaje acaba de pie en el campo como
  una pregunta nueva. El correo está visible al instante, y en el prototipo nunca hay un envío
  simulado.
- **Técnica.** Carga por zonas con siluetas lejanas, luz horneada por zona (cada zona tiene su
  hora), instancias y presupuestos medibles. El rendimiento con GPU se mide en tu equipo.

## Decisiones que necesito

Están en el tablero (`index.html#decisiones`):

1. ¿Apruebas el mundo ampliado?
2. MathView: ¿hay código, demo o capturas?
3. Tournamently: ¿se puede incrustar la web? ¿Copiar `bracket.ts`? ¿El repositorio es público?
4. ¿El correo y los enlaces públicos son los correctos?
5. Docencia: ¿qué se puede contar?
6. Locomoción: ¿empiezo por la capa procedural?
7. ¿Te parecen bien las nuevas acciones de Scope (encajar, Nudge, activar con su luz)?
8. ¿Puedo excluir `docs/` del `tsconfig` y de ESLint?
