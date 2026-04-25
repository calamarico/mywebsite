import { type RefObject, useEffect, useRef, useState } from 'react'

export interface Band {
  keys: number[]
  binStart: number
  binEnd: number
  threshold?: number
  cooldownMs?: number
}

interface UseFFTPianoArgs {
  audioRef: RefObject<HTMLAudioElement | null>
  playing: boolean
  bands: Band[]
  onTrigger: (keyIndex: number, pressMs: number) => void
  onAudioFailed?: () => void
  pressMs?: number
  historyFrames?: number
  defaultThreshold?: number
  defaultCooldownMs?: number
  fillGapMs?: number
  fillEnergyFloor?: number
}

interface UseFFTPianoResult {
  audioAvailable: boolean
}

export function useFFTPiano({
  audioRef,
  playing,
  bands,
  onTrigger,
  onAudioFailed,
  pressMs = 120,
  historyFrames = 18,
  defaultThreshold = 1.4,
  defaultCooldownMs = 80,
  fillGapMs = 450,
  fillEnergyFloor = 28,
}: UseFFTPianoArgs): UseFFTPianoResult {
  const [audioAvailable, setAudioAvailable] = useState(false)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const onTriggerRef = useRef(onTrigger)
  onTriggerRef.current = onTrigger
  const onAudioFailedRef = useRef(onAudioFailed)
  onAudioFailedRef.current = onAudioFailed
  // One-shot: el callback de fallo se invoca como mucho una vez por sesión.
  const failureLoggedRef = useRef(false)

  const notifyFailure = (reason: string, error: unknown) => {
    console.warn('[useFFTPiano] audio failed:', reason, error)
    if (failureLoggedRef.current) return
    failureLoggedRef.current = true
    onAudioFailedRef.current?.()
  }

  // Pre-unlock: al primer gesture del usuario creamos el AudioContext y hacemos
  // un play()/pause() silencioso para desbloquear tanto el context como el
  // HTMLMediaElement. El main effect NUNCA crea el AudioContext — si este
  // pre-unlock no ha corrido, el hook entra en fallback.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const unlock = async () => {
      try {
        if (!audioCtxRef.current) {
          const Ctor =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext
          if (!Ctor) {
            notifyFailure('webaudio-unsupported', null)
            return
          }
          const ctx = new Ctor()
          const source = ctx.createMediaElementSource(audio)
          const analyser = ctx.createAnalyser()
          analyser.fftSize = 2048
          analyser.smoothingTimeConstant = 0.6
          source.connect(analyser)
          analyser.connect(ctx.destination)
          audioCtxRef.current = ctx
          sourceRef.current = source
          analyserRef.current = analyser
        }
        await audioCtxRef.current.resume()
        // Silent play/pause cycle to fully unlock the media element.
        const wasMuted = audio.muted
        audio.muted = true
        try {
          await audio.play()
          audio.pause()
          audio.currentTime = 0
        } finally {
          audio.muted = wasMuted
        }
      } catch (e) {
        notifyFailure('unlock-failed', e)
      }
    }

    window.addEventListener('pointerdown', unlock, { once: true, passive: true })
    window.addEventListener('keydown', unlock, { once: true, passive: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [audioRef])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (!playing) {
      audio.pause()
      setAudioAvailable(false)
      return
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const ctx = audioCtxRef.current
    const analyser = analyserRef.current
    // Si el pre-unlock aún no se ha disparado (no ha habido gesture), salir
    // al fallback silencioso sin crear nada.
    if (!ctx || !analyser) {
      setAudioAvailable(false)
      return
    }

    const freqData = new Uint8Array(analyser.frequencyBinCount)
    const bandState = bands.map(() => ({
      history: [] as number[],
      lastTriggerTime: 0,
      lastKey: -1,
    }))

    let rafId = 0
    let cancelled = false
    let lastAnyTriggerTime = 0

    const tick = () => {
      if (cancelled) return
      analyser.getByteFrequencyData(freqData)
      const now = performance.now()

      let anyTriggered = false
      let strongestBand = -1
      let strongestEnergy = 0

      for (let b = 0; b < bands.length; b++) {
        const band = bands[b]
        const state = bandState[b]
        const threshold = band.threshold ?? defaultThreshold
        const cooldown = band.cooldownMs ?? defaultCooldownMs

        let sum = 0
        const binCount = band.binEnd - band.binStart + 1
        for (let i = band.binStart; i <= band.binEnd; i++) {
          sum += freqData[i]
        }
        const energy = binCount > 0 ? sum / binCount : 0

        if (energy > strongestEnergy) {
          strongestEnergy = energy
          strongestBand = b
        }

        state.history.push(energy)
        if (state.history.length > historyFrames) state.history.shift()
        const avg =
          state.history.reduce((a, c) => a + c, 0) / state.history.length

        if (
          state.history.length >= 6 &&
          avg > 4 &&
          energy > avg * threshold &&
          now - state.lastTriggerTime > cooldown
        ) {
          const picks = Math.random() < 0.35 ? 2 : 1
          const picked = new Set<number>()
          for (let attempt = 0; attempt < 8 && picked.size < picks; attempt++) {
            const k = band.keys[Math.floor(Math.random() * band.keys.length)]
            if (k !== state.lastKey || band.keys.length === 1) {
              picked.add(k)
            }
          }
          picked.forEach((k) => onTriggerRef.current(k, pressMs))
          const pickedArr = Array.from(picked)
          if (pickedArr.length > 0) {
            state.lastKey = pickedArr[pickedArr.length - 1]
          }
          state.lastTriggerTime = now
          anyTriggered = true
        }
      }

      if (anyTriggered) {
        lastAnyTriggerTime = now
      } else if (
        strongestBand >= 0 &&
        strongestEnergy >= fillEnergyFloor &&
        now - lastAnyTriggerTime > fillGapMs
      ) {
        // Fill: pasajes sostenidos sin onsets claros — disparamos una tecla
        // en la banda con más energía actual para mantener presencia visual.
        const band = bands[strongestBand]
        const state = bandState[strongestBand]
        const k = band.keys[Math.floor(Math.random() * band.keys.length)]
        if (k !== state.lastKey || band.keys.length === 1) {
          onTriggerRef.current(k, pressMs)
          state.lastKey = k
          state.lastTriggerTime = now
          lastAnyTriggerTime = now
        }
      }

      rafId = requestAnimationFrame(tick)
    }

    const start = async () => {
      try {
        if (ctx.state === 'suspended') await ctx.resume()
        audio.currentTime = 0
        await audio.play()
      } catch (e) {
        notifyFailure('audio-play-rejected', e)
        setAudioAvailable(false)
        return
      }
      if (cancelled) return
      setAudioAvailable(true)
      if (!prefersReducedMotion) {
        rafId = requestAnimationFrame(tick)
      }
    }

    void start()

    return () => {
      cancelled = true
      if (rafId) cancelAnimationFrame(rafId)
      audio.pause()
    }
  }, [
    audioRef,
    playing,
    bands,
    pressMs,
    historyFrames,
    defaultThreshold,
    defaultCooldownMs,
    fillGapMs,
    fillEnergyFloor,
  ])

  useEffect(() => {
    return () => {
      try {
        sourceRef.current?.disconnect()
        analyserRef.current?.disconnect()
        void audioCtxRef.current?.close()
      } catch {
        // ignore
      }
    }
  }, [])

  return { audioAvailable }
}
