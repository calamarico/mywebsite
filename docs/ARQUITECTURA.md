# Arquitectura del proyecto

Documentación detallada de cómo está montado el sitio personal de **Kalamarico** y cómo conviven sus piezas.

---

## 1. Visión general

Sitio one-page con tres elementos visibles permanentes (header con avatar, hero central, footer con redes) y una mecánica oculta: tras el primer click/tecla del usuario, una intro animada tipo terminal (typewriter, ~17s) precede al modo piano, en el que el título `KALAMARICO` se transforma en un piano que reproduce un MP3 real, mientras las teclas del piano se iluminan **siguiendo los picos de frecuencia del audio en tiempo real** (FFT vía Web Audio API). El modo piano es one-shot: tras un único ciclo completo, queda deshabilitado para el resto de la sesión.

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
│   │   ├── kalamarico_sprite_v3.png   # sprite sheet del avatar (17 frames × 256px)
│   │   └── mm_bernard.jpeg            # favicon
│   ├── components/
│   │   ├── Hero.tsx            # h1, gestión del modo (text/intro/piano)
│   │   ├── HeroPiano.tsx       # piano DOM (29 blancas + 20 negras), <audio>, integra useFFTPiano
│   │   ├── KalAmaricoIntro.tsx # intro terminal animado (~17s) que precede al modo piano
│   │   ├── KalamaricoAvatar.tsx # sprite + hook useKalamaricoAvatar (loop random + tryPlay)
│   │   └── SocialLinks.tsx     # iconos SVG inline + enlaces footer
│   ├── hooks/
│   │   ├── useClickHints.tsx   # texto "click anywhere" + ondas aleatorias antes del primer click
│   │   ├── useFFTPiano.ts      # AudioContext + Analyser + RAF + onset detection
│   │   ├── useMusicalNotes.tsx # notas musicales flotantes alrededor del avatar durante modo piano
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

Sprite sheet horizontal con 17 frames (256×256 cada uno). El componente `<KalamaricoAvatar>` recibe un `state: AvatarState` y calcula `background-position` para mostrar el frame correcto. Frames: `normal, surprised, blink, smile, grimace, electro1-2, hold1-2, blue1-2, purple1-3, whistle1-3`.

#### Animaciones definidas

```ts
ANIMATIONS = {
  blink:        ['blink', 'normal', 'blink', 'normal']    // 370ms total
  surprised:    ['surprised', 'normal']                    // 900ms
  smile:        ['smile', 'normal']                        // 1000ms
  grimace:      ['grimace', 'normal']                      // 900ms
  electrocuted: 16 frames con timings progresivos          // ~1770ms
  holdBreath:   16 frames con paleta hold→blue→purple      // ~1320ms
  whistle:      8 frames con patrón whistle1/whistle3 asimétrico  // 1760ms loopable
}
```

Cada animación es un objeto `{ frames, frameDuration }` que el hook ejecuta secuencialmente con `setState` + `await wait(ms)`. La animación `whistle` es especial: **no termina en `'normal'`** — está diseñada para encadenarse en bucle desde el effect del hook (modo piano).

#### Hook `useKalamaricoAvatar`

Expone un **controller** con:

| Método | Comportamiento |
| --- | --- |
| `state` | Frame actual del avatar |
| `tryPlay(anim)` | Ejecuta una animación. Devuelve `false` si `busyRef === true` (otra animación corriendo). Comprueba `cancelRef` entre frames para abortar limpio. |
| `tryPlayRandom()` | Elige una del `RANDOM_POOL` evitando repetir la última. |

#### Loop interno

`useEffect` con dos modos según la opción `whistle`:

- **`whistle === false` (random loop)**:
  1. Espera 3s al mount inicial.
  2. Ejecuta `tryPlay(smile)` como warm-up.
  3. Bucle infinito: `await wait(1000–3000ms)` aleatorio + `tryPlayRandom()`.
- **`whistle === true` (piano mode)**:
  1. Bucle inmediato: `await tryPlay(ANIMATIONS.whistle)` encadenado sin gap. Cada ciclo dura 1760ms (8 frames × 220ms).
  2. El loop respeta `cancelRef` entre ciclos para parar limpio cuando cambia el prop.

El cleanup del effect (común a ambos modos):
- Cancela timers (`clearTimeout` sobre `timersRef`).
- Marca `cancelRef.current = true` para que `tryPlay` aborte entre frames.
- Hace `setState('normal')` defensivo — evita que el avatar quede atascado en un frame intermedio (importante al salir del modo whistle: si no, se quedaría con la boca abierta).
- Resetea `busyRef.current = false` por si una animación huérfana lo dejó colgado.

> **Por qué un único effect comparte ambos modos**: el cleanup uniforme (`cancelRef + clearTimers + setState('normal')`) garantiza que cualquier transición entre modos deje el avatar en estado limpio. Versiones anteriores intentaron un loop separado fuera del hook y se enredaron con races (ver §6.2).

> **Decisión**: `tryPlay` y `tryPlayRandom` consultan `busyRef` para evitar solapamiento. `tryPlay` también respeta `cancelRef` entre frames para abortar limpio durante una transición de modo.

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

- `mode: 'text' | 'intro' | 'piano'` — qué renderiza el hero (h1, intro o piano).
- `hasInteractedRef` — flag que se vuelve `true` tras el primer click/keydown global. **Bloquea el modo intro/piano** hasta que el usuario haya interactuado (sin gesture el navegador no permite reproducir audio).
- `ignoreNextTitleEnterRef` — flag temporal de 600ms tras `exitPianoMode` que ignora el primer `mouseenter` en el h1 (evita disparar una animación del avatar por el cursor estacionario sobre el que las letras emergen al volver a modo texto).
- `pianoDisabledRef` — flag persistente de sesión. Se vuelve `true` en dos casos: (a) el hook de audio reporta un fallo definitivo; (b) el modo piano completa un ciclo (la canción termina). En ambos, **bloquea para siempre** la entrada al modo intro/piano hasta recargar la página.
- `modeRef` — espejo del state `mode` para que callbacks estables (como `handleAudioFailed`) consulten el modo actual sin ser dependencia.

#### Eventos

- **`window.addEventListener('click' | 'keydown')`** registrado una sola vez. Al primer evento marca `hasInteractedRef = true`, llama `startIntro()`, y se desregistra.
- **`onMouseEnter` del h1** → `handleTitleEnter`: dispara la animación random del avatar (`onTitleHover`). **No afecta al modo** — el hover es solo para el avatar.
- **`onComplete` del `<KalAmaricoIntro>`** → `handleIntroComplete`: ~17s después del montaje del intro, transiciona a `mode = 'piano'`. Si en ese intervalo el audio falló (`pianoDisabledRef = true`), vuelve a `'text'` en su lugar.
- **`onAudioEnded` del `<HeroPiano>`** → `exitPianoMode`: única ruta de salida del modo piano. Vuelve a texto y marca `pianoDisabledRef = true`.
- **`onAudioFailed` del `<HeroPiano>`** → `handleAudioFailed`: si el hook reporta fallo definitivo (unlock o `audio.play()` rechaza), marca `pianoDisabledRef = true` y, si estábamos en intro o piano, sale a texto inmediatamente.

> **El hover sobre el piano no hace nada** — durante el modo piano el usuario no puede salir manualmente. El piano corre hasta que la canción termina y entonces vuelve a texto definitivamente.

#### `startIntro`

```ts
const startIntro = () => {
  if (!hasInteractedRef.current) return    // guard primer gesture
  if (pianoDisabledRef.current) return     // guard fallo o ciclo previo
  if (modeRef.current !== 'text') return   // ya estamos en intro/piano
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  setMode(reduced ? 'piano' : 'intro')
}
```

> Si el usuario tiene `prefers-reduced-motion: reduce`, salta el intro y va directo al piano. El intro no está pensado para ser breve ni discreto.

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
  <audio src={audioSrc} preload="auto" playsInline onEnded={onAudioEnded} />
  <div class="hero-piano__whites">
    <div class="hero-piano__white"></div> × 29
  </div>
  <div class="hero-piano__blacks">
    <div class="hero-piano__black"></div> × 20
  </div>
</div>
```

> El atributo `playsInline` es necesario en iOS Safari para que el audio no se vaya a fullscreen al hacer `play()`. En Android no estorba.

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
  pointer-events: none;          /* nunca captura eventos: el piano es decorativo */
}
```

> El piano nunca recibe pointer events: durante el modo piano el usuario no interactúa con las teclas. La salida se produce solo cuando termina la canción.

#### Estados visuales

- **Base**: blancas con gradiente crema (`#f8f8f0 → #e8e8d8`), borde gris fino, sombra suave; negras con gradiente oscuro (`#222 → #444`) y sombra más profunda.
- **Pulsada (`data-pressed="true"`)**: blanca pasa a `#f5d8ff → var(--accent)` con glow lavanda; negra pasa a `#a770cf → #5e3a7a`. `transform: translateY(2px)` simula la pulsación.
- **Modo piano activo**: opacidad 1, scale 1, transition 420ms.
- **Modo texto**: opacidad 0, `transform: translateY(16px) scale(0.94)`.

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

`useEffect` separado que registra un listener `pointerdown`/`keydown` en `window` con `{ once: true }`. Al primer gesture:

1. Crea `AudioContext` (con fallback `webkitAudioContext` para Safari).
2. Crea `MediaElementSource` desde el `<audio>` ref.
3. Crea `AnalyserNode` con `fftSize: 2048`, `smoothingTimeConstant: 0.6`.
4. Conecta: `source → analyser → destination`.
5. Dispara **sin await** `ctx.resume()` y `audio.play()` (con `audio.muted = true`) **dentro del mismo stack del gesture**. Las promesas resuelven después: tras el play silencioso, hace `pause()` + `currentTime = 0` y restaura `muted`.

> **Por qué síncrono y sin await previo** (Android/iOS Chrome): cualquier `await` antes del `audio.play()` consume la "user activation" del gesture y los siguientes `play/resume` se tratan como auto-start → autoplay policy los rechaza. Disparar ambas promesas síncronamente dentro del listener mantiene la activación.

> **Tolerancia ante fallo del silent prime**: si el `audio.play()` muteado rechaza, **solo se loguea un `console.warn`**, NO se invoca `notifyFailure`. Algunas versiones de Android Chrome rechazan el prime silencioso aunque el play() real al entrar a piano sí funciona. Dejamos que `start()` sea el juez real del estado del audio.

> **Decisión clave**: el `AudioContext` **solo se crea aquí**. El effect principal nunca lo crea. Si no ha habido gesture, el effect principal sale temprano con `audioAvailable = false` y no hay piano sonando — nunca se loguea el warning de Chrome "AudioContext was not allowed to start".

#### Effect principal

Corre cuando `playing` cambia. Si `playing === false` o `ctx === null`, sale temprano (pausa el audio si lo estaba reproduciendo).

Si `playing === true` y el ctx existe:

1. `await ctx.resume()` si está suspended.
2. `audio.currentTime = 0` — siempre arranca desde el principio.
3. `await audio.play()`.
4. Si rechaza con `AbortError` (race típico cuando un `pause()` interrumpe un `play()`), se ignora silenciosamente.
5. Si rechaza con cualquier otro error, llama `notifyFailure('audio-play-rejected', e)`, marca `audioAvailable = false` y vuelve.
6. Si resuelve, arranca el RAF loop.

#### Reporte de fallos — `onAudioFailed`

Opción opcional del hook. Se invoca **una sola vez por sesión** (gated por `failureLoggedRef`) cuando ocurre un fallo definitivo de audio. Casos cubiertos:

- `webaudio-unsupported`: el navegador no expone `AudioContext` ni `webkitAudioContext`.
- `unlock-failed`: el `try` síncrono del pre-unlock cae al catch (creación de `AudioContext`, `createMediaElementSource`, etc.). El rechazo del play silencioso **no** entra aquí.
- `audio-play-rejected`: el `audio.play()` real del effect principal rechaza con un error que no es `AbortError`.

Cada caso loguea un `console.warn` con la razón y el error original. Solo el primer fallo invoca el callback; los siguientes solo loguean. Casos que **NO** disparan `onAudioFailed`:

- "Aún no ha habido gesture" — no es fallo, es estado transicional. Lo cubre el guard de `hasInteractedRef` en Hero.
- `<audio>` element no montado (audioRef vacío) — pre-condición no cumplida, no error.
- Rechazo del silent prime durante el unlock — solo `console.warn`, no fallo definitivo (Android Chrome a veces lo rechaza aunque el play real funciona).
- `AbortError` en `audio.play()` del effect principal — race de play/pause, no fallo de autoplay.

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

App pasa el `state` real del hook directamente al componente — sin override. Durante el modo piano, el avatar refleja los frames de `whistle` que el propio hook está reproduciendo en bucle.

```ts
<KalamaricoAvatar state={state} ... />
```

El control del comportamiento se hace vía la opción del hook:

```ts
useKalamaricoAvatar({
  onAnimationStart,
  whistle: heroMode === 'piano',
})
```

- Cuando `heroMode === 'piano'`: el hook arranca un loop continuo de `ANIMATIONS.whistle` (4 frames × 150ms en bucle). El avatar silba sincronizado con la música.
- Cuando `heroMode !== 'piano'`: el hook ejecuta su loop random normal.
- Al cambiar el prop, el cleanup del effect (común a ambos modos) deja el avatar en `'normal'` antes de re-arrancar con el otro modo.

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

El hook `useKalamaricoAvatar` también consulta `matchMedia('(prefers-reduced-motion: reduce)')` y no arranca el loop random. Igualmente `useFFTPiano` no arranca el RAF de flasheo, aunque el audio sí se reproduce. En `Hero`, `startIntro` también respeta esta preferencia y salta el intro yendo directo al modo piano.

### 4.10 KalAmaricoIntro — `KalAmaricoIntro.tsx`

Componente de intro animada que precede al modo piano. Aparece cubriendo el área del h1 cuando `mode === 'intro'` y termina llamando a `onComplete` después de ~17s.

#### Estructura

Es un componente self-contained: trae sus propios estilos en un `<style>` inline (clases `kala-*`), su propia tipografía (`Press Start 2P` desde Google Fonts), y su propio loop async (sin librerías externas).

#### Fases

1. **Typewriter** (~13s): cinco líneas se escriben carácter a carácter, se mantienen un breve momento, y se borran. Cada línea tiene su propia velocidad de tipeo y pausa de lectura.
2. **Countdown** (~2s): muestra `3,` → `3, 2,` → `3, 2, 1...`.
3. **"Let's go!"**: aparece centrado y se invoca `onComplete()`. La línea de terminal se desvanece simultáneamente.

#### API

```ts
interface KalAmaricoIntroProps {
  onComplete?: () => void
  style?: React.CSSProperties
  className?: string
}
```

`onComplete` se dispara una sola vez cuando aparece "Let's go!". El consumidor (Hero) la usa para hacer `setMode('piano')`.

#### Hook interno `useTerminalIntro`

Maneja el state de fase (`'typing' | 'countdown' | 'letsgo'`), el texto actualmente tipeado, y el contador. Auto-arranca en mount. Limpia sus timers en unmount vía `cancelRef + clearTimers()`.

#### Posicionamiento en Hero

Se monta dentro del `.hero-stage` envuelto en un `.hero-intro-slot` con `position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%)`. La anchura es `min(calc(100vw - 24px), 1100px)` — rompe la inline-block trap del `.hero-stage` (que sigue la anchura del h1, demasiado estrecha en mobile) y se ancla al centro horizontal. En desktop ocupa hasta 1100px para que las frases largas no wrappeen y la presencia visual sea más cinematográfica. Mantiene altura fija de 200px y `pointer-events: none`.

#### Tipografía responsive

`.kala-terminal` usa `font-size: clamp(10px, 2.4vw, 18px)` con `line-height: 1.7` y `.kala-letsgo` `clamp(13px, 3vw, 22px)`. El cursor está en unidades `em` (`width: 0.78em; height: 1em`) para escalar con la fuente.

En desktop (slot hasta 1100px) las frases largas caben en una sola línea. En mobile no caben aunque la fuente esté reducida; se permite wrap con `white-space: pre-wrap; word-break: break-word`. El typewriter se siente como un terminal real cuando una frase es más larga que la anchura disponible: la línea continúa abajo en lugar de cortarse. El `line-height: 1.7` da suficiente aire entre líneas wrappeadas para mantener legibilidad.

#### Background

`.kala-intro` es `background: transparent` (no rectángulo negro). Deja ver el `--bg` del `<body>` con su radial-gradient, integrando el intro visualmente con el resto de la página.

> Detalle técnico: `.kala-terminal` es flex item del `.kala-intro` (centrado vertical y horizontal). Necesita `min-width: 0` para que el `max-width: 100%` se respete y el wrap suceda — sin esa regla, el flex item por defecto crece a la anchura intrínseca del contenido y desborda.

### 4.11 Notas musicales — `useMusicalNotes.tsx`

Hook que devuelve `{ start, stop, MusicalNotesLayer }`. Spawnea símbolos musicales (`♩ ♪ ♫ ♬`) flotando hacia arriba alrededor de un elemento target mientras está activo. App lo usa para acompañar visualmente al avatar durante el modo piano.

#### API

- `start(target: HTMLElement | DOMRect, opts?: MusicalNotesOptions)` — arranca un `setInterval` que spawnea una nota cada `interval` ms (default `340`). Si ya estaba corriendo, hace `stop()` antes.
- `stop()` — limpia el interval, vacía `targetRef`, vacía las notas activas.
- `MusicalNotesLayer` — componente que portaliza a `document.body` un `<style>` con los keyframes `kala-note-float` y un `<div>` por nota viva.

#### Mecánica

Cada nota:
- Se posiciona en `position: fixed` en coordenadas calculadas a partir del `getBoundingClientRect()` del target. El `rect` se vuelve a leer en cada tick → si el avatar se mueve (scroll, layout shift), las notas le siguen.
- Spawnea con jitter angular hacia el hemisferio superior del target (efecto "silba hacia arriba"), a un radio de 18-48px del centro.
- Anima vía CSS keyframes `kala-note-float` durante 1.8-3.2s (translate + rotate + scale + opacity).
- Tiene paleta `#ffffff / #e0a0ff / #c8b8ff / #f0d0ff` (compatible con el accent del proyecto).
- Se autodestruye via `setTimeout` cuando termina su animación.

#### Integración en App

```ts
useEffect(() => {
  if (heroMode !== 'piano') {
    stopNotes()
    return
  }
  if (!avatarRef.current) return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) return
  startNotes(avatarRef.current)
  return () => stopNotes()
}, [heroMode, startNotes, stopNotes])
```

`<MusicalNotesLayer />` se monta una sola vez en el árbol JSX (junto al `{container}` de partículas). Su orden en el JSX es estético: portaliza a `document.body`.

#### Rate fijo, no sincronizado con FFT

Las notas se spawnean a ritmo fijo (340ms) — no siguen los onsets reales del audio. Decisión consciente, ver §6.14.

#### Reduced motion

El hook trae sus propios keyframes inline, fuera del alcance del media query global. Por eso App añade un guard explícito antes de `startNotes`. Si el usuario tiene `prefers-reduced-motion: reduce`, no aparecen notas.

### 4.12 Click hints — `useClickHints.tsx`

Hook que muestra el texto **"click anywhere"** acompañado de ondas concéntricas expansivas en posiciones aleatorias del viewport, invitando al usuario a hacer click la primera vez. Devuelve `{ start, stop, ClickHintsLayer }`.

#### API

- `start(excludeSelectors: string[], opts?: ClickHintsOptions)` — programa un timer recursivo que spawnea un hint cada 0.9-1.7s en una posición válida.
- `stop()` — cancela el timer y limpia los hints activos.
- `ClickHintsLayer` — componente que portaliza a `document.body` los hints con sus estilos inline.

#### Posicionamiento

Cada spawn pide una posición:
1. Lee `getBoundingClientRect()` de los selectores excluidos (`.site-header`, `.hero`, `.site-footer`).
2. Genera un `(x, y)` aleatorio dentro del viewport con margen (40px del borde).
3. Si cae dentro de cualquier rectángulo excluido + padding (24px), reintenta hasta 12 veces.
4. Si no encuentra hueco, salta esa ronda (mobile estrecho puede tener pocos huecos).

#### Visual

Cada hint:
- 3 ondas concéntricas (10px iniciales, escalan ×8 en 1.4s) con delay escalonado 0/220/440ms, color accent `#e0a0ff`.
- Texto "click anywhere" en monospace 11px, color `rgba(255,255,255,0.62)`, posicionado 22px sobre el centro de las ondas.
- Animación del texto: fade-in subiendo + fade-out subiendo (1.6s total).

Auto-cleanup tras 1.6s + 100ms de buffer.

#### Lifecycle en App

```ts
useEffect(() => {
  if (heroMode !== 'text') {
    hintsDisabledRef.current = true   // ← deshabilita permanentemente
    stopHints()
    return
  }
  if (hintsDisabledRef.current) return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) return
  startHints(['.site-header', '.hero', '.site-footer'])
  return () => stopHints()
}, [heroMode, startHints, stopHints])
```

Solo aparecen **antes del primer click** del usuario. Una vez `heroMode` deja de ser `'text'` (pasa a `'intro'` o `'piano'`), `hintsDisabledRef = true` para el resto de la sesión: aunque la canción termine y `heroMode` vuelva a `'text'`, los hints **no reaparecen** — el usuario ya ha visto la página.

#### Reduced motion

App también guard contra `prefers-reduced-motion: reduce` antes de `startHints`. Mismo patrón que `useMusicalNotes`.

---

## 5. Flujo completo del usuario

1. **Carga inicial**.
   - Reveal escalonado: header (80ms) → hero-stage (220ms) → role (360ms) → footer (500ms).
   - Avatar arranca su loop random tras un warm-up `smile` a los 3s.
   - Mensaje ASCII `KALAMARICO` en consola del navegador (easter egg).
   - **Click hints** empiezan a aparecer aleatoriamente cada 0.9-1.7s: texto "click anywhere" + ondas expansivas color accent, en posiciones del viewport que no chocan con header / hero / footer.
   - Hero está esperando el primer gesture; `mode = 'text'`.

2. **Primer gesture** (click o keydown en cualquier sitio).
   - Hero: `hasInteractedRef = true`, `startIntro()` cambia `mode` a `'intro'` (o a `'piano'` si reduced-motion).
   - useFFTPiano: `unlock` crea `AudioContext`, lo resume, hace play/pause silencioso del media element.
   - App: el click handler global dispara `tryPlay(surprised)` → avatar hace cara de sorpresa con burst naranja.
   - App: detecta cambio de `heroMode` → marca `hintsDisabledRef = true` y para los click hints (no reaparecerán en esta sesión).
   - CSS reacciona a `data-mode='intro'`: letras del h1 caen en cascada, `Senior Frontend Developer` se desvanece. El componente `KalAmaricoIntro` emerge en el área del h1 y arranca su typewriter.

3. **Hover sobre KALAMARICO** (durante text).
   - `handleTitleEnter`: dispara `onTitleHover` → `tryPlayRandom()` → avatar hace una animación aleatoria con burst de su paleta. **No afecta al modo**.

4. **Intro completa (~17s, "Let's go!") → modo piano**.
   - `KalAmaricoIntro` invoca `onComplete` → `handleIntroComplete` → `setMode('piano')`.
   - El intro se desmonta. CSS de `data-mode='piano'`:
     - Letras del h1 siguen caídas (mismo selector cubre `intro` y `piano`).
     - Piano emerge desde abajo (180ms de retraso, 420ms duración).
     - h1 deja de capturar pointer events; piano los captura.
   - Avatar: el hook recibe `whistle=true` → cleanup del random loop → arranca el loop continuo de `ANIMATIONS.whistle` (8 frames alternando whistle1/whistle3 con patrón asimétrico, 1760ms por ciclo).
   - useFFTPiano: `playing=true` → `audio.currentTime=0`, `audio.play()`, RAF arranca.
   - El MP3 suena. Las teclas se iluminan en lavanda siguiendo el FFT.
   - App arranca `useMusicalNotes` → notas `♩ ♪ ♫ ♬` empiezan a flotar hacia arriba alrededor del avatar (rate 340ms, paleta lavanda/blanco).

5. **Click durante modo piano**.
   - El click handler de App entra y comprueba `heroModeRef.current === 'piano'` → `return`.
   - **No se dispara `surprised`** ni se emite burst. El avatar sigue silbando ininterrumpidamente.
   - Las notas musicales siguen flotando con normalidad.

6. **Canción terminada**.
   - El `<audio>` dispara `onEnded` → `exitPianoMode`.
   - `setMode('text')`, marca `pianoDisabledRef = true` (modo piano deshabilitado para el resto de la sesión), activa `ignoreNextTitleEnterRef` (600ms).
   - useFFTPiano: `playing=false` → cleanup → `audio.pause()`, RAF cancelado.
   - App detecta cambio de `heroMode` → llama `stopNotes()` → no se spawnan notas nuevas; las notas activas terminan su animación pendiente y se limpian solas.
   - Avatar: el hook recibe `whistle=false` → cleanup deja el avatar en `'normal'` → re-arranca el random loop (3s de warm-up + smile + bucle aleatorio).
   - CSS: piano fade-out, h1 reaparece (letras en cascada inversa con `--i-rev`), role vuelve.
   - **No se rearma el timer**. La sesión sigue en modo texto normal y ya no hay más ciclos de piano.

> El modo piano ocurre **una sola vez por sesión**. El usuario lo experimenta como un easter-egg que arranca con el primer click, tras una intro narrativa de ~17s, y dura lo que dure la canción. Cuando termina, la página vuelve a ser un hero estático normal hasta que se recargue.

### Rama alternativa — fallo de audio

Si en cualquier punto el hook detecta un fallo definitivo (unlock o `audio.play()` rechaza):

1. `notifyFailure` loguea un único `console.warn` con la razón.
2. Se invoca `onAudioFailed` (idempotente).
3. Hero marca `pianoDisabledRef = true` y sale a modo texto si estaba en intro o piano.
4. A partir de aquí, ningún `startIntro` arranca el intro (guard) y ningún `handleIntroComplete` salta a piano.
5. El usuario ve la página en modo texto normal hasta el final de la sesión. Recargar la página es la única forma de reintentarlo.

---

## 6. Decisiones de diseño relevantes

### 6.1 ¿Por qué dos sistemas de animación distintos?

- **Avatar**: pocas animaciones, breves, async basado en `setState` + `await wait()`. Cada animación es declarativa (`{ frames, frameDuration }`). Ideal para el comportamiento "vivo" del avatar (parpadeo, cara, etc.).
- **Piano FFT**: 60 fps, hasta varias decenas de pulsaciones por segundo. Aquí `setState` por cada flash sería catastrófico. Por eso DOM imperativo con refs y `dataset.pressed`.

### 6.2 Loop de silbido durante modo piano (en lugar de frame estático)

Iteración 1 (descartada): bucle de `grimace` durante piano vía un loop separado fuera del hook → race conditions con `cancelRef` cuando el `useEffect` se re-ejecutaba, `tryPlay` huérfano dejaba `busyRef` colgado, UI congelada.

Iteración 2 (provisional): **frame estático `grimace`** vía override de `displayState` en App.tsx, con prop `paused` desactivando el loop interno. Funcionó pero el avatar quedaba inerte durante la canción y compitiendo visualmente con las notas musicales.

Iteración 3 (actual): se añadieron 3 frames de silbido al sprite (v3) y una nueva animación `whistle` de 4 frames loopable. **El loop vive dentro del mismo `useEffect` que el random loop**, gobernado por la prop `whistle`. Esto cambia la dinámica respecto a la iteración 1:

- Un único cleanup (`cancelRef + clearTimers + setState('normal')`) cubre cualquier transición entre modos.
- `tryPlay` ahora consulta `cancelRef` entre frames, así que aborta limpio cuando se cancela.
- No hay loop externo en App: la única fuente de animación es el effect del hook.

Resultado: avatar silbando en bucle durante toda la canción, transición limpia a/desde modo random sin frames atascados.

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

### 6.9 El hover sobre el h1 no afecta al modo

Hacer hover sobre el h1 dispara la animación random del avatar pero **no toca el modo** — la transición a intro/piano depende solo del primer gesture global y luego del `onComplete` del intro.

### 6.10 El modo piano se activa una sola vez por sesión

Decisión: el modo piano es un easter-egg one-shot. Se activa una vez (tras el primer gesture y la intro de ~17s) y, cuando la canción termina (o falla el audio), queda deshabilitado para el resto de la sesión.

Razones:
- **No es interactivo**: no es un reproductor de música; es una pequeña pieza ambiental. Una vez vista, no aporta valor repetirla.
- **No se puede salir manualmente**: el hover sobre el piano no hace nada. La única forma de "volver" es esperar a que la canción acabe.
- **No vuelve solo**: tras terminar, no hay más entradas a intro ni piano. El usuario ve la página normal hasta recargar.

El flag `pianoDisabledRef` (en Hero) se vuelve `true` en dos casos: (a) `exitPianoMode` (canción terminada), (b) `handleAudioFailed` (fallo de audio). Los guards de `startIntro` y `handleIntroComplete` impiden cualquier reprogramación futura. La diferencia entre ambos casos:

| Caso | ¿Llegó a verse el piano? | Tras el bloqueo |
| --- | --- | --- |
| Canción terminada | Sí, ciclo completo | Modo texto normal hasta recargar |
| Fallo de audio | A veces (race del primer `start()`); si pasa, se sale inmediatamente | Modo texto normal hasta recargar; un `console.warn` documenta la razón |

Trade-offs aceptados:
- **Sin UI de error**: si el audio falla, el usuario nunca lo nota — la página parece no tener la feature. Aceptable: el modo piano es un easter-egg, no un funcional crítico.
- **Sin reintento**: ni el ciclo completado ni el fallo se pueden "rebajar". Recargar es el camino. Mantiene la lógica simple.
- **Un único `console.warn` por sesión** ante fallos: idempotente vía `failureLoggedRef` en el hook.

### 6.11 Intro narrativa en lugar de timer ciego

Antes, el modo piano arrancaba tras 12s de inactividad sin más. El usuario tenía que adivinar qué hacía la página o esperar sin contexto.

Ahora, el primer gesture activa la intro `KalAmaricoIntro` (~17s de typewriter + countdown + "Let's go!") que actúa como **anuncio explícito** del modo piano. La transición es más narrativa, da contexto, y elimina la incógnita de "¿qué hace esta página si me quedo quieto?".

Beneficios laterales:
- **El gesture activa el ciclo entero**: ya no hay disonancia entre "click para desbloquear audio" y "12s para que pase algo". Un click → empieza la intro → empieza el piano.
- **No depende de la inactividad**: usuarios que interactúan rápido con la página no se pierden el easter-egg.
- **Aprovecha el tiempo de carga del MP3**: durante los 17s del intro, el navegador puede precargar el audio (`preload="auto"`).

Contras:
- **El gesture no puede ser sutil**: cualquier click (incluso en un enlace social) lo activa. Si el usuario está navegando con teclado, basta un keydown. Aceptable: la intro es bonita y dura 17s; si molesta, basta esperar a que termine y vuelva al estado normal tras la canción.
- **Se respeta `prefers-reduced-motion`** saltando el intro y yendo directo al piano. La intro es animada y no tiene "modo plano".

### 6.12 Click no dispara `surprised` en modo piano

Durante el modo piano el avatar está silbando en bucle (8 frames whistle1/whistle3 alternados, 1760ms por ciclo) y aparecen las notas musicales flotando a su alrededor. Permitir que el click dispare la animación `surprised` rompía esa atmósfera por dos razones:

- **Visualmente compite** con las notas musicales: el burst naranja de partículas se cruza con las notas lavanda y la composición se vuelve ruidosa.
- **Narrativamente disonante**: el avatar acaba de prometer un "concert" en la intro y está silbando la canción; cortar la animación de silbido para meter una cara de sorpresa cada dos segundos rompe la inmersión.

Implementación: un guard al inicio del click handler en App (`if (heroModeRef.current === 'piano') return`). Fuera del modo piano (texto e intro), el click sigue disparando `surprised` exactamente como antes. El ref espejo evita re-instalar el handler en cada cambio de modo.

### 6.13 Click hints solo antes del primer gesture

Los click hints (texto + ondas) aparecen aleatoriamente sobre el viewport para invitar al usuario a hacer click la primera vez. Una vez ocurre el primer gesture (heroMode deja de ser `'text'`), `hintsDisabledRef = true` y **no reaparecen** aunque tras la canción el modo vuelva a `'text'`.

Razones:
- **Función pedagógica única**: los hints existen para que el usuario descubra que clickar dispara el easter-egg. Tras hacerlo, ya conoce la página; mostrarlos otra vez es ruido.
- **Coherencia con el modo piano one-shot** (§6.10): la página solo tiene una "primera impresión" por sesión. Tras la canción, todo es estado normal post-experiencia.
- **No molestar**: los hints son intencionalmente sutiles pero recurrentes; mantenerlos vivos sin propósito tras la interacción rompería la calma post-show.

### 6.14 Notas con rate fijo, no sincronizadas con FFT

Las notas musicales spawnean cada 340ms a ritmo fijo, no en los onsets reales del audio detectados por la FFT. Decisión consciente:

- **Separación de responsabilidades**: el FFT vive dentro de `HeroPiano` (refs imperativas, `dataset.pressed`). Exponerlo a App requeriría un nuevo callback `onTrigger` que cruzaría hooks (Hero → HeroPiano → useFFTPiano → callback hacia arriba → App), añadiendo acoplamiento por un beneficio visual marginal.
- **Densidad estable**: a ritmo fijo el efecto se siente "ambiental"; sincronizado con onsets sería más espectacular en pasajes densos pero lo dejaría desierto en pasajes sostenidos (precisamente el caso que el `fillMode` del FFT compensa internamente para las teclas).
- **Tunable por opción**: si en el futuro queremos densificar/relajar, basta pasar `start(avatarRef.current, { interval: 220 })` desde App.

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
- `AUDIO_SRC` (`'/audio/piano.mp3'`)

`KalAmaricoIntro.tsx`:
- `LINES[]`: textos, velocidad de tipeo (`spd`) y pausa de lectura (`read`) por línea.
- Timings del countdown (hardcoded `780ms`, `780ms`, `500ms`).

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

`useMusicalNotes.tsx` (defaults sobrescribibles vía `opts` en `start`):
- `interval` (340 ms entre notas)
- radio de spawn (18-48 px del centro del avatar)
- altura de subida `dy` (55-140 px hacia arriba)
- tamaño de la nota (14-28 px)
- símbolos `♩ ♪ ♫ ♬`, paleta `#ffffff / #e0a0ff / #c8b8ff / #f0d0ff`

`useClickHints.tsx` (constantes hardcoded, sobrescribibles vía `opts` en `start`):
- `text` (`'click anywhere'`)
- `intervalMs` (`[900, 1700]` — gap aleatorio entre hints)
- `excludePadding` (24 px de margen alrededor de los rectángulos excluidos)
- `viewportPadding` (40 px de margen al borde del viewport)
- `HINT_DURATION` (1600 ms — vida total del hint)
- 3 ondas con delay 0/220/440ms, escalan de 10px → ×8

`KalamaricoAvatar.tsx` (constantes hardcoded):
- `RANDOM_POOL[]` (animaciones del loop random)
- Tiempos de cada animación dentro de `ANIMATIONS`
- Warm-up: 3000ms al mount inicial
- Gap entre randoms: `1000 + Math.random() * 2000` ms

---

## 8. Glosario rápido de archivos

| Archivo | Responsabilidad |
| --- | --- |
| `main.tsx` | Bootstrapping React + carga fuente + easter egg consola |
| `App.tsx` | Composición raíz, owner del avatar y heroMode mirror |
| `Hero.tsx` | Estado del modo (text/intro/piano), guards, gestión de transiciones |
| `HeroPiano.tsx` | DOM del piano, mount del `<audio>`, integración useFFTPiano |
| `KalAmaricoIntro.tsx` | Intro terminal animado (~17s) que precede al modo piano |
| `KalamaricoAvatar.tsx` | Sprite, `useKalamaricoAvatar` (loop random + tryPlay) |
| `SocialLinks.tsx` | Iconos SVG inline + enlaces footer |
| `useClickHints.tsx` | Hints "click anywhere" + ondas aleatorias antes del primer gesture |
| `useFFTPiano.ts` | AudioContext + Analyser + RAF + onset detection |
| `useMusicalNotes.tsx` | Notas musicales flotantes alrededor del avatar durante modo piano |
| `usePixelParticles.tsx` | Bursts de partículas pixel art |
| `global.css` | Tokens, layout, hero, piano, animaciones, reduced-motion |

---

*Documento mantenido manualmente. Actualizar al introducir nuevos sistemas o cambiar variables tunables.*
