import { useCallback, useEffect, useRef } from 'react'
import { Hero } from './components/Hero'
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
  })

  useEffect(() => {
    const onClick = () => {
      void tryPlay(ANIMATIONS.surprised)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [tryPlay])

  return (
    <>
      {container}
      <header className="site-header" data-reveal="1">
        <KalamaricoAvatar ref={avatarRef} state={state} />
        <span className="handle">@calamarico</span>
      </header>
      <main className="site-main">
        <Hero onTitleHover={() => { void tryPlayRandom() }} />
      </main>
      <footer className="site-footer" data-reveal="4">
        <SocialLinks />
      </footer>
    </>
  )
}

export default App
