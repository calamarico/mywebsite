import { useCallback, useEffect, useRef, useState } from 'react'
import spriteUrl from '../assets/kalamarico_sprite.png'

export type AvatarState = 'normal' | 'surprised' | 'blink' | 'smile' | 'grimace'

export interface AvatarAnimation {
  frames: AvatarState[]
  frameDuration: number | number[]
}

const FRAME_SIZE = 256
const FRAME_COUNT = 5

const STATE_INDEX: Record<AvatarState, number> = {
  normal: 0,
  surprised: 1,
  blink: 2,
  smile: 3,
  grimace: 4,
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
} satisfies Record<string, AvatarAnimation>

const RANDOM_POOL: AvatarAnimation[] = [
  ANIMATIONS.blink,
  ANIMATIONS.surprised,
  ANIMATIONS.smile,
  ANIMATIONS.grimace,
]

export interface KalamaricoController {
  state: AvatarState
  tryPlay: (anim: AvatarAnimation) => Promise<boolean>
  tryPlayRandom: () => Promise<boolean>
}

export function useKalamaricoAvatar(): KalamaricoController {
  const [state, setState] = useState<AvatarState>('normal')
  const busyRef = useRef(false)
  const cancelRef = useRef(false)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const lastAnimRef = useRef<AvatarAnimation | null>(null)

  const wait = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        const id = setTimeout(() => {
          timersRef.current = timersRef.current.filter((t) => t !== id)
          resolve()
        }, ms)
        timersRef.current.push(id)
      }),
    [],
  )

  const tryPlay = useCallback(
    async (anim: AvatarAnimation): Promise<boolean> => {
      if (busyRef.current || cancelRef.current) return false
      busyRef.current = true
      try {
        const { frames, frameDuration } = anim
        const durations = Array.isArray(frameDuration)
          ? frameDuration
          : frames.map(() => frameDuration)

        for (let i = 0; i < frames.length; i++) {
          if (cancelRef.current) return false
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
    if (busyRef.current || cancelRef.current) return false
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
      await wait(5000)
      if (cancelRef.current) return
      await tryPlay(ANIMATIONS.smile)

      while (!cancelRef.current) {
        const gap = 2000 + Math.random() * 6000
        await wait(gap)
        if (cancelRef.current) return
        await tryPlayRandom()
      }
    }

    loop()

    return () => {
      cancelRef.current = true
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
    }
  }, [wait, tryPlay, tryPlayRandom])

  return { state, tryPlay, tryPlayRandom }
}

interface KalamaricoAvatarProps {
  state: AvatarState
  size?: number
}

export function KalamaricoAvatar({ state, size = 44 }: KalamaricoAvatarProps) {
  const scale = size / FRAME_SIZE
  const offsetX = -(STATE_INDEX[state] * FRAME_SIZE) * scale

  return (
    <span className="avatar" aria-label="Avatar Kalamarico">
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
