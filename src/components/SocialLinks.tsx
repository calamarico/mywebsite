const GithubIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .5C5.73.5.74 5.48.74 11.75c0 4.98 3.23 9.2 7.71 10.7.56.1.77-.25.77-.55 0-.27-.01-1-.02-1.96-3.14.68-3.8-1.51-3.8-1.51-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.68.08-.68 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.73.39-1.22.72-1.5-2.5-.28-5.14-1.25-5.14-5.57 0-1.23.44-2.24 1.16-3.03-.12-.29-.5-1.43.11-2.98 0 0 .95-.3 3.1 1.16a10.7 10.7 0 0 1 5.64 0c2.15-1.46 3.1-1.16 3.1-1.16.62 1.55.23 2.69.11 2.98.72.79 1.16 1.8 1.16 3.03 0 4.33-2.65 5.28-5.17 5.56.4.35.76 1.03.76 2.08 0 1.5-.01 2.7-.01 3.07 0 .3.2.66.78.55 4.47-1.5 7.7-5.72 7.7-10.69C23.26 5.48 18.27.5 12 .5z" />
  </svg>
)

const StackOverflowIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.36 20.13v-4.67h1.55V22H3v-6.54h1.55v4.67h12.81zM6.77 14.32l7.62 1.6.32-1.52-7.62-1.6-.32 1.52zm1.01-3.64l7.06 3.3.66-1.4-7.06-3.32-.66 1.42zm1.96-3.46l5.98 4.98.99-1.18-5.98-4.98-.99 1.18zM13.64 2l-1.25.93 4.63 6.25 1.25-.93L13.64 2zM5.81 18.35h7.79v-1.55H5.81v1.55z" />
  </svg>
)

const MailIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
)

export function SocialLinks() {
  return (
    <ul className="social">
      <li>
        <a
          href="https://github.com/calamarico"
          target="_blank"
          rel="noreferrer noopener"
          aria-label="GitHub — calamarico"
        >
          <GithubIcon />
          <span>github</span>
        </a>
      </li>
      <li>
        <a
          href="https://stackoverflow.com/users/1034105/kalamarico"
          target="_blank"
          rel="noreferrer noopener"
          aria-label="StackOverflow — kalamarico"
        >
          <StackOverflowIcon />
          <span>stackoverflow</span>
        </a>
      </li>
      <li>
        <a
          href="mailto:this@kalamarico.lol"
          aria-label="Email — this@kalamarico.lol"
        >
          <MailIcon />
          <span>contact</span>
        </a>
      </li>
    </ul>
  )
}
