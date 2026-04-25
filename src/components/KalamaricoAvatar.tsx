import { useCallback, useEffect, useRef, useState } from 'react'
import spriteUrl from '../assets/kalamarico_sprite_v3.png'
import { useLatestRef } from '../hooks/useLatestRef'

export type AvatarState =
  | 'normal'
  | 'surprised'
  | 'blink'
  | 'smile'
  | 'grimace'
  | 'electro1'
  | 'electro2'
  | 'hold1'
  | 'hold2'
  | 'blue1'
  | 'blue2'
  | 'purple1'
  | 'purple2'
  | 'purple3'
  | 'whistle1'
  | 'whistle2'
  | 'whistle3'

export interface AvatarAnimation {
  frames: AvatarState[]
  frameDuration: number | number[]
}

const FRAME_SIZE = 256
const FRAME_COUNT = 17

const STATE_INDEX: Record<AvatarState, number> = {
  normal: 0,
  surprised: 1,
  blink: 2,
  smile: 3,
  grimace: 4,
  electro1: 5,
  electro2: 6,
  hold1: 7,
  hold2: 8,
  blue1: 9,
  blue2: 10,
  purple1: 11,
  purple2: 12,
  purple3: 13,
  whistle1: 14,
  whistle2: 15,
  whistle3: 16,
}

export const ANIMATIONS = {
  blink: {
    frames: ['blink', 'normal', 'blink', 'normal'],
    frameDuration: [140, 90, 140, 0],
  },
  surprised: {
    frames: ['surprised', 'normal'],
    frameDuration: [900, 0],
  },
  smile: {
    frames: ['smile', 'normal'],
    frameDuration: [1000, 0],
  },
  grimace: {
    frames: ['grimace', 'normal'],
    frameDuration: [900, 0],
  },
  electrocuted: {
    frames: [
      'electro1', 'electro2', 'normal',
      'electro1', 'electro2', 'normal',
      'electro1', 'electro2', 'electro1', 'electro2',
      'electro1', 'electro2', 'normal',
      'electro1', 'normal',
      'normal',
    ],
    frameDuration: [
      60, 60, 40,
      60, 60, 40,
      50, 50, 50, 50,
      80, 80, 120,
      200, 400,
      0,
    ],
  },
  holdBreath: {
    frames: [
      'hold1', 'hold1',
      'hold2', 'hold2',
      'blue1', 'blue1',
      'blue2', 'blue2',
      'purple1', 'purple1',
      'purple2', 'purple2',
      'purple3', 'purple3', 'purple3',
      'normal',
    ],
    frameDuration: [
      60, 60,
      70, 70,
      80, 80,
      80, 80,
      90, 90,
      100, 100,
      120, 120, 120,
      0,
    ],
  },
  // Pulso de silbido. NO termina en 'normal' — el ciclo es loopable y se
  // encadena continuamente desde el effect del hook (modo piano).
  whistle: {
    frames: ['whistle1', 'whistle1', 'whistle3', 'whistle1', 'whistle1', 'whistle1', 'whistle3', 'whistle1'],
    frameDuration: 220,
  },
} satisfies Record<string, AvatarAnimation>

const RANDOM_POOL: AvatarAnimation[] = [
  ANIMATIONS.blink,
  ANIMATIONS.surprised,
  ANIMATIONS.smile,
  ANIMATIONS.grimace,
  ANIMATIONS.electrocuted,
  ANIMATIONS.holdBreath,
]

export interface KalamaricoController {
  state: AvatarState
  tryPlay: (anim: AvatarAnimation) => Promise<boolean>
  tryPlayRandom: () => Promise<boolean>
}

export interface UseKalamaricoOptions {
  onAnimationStart?: (anim: AvatarAnimation) => void
  /**
   * Cuando true, en lugar del loop random reproduce `whistle` en bucle
   * continuo. Cualquier transición (true→false o false→true) reusa la
   * cleanup del effect (cancelRef + clearTimers + setState('normal')) para
   * dejar el avatar en estado limpio antes del siguiente modo.
   */
  whistle?: boolean
}

interface PendingTimer {
  id: ReturnType<typeof setTimeout>
  resolve: () => void
}

export function useKalamaricoAvatar(
  options: UseKalamaricoOptions = {},
): KalamaricoController {
  const [state, setState] = useState<AvatarState>('normal')
  const busyRef = useRef(false)
  const cancelRef = useRef(false)
  // Cada timer guarda también su `resolve` para que el cleanup pueda
  // desbloquear las promesas que estuvieran awaitando en `wait()`. Sin esto,
  // un `tryPlay` cancelado mid-await dejaba la promesa dangling.
  const timersRef = useRef<PendingTimer[]>([])
  const lastAnimRef = useRef<AvatarAnimation | null>(null)

  const onStartRef = useLatestRef(options.onAnimationStart)

  const { whistle = false } = options

  const wait = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        const id = setTimeout(() => {
          timersRef.current = timersRef.current.filter((t) => t.id !== id)
          resolve()
        }, ms)
        timersRef.current.push({ id, resolve })
      }),
    [],
  )

  const tryPlay = useCallback(
    async (anim: AvatarAnimation): Promise<boolean> => {
      if (busyRef.current) return false
      busyRef.current = true
      try {
        onStartRef.current?.(anim)
        const { frames, frameDuration } = anim
        const durations = Array.isArray(frameDuration)
          ? frameDuration
          : frames.map(() => frameDuration)

        for (let i = 0; i < frames.length; i++) {
          if (cancelRef.current) break
          setState(frames[i])
          const delay = durations[i] ?? 0
          if (delay > 0) await wait(delay)
        }
        lastAnimRef.current = anim
        return true
      } finally {
        busyRef.current = false
      }
    },
    [wait],
  )

  const tryPlayRandom = useCallback(async (): Promise<boolean> => {
    if (busyRef.current) return false
    let pick = lastAnimRef.current
    while (pick === lastAnimRef.current) {
      pick = RANDOM_POOL[Math.floor(Math.random() * RANDOM_POOL.length)]
    }
    return tryPlay(pick!)
  }, [tryPlay])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    cancelRef.current = false

    const loop = async () => {
      if (whistle) {
        // Loop continuo de silbido durante el modo piano.
        while (!cancelRef.current) {
          await tryPlay(ANIMATIONS.whistle)
          if (cancelRef.current) return
        }
        return
      }

      // Loop random normal.
      await wait(3000)
      if (cancelRef.current) return
      await tryPlay(ANIMATIONS.smile)

      while (!cancelRef.current) {
        const gap = 1000 + Math.random() * 2000
        await wait(gap)
        if (cancelRef.current) return
        await tryPlayRandom()
      }
    }

    loop()

    return () => {
      cancelRef.current = true
      // Cancelar timers Y resolver las promesas asociadas. Sin el resolve(),
      // los `await wait(...)` dentro de `tryPlay` quedaban dangling para
      // siempre. Con el resolve, el for-loop de `tryPlay` avanza al siguiente
      // check de cancelRef y sale limpio.
      timersRef.current.forEach(({ id, resolve }) => {
        clearTimeout(id)
        resolve()
      })
      timersRef.current = []
      // Defensive reset: redundante tras el resolve() (tryPlay sale por su
      // for-loop y el finally pone busyRef a false), pero defensivo por si
      // hubiera algún path que no pase por el for-loop.
      busyRef.current = false
      setState('normal')
    }
  }, [wait, tryPlay, tryPlayRandom, whistle])

  return { state, tryPlay, tryPlayRandom }
}

interface KalamaricoAvatarProps {
  state: AvatarState
  size?: number
  ref?: React.Ref<HTMLSpanElement>
}

export function KalamaricoAvatar({
  state,
  size = 44,
  ref,
}: KalamaricoAvatarProps) {
  const scale = size / FRAME_SIZE
  const offsetX = -(STATE_INDEX[state] * FRAME_SIZE) * scale

  return (
    <span
      ref={ref}
      className="avatar"
      style={{ width: size, height: size }}
      aria-label="Avatar Kalamarico"
    >
      <div
        style={{
          width: size,
          height: size,
          backgroundImage: `url(${spriteUrl})`,
          backgroundSize: `${FRAME_SIZE * FRAME_COUNT * scale}px ${size}px`,
          backgroundPosition: `${offsetX}px 0`,
          backgroundRepeat: 'no-repeat',
          imageRendering: 'pixelated',
        }}
      />
    </span>
  )
}
