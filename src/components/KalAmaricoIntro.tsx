// Intro terminal animado — typewriter line by line, sin historial.
// Cada línea se escribe, se lee, se borra. Luego el countdown y "Let's go!"
//
// Uso:
//   <KalAmaricoIntro onComplete={() => startPiano()} />
//
// onComplete se dispara cuando aparece "Let's go!" (~17s)

import { useEffect, useRef, useState, useCallback } from 'react'

// ─── Config ──────────────────────────────────────────────────────────────────

const LINES: { text: string; spd: number; read: number }[] = [
  { text: 'so... You want to see what I can do???',                 spd: 55, read: 900  },
  { text: 'oki dok, no problem at all',                              spd: 52, read: 1100 },
  { text: 'before start, please check if your volume is maxed out', spd: 48, read: 1100 },
  { text: 'I mean, turn it down a notch, just in case xD',          spd: 50, read: 850  },
  { text: 'Because the concert... Is about to start!!!! Ohhh Yess!',spd: 50, read: 1200 },
]

// ─── Hook ────────────────────────────────────────────────────────────────────

function useTerminalIntro(onComplete?: () => void) {
  const [typed, setTyped]           = useState('')
  const [phase, setPhase]           = useState<'typing' | 'countdown' | 'letsgo'>('typing')
  const [countdown, setCountdown]   = useState('')   // '3,' | '3, 2,' | '3, 2, 1...'
  const cancelRef                   = useRef(false)
  const timersRef                   = useRef<ReturnType<typeof setTimeout>[]>([])

  const sleep = useCallback((ms: number): Promise<void> =>
    new Promise(resolve => {
      const t = setTimeout(resolve, ms)
      timersRef.current.push(t)
    }), [])

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }, [])

  const start = useCallback(async () => {
    clearTimers()
    cancelRef.current = false
    setTyped('')
    setCountdown('')
    setPhase('typing')

    const ok = () => !cancelRef.current

    // ── Typewriter lines ──────────────────────────────────────────────────────
    for (const cfg of LINES) {
      if (!ok()) return

      // Type char by char
      let current = ''
      for (const ch of cfg.text) {
        if (!ok()) return
        current += ch
        setTyped(current)
        await sleep(cfg.spd)
      }

      // Read pause
      await sleep(cfg.read)
      if (!ok()) return

      // Clear
      await sleep(180)
      setTyped('')
      await sleep(140)
    }

    // ── Countdown ─────────────────────────────────────────────────────────────
    if (!ok()) return
    setPhase('countdown')

    setCountdown('3,')
    await sleep(780)
    if (!ok()) return

    setCountdown('3, 2,')
    await sleep(780)
    if (!ok()) return

    setCountdown('3, 2, 1...')
    await sleep(500)
    if (!ok()) return

    // ── Let's go! ─────────────────────────────────────────────────────────────
    setPhase('letsgo')
    onComplete?.()

  }, [sleep, clearTimers, onComplete])

  // Auto-start on mount
  useEffect(() => {
    start()
    return () => {
      cancelRef.current = true
      clearTimers()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    typed,
    countdown,
    phase,
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

interface KalAmaricoIntroProps {
  /** Called when "Let's go!" appears — use this to trigger your piano */
  onComplete?: () => void
  /** Override container styles */
  style?: React.CSSProperties
  className?: string
}

export function KalAmaricoIntro({ onComplete, style, className }: KalAmaricoIntroProps) {
  const { typed, countdown, phase } = useTerminalIntro(onComplete)

  const isLetsGo   = phase === 'letsgo'
  const isCountdown = phase === 'countdown'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

        .kala-intro {
          /* Transparente para que se vea el bg de la página (incluido el
             radial-gradient sobre <body>) en lugar del rectángulo negro. */
          background: transparent;
          width: 100%;
          height: 200px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          font-family: 'Press Start 2P', monospace;
        }

        /* Terminal line */
        .kala-terminal {
          font-size: clamp(10px, 2.4vw, 18px);
          color: #fff;
          text-align: center;
          /* pre-wrap + break-word: las líneas largas wrappean en mobile como
             un terminal real cuando llegan al borde, en lugar de cortarse. */
          white-space: pre-wrap;
          word-break: break-word;
          /* min-width: 0 fuerza al flex item a respetar el max-width del padre
             (el default min-width: auto = ancho del contenido haría overflow). */
          min-width: 0;
          max-width: 100%;
          padding: 0 8px;
          box-sizing: border-box;
          transition: opacity 0.3s;
          opacity: ${isLetsGo ? 0 : 1};
        }

        .kala-prompt {
          color: #e0a0ff;
        }

        .kala-typed {
          color: #fff;
        }

        /* Blinking cursor — em-relative para escalar con la fuente */
        .kala-cursor {
          display: inline-block;
          width: 0.78em;
          height: 1em;
          background: #fff;
          margin-left: 2px;
          vertical-align: middle;
          animation: kala-blink 0.6s step-end infinite;
        }

        @keyframes kala-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }

        /* Let's go! */
        .kala-letsgo {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: clamp(13px, 3vw, 22px);
          color: #fff;
          text-align: center;
          white-space: nowrap;
          letter-spacing: 1px;
          transition: opacity 0.3s;
          opacity: ${isLetsGo ? 1 : 0};
          pointer-events: none;
        }
      `}</style>

      <div
        className={`kala-intro${className ? ` ${className}` : ''}`}
        style={style}
      >
        {/* Terminal line — shows during typing + countdown */}
        <div className="kala-terminal">
          <span className="kala-prompt">~&gt;&nbsp;</span>
          <span className="kala-typed">
            {isCountdown ? countdown : typed}
          </span>
          <span className="kala-cursor" />
        </div>

        {/* Let's go! */}
        <div className="kala-letsgo" aria-live="polite">
          Let&apos;s go!
        </div>
      </div>
    </>
  )
}
