import avatarUrl from '../assets/mm_bernard.jpeg'

export function Avatar() {
  return (
    <span className="avatar" aria-hidden="true">
      <img src={avatarUrl} alt="" width={44} height={44} loading="eager" />
    </span>
  )
}
