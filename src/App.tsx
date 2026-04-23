import { useEffect } from 'react'
import { Hero } from './components/Hero'
import {
  ANIMATIONS,
  KalamaricoAvatar,
  useKalamaricoAvatar,
} from './components/KalamaricoAvatar'
import { SocialLinks } from './components/SocialLinks'

function App() {
  const kalamarico = useKalamaricoAvatar()
  const { state, tryPlay, tryPlayRandom } = kalamarico

  useEffect(() => {
    const onClick = () => {
      void tryPlay(ANIMATIONS.surprised)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [tryPlay])

  return (
    <>
      <header className="site-header" data-reveal="1">
        <KalamaricoAvatar state={state} />
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
