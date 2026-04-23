import { useCallback, useEffect, useRef, useState } from 'react'
import spriteUrl from '../assets/kalamarico_sprite_v2.png'

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

export interface AvatarAnimation {
  frames: AvatarState[]
  frameDuration: number | number[]
}

const FRAME_SIZE = 256
const FRAME_COUNT = 14

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
      300, 300,
      350, 350,
      400, 400,
      400, 400,
      450, 450,
      500, 500,
      600, 600, 600,
      0,
    ],
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
}

export function useKalamaricoAvatar(
  options: UseKalamaricoOptions = {},
): KalamaricoController {
  const [state, setState] = useState<AvatarState>('normal')
  const busyRef = useRef(false)
  const cancelRef = useRef(false)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const lastAnimRef = useRef<AvatarAnimation | null>(null)

  const onStartRef = useRef(options.onAnimationStart)
  onStartRef.current = options.onAnimationStart

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
        onStartRef.current?.(anim)
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
    <span ref={ref} className="avatar" aria-label="Avatar Kalamarico">
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
