# Scope World 2.0 · Entrega 2: pase de arte del entorno

Estado: **pendiente de tu aprobación.** No se han construido las siete zonas.

- Sin cambios en producción.
- Sin commits.
- El modelo de Scope y sus clips, intactos.
- El 1.0 y la Fase A, intactos: todo lo nuevo está en esta carpeta.

Abre **`index.html`** (doble clic) para ver las comparativas.

## Qué hay

| Ruta | Qué es |
|---|---|
| `blender/entorno2.py` | Copia experimental. Importa en solo lectura el mundo aprobado (1.5) y los lugares de Scope de la Fase A, y construye el entorno nuevo |
| `blender/export_env.py` | Exporta ese entorno a GLB para el visor |
| `renders/` | 7 renders de Cycles a 1600 px y 48 muestras. Las cuatro primeras cámaras son **las mismas de la Fase A** |
| `renders/visor/` | Capturas del visor en tiempo real |
| `visor/` | El estudio navegable: `index.html`, `src/main.ts`, `tools/build.mjs` y `tools/serve.mjs` (puerto 3110) |
| `../entrega-3-comportamiento/DISEÑO.md` | El diseño de la entrega 3 (solo diseño) |

## Qué cambia frente a la Fase A

| Problema que señalaste | Qué he hecho | Dónde se ve |
|---|---|---|
| Cordilleras de videojuego *low poly* | Un único relieve continuo de papel, desde el pliego hasta el horizonte. Está plegado a cuatro escalas (pliegues en triángulo, con aristas suaves), deformado y sin facetas. Lo lejano se funde en el aire | `e2-wide`, `e2-horizonte` |
| El rectángulo del pliego se distingue | El papel del mundo es el mismo que el del pliego, y está justo bajo su grosor: el escalón desaparece. **Las líneas pautadas salen del pliego, se curvan y se disuelven** (desaparecen hacia los 2,2 m). **El margen bermellón sigue como un camino** que se aleja | `e2-horizonte`: no se ve el borde. `e2-wide`: el margen se pierde a la izquierda |
| Demasiado gris y plano | Cada plano tiene su sol (acimut, altura y color), un cielo con cenit, horizonte y halo, y neblina del color del horizonte que **solo afecta a la geometría**: el cielo conserva su degradado | Todos |
| Intención lumínica por zona | Amanecer en el margen, contraluz en la atalaya, día claro en el círculo, atardecer cálido en el lado del aula y noche con la linterna | `e2-dia`, `e2-atardecer`, `e2-linterna` |
| Escala: objetos rodeados de terreno vacío | Planos de profundidad con contenido: arboledas de hojas en blanco curvadas, reunidas en los valles; olas de papel enrolladas; arcos plegados; tres torres de acordeón como hitos; el lago | `e2-escala`, `e2-wide` |

**Problemas que encontré y corregí al hacer los renders:**

- **El cielo salía plano.** La neblina del compositor tapaba también el fondo, porque la niebla del cielo vale 1. Ahora la geometría se compone sobre el pase de entorno.
- **Un corte recto en el cielo.** La cámara del script aprobado recorta a 40 m y el relieve llega a 58. En esta copia el recorte llega a 150 m.
- **Una franja de luz en el suelo de la atalaya.** Era la luz de rebote del script aprobado, cortada contra el borde del pliego. Desactivada en ese plano.
- **El pliego gris.** El sol bajo proyectaba encima la sombra de todo el campo. Ahora el sol de la vista general está más alto y viene del sur.

## El visor en tiempo real (`visor/`)

```bash
node docs/redesign/scope-world/entrega-2-entorno/visor/tools/build.mjs
node docs/redesign/scope-world/entrega-2-entorno/visor/tools/serve.mjs --port 3110
# → http://localhost:3110/   (?camara=general|horizonte|margen|escala|linterna  ?hora=amanecer|dia|atardecer|noche)
```

- **Qué carga.** Reutiliza en solo lectura los módulos del prototipo 1.0: el mundo aprobado, sus materiales y Scope. Desde la Entrega 4, el entorno (relieve, cielo, niebla y ambientes) se monta en el módulo común `core/env/stage.ts`, el mismo que usan el laboratorio y el mundo; el visor conserva su cámara, sus planos y su HUD. Encima pone el relieve exportado, el cielo con halo, la niebla, cuatro ambientes de luz y las cinco cámaras de los renders. Las líneas pautadas y el margen que se disuelven están reescritos como *shader*.
- **Optimizaciones aplicadas.**
  - El entorno estático se fusiona en una malla por material (unas 95 piezas pasan a 3).
  - Solo un sol proyecta sombras.
  - La luz de la linterna solo cuenta de noche.
  - Sin GPU: sin sombras y a escala 0,5.
- **Medido aquí.**
  - Carga: 0,5–1,4 s en local.
  - Entorno: 1,13 MB y 52 657 triángulos.
  - Mundo 1.0: 2,2 MB y 65 979 triángulos.
  - Llamadas de dibujo: 328 en la vista general y 16 en la atalaya.
- **Sin medir:** los FPS. En este equipo sin GPU, y en una pestaña automatizada, **tanto el visor como el prototipo 1.0 dan ≈ 1 FPS**. Lo he comprobado midiendo los dos en las mismas condiciones. Esa cifra no dice nada del visor. Hay que medir en un equipo con GPU.

## Limitaciones honestas

- **Las capturas del visor se ven más planas que los renders:** sin GPU no hay sombras en tiempo real.
- **El entorno exportado pesa demasiado.** Son 52 657 triángulos frente al objetivo de 20 000. Pendiente:
  - instanciar las hojas;
  - decimar más el relieve lejano;
  - hornear la oclusión.
- **El lago del visor se ve demasiado oscuro.** La intensidad de entorno del mundo 1.0 es muy baja; el ajuste queda para la integración.
- **Las cordilleras ya se leen como pliegues, pero aún son pliegues suaves.** Si quieres aristas más vivas, como de papel recién doblado, el siguiente paso es una malla con normales partidas en las crestas.
- **Las hojas de las arboledas aún pueden recordar a losas** a contraluz en algún encuadre.

## Necesita tu aprobación

1. **El resultado artístico del entorno:** el relieve continuo, la integración del pliego y la luz por zonas.
2. **Si sigo por la entrega 3** (el prototipo de comportamiento), según el diseño de
   `../entrega-3-comportamiento/DISEÑO.md`.
