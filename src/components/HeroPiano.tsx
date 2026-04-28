import { useCallback, useEffect, useRef, useState } from 'react'
import { useFFTPiano, type Band } from '../hooks/useFFTPiano'

// ─── Config (tunable) ──────────────────────────────────────
const WHITE_COUNT = 29 // C3..C7 inclusive
const BLACK_COUNT = 20 // 5 negras por 4 octavas

const DEFAULT_PRESS_MS = 120

// FFT bands → ranges de tecla. Indexing: blancas [0..28], negras [29..48]
// fftSize 2048 @ 44100Hz → ~21.5Hz/bin
// Thresholds escalados: más sensibles en graves (fundamentales limpias),
// menos sensibles en agudos (los armónicos de notas graves saturan esos bins).
// C7 fusionada con la banda medio-alto para que toda la zona derecha reaccione
// como un bloque y no como tecla aislada.
const BANDS: Band[] = [
  // Graves C3–B3
  { keys: [0, 1, 2, 3, 4, 5, 6, 29, 30, 31, 32, 33], binStart: 6, binEnd: 11, threshold: 1.08, cooldownMs: 70 },
  // Medio-bajo C4–B4
  { keys: [7, 8, 9, 10, 11, 12, 13, 34, 35, 36, 37, 38], binStart: 12, binEnd: 23, threshold: 1.12, cooldownMs: 70 },
  // Medio C5–B5
  { keys: [14, 15, 16, 17, 18, 19, 20, 39, 40, 41, 42, 43], binStart: 24, binEnd: 45, threshold: 1.22, cooldownMs: 80 },
  // Medio-alto C6–C7 (incluye C7 fusionado)
  { keys: [21, 22, 23, 24, 25, 26, 27, 28, 44, 45, 46, 47, 48], binStart: 49, binEnd: 102, threshold: 1.45, cooldownMs: 120 },
]
// ───────────────────────────────────────────────────────────

interface HeroPianoProps {
  playing?: boolean
  audioSrc?: string
  onAudioEnded?: () => void
  onAudioFailed?: () => void
}

export function HeroPiano({
  playing = true,
  audioSrc,
  onAudioEnded,
  onAudioFailed,
}: HeroPianoProps) {
  const whiteRefs = useRef<(HTMLDivElement | null)[]>([])
  const blackRefs = useRef<(HTMLDivElement | null)[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const releaseTimersRef = useRef<Record<number, number>>({})
  // Progreso de la canción (0..1). Actualizado vía `timeupdate` (~4-5 fps);
  // CSS interpola entre ticks con `transition: transform 280ms linear`.
  const [progress, setProgress] = useState(0)

  // Volumen (0..1) controlado por el slider sobre las teclas. Default 0.7
  // alineado con la advertencia de la intro ("turn it down a notch"). Vive
  // como state local: HeroPiano no se desmonta entre transiciones, así que
  // el valor sobrevive a los replays vía encore.
  const [volume, setVolume] = useState(0.7)

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    const { currentTime, duration } = audio
    if (!Number.isFinite(duration) || duration <= 0) return
    setProgress(currentTime / duration)
  }, [])

  // Reset al entrar a piano para que el replay/encore no muestre brevemente
  // la barra llena de la canción anterior antes del primer `timeupdate`.
  useEffect(() => {
    if (playing) setProgress(0)
  }, [playing])

  // Sincroniza el state `volume` con el `<audio>`. El effect se ejecuta tras
  // cada commit, así que en el primer mount audio.volume = 0.7 antes de que
  // useFFTPiano llame a `audio.play()`.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
  }, [volume])

  const resolveKey = useCallback((keyIndex: number): HTMLDivElement | null => {
    if (keyIndex < WHITE_COUNT) return whiteRefs.current[keyIndex] ?? null
    return blackRefs.current[keyIndex - WHITE_COUNT] ?? null
  }, [])

  const flashKey = useCallback(
    (keyIndex: number, pressMs: number) => {
      const el = resolveKey(keyIndex)
      if (!el) return
      el.dataset.pressed = 'true'
      const existing = releaseTimersRef.current[keyIndex]
      if (existing) window.clearTimeout(existing)
      releaseTimersRef.current[keyIndex] = window.setTimeout(() => {
        delete el.dataset.pressed
        delete releaseTimersRef.current[keyIndex]
      }, pressMs)
    },
    [resolveKey],
  )

  useFFTPiano({
    audioRef,
    playing: playing && !!audioSrc,
    bands: BANDS,
    onTrigger: flashKey,
    onAudioFailed,
    pressMs: DEFAULT_PRESS_MS,
  })

  // Al salir de modo piano, limpiar todos los data-pressed
  useEffect(() => {
    if (playing) return
    const timers = releaseTimersRef.current
    Object.keys(timers).forEach((k) => window.clearTimeout(timers[Number(k)]))
    releaseTimersRef.current = {}
    whiteRefs.current.forEach((el) => {
      if (el) delete el.dataset.pressed
    })
    blackRefs.current.forEach((el) => {
      if (el) delete el.dataset.pressed
    })
  }, [playing])

  // Bloquea el default handling del browser para media keys (volume keys, F8/9
  // playback, etc.) mientras suena la canción. Sin esto, con focus en <body>
  // el browser puede pausar el <audio> "en silencio" — el RAF sigue, pero el
  // analyser lee ceros y el piano queda atascado sin sonido. Registrar noops
  // en MediaSession le dice al browser "yo manejo estas acciones" y bloquea
  // el efecto por defecto. No-op si `navigator.mediaSession` no existe.
  useEffect(() => {
    if (!playing) return
    if (typeof navigator === 'undefined' || !navigator.mediaSession) return
    const ms = navigator.mediaSession
    const actions: MediaSessionAction[] = [
      'pause', 'play', 'previoustrack', 'nexttrack',
      'seekbackward', 'seekforward', 'stop',
    ]
    const noop = () => {}
    actions.forEach((a) => {
      try { ms.setActionHandler(a, noop) } catch { /* unsupported action */ }
    })
    return () => {
      actions.forEach((a) => {
        try { ms.setActionHandler(a, null) } catch { /* ignore */ }
      })
    }
  }, [playing])

  // Red de seguridad: si el <audio> es pausado o errora por algo externo
  // (media key residual, focus loss, decoding error...), salimos limpios al
  // mismo path que el final natural — mode='text' con encore disponible —
  // en lugar de quedar atascados. Las guardas evitan doble disparo cuando es
  // el cleanup legítimo del effect el que pausa.
  const handleUnexpectedStop = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (!playing) return
    if (audio.ended) return
    onAudioEnded?.()
  }, [playing, onAudioEnded])

  return (
    <div className="hero-piano">
      {audioSrc && (
        <audio
          ref={audioRef}
          src={audioSrc}
          preload="auto"
          playsInline
          onEnded={onAudioEnded}
          onTimeUpdate={handleTimeUpdate}
          onPause={handleUnexpectedStop}
          onError={handleUnexpectedStop}
        />
      )}
      {/* Las teclas son decorativas: aria-hidden para que el lector de
          pantalla no las anuncie. El slider, en cambio, debe ser accesible,
          por eso movemos aria-hidden a los hijos en lugar del piano. */}
      <div className="hero-piano__whites" aria-hidden="true">
        {Array.from({ length: WHITE_COUNT }, (_, i) => (
          <div
            key={`w-${i}`}
            ref={(el) => {
              whiteRefs.current[i] = el
            }}
            className="hero-piano__white"
          />
        ))}
      </div>
      <div className="hero-piano__blacks" aria-hidden="true">
        {Array.from({ length: BLACK_COUNT }, (_, i) => (
          <div
            key={`b-${i}`}
            ref={(el) => {
              blackRefs.current[i] = el
            }}
            className="hero-piano__black"
          />
        ))}
      </div>
      <div className="hero-piano__volume">
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          aria-label="Volume"
          className="hero-piano__volume-input"
        />
      </div>
      <div
        className="hero-piano__progress"
        style={{ transform: `scaleX(${progress})` }}
        aria-hidden="true"
      />
    </div>
  )
}
