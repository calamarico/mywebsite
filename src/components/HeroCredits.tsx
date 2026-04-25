// HeroCredits.tsx
// Panel inline tipo "credits roll" que aparece tras el primer ciclo del modo
// piano. Lista las skills demostradas en la web. Cada categoría se revela
// con animación CSS escalonada (cascading fade-in) para dar sensación de
// créditos de concierto.
//
// El render lo gobierna Hero.tsx vía `creditsOpen && mode === 'text'`.

import { useEffect, useRef } from 'react'

interface CreditCategory {
  title: string
  bullets: string[]
}

const CATEGORIES: CreditCategory[] = [
  {
    title: 'React 19 (advanced patterns)',
    bullets: [
      'Composition of 8 custom hooks coordinated from App (useFFTPiano, useMusicalNotes, usePixelParticles, useClickHints, useScreenWakeLock, useLatestRef, useKalamaricoAvatar).',
      'Refs vs state discipline: refs for session guards, state mirrors, timers, cancellation tokens.',
      "Imperative DOM when React's render isn't the right tool (49-key flashing at 60fps via dataset.pressed with refs, no re-renders).",
      'Portals for decoupled overlay layers (particles, notes, hints).',
      'Cleanup discipline: timers, listeners, RAFs, AudioContexts, Wake Lock sentinels, all released in their useEffect cleanups.',
      'Implicit state machine with flags (pianoDisabledRef, audioFailedRef, encoreAvailable, hintsDisabledRef) distinguishing "completed" vs "failed" vs "first time" vs "post-experience".',
      'Senior-grade TypeScript: discriminated unions, satisfies, generics (useLatestRef<T>), const assertions.',
    ],
  },
  {
    title: 'Web Audio & DSP',
    bullets: [
      'Web Audio API end-to-end: AudioContext + MediaElementSource + AnalyserNode + RAF loop.',
      'Real-time FFT analysis (2048 bins, 4 frequency bands).',
      'Algorithmic onset detection: moving average + scaled threshold + cooldown + fill mode for sustained passages.',
      'Harmonic-aware band design (low frequencies would saturate highs without scaled thresholds).',
      'Cross-platform audio unlock: fine-grained handling of Android Chrome / iOS Safari autoplay policies (synchronous gesture, no await before play()).',
    ],
  },
  {
    title: 'Performance',
    bullets: [
      '60fps without re-renders in the piano flashing (imperative DOM).',
      'GPU-accelerated transforms (scaleX for progress bar, scale/translate for morph).',
      'transition interpolating between timeupdate events (~4-5fps, smooth without dedicated RAF).',
      'requestAnimationFrame for onset detection without blocking main thread.',
      'preload="auto" during the 17s intro so audio is ready when piano starts.',
    ],
  },
  {
    title: 'Advanced CSS',
    bullets: [
      'Design tokens via CSS custom properties (--bg, --accent, --hero-size, --morph-duration, etc.).',
      'data-* attributes as state controllers (data-mode, data-pressed, data-reveal).',
      'clamp() for fluid typography without discrete breakpoints.',
      'Cascading declarative animations with transition-delay: calc(var(--i) * stagger) per h1 letter.',
      'Text gradient via -webkit-background-clip: text for the title degradé.',
      'Pixel-perfect rendering: image-rendering: pixelated for sprite, font-smooth: never for the intro pixel font.',
    ],
  },
  {
    title: 'Mobile / cross-browser',
    bullets: [
      'iOS Safari: playsInline, audio unlock pattern.',
      'Android Chrome: synchronous unlock inside the gesture (no await consuming user activation).',
      'Wake Lock API: screen stays awake during the song (with re-acquire on visibilitychange).',
      'Responsive breakouts: intro slot up to 1100px on desktop, 100vw - 24px on mobile, escaping the inline-block container.',
      'Subpixel jitter solved on hi-DPR (block stabilization + font-smoothing disabled).',
    ],
  },
  {
    title: 'Accessibility',
    bullets: [
      'prefers-reduced-motion: reduce respected across all systems (avatar loop, FFT RAF, hints, notes, intro skip directly to piano).',
      'Correct ARIA: aria-label on h1 and avatar, aria-hidden on decorative elements, role="presentation" on piano.',
      'focus-visible with accent outline on the encore button.',
      'Semantic HTML: header / main / footer, h1, button (no div soup).',
    ],
  },
  {
    title: 'Animation craft',
    bullets: [
      'Sprite sheet with 17 frames and 7 named animations.',
      'Async/await sequences with cancellation tokens (cancelRef checked between frames).',
      'Multi-layer composition: avatar + particles + musical notes + hint ripples + progress bar, each in independent layers.',
      "Cleanly interruptible animations (cleanup resolves pending promises so cancelled loops don't deadlock busyRef).",
    ],
  },
  {
    title: 'UX patterns',
    bullets: [
      'Progressive disclosure (one-shot easter-egg with opt-in replay via "encore?").',
      'Subtle onboarding ("click anywhere" + concentric ripples before the first gesture).',
      'Audio-reactive UI (keys lighting up with the actual music, not canned).',
      'Three-layer feedback (key flash + musical notes + progress bar).',
      'Consistent tone and voice ("encore?", narrative intro), copywriting in service of the product.',
    ],
  },
]

interface HeroCreditsProps {
  id: string
}

export function HeroCredits({ id }: HeroCreditsProps) {
  const titleRef = useRef<HTMLHeadingElement>(null)

  // Mover el focus al h2 al abrir, para lectores de pantalla y navegación
  // por teclado.
  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  return (
    <section
      id={id}
      className="hero-credits"
      role="region"
      aria-labelledby={`${id}-title`}
    >
      <h2
        id={`${id}-title`}
        ref={titleRef}
        tabIndex={-1}
        className="hero-credits__title"
      >
        what just happened
      </h2>

      {CATEGORIES.map((cat, i) => (
        <section
          key={cat.title}
          className="hero-credits__section"
          style={{ ['--i' as string]: i } as React.CSSProperties}
        >
          <h3 className="hero-credits__heading">{cat.title}</h3>
          <ul className="hero-credits__list">
            {cat.bullets.map((b, j) => (
              <li key={j} className="hero-credits__bullet">
                {b}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  )
}
