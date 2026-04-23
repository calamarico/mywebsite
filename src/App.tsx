import { Avatar } from './components/Avatar'
import { Hero } from './components/Hero'
import { SocialLinks } from './components/SocialLinks'

function App() {
  return (
    <>
      <header className="site-header" data-reveal="1">
        <Avatar />
        <span className="handle">@calamarico</span>
      </header>
      <main className="site-main">
        <Hero />
      </main>
      <footer className="site-footer" data-reveal="4">
        <SocialLinks />
      </footer>
    </>
  )
}

export default App
