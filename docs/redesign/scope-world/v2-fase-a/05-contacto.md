# 5. El lugar de encuentro: el pie de la lámpara

## 5.1 La metáfora

**El final del recorrido es la mesa de Álvaro.** Se baja del pliego por la esquina doblada. Al
pie de la lámpara, en el círculo de luz que cae fuera del pliego, hay dos cosas:

- **una nota en blanco** con la misma pauta que el pliego;
- **el lápiz** de Álvaro.

Todo lo anterior era el mundo de Scope; esto es el sitio de Álvaro. Escribir aquí no es rellenar
un formulario: es **dejar una pregunta nueva**. La biblia ya lo cerraba así: la nota plegada acaba
de pie en el campo, como una pregunta más (§3, «Cierre»). Por eso el final se recuerda: tu
mensaje entra en el mundo.

He descartado otras metáforas:

| Metáfora | Por qué no |
|---|---|
| Un buzón | Es un objeto nuevo, no está en la biblia, y suena a trámite |
| Un taller con herramientas | Repite el taller de pliegues |
| Un avión de papel que «sale volando» | Saca el mensaje fuera del mundo; la biblia lo mete dentro |

## 5.2 Lo que hay en pantalla

Es HTML real, a la derecha (o abajo en el móvil), y se ve **en cuanto llegas**, sin esperar a
ninguna animación:

```
AL PIE DE LA LÁMPARA

Escríbeme.
Si tienes un proyecto, una clase o una pregunta que no te deja tranquilo, cuéntamela.

contact@alvarogaertner.com      [Copiar]
LinkedIn ↗   GitHub ↗

[ Escribir la nota ]            Seguir explorando →
```

| Elemento | Dato | Estado |
|---|---|---|
| Correo | `contact@alvarogaertner.com` | **Confirmado** como correo público |
| LinkedIn | `linkedin.com/in/alvarogaertner2262331b1` | **Confirmado** |
| GitHub | `github.com/AlvaroGaertnerGit` | **Confirmado** |
| Frase final | «Toda buena idea empieza con una conversación.» | Es la versión en español de la que aprobaste en producción (`CONTACT_ENDING_LINE`) |

El texto es un borrador para revisar contigo.

## 5.3 El formulario

| Dónde | Cómo funciona | Por qué |
|---|---|---|
| **Prototipo** | «Escribir la nota» abre la nota: nombre, correo y mensaje. El botón dice **«Enviar desde mi correo»** y abre tu cliente de correo con el mensaje ya escrito (`mailto:`) | Es real y no necesita servidor. **No simula ningún envío** |
| **Producción** | El mismo formulario usa **`/api/contact`**, que ya existe (Resend, con trampa antispam y confirmación al visitante) | No hay que construir otro servidor |

En el prototipo **no hay ningún botón que diga «Enviado»**. La secuencia de cierre (§5.4) solo
puede verse con un botón aparte, **«Ver el cierre (demostración)»**, para que revises la
coreografía.

## 5.4 Scope en el encuentro

1. **Al llegar.**
   - La lámpara ya ilumina la nota.
   - Scope baja la rampa con su paso, se pone al otro lado de la nota y te mira.
   - Es la única zona donde se coloca de cara a ti sin que hayas hecho nada: le espera una
     conversación.
2. **Mientras escribes.**
   - Las líneas de la nota 3D se llenan de grafito al ritmo de lo que tecleas. Es un reflejo
     abstracto: **nunca muestra tu texto en el canvas**.
   - Scope mira la nota, y de vez en cuando a ti.
   - No hace ningún clip largo.
3. **Al enviar** (en producción, solo cuando el servidor confirma; como en el canon actual, Scope
   reacciona a la carta entregada, nunca al clic).
   1. La nota se pliega sola en una forma.
   2. La luz de los ojos de Scope la alcanza (su canal canónico).
   3. Se desliza por la mesa, sube por la esquina doblada y cruza el pliego.
   4. Termina de pie en el campo, junto a «· · ·». Scope la sigue con la mirada y luego te mira.
   5. La lámpara baja a luz de noche.
   6. Se ve la frase final y «Seguir explorando».
4. **Seguir explorando.** Vuelve a la parada en la que estabas antes de ir al contacto, o al
   margen si llegaste directamente.
   - Ya es de día.
   - Tu nota sigue en el campo durante toda la sesión. Solo la ves tú; no se guarda en ningún
     servidor.

## 5.5 Contactar rápido

- **«Contacto» está siempre en la barra.** Desde cualquier parada se llega en menos de 1,2 s
  (con movimiento reducido, de golpe).
- El correo, con el botón «Copiar», está en el HTML desde el primer fotograma. No hay que
  esperar a Scope ni a la lámpara.
- **En la vista de lectura y sin WebGL** el contacto es una sección normal, con todo lo
  anterior.
- **Accesibilidad.**
  - Los campos tienen etiquetas reales.
  - Los errores se anuncian y el foco va al primero.
  - La animación nunca bloquea el formulario.
  - Con movimiento reducido no hay vuelo de la nota: aparece en el campo con un fundido.
