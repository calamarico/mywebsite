// Notas musicales flotando alrededor del avatar mientras suena el piano.
//
// Uso:
//   const { start, stop, MusicalNotesLayer } = useMusicalNotes()
//
//   // Pon <MusicalNotesLayer /> en el root/layout (una sola vez)
//   // Cuando empiece el piano:
//   start(avatarRef.current)
//   // Cuando pare:
//   stop()

import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface MusicalNotesOptions {
  /** Intervalo entre notas en ms (default: 340) */
  interval?: number
  /** Distancia mínima de spawn desde el centro del avatar en px (default: 18) */
  minRadius?: number
  /** Distancia máxima de spawn desde el centro del avatar en px (default: 48) */
  maxRadius?: number
  /** Cuánto sube cada nota en px (default: 55–140) */
  minDy?: number
  maxDy?: number
  /** Tamaño mínimo y máximo de las notas en px (default: 14–28) */
  minSize?: number
  maxSize?: number
}

interface Note {
  id:       number
  x:        number
  y:        number
  symbol:   string
  size:     number
  color:    string
  dx:       number
  dy:       number
  rot:      number
  duration: number
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const SYMBOLS = ['♩', '♪', '♫', '♬']

const COLORS  = [
  '#ffffff', '#e0a0ff', '#c8b8ff',
  '#ffffff', '#f0d0ff', '#ffffff', '#e0a0ff',
]

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMusicalNotes() {
  const [notes, setNotes]   = useState<Note[]>([])
  const intervalRef         = useRef<ReturnType<typeof setInterval> | null>(null)
  const counterRef          = useRef(0)

  // Obtener DOMRect en cada tick para seguir al avatar si se mueve
  const targetRef = useRef<HTMLElement | DOMRect | null>(null)

  const spawnNote = useCallback(() => {
    if (!targetRef.current) return

    const rect = targetRef.current instanceof HTMLElement
      ? targetRef.current.getBoundingClientRect()
      : targetRef.current

    const cx = rect.left + rect.width  / 2
    const cy = rect.top  + rect.height / 2

    // Bias hacia la zona superior del avatar (como si silbase hacia arriba)
    const angle  = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.6
    const radius = 18 + Math.random() * 30
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius

    const note: Note = {
      id:       ++counterRef.current,
      x,
      y,
      symbol:   SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      size:     14 + Math.random() * 14,
      color:    COLORS[Math.floor(Math.random() * COLORS.length)],
      dx:       (Math.random() - 0.5) * 70,
      dy:       -(55 + Math.random() * 85),
      rot:      (Math.random() - 0.5) * 50,
      duration: 1800 + Math.random() * 1400,
    }

    setNotes(prev => [...prev, note])

    setTimeout(() => {
      setNotes(prev => prev.filter(n => n.id !== note.id))
    }, note.duration + 100)
  }, [])

  const stop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = null
    targetRef.current   = null
    setNotes([])
  }, [])

  const start = useCallback((
    target: HTMLElement | DOMRect,
    opts: MusicalNotesOptions = {}
  ) => {
    stop()
    targetRef.current = target
    intervalRef.current = setInterval(spawnNote, opts.interval ?? 340)
  }, [spawnNote, stop])

  useEffect(() => () => stop(), [stop])

  // ─── Componente de renderizado ──────────────────────────────────────────────

  const MusicalNotesLayer = useCallback(() => {
    if (notes.length === 0 || typeof document === 'undefined') return null

    return createPortal(
      <>
        <style>{`
          @keyframes kala-note-float {
            0%   { opacity: 0;    transform: translate(0,0)                         rotate(0deg)                scale(.5); }
            12%  { opacity: 1;    transform: translate(calc(var(--kn-dx)*.08), calc(var(--kn-dy)*.08)) rotate(calc(var(--kn-rot)*.08)) scale(1);  }
            85%  { opacity: .85; }
            100% { opacity: 0;    transform: translate(var(--kn-dx), var(--kn-dy)) rotate(var(--kn-rot))        scale(.7); }
          }
        `}</style>
        {notes.map(n => (
          <div
            key={n.id}
            style={{
              position:       'fixed',
              left:           n.x,
              top:            n.y,
              fontSize:       n.size,
              color:          n.color,
              fontFamily:     'serif',
              lineHeight:     1,
              pointerEvents:  'none',
              zIndex:         9999,
              userSelect:     'none',
              ['--kn-dx' as string]:  `${n.dx}px`,
              ['--kn-dy' as string]:  `${n.dy}px`,
              ['--kn-rot' as string]: `${n.rot}deg`,
              animation:      `kala-note-float ${n.duration}ms ease-out forwards`,
            } as React.CSSProperties}
          >
            {n.symbol}
          </div>
        ))}
      </>,
      document.body
    )
  }, [notes])

  return { start, stop, MusicalNotesLayer }
}
