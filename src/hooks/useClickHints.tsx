// useClickHints.tsx
// "click anywhere" + ondas expansivas que aparecen aleatoriamente por la
// página invitando al usuario a hacer click la primera vez. Evita los
// rectángulos del header, el hero y el footer (los selectores se pasan al
// `start`).
//
// Uso:
//   const { start, stop, ClickHintsLayer } = useClickHints()
//   start(['.site-header', '.hero', '.site-footer'])
//   stop()
//   <ClickHintsLayer />  // una sola vez en el árbol

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ClickHintsOptions {
  /** Texto del hint (default: 'click anywhere') */
  text?: string
  /** Intervalo mínimo/máximo entre hints en ms (default: [1700, 2100]) */
  intervalMs?: [number, number]
  /** Padding alrededor de los rectángulos excluidos en px (default: 24) */
  excludePadding?: number
  /** Margen al borde del viewport en px (default: 40) */
  viewportPadding?: number
}

interface Hint {
  id:       number
  x:        number
  y:        number
  text:     string
  duration: number
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const HINT_DURATION = 1600
const RIPPLE_COLOR  = '#e0a0ff'
const TEXT_COLOR    = 'rgba(255, 255, 255, 0.62)'
// Distancia mínima entre dos spawns consecutivos. Sin esto, dos
// `Math.random()` seguidos pueden caer muy cerca y dar la impresión de que
// el hint "no se mueve".
const MIN_DIST_FROM_LAST = 160

export function useClickHints() {
  const [hints, setHints] = useState<Hint[]>([])
  const timerRef          = useRef<ReturnType<typeof setTimeout> | null>(null)
  const counterRef        = useRef(0)
  const excludeSelectorsRef = useRef<string[]>([])
  const optsRef           = useRef<ClickHintsOptions>({})
  const lastPositionRef   = useRef<{ x: number; y: number } | null>(null)

  const pickPosition = useCallback((): { x: number; y: number } | null => {
    const opts = optsRef.current
    const pad = opts.excludePadding ?? 24
    const vpad = opts.viewportPadding ?? 40
    const last = lastPositionRef.current

    const excludeRects = excludeSelectorsRef.current
      .map((sel) => document.querySelector(sel))
      .filter((el): el is Element => Boolean(el))
      .map((el) => el.getBoundingClientRect())

    for (let i = 0; i < 16; i++) {
      const x = vpad + Math.random() * Math.max(0, window.innerWidth - vpad * 2)
      const y = vpad + Math.random() * Math.max(0, window.innerHeight - vpad * 2)
      const blocked = excludeRects.some(
        (r) =>
          x >= r.left - pad &&
          x <= r.right + pad &&
          y >= r.top - pad &&
          y <= r.bottom + pad,
      )
      if (blocked) continue
      if (last) {
        const dx = x - last.x
        const dy = y - last.y
        if (Math.sqrt(dx * dx + dy * dy) < MIN_DIST_FROM_LAST) continue
      }
      return { x, y }
    }
    return null
  }, [])

  const spawnHint = useCallback(() => {
    const opts = optsRef.current
    const text = opts.text ?? 'click anywhere'
    const pos = pickPosition()
    if (!pos) return // sin hueco válido esta ronda
    lastPositionRef.current = pos

    const hint: Hint = {
      id:       ++counterRef.current,
      x:        pos.x,
      y:        pos.y,
      text,
      duration: HINT_DURATION,
    }

    setHints((prev) => [...prev, hint])
    setTimeout(() => {
      setHints((prev) => prev.filter((h) => h.id !== hint.id))
    }, hint.duration + 100)
  }, [pickPosition])

  const stop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    lastPositionRef.current = null
    setHints([])
  }, [])

  const start = useCallback(
    (excludeSelectors: string[], opts: ClickHintsOptions = {}) => {
      stop()
      excludeSelectorsRef.current = excludeSelectors
      optsRef.current = opts

      const [minMs, maxMs] = opts.intervalMs ?? [1700, 2100]
      const range = Math.max(0, maxMs - minMs)

      const scheduleNext = () => {
        const delay = minMs + Math.random() * range
        timerRef.current = setTimeout(() => {
          spawnHint()
          scheduleNext()
        }, delay)
      }
      scheduleNext()
    },
    [stop, spawnHint],
  )

  useEffect(() => () => stop(), [stop])

  // ─── Componente de renderizado ──────────────────────────────────────────────

  const ClickHintsLayer = useCallback(() => {
    if (hints.length === 0 || typeof document === 'undefined') return null

    return createPortal(
      <>
        <style>{`
          @keyframes kala-hint-text {
            0%   { opacity: 0;    transform: translate(-50%, calc(-50% + 6px)); }
            18%  { opacity: 1;    transform: translate(-50%, -50%); }
            82%  { opacity: 1;    transform: translate(-50%, -50%); }
            100% { opacity: 0;    transform: translate(-50%, calc(-50% - 6px)); }
          }
          @keyframes kala-hint-ripple {
            0%   { opacity: 0.65; transform: translate(-50%, -50%) scale(0.4); }
            100% { opacity: 0;    transform: translate(-50%, -50%) scale(8);   }
          }
        `}</style>
        {hints.map((h) => (
          <div
            key={h.id}
            style={{
              position: 'fixed',
              left: h.x,
              top: h.y,
              pointerEvents: 'none',
              zIndex: 9998,
              userSelect: 'none',
            }}
          >
            {[0, 220, 440].map((delay, idx) => (
              <span
                key={idx}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  border: `2px solid ${RIPPLE_COLOR}`,
                  animation: `kala-hint-ripple 1400ms ease-out ${delay}ms forwards`,
                }}
              />
            ))}
            <span
              style={{
                position: 'absolute',
                left: 0,
                top: -22,
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, "Cascadia Mono", monospace',
                fontSize: 13,
                letterSpacing: '0.5px',
                color: TEXT_COLOR,
                whiteSpace: 'nowrap',
                animation: `kala-hint-text ${h.duration}ms ease-out forwards`,
              }}
            >
              {h.text}
            </span>
          </div>
        ))}
      </>,
      document.body,
    )
  }, [hints])

  return { start, stop, ClickHintsLayer }
}
