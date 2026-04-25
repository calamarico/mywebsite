import { useCallback, useEffect, useRef } from 'react'
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

  return (
    <div
      className="hero-piano"
      role="presentation"
      aria-hidden="true"
    >
      {audioSrc && (
        <audio
          ref={audioRef}
          src={audioSrc}
          preload="auto"
          playsInline
          onEnded={onAudioEnded}
        />
      )}
      <div className="hero-piano__whites">
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
      <div className="hero-piano__blacks">
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
    </div>
  )
}
