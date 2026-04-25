import { useCallback, useEffect, useRef, useState } from 'react'
import { Hero, type HeroMode } from './components/Hero'
import {
  ANIMATIONS,
  KalamaricoAvatar,
  useKalamaricoAvatar,
  type AvatarAnimation,
} from './components/KalamaricoAvatar'
import { SocialLinks } from './components/SocialLinks'
import {
  usePixelParticles,
  type ParticlePalette,
} from './hooks/usePixelParticles'
import { useMusicalNotes } from './hooks/useMusicalNotes'
import { useClickHints } from './hooks/useClickHints'

const PALETTE_BY_ANIM = new WeakMap<AvatarAnimation, ParticlePalette>([
  [ANIMATIONS.blink, 'cyan'],
  [ANIMATIONS.surprised, 'orange'],
  [ANIMATIONS.smile, 'yellow'],
  [ANIMATIONS.grimace, 'red'],
  [ANIMATIONS.electrocuted, 'electric'],
  [ANIMATIONS.holdBreath, 'purple'],
])

function App() {
  const avatarRef = useRef<HTMLSpanElement>(null)
  const { burst, container } = usePixelParticles()
  const { start: startNotes, stop: stopNotes, MusicalNotesLayer } = useMusicalNotes()
  const { start: startHints, stop: stopHints, ClickHintsLayer } = useClickHints()

  const [heroMode, setHeroMode] = useState<HeroMode>('text')

  // Una vez el usuario interactúa por primera vez (heroMode deja de ser
  // 'text' al activar la intro), los click hints se desactivan
  // permanentemente: ya no vuelven aunque el modo regrese a 'text' tras la
  // canción.
  const hintsDisabledRef = useRef(false)

  // Espejo del state para que el click handler global no se re-instale en
  // cada cambio de modo (mismo patrón que `modeRef` en Hero).
  const heroModeRef = useRef<HeroMode>(heroMode)
  heroModeRef.current = heroMode

  const onAnimationStart = useCallback(
    (anim: AvatarAnimation) => {
      const node = avatarRef.current
      if (!node) return
      burst(node, PALETTE_BY_ANIM.get(anim) ?? 'orange')
    },
    [burst],
  )

  const { state, tryPlay, tryPlayRandom } = useKalamaricoAvatar({
    onAnimationStart,
    whistle: heroMode === 'piano',
  })

  useEffect(() => {
    const onClick = () => {
      // Durante el modo piano el avatar está silbando en bucle: ningún
      // click interrumpe la animación para no romper la atmósfera.
      if (heroModeRef.current === 'piano') return
      void tryPlay(ANIMATIONS.surprised)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [tryPlay])

  // Notas musicales flotando alrededor del avatar mientras suena el piano.
  // Se respeta `prefers-reduced-motion` saltando el efecto (el hook trae sus
  // propios keyframes inline, no caen bajo el media query global).
  useEffect(() => {
    if (heroMode !== 'piano') {
      stopNotes()
      return
    }
    if (!avatarRef.current) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    startNotes(avatarRef.current)
    return () => stopNotes()
  }, [heroMode, startNotes, stopNotes])

  // Click hints aleatorios mientras el usuario está en modo texto y aún no
  // ha interactuado. Tras la primera transición fuera de 'text' (intro o
  // piano), se desactivan para el resto de la sesión: ni vuelven al acabar
  // la canción.
  useEffect(() => {
    if (heroMode !== 'text') {
      hintsDisabledRef.current = true
      stopHints()
      return
    }
    if (hintsDisabledRef.current) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    startHints(['.site-header', '.hero', '.site-footer'])
    return () => stopHints()
  }, [heroMode, startHints, stopHints])

  return (
    <>
      {container}
      <MusicalNotesLayer />
      <ClickHintsLayer />
      <header className="site-header" data-reveal="1">
        <KalamaricoAvatar ref={avatarRef} state={state} size={64} />
        <span className="handle">@calamarico</span>
      </header>
      <main className="site-main">
        <Hero
          onTitleHover={() => { void tryPlayRandom() }}
          onModeChange={setHeroMode}
        />
      </main>
      <footer className="site-footer" data-reveal="4">
        <SocialLinks />
      </footer>
    </>
  )
}

export default App
