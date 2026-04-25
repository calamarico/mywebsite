# Arquitectura del proyecto

Documentación detallada de cómo está montado el sitio personal de **Kalamarico** y cómo conviven sus piezas.

---

## 1. Visión general

Sitio one-page con tres elementos visibles permanentes (header con avatar, hero central, footer con redes) y una mecánica oculta: tras unos segundos de inactividad, el título `KALAMARICO` se transforma en un piano que reproduce un MP3 real, mientras las teclas del piano se iluminan **siguiendo los picos de frecuencia del audio en tiempo real** (FFT vía Web Audio API).

La página es estática (no hay backend). Todo el comportamiento vive en el cliente.

---

## 2. Stack técnico

| Capa | Tecnología |
| --- | --- |
| UI | React 19.2 + TypeScript ~6 |
| Build | Vite 8 |
| Estilos | CSS plano + variables CSS (sin frameworks ni preprocesadores) |
| Tipografía | Inter Variable vía `@fontsource-variable/inter` |
| Audio | Web Audio API (`AudioContext`, `AnalyserNode` con `fftSize: 2048`) + `<audio>` HTML |
| Sprites | Pixel-art en PNG con `image-rendering: pixelated`, sprite sheet manual |

Sin librerías de animación (no Framer Motion, no GSAP). Todas las animaciones son CSS (transitions, keyframes, custom properties) o JavaScript directo (RAF, refs, DOM imperativo).

---

## 3. Estructura de archivos

```
mywebsite/
├── public/
│   └── audio/
│       └── piano.mp3           # asset de audio del modo piano
├── src/
│   ├── App.tsx                 # composición raíz (header, main, footer)
│   ├── main.tsx                # entrada React + carga de fuente + easter-egg ASCII en consola
│   ├── assets/
│   │   ├── kalamarico_sprite_v2.png   # sprite sheet del avatar (14 frames × 256px)
│   │   └── mm_bernard.jpeg            # favicon
│   ├── components/
│   │   ├── Hero.tsx            # h1, idle, gestión del modo (text/piano)
│   │   ├── HeroPiano.tsx       # piano DOM (29 blancas + 20 negras), <audio>, integra useFFTPiano
│   │   ├── KalamaricoAvatar.tsx # sprite + hook useKalamaricoAvatar (loop random + tryPlay)
│   │   └── SocialLinks.tsx     # iconos SVG inline + enlaces footer
│   ├── hooks/
│   │   ├── useFFTPiano.ts      # AudioContext + Analyser + RAF + onset detection
│   │   └── usePixelParticles.tsx  # bursts de partículas pixel-art al disparar animaciones
│   └── styles/
│       └── global.css          # tokens, layout, hero, piano, animaciones, reduced-motion
├── docs/
│   └── ARQUITECTURA.md         # este archivo
├── index.html
├── package.json
└── vite.config.ts
```

---

## 4. Sistemas (de fuera hacia dentro)

### 4.1 Tokens y reset global

[src/styles/global.css](../src/styles/global.css) define los **design tokens** en `:root`:

| Token | Valor | Uso |
| --- | --- | --- |
| `--bg` | `#0a0a0a` | Fondo principal |
| `--bg-soft` | `#141414` | Fondo elevado / detalles |
| `--fg` | `#ededed` | Texto principal |
| `--muted` | `#8a8a8a` | Texto secundario |
| `--accent` | `#e0a0ff` | Lavanda — color firma del sitio |
| `--accent-soft` | `rgba(224, 160, 255, 0.14)` | Lavanda translúcido |
| `--font-sans` | Inter Variable | Hero |
| `--font-mono` | system mono stack | Handle, role, footer |
| `--hero-size` | `clamp(2.25rem, 15vw, 12rem)` | Tamaño del h1 (responsive) |
| `--ease-out` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Easing común para todas las transiciones |

El layout raíz es `#root { display: grid; grid-template-rows: auto 1fr auto }` — header arriba, main expansivo, footer abajo.

### 4.2 Reveal inicial

Mecanismo que evita FOUC y entrega una entrada escalonada:

```css
[data-reveal] {
  animation: reveal 700ms var(--ease-out) backwards;
}
@keyframes reveal {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

[data-reveal='1'] { animation-delay: 80ms;  } /* header */
[data-reveal='2'] { animation-delay: 220ms; } /* hero-stage */
[data-reveal='3'] { animation-delay: 360ms; } /* role */
[data-reveal='4'] { animation-delay: 500ms; } /* footer */
```

> **Detalle clave**: `animation-fill-mode: backwards` (no `forwards`). Con `forwards` los valores del `to` quedaban "fijados" como override de la animación, lo cual impedía que reglas posteriores como `.hero[data-mode='piano'] .hero-role { opacity: 0 }` cambiasen el opacity. Con `backwards` el elemento queda invisible **durante el delay** (anti-FOUC) pero al terminar la animación libera el control a la cascada CSS normal.

### 4.3 Avatar — `KalamaricoAvatar.tsx`

Sprite sheet horizontal con 14 frames (256×256 cada uno). El componente `<KalamaricoAvatar>` recibe un `state: AvatarState` y calcula `background-position` para mostrar el frame correcto.

#### Animaciones definidas

```ts
ANIMATIONS = {
  blink:        ['blink', 'normal', 'blink', 'normal']    // 370ms total
  surprised:    ['surprised', 'normal']                    // 900ms
  smile:        ['smile', 'normal']                        // 1000ms
  grimace:      ['grimace', 'normal']                      // 900ms
  electrocuted: 16 frames con timings progresivos          // ~1770ms
  holdBreath:   16 frames con paleta hold→blue→purple      // ~3750ms
}
```

Cada animación es un objeto `{ frames, frameDuration }` que el hook ejecuta secuencialmente con `setState` + `await wait(ms)`.

#### Hook `useKalamaricoAvatar`

Expone un **controller** con:

| Método | Comportamiento |
| --- | --- |
| `state` | Frame actual del avatar |
| `tryPlay(anim)` | Ejecuta una animación. Devuelve `false` si `busyRef === true` (otra animación corriendo). |
| `tryPlayRandom()` | Elige una del `RANDOM_POOL` evitando repetir la última. |

#### Loop interno

`useEffect` con dos modos según la opción `paused`:

- **Activo (`paused === false`)**:
  1. Espera 5s al mount inicial.
  2. Ejecuta `tryPlay(smile)` como warm-up.
  3. Bucle infinito: `await wait(2000–8000ms)` aleatorio + `tryPlayRandom()`.
- **Pausado (`paused === true`)**: el effect retorna sin hacer nada. El loop interno no consume recursos.

El cleanup del effect:
- Cancela timers (`clearTimeout` sobre `timersRef`).
- Hace `setState('normal')` defensivo — evita que el avatar quede atascado en un frame intermedio si el loop se cancela mid-animación.
- Resetea `busyRef.current = false` por si una animación huérfana lo dejó colgado.

> **Decisión**: `tryPlay` y `tryPlayRandom` **no** consultan `cancelRef`. Solo consultan `busyRef`. Esto permite que llamadas externas (como el click handler de App) funcionen incluso cuando el loop interno está cancelado por `paused`.

### 4.4 Partículas — `usePixelParticles.tsx`

Hook que devuelve `{ burst, container }`. Por cada llamada a `burst(targetEl, palette)`:

- Calcula el centro del elemento target.
- Genera N partículas (default 14) con ángulos distribuidos + jitter.
- Cada partícula es un `<div>` con `position: fixed`, `imageRendering: pixelated`, animación CSS `kala-particle-fly` (translate + scale + opacity) que dura 500–900ms.
- Tras la animación, se eliminan vía `setTimeout`.

El `container` es un portal a `document.body` con todos los `<div>` activos.

Las paletas son arrays de colores hex predefinidos: `orange`, `yellow`, `electric`, `purple`, `cyan`, `red`. En `App.tsx` se mapea cada animación a una paleta:

```ts
blink → cyan
surprised → orange
smile → yellow
grimace → red
electrocuted → electric
holdBreath → purple
```

### 4.5 Hero — `Hero.tsx`

Núcleo de la lógica. Gestiona:

#### State

- `mode: 'text' | 'piano'` — qué renderiza el hero (h1 o piano).
- `hasInteractedRef` — flag que se vuelve `true` tras el primer click/keydown global. **Bloquea el modo piano** hasta que el usuario haya interactuado (sin gesture el navegador no permite reproducir audio).
- `ignoreNextTitleEnterRef` — flag temporal de 600ms tras `exitPianoMode` que ignora el primer `mouseenter` en el h1 (evita disparar una animación del avatar por el cursor estacionario sobre el que las letras emergen al volver a modo texto).
- `idleTimerRef` — handle del `setTimeout` de 12s.

#### Eventos

- **`window.addEventListener('click' | 'keydown')`** registrado una sola vez. Al primer evento marca `hasInteractedRef = true`, llama `scheduleIdle()`, y se desregistra.
- **`onMouseEnter` del h1** → `handleTitleEnter`: dispara la animación random del avatar (`onTitleHover`). **No afecta al timer** — el contador sigue corriendo aunque hagas hover sobre el título.
- **`onPointerEnter` del piano** → `exitPianoMode`: vuelve a modo texto y rearma el timer.
- **`onEnded` del `<audio>`** → también `exitPianoMode`: cuando la canción acaba, se sale.

#### `scheduleIdle`

```ts
const scheduleIdle = () => {
  if (!hasInteractedRef.current) return    // guard
  window.clearTimeout(idleTimerRef.current)
  idleTimerRef.current = window.setTimeout(() => {
    setMode('piano')
  }, IDLE_MS)
}
```

> El guard interno hace que sea seguro llamar a `scheduleIdle` desde cualquier parte. Si no ha habido gesture, es un no-op.

#### Render

```html
<div class="hero" data-mode={mode}>
  <div class="hero-stage" data-reveal="2">
    <h1 class="hero-title" aria-label="KALAMARICO">
      <span class="hero-title__letter" style="--i: 0; --i-rev: 9">K</span>
      <span class="hero-title__letter" style="--i: 1; --i-rev: 8">A</span>
      ...
    </h1>
    <HeroPiano playing={mode === 'piano'} ... />
  </div>
  <p class="hero-role" data-reveal="3">Senior Frontend Developer</p>
</div>
```

Cada letra es un `<span>` con `--i` (índice ascendente) y `--i-rev` (descendente). El CSS las escalona con `transition-delay: calc(var(--i) * var(--letter-stagger))`. El `--i-rev` se usa al volver a modo texto para que las letras vuelvan en cascada inversa (de derecha a izquierda).

#### Comunicación con App

`Hero` emite cambios de modo vía `onModeChange?: (mode) => void` al cambiar el state interno. App escucha con `setHeroMode`. Esto permite que App (que es el dueño del avatar) reaccione al cambio sin cruzar refs.

### 4.6 Piano visual — `HeroPiano.tsx` + CSS

#### Estructura DOM

29 blancas + 20 negras (rango C3–C7) en dos capas:

```html
<div class="hero-piano" onPointerEnter={onHoverOut}>
  <audio src={audioSrc} preload="auto" onEnded={onAudioEnded} />
  <div class="hero-piano__whites">
    <div class="hero-piano__white"></div> × 29
  </div>
  <div class="hero-piano__blacks">
    <div class="hero-piano__black"></div> × 20
  </div>
</div>
```

Las blancas en grid `repeat(29, 1fr)`. Las negras en `position: absolute` con su `left` calculado por nth-child, una regla por tecla (4 octavas × 5 negras = 20 reglas).

#### Layout dentro del `.hero-stage`

`.hero-stage` es `position: relative; display: inline-block` — su anchura es la del h1. El `.hero-piano` es `position: absolute` centrado verticalmente sobre el área del h1:

```css
.hero-piano {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(50% - var(--piano-height) / 2);
  width: 100%;
  height: var(--piano-height);   /* 1.8 × --hero-size */
  pointer-events: none;          /* ← solo cuando text mode */
}

.hero[data-mode='piano'] .hero-piano {
  pointer-events: auto;          /* recibe hover para salir */
}
```

#### Estados visuales

- **Base**: blancas con gradiente crema (`#f8f8f0 → #e8e8d8`), borde gris fino, sombra suave; negras con gradiente oscuro (`#222 → #444`) y sombra más profunda.
- **Pulsada (`data-pressed="true"`)**: blanca pasa a `#f5d8ff → var(--accent)` con glow lavanda; negra pasa a `#a770cf → #5e3a7a`. `transform: translateY(2px)` simula la pulsación.
- **Modo piano activo**: opacidad 1, scale 1, `pointer-events: auto`, transition 420ms.
- **Modo texto**: opacidad 0, `transform: translateY(16px) scale(0.94)`, `pointer-events: none`.

#### Flasheo imperativo

Para evitar `setState` por cada flash (60fps × 5 bandas = miles de re-renders/min), las pulsaciones se aplican vía DOM imperativo:

```ts
const flashKey = (keyIndex, pressMs) => {
  const el = resolveKey(keyIndex)
  el.dataset.pressed = 'true'
  setTimeout(() => delete el.dataset.pressed, pressMs)
}
```

`whiteRefs` y `blackRefs` son `useRef<(HTMLDivElement | null)[]>([])`. Refs imperativas, sin re-render React.

### 4.7 Audio FFT — `useFFTPiano.ts`

Núcleo del sistema audio-reactivo.

#### Pre-unlock

`useEffect` separado que registra un listener `pointerdown`/`keydown` en `window` (no `once: true` — se desregistra manualmente). Al primer gesture:

1. Crea `AudioContext` (con fallback `webkitAudioContext` para Safari).
2. Crea `MediaElementSource` desde el `<audio>` ref.
3. Crea `AnalyserNode` con `fftSize: 2048`, `smoothingTimeConstant: 0.6`.
4. Conecta: `source → analyser → destination`.
5. Llama `ctx.resume()` (necesario tras la creación, requiere gesture).
6. Hace un ciclo silencioso `audio.muted = true; await audio.play(); audio.pause(); audio.currentTime = 0; audio.muted = false`. Esto **desbloquea por completo el HTMLMediaElement** para `audio.play()` posteriores fuera de gesture.
7. Se desregistra a sí mismo.

> **Decisión clave**: el `AudioContext` **solo se crea aquí**. El effect principal nunca lo crea. Si no ha habido gesture, el effect principal sale temprano con `audioAvailable = false` y no hay piano sonando — nunca se loguea el warning de Chrome "AudioContext was not allowed to start".

#### Effect principal

Corre cuando `playing` cambia. Si `playing === false` o `ctx === null`, sale temprano (pausa el audio si lo estaba reproduciendo).

Si `playing === true` y el ctx existe:

1. `audio.currentTime = 0` — siempre arranca desde el principio.
2. `await audio.play()`.
3. Si rechaza, `setAudioAvailable(false)` y vuelve.
4. Si resuelve, arranca el RAF loop.

#### RAF loop — onset detection

Cada frame:

1. `analyser.getByteFrequencyData(freqData)` — array de 1024 bins (frecuencias 0–22050 Hz a 21.5 Hz/bin).
2. Por cada banda:
   - Calcula energía media en sus bins (`band.binStart` a `band.binEnd`).
   - Acumula en una historia móvil de 18 frames.
   - Calcula la media móvil.
   - **Detecta onset**: `energy > avg * threshold && now - lastTriggerTime > cooldown`.
   - Si onset: elige 1–2 teclas aleatorias de `band.keys`, evita repetir la última, llama `onTrigger(keyIndex, pressMs)`.
3. **Fill mode**: si pasaron >450ms sin disparar nada y la banda con más energía supera el `fillEnergyFloor` (28), dispara una tecla en esa banda. Evita silencios visuales en pasajes legato.

#### Bandas configuradas

```
Graves  C3–B3   bins  6–11   threshold 1.08  cooldown 70ms
Med-baj C4–B4   bins 12–23   threshold 1.12  cooldown 70ms
Medio   C5–B5   bins 24–45   threshold 1.22  cooldown 80ms
Med-alt C6–C7   bins 49–102  threshold 1.45  cooldown 120ms  ← incluye C7
```

Los thresholds están escalados: las bandas altas son menos sensibles porque los **armónicos** de notas graves saturan esos bins (un Do3 produce energía en sus múltiplos enteros, llegando a 2 kHz y más). Sin escalado, la mitad derecha del piano se iluminaba constantemente con cada nota grave.

### 4.8 Morph texto ↔ piano

Coreografía CSS controlada por `data-mode` en `.hero`.

#### Variables de tuning (en `.hero`)

```css
--morph-duration: 420ms
--piano-entry-delay: 180ms
--letter-stagger: 45ms
--letter-fall-y: 0.55em
--letter-fall-rotate: 14deg
--role-fade-y: 8px
```

#### Letras cayendo

```css
.hero-title__letter {
  display: inline-block;
  background: inherit;        /* hereda el gradiente del h1 */
  -webkit-background-clip: text;
  background-clip: text;
  transition: opacity var(--morph-duration), transform var(--morph-duration);
  transition-delay: calc(var(--i) * var(--letter-stagger));
}

.hero[data-mode='piano'] .hero-title__letter {
  opacity: 0;
  transform: translateY(0.55em) rotate(14deg);
}

.hero[data-mode='text'] .hero-title__letter {
  transition-delay: calc(var(--i-rev) * var(--letter-stagger));
}
```

> **Decisión**: cada letra hereda `background` y aplica su propio `background-clip: text`. Sin esto, el gradiente del h1 (clipeado a texto) no se proyecta a través de los `<span display:inline-block>` y las letras quedan transparentes.

#### Piano emergiendo

```css
.hero-piano {
  opacity: 0;
  transform: translateY(16px) scale(0.94);
  transition: opacity var(--morph-duration), transform var(--morph-duration);
}

.hero[data-mode='piano'] .hero-piano {
  opacity: 1;
  transform: translateY(0) scale(1);
  transition-delay: var(--piano-entry-delay);   /* 180ms — espera a que las letras empiecen a caer */
}
```

#### Role desvaneciéndose

```css
.hero-role {
  transition: opacity var(--morph-duration), transform var(--morph-duration);
}

.hero[data-mode='piano'] .hero-role {
  opacity: 0;
  transform: translateY(8px);
  pointer-events: none;
}
```

#### Avatar

App calcula el `displayState` mostrado al avatar:

```ts
const displayState =
  heroMode === 'piano' && state !== 'surprised' ? 'grimace' : state
```

- En modo piano: muestra siempre `grimace` excepto si está corriendo un `surprised` (animación legítima disparada por el click). Cuando termina `surprised`, el state vuelve a `'normal'` y el override muestra `grimace` de nuevo.
- En modo texto: pasa el state real del hook.

Adicionalmente, el hook recibe `paused: heroMode === 'piano'` que detiene su loop interno (no se disparan animaciones random durante el modo piano).

### 4.9 `prefers-reduced-motion`

Una sola media query en `global.css` deshabilita transiciones y animaciones para usuarios con esa preferencia:

```css
@media (prefers-reduced-motion: reduce) {
  [data-reveal] { animation: none; opacity: 1; }
  .hero-title, .hero-title__letter, .hero-role,
  .social a, .social a::after,
  .hero-piano, .hero-piano__white, .hero-piano__black {
    transition: none;
  }
  .hero-piano__white[data-pressed='true'],
  .hero-piano__black[data-pressed='true'] {
    transform: none;
  }
}
```

El hook `useKalamaricoAvatar` también consulta `matchMedia('(prefers-reduced-motion: reduce)')` y no arranca el loop random. Igualmente `useFFTPiano` no arranca el RAF de flasheo, aunque el audio sí se reproduce.

---

## 5. Flujo completo del usuario

1. **Carga inicial**.
   - Reveal escalonado: header (80ms) → hero-stage (220ms) → role (360ms) → footer (500ms).
   - Avatar arranca su loop random tras un warm-up `smile` a los 5s.
   - Mensaje ASCII `KALAMARICO` en consola del navegador (easter egg).
   - El timer del modo piano **no arranca**: está esperando interacción.

2. **Primer gesture** (click o keydown en cualquier sitio).
   - Hero: `hasInteractedRef = true`, `scheduleIdle()` arranca el timer de 12s.
   - useFFTPiano: `unlock` crea `AudioContext`, lo resume, hace play/pause silencioso del media element.
   - App: el click handler global dispara `tryPlay(surprised)` → avatar hace cara de sorpresa con burst naranja.

3. **Hover sobre KALAMARICO**.
   - `handleTitleEnter`: dispara `onTitleHover` → `tryPlayRandom()` → avatar hace una animación aleatoria con burst de su paleta.
   - **El timer no se afecta** — sigue corriendo aunque el cursor esté sobre el h1.

4. **12s desde el primer gesture → modo piano**.
   - `setMode('piano')` → fluye via `onModeChange` a App → `heroMode = 'piano'`.
   - CSS reacciona a `data-mode='piano'` en `.hero`:
     - Letras de `KALAMARICO` caen en cascada (45ms stagger).
     - `Senior Frontend Developer` se desvanece.
     - Piano emerge desde abajo (180ms de retraso, 420ms duración).
     - h1 deja de capturar pointer events; piano los captura.
   - Avatar: `paused=true`, loop random detenido. Display override → `grimace` estático.
   - useFFTPiano: `playing=true` → `audio.currentTime=0`, `audio.play()`, RAF arranca.
   - El MP3 suena. Las teclas se iluminan en lavanda siguiendo el FFT.

5. **Click durante modo piano**.
   - El click handler de App dispara `tryPlay(surprised)`.
   - `tryPlay` no consulta `cancelRef`, solo `busyRef`. Como el loop está pausado, `busyRef = false` → `surprised` se ejecuta normalmente.
   - Burst naranja aparece sobre el avatar.
   - Tras 900ms, state vuelve a `'normal'` → display override → `grimace` de nuevo.

6. **Hover sobre el piano** o **canción terminada**.
   - Ambos disparan `exitPianoMode` (callback compartido entre `onPointerEnter` y `onEnded`).
   - `setMode('text')`, activa `ignoreNextTitleEnterRef` (600ms).
   - useFFTPiano: `playing=false` → cleanup → `audio.pause()`, RAF cancelado.
   - Avatar: `paused=false` → loop random vuelve.
   - CSS: piano fade-out, h1 reaparece (letras en cascada inversa con `--i-rev`), role vuelve.
   - `scheduleIdle()` rearma el timer de 12s.

7. **Sin interacción tras volver del piano**.
   - El timer corre 12s y vuelve a entrar al modo piano (el hover sobre el h1 no lo afecta).

---

## 6. Decisiones de diseño relevantes

### 6.1 ¿Por qué dos sistemas de animación distintos?

- **Avatar**: pocas animaciones, breves, async basado en `setState` + `await wait()`. Cada animación es declarativa (`{ frames, frameDuration }`). Ideal para el comportamiento "vivo" del avatar (parpadeo, cara, etc.).
- **Piano FFT**: 60 fps, hasta varias decenas de pulsaciones por segundo. Aquí `setState` por cada flash sería catastrófico. Por eso DOM imperativo con refs y `dataset.pressed`.

### 6.2 Frame estático en el avatar (no animación de loop)

Inicialmente el plan era poner el avatar en bucle de `grimace` cuando entrara al modo piano. Resultó complejo:

- Race conditions con el `cancelRef` cuando el `useEffect` se re-ejecutaba.
- `tryPlay` huérfano dejaba `busyRef` colgado, bloqueando el click.
- UI se congelaba en spin del while-loop del bucle forzado.

Solución final: **el avatar muestra el frame estático `grimace`** vía override de la prop `state` en App.tsx. El loop interno se pausa con `paused`, pero `tryPlay` y `tryPlayRandom` siguen disponibles para llamadas manuales (el click handler).

### 6.3 Por qué el `AudioContext` nunca se crea fuera de un gesture

El navegador penaliza con un warning ("AudioContext was not allowed to start") cualquier `new AudioContext()` previo a un user gesture. El AudioContext queda en estado `suspended` y `resume()` solo funciona dentro de un gesture.

Por eso el `pre-unlock` es la **única ruta de creación**. El effect principal nunca crea uno; si no existe, sale a "fallback silencioso" (que en la versión actual significa: no animar nada y dejar el piano quieto).

### 6.4 Por qué `backwards` en lugar de `forwards` en `[data-reveal]`

Con `forwards`, los valores del último keyframe quedaban como override permanente (a nivel de animación), y reglas CSS posteriores no podían sobrescribir `opacity` o `transform`. Esto bloqueaba el fade del `Senior Frontend Developer` al entrar a modo piano. Con `backwards` solo se aplica el `from` durante el delay (anti-FOUC) y el resto queda en manos de la cascada.

### 6.5 Bandas FFT y armónicos

Las notas de un piano real generan armónicos en frecuencias múltiplo de la fundamental. Un Do3 (130 Hz) produce energía detectable hasta los 2–4 kHz, llenando bandas que "pertenecen" a notas mucho más agudas. Sin contramedida, la zona derecha del piano se iluminaba con cada nota grave.

Solución: **thresholds escalados**. Las bandas graves son muy sensibles (1.08), las agudas mucho menos (1.45). Esto reequilibra la actividad visual.

### 6.6 Fill mode en el FFT

Una pieza tocada con pedal/legato tiene pocos onsets claros (la energía se mantiene constante, la media móvil "alcanza" al pico). Sin un mecanismo extra, había pasajes de varios segundos sin ninguna tecla iluminada.

`fill mode`: cada vez que pasan >450ms sin disparar, se dispara una tecla en la banda con más energía actual (siempre que supere `fillEnergyFloor`). Mantiene el piano "vivo" durante pasajes sostenidos.

### 6.7 Guard del primer gesture en Hero

Sin `hasInteractedRef`, el modo piano podía activarse sin que el usuario hubiera interactuado nunca con la página. Resultado: piano visible, MP3 bloqueado por autoplay, ninguna tecla iluminada (FFT sin audio = sin onsets). Visualmente roto.

Con el guard, el contador idle **no arranca** hasta el primer click/keydown. Eso garantiza que cuando el modo piano se active, el `AudioContext` está desbloqueado y el media element ha pasado por el play/pause silencioso.

### 6.8 `ignoreNextTitleEnterRef`

Bug sutil: al pasar de modo piano a texto (vía hover en piano), las letras del h1 emergen *exactamente donde estaba el cursor del usuario*. Aunque el cursor esté estacionario, el navegador dispara `mouseenter` en el h1 (porque un nuevo elemento aparece bajo un cursor). Esto disparaba una animación random del avatar sin que el usuario hubiera hecho nada.

Fix: un flag de un solo disparo, válido 600ms. El primer `mouseenter` tras `exitPianoMode` se ignora; los posteriores funcionan normal.

### 6.9 El hover sobre el h1 no afecta al timer

El timer arranca con la primera interacción global y solo se rearma desde `exitPianoMode`. Hacer hover sobre el h1 dispara la animación random del avatar pero **no toca el timer** — el contador sigue corriendo aunque el cursor esté quieto sobre el título. Decisión deliberada del usuario: el modo piano no debe depender de dónde esté el cursor en el hero.

---

## 7. Variables tunables (resumen)

### En CSS — `global.css`

```css
.hero {
  --morph-duration: 420ms;
  --piano-entry-delay: 180ms;
  --letter-stagger: 45ms;
  --letter-fall-y: 0.55em;
  --letter-fall-rotate: 14deg;
  --role-fade-y: 8px;
}

.hero-piano {
  --piano-keys: 29;
  --piano-height: calc(var(--hero-size) * 1.8);
  --black-w-ratio: 0.61;
  --black-h-ratio: 0.61;
  --white-border-color: #aaa;
  --white-radius: 5px;
  --black-radius: 4px;
  --white-shadow: 2px 4px 8px rgba(0, 0, 0, 0.5);
  --black-shadow: 2px 6px 10px rgba(0, 0, 0, 0.8);
  --press-translate: 2px;
  --press-duration: 120ms;
  --piano-enter-offset: 16px;
  --piano-enter-scale: 0.94;
  --white-top: #f8f8f0;
  --white-bottom: #e8e8d8;
  --black-top: #222;
  --black-bottom: #444;
  --press-white-top: #f5d8ff;
  --press-white-bottom: var(--accent);
  --press-black-top: #a770cf;
  --press-black-bottom: #5e3a7a;
  --press-glow: rgba(224, 160, 255, 0.55);
}
```

### En JS

`Hero.tsx`:
- `TITLE` (`'KALAMARICO'`)
- `ROLE` (`'Senior Frontend Developer'`)
- `IDLE_MS` (12000)
- `AUDIO_SRC` (`'/audio/piano.mp3'`)

`HeroPiano.tsx`:
- `WHITE_COUNT` (29)
- `BLACK_COUNT` (20)
- `DEFAULT_PRESS_MS` (120)
- `BANDS[]` (5 bandas, cada una con `keys`, `binStart`, `binEnd`, `threshold`, `cooldownMs`)

`useFFTPiano.ts` (defaults sobrescribibles por prop):
- `pressMs` (120)
- `historyFrames` (18)
- `defaultThreshold` (1.4)
- `defaultCooldownMs` (80)
- `fillGapMs` (450)
- `fillEnergyFloor` (28)

`KalamaricoAvatar.tsx` (constantes hardcoded):
- `RANDOM_POOL[]` (animaciones del loop random)
- Tiempos de cada animación dentro de `ANIMATIONS`
- Warm-up: 5000ms al mount inicial
- Gap entre randoms: `2000 + Math.random() * 6000` ms

---

## 8. Glosario rápido de archivos

| Archivo | Responsabilidad |
| --- | --- |
| `main.tsx` | Bootstrapping React + carga fuente + easter egg consola |
| `App.tsx` | Composición raíz, owner del avatar y heroMode mirror |
| `Hero.tsx` | Estado del modo (text/piano), idle timer, hover guards |
| `HeroPiano.tsx` | DOM del piano, mount del `<audio>`, integración useFFTPiano |
| `KalamaricoAvatar.tsx` | Sprite, `useKalamaricoAvatar` (loop random + tryPlay) |
| `SocialLinks.tsx` | Iconos SVG inline + enlaces footer |
| `useFFTPiano.ts` | AudioContext + Analyser + RAF + onset detection |
| `usePixelParticles.tsx` | Bursts de partículas pixel art |
| `global.css` | Tokens, layout, hero, piano, animaciones, reduced-motion |

---

*Documento mantenido manualmente. Actualizar al introducir nuevos sistemas o cambiar variables tunables.*
