import { useCallback, useEffect, useRef, useState } from 'react'
import { HeroPiano } from './HeroPiano'
import { KalAmaricoIntro } from './KalAmaricoIntro'

// ─── Config (tunable) ──────────────────────────────────────
const TITLE = 'KALAMARICO'
const ROLE = 'Senior Frontend Developer'
const AUDIO_SRC = '/audio/piano.mp3'
// ───────────────────────────────────────────────────────────

const TITLE_LETTERS = TITLE.split('')

export type HeroMode = 'text' | 'intro' | 'piano'

interface HeroProps {
  onTitleHover?: () => void
  onModeChange?: (mode: HeroMode) => void
}

export function Hero({ onTitleHover, onModeChange }: HeroProps) {
  const [mode, setMode] = useState<HeroMode>('text')
  // Una vez la canción ha terminado al menos una vez, el link "encore?"
  // se muestra bajo el role para permitir replays en modo texto.
  const [encoreAvailable, setEncoreAvailable] = useState(false)
  // Guard: el modo intro/piano no debe activarse hasta que el usuario haya
  // interactuado al menos una vez (click o keydown). Sin gesture el navegador
  // bloquea el audio y entraríamos al modo piano sin música.
  const hasInteractedRef = useRef(false)
  // Guard: tras salir del modo piano, las letras de h1 emergen donde estaba
  // el cursor del usuario. El browser dispara mouseenter en el h1 (cursor
  // estacionario, elemento aparece debajo) y dispararía una animación del
  // avatar sin que el usuario haya hecho nada. Ignoramos el primer mouseenter
  // durante 600ms.
  const ignoreNextTitleEnterRef = useRef(false)
  // Guard persistente de sesión: se vuelve true si el audio falla o si el
  // modo piano completa un ciclo. Bloquea el flujo automático del intro
  // (primer gesture → intro → piano).
  const pianoDisabledRef = useRef(false)
  // Distinción específica del fallo de audio. Si es true, el link "encore?"
  // NO se muestra ni replay es posible.
  const audioFailedRef = useRef(false)
  // Espejo de `mode` para que callbacks estables consulten el state actual
  // sin ser dependencia.
  const modeRef = useRef<HeroMode>(mode)
  modeRef.current = mode

  useEffect(() => {
    onModeChange?.(mode)
  }, [mode, onModeChange])

  // Tras el primer gesture, en lugar de programar un timer, arrancamos
  // directamente el intro (KalAmaricoIntro). Si el usuario tiene reduced-motion,
  // saltamos el intro y vamos directo al modo piano.
  const startIntro = useCallback(() => {
    if (!hasInteractedRef.current) return
    if (pianoDisabledRef.current) return
    if (modeRef.current !== 'text') return
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setMode(prefersReducedMotion ? 'piano' : 'intro')
  }, [])

  // Cuando el intro termina (~17s, "Let's go!"), arrancamos el modo piano.
  // Si entre medias hubo un fallo de audio (pianoDisabledRef true), nos
  // quedamos en text.
  const handleIntroComplete = useCallback(() => {
    if (pianoDisabledRef.current) {
      setMode('text')
      return
    }
    setMode('piano')
  }, [])

  // Si el hook de audio reporta fallo definitivo, deshabilitamos el modo piano
  // para el resto de la sesión. Si estábamos en intro o piano, salimos a text.
  // Marcamos también `audioFailedRef` para que el link "encore?" NO se ofrezca.
  const handleAudioFailed = useCallback(() => {
    pianoDisabledRef.current = true
    audioFailedRef.current = true
    if (modeRef.current === 'piano' || modeRef.current === 'intro') {
      setMode('text')
    }
  }, [])

  // Salida del modo piano (solo se dispara cuando la canción termina).
  // Bloquea el flujo automático del intro y, si la canción terminó normal
  // (no por fallo de audio), expone el link "encore?" para replays.
  const exitPianoMode = useCallback(() => {
    setMode('text')
    pianoDisabledRef.current = true
    if (!audioFailedRef.current) {
      setEncoreAvailable(true)
    }
    ignoreNextTitleEnterRef.current = true
    window.setTimeout(() => {
      ignoreNextTitleEnterRef.current = false
    }, 600)
  }, [])

  // Replay manual: salta la intro y entra directo a piano. Llamado al click
  // del link "encore?". El stopPropagation evita que el handler global de
  // App dispare `surprised` justo antes de la transición.
  const handleEncoreClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (audioFailedRef.current) return
    if (modeRef.current !== 'text') return
    setMode('piano')
  }, [])

  // Primera interacción (click/keydown global): arranca el intro.
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (hasInteractedRef.current) return
      hasInteractedRef.current = true
      startIntro()
      window.removeEventListener('click', handleFirstInteraction)
      window.removeEventListener('keydown', handleFirstInteraction)
    }
    window.addEventListener('click', handleFirstInteraction, { passive: true })
    window.addEventListener('keydown', handleFirstInteraction, { passive: true })
    return () => {
      window.removeEventListener('click', handleFirstInteraction)
      window.removeEventListener('keydown', handleFirstInteraction)
    }
  }, [startIntro])

  // El hover sobre el h1 dispara la animación random del avatar pero NO
  // afecta al timer de idle (no hay timer).
  const handleTitleEnter = useCallback(() => {
    if (ignoreNextTitleEnterRef.current) {
      ignoreNextTitleEnterRef.current = false
      return
    }
    onTitleHover?.()
  }, [onTitleHover])

  const lastIndex = TITLE_LETTERS.length - 1

  return (
    <div className="hero" data-mode={mode}>
      <div className="hero-stage" data-reveal="2">
        <h1
          className="hero-title"
          onMouseEnter={handleTitleEnter}
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
        {mode === 'intro' && (
          <div className="hero-intro-slot">
            <KalAmaricoIntro onComplete={handleIntroComplete} />
          </div>
        )}
        <HeroPiano
          playing={mode === 'piano'}
          audioSrc={AUDIO_SRC}
          onAudioEnded={exitPianoMode}
          onAudioFailed={handleAudioFailed}
        />
      </div>
      <p className="hero-role" data-reveal="3">{ROLE}</p>
      {encoreAvailable && mode === 'text' && (
        <button
          type="button"
          className="hero-encore"
          onClick={handleEncoreClick}
          aria-label="Play the concert again"
        >
          encore?
        </button>
      )}
    </div>
  )
}
