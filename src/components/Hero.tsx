import { useCallback, useEffect, useRef, useState } from 'react'
import { HeroPiano } from './HeroPiano'

// ─── Config (tunable) ──────────────────────────────────────
const TITLE = 'KALAMARICO'
const ROLE = 'Senior Frontend Developer'
const IDLE_MS = 12_000
const AUDIO_SRC = '/audio/piano.mp3'
// ───────────────────────────────────────────────────────────

const TITLE_LETTERS = TITLE.split('')

export type HeroMode = 'text' | 'piano'

interface HeroProps {
  onTitleHover?: () => void
  onModeChange?: (mode: HeroMode) => void
}

export function Hero({ onTitleHover, onModeChange }: HeroProps) {
  const [mode, setMode] = useState<HeroMode>('text')
  const idleTimerRef = useRef<number | undefined>(undefined)
  // Guard: el modo piano no debe activarse hasta que el usuario haya
  // interactuado al menos una vez (click o keydown). Sin gesture el navegador
  // bloquea el audio y entraríamos al modo piano sin música.
  const hasInteractedRef = useRef(false)
  // Guard: tras salir del modo piano, las letras de h1 emergen donde estaba
  // el cursor del usuario. El browser dispara mouseenter en el h1 (cursor
  // estacionario, elemento aparece debajo) y `handleTitleEnter` cancelaría
  // el timer recién armado. Ignoramos el primer mouseenter por 600ms.
  const ignoreNextTitleEnterRef = useRef(false)

  useEffect(() => {
    onModeChange?.(mode)
  }, [mode, onModeChange])

  const scheduleIdle = useCallback(() => {
    if (!hasInteractedRef.current) return
    window.clearTimeout(idleTimerRef.current)
    idleTimerRef.current = window.setTimeout(() => {
      setMode('piano')
    }, IDLE_MS)
  }, [])

  useEffect(() => {
    return () => {
      window.clearTimeout(idleTimerRef.current)
    }
  }, [])

  // Primera interacción (click/keydown global): arranca el contador idle.
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (hasInteractedRef.current) return
      hasInteractedRef.current = true
      scheduleIdle()
      window.removeEventListener('click', handleFirstInteraction)
      window.removeEventListener('keydown', handleFirstInteraction)
    }
    window.addEventListener('click', handleFirstInteraction, { passive: true })
    window.addEventListener('keydown', handleFirstInteraction, { passive: true })
    return () => {
      window.removeEventListener('click', handleFirstInteraction)
      window.removeEventListener('keydown', handleFirstInteraction)
    }
  }, [scheduleIdle])

  // Al entrar con el puntero en el h1 cancelamos la cuenta atrás; al salir
  // la rearmamos. Nada más en la página afecta al timer.
  const handleTitleEnter = useCallback(() => {
    if (ignoreNextTitleEnterRef.current) {
      ignoreNextTitleEnterRef.current = false
      return
    }
    window.clearTimeout(idleTimerRef.current)
    onTitleHover?.()
  }, [onTitleHover])

  const handleTitleLeave = useCallback(() => {
    scheduleIdle()
  }, [scheduleIdle])

  const exitPianoMode = useCallback(() => {
    setMode('text')
    ignoreNextTitleEnterRef.current = true
    // Por si el cursor no estaba sobre el h1 al salir, limpiamos el flag
    // tras un margen para que un hover legítimo posterior funcione.
    window.setTimeout(() => {
      ignoreNextTitleEnterRef.current = false
    }, 600)
    scheduleIdle()
  }, [scheduleIdle])

  const lastIndex = TITLE_LETTERS.length - 1

  return (
    <div className="hero" data-mode={mode}>
      <div className="hero-stage" data-reveal="2">
        <h1
          className="hero-title"
          onMouseEnter={handleTitleEnter}
          onMouseLeave={handleTitleLeave}
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
