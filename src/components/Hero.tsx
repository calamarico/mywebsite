interface HeroProps {
  onTitleHover?: () => void
}

export function Hero({ onTitleHover }: HeroProps) {
  return (
    <div className="hero">
      <h1
        className="hero-title"
        data-reveal="2"
        onMouseEnter={onTitleHover}
      >
        KALAMARICO
      </h1>
      <p className="hero-role" data-reveal="3">Senior Frontend Developer</p>
    </div>
  )
}
