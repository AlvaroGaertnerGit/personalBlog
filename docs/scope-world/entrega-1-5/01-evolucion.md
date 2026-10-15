# Entrega 1.5: evolución de Pliego

La biblia de la Entrega 1 (`../02-biblia.md`) **no se ha modificado**. Este documento separa lo
que se conserva, lo que propongo mejorar, lo nuevo y lo descartado. La geografía, la escala, la
lámpara, los materiales y el recorrido son los mismos: todas las escenas nuevas se construyen
sobre el mismo pliego, con las mismas coordenadas (`blender/mundo.py` extiende una copia de
laboratorio del script de la Entrega 1, sin tocar el original).

## 1. La idea que lo desbloquea

> **Las hojas verticales de la Entrega 1 eran preguntas cerradas.**

Cada pregunta es un **libro desplegable de pie sobre su lomo**:

- **Cerrado:** desde fuera se ve igual que la hoja de la Entrega 1, con la pregunta escrita en la
  tapa. La vista aérea no cambia.
- **Abierto:** del lomo se levantan **capas pop-up**, sujetas por pestañas de papel, con las notas
  reales de esa línea de investigación (hallazgo, hipótesis, suposición fallida tachada,
  siguiente experimento).

Así el mundo gana profundidad **sin añadir nada ajeno**: el interior ya estaba ahí, plegado. Lo
que no se ve desde fuera es literalmente el contenido.

## 2. Clasificación de las decisiones

| Tipo | Elemento | Por qué |
|---|---|---|
| **Aprobado, se conserva** | Una sola hoja; papel = todavía no; la luz cuece en porcelana; el anillo tostado; la lámpara como centro; el hilo rojo; el recorrido en S; el margen con el recorte de Scope; el ciclo del día | Es la identidad de Pliego |
| **Aprobado, se conserva** | La cámara de la home y su composición | La jerarquía funcionaba; ahora se anima (Entregable D) |
| **Mejora propuesta** | Las preguntas son libros (cerrados o abiertos) | Da interior, exploración y una interacción física natural para un ser sin manos |
| **Mejora propuesta** | **El loader es la home de noche**: la misma cámara y la misma interfaz; al estar lista la escena se enciende la lámpara | Elimina el corte entre el loader azul y el sitio (problema 10 de la auditoría) y hace que la primera imagen ya sea el mundo |
| **Mejora propuesta** | El estado real de cada línea de investigación decide su forma: *Paused* = tumbada (Local Models es un banco); *Building* = en el borde, medio cocida (ya en la Entrega 1) | El mundo se lee como un panel de estado sin texto |
| **Nuevo** | Etiquetas colgadas del hilo rojo con notas reales del cuaderno | Elementos suspendidos con una función: son las notas que unen dos preguntas |
| **Nuevo** | **El mirador**: una caja plegada con escalera en acordeón | Da alturas, un camino en vertical (Scope sube a saltitos) y un lugar de contemplación desde el que se ve la lámpara |
| **Nuevo** | MathView con ejes de porcelana, su tarjeta y **curvas de nivel que se encienden** | El proyecto se reconoce como gráfica y su activación obedece a la ley de la luz |
| **Descartado** | Una biblioteca o un archivo para el campo | Habría convertido el campo en una sala distinta; el libro desplegable mantiene la hoja |
| **Descartado** | Pantallas o tarjetas flotantes para los proyectos | El brief las prohíbe; el contenido se despliega como una hoja del propio pliego |
| **Descartado** | Agujero bajo cada libro | Un libro se dobla sobre su lomo: no deja hueco, y el hueco quedaba justo donde Scope tiene que pisar |
| **Descartado (durante el trabajo)** | Girar el libro de los agentes hacia el banco | La tapa cerrada tapaba a Scope desde cualquier cámara útil; se mantuvo la orientación hacia el camino y el empujón se cuenta con un plano de inserto |

## 3. Continuidad: dónde está cada cosa nueva

| Elemento | Posición (m sobre el pliego) | Antes, en la Entrega 1 |
|---|---|---|
| Libro «How much context…» | (−0,46, −0,08), abre hacia el margen | La misma hoja, en el mismo sitio |
| Libro «When should one AI agent become two?» | (−0,14, −0,38) | La misma hoja |
| Libro «Can one shared protocol…» | (−0,12, 0,15) | La misma hoja |
| Banco «Local Models» (tumbado) | Desde (0,04, −0,26) hacia el este | Una hoja inclinada en (0,07, −0,21) |
| Mirador | (−0,68, 0,15), cima a 9 cm | Un boceto pequeño en (−0,60, 0,10), retirado |
| Etiquetas del hilo | Sobre los hilos ya existentes | Los mismos hilos |
| MathView con ejes y tarjeta | (0,40, 0,31), dentro del círculo | La misma pieza, sin ejes |

Las escalas son las mismas:
- Scope: unos 150 mm.
- Libros: 0,40–0,54 m de alto.
- Mirador: 9 cm de alto.
- Peldaños del mirador: unos 11 mm, la altura de un salto de Bounce.
