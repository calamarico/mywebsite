import { useCallback, useEffect, useRef, useState } from 'react'
import { HeroPiano } from './HeroPiano'

// ─── Config (tunable) ──────────────────────────────────────
const TITLE = 'KALAMARICO'
const ROLE = 'Senior Frontend Developer'
const IDLE_MS = 12_000
const AUDIO_SRC = '/audio/piano.mp3'
const ACTIVITY_EVENTS = [
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'pointerdown',
] as const
// ───────────────────────────────────────────────────────────

const TITLE_LETTERS = TITLE.split('')

type HeroMode = 'text' | 'piano'

interface HeroProps {
  onTitleHover?: () => void
}

export function Hero({ onTitleHover }: HeroProps) {
  const [mode, setMode] = useState<HeroMode>('text')
  const idleTimerRef = useRef<number | undefined>(undefined)
  const modeRef = useRef<HeroMode>(mode)
  modeRef.current = mode

  const scheduleIdle = useCallback(() => {
    window.clearTimeout(idleTimerRef.current)
    idleTimerRef.current = window.setTimeout(() => {
      setMode('piano')
    }, IDLE_MS)
  }, [])

  useEffect(() => {
    const handleActivity = () => {
      // En modo piano la actividad global NO saca — solo el hover del piano.
      if (modeRef.current === 'piano') return
      scheduleIdle()
    }

    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, handleActivity, { passive: true }),
    )
    scheduleIdle()

    return () => {
      window.clearTimeout(idleTimerRef.current)
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, handleActivity),
      )
    }
  }, [scheduleIdle])

  const exitPianoMode = useCallback(() => {
    if (modeRef.current !== 'piano') return
    setMode('text')
    scheduleIdle()
  }, [scheduleIdle])

  const lastIndex = TITLE_LETTERS.length - 1

  return (
    <div className="hero" data-mode={mode}>
      <div className="hero-stage" data-reveal="2">
        <h1
          className="hero-title"
          onMouseEnter={onTitleHover}
          aria-label={TITLE}
        >
          {TITLE_LETTERS.map((ch, i) => (
            <span
              key={i}
              className="hero-title__letter"
              style={
                {
                  '--i': i,
                  '--i-rev': lastIndex - i,
                } as React.CSSProperties
              }
              aria-hidden="true"
            >
              {ch}
            </span>
          ))}
        </h1>
        <HeroPiano
          playing={mode === 'piano'}
          audioSrc={AUDIO_SRC}
          onHoverOut={exitPianoMode}
        />
      </div>
      <p className="hero-role" data-reveal="3">{ROLE}</p>
    </div>
  )
}
