import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type ParticlePalette =
  | 'orange'
  | 'yellow'
  | 'electric'
  | 'purple'
  | 'cyan'
  | 'red'
  | string[]

export interface BurstOptions {
  count?: number
  minDist?: number
  maxDist?: number
  minDuration?: number
  maxDuration?: number
  minSize?: number
  maxSize?: number
}

interface Particle {
  id: number
  x: number
  y: number
  size: number
  color: string
  tx: number
  ty: number
  duration: number
}

const PARTICLE_PALETTES: Record<string, string[]> = {
  orange: ['#ff6600', '#ffaa00', '#ff3300', '#ffcc44', '#ffffff'],
  yellow: ['#ffcc00', '#ff8800', '#ffff44', '#ffdd00', '#ffffff'],
  electric: ['#ffff00', '#ffffff', '#aaaaff', '#00ffff', '#ffff88'],
  purple: ['#cc00cc', '#ff00ff', '#8800aa', '#dd44ff', '#ffffff'],
  cyan: ['#00ffff', '#0066ff', '#44aaff', '#0033cc', '#ffffff'],
  red: ['#ff2200', '#ff6644', '#cc0000', '#ff9966', '#ffffff'],
}

const KEYFRAMES = `
@keyframes kala-particle-fly {
  0%   { transform: translate(0, 0) scale(1); opacity: 1; }
  100% { transform: translate(var(--kala-tx), var(--kala-ty)) scale(0); opacity: 0; }
}
`

export function usePixelParticles() {
  const [particles, setParticles] = useState<Particle[]>([])
  const counterRef = useRef(0)

  const burst = useCallback(
    (
      target: HTMLElement,
      palette: ParticlePalette = 'orange',
      options: BurstOptions = {},
    ) => {
      const {
        count = 14,
        minDist = 50,
        maxDist = 130,
        minDuration = 500,
        maxDuration = 900,
        minSize = 3,
        maxSize = 6,
      } = options

      const rect = target.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2

      const colors = Array.isArray(palette)
        ? palette
        : (PARTICLE_PALETTES[palette] ?? PARTICLE_PALETTES.orange)

      const fresh: Particle[] = []
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
        const dist = minDist + Math.random() * (maxDist - minDist)
        const size = Math.floor(minSize + Math.random() * (maxSize - minSize))
        const duration = minDuration + Math.random() * (maxDuration - minDuration)
        const id = ++counterRef.current

        fresh.push({
          id,
          x: cx,
          y: cy,
          size,
          color: colors[i % colors.length],
          tx: Math.cos(angle) * dist,
          ty: Math.sin(angle) * dist,
          duration,
        })

        setTimeout(() => {
          setParticles((prev) => prev.filter((p) => p.id !== id))
        }, duration + 100)
      }

      setParticles((prev) => [...prev, ...fresh])
    },
    [],
  )

  const container =
    particles.length > 0 && typeof document !== 'undefined'
      ? createPortal(
          <>
            <style>{KEYFRAMES}</style>
            {particles.map((p) => (
              <div
                key={p.id}
                style={
                  {
                    position: 'fixed',
                    left: p.x,
                    top: p.y,
                    width: p.size,
                    height: p.size,
                    background: p.color,
                    pointerEvents: 'none',
                    imageRendering: 'pixelated',
                    zIndex: 9999,
                    '--kala-tx': `${p.tx}px`,
                    '--kala-ty': `${p.ty}px`,
                    animation: `kala-particle-fly ${p.duration}ms ease-out forwards`,
                  } as React.CSSProperties
                }
              />
            ))}
          </>,
          document.body,
        )
      : null

  return { burst, container }
}
