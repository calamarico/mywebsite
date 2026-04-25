import { useEffect, useRef, type RefObject } from 'react'

/**
 * Mantiene `value` espejado en un ref. La asignación ocurre en `useEffect`
 * (post-commit), no durante render — evita el anti-patrón de mutar refs en
 * el cuerpo del componente.
 *
 * Uso típico: callbacks o state que se leen desde event listeners, timers
 * o promises sin querer que el effect/callback estable que los usa se
 * re-ejecute cada vez que el valor cambia.
 */
export function useLatestRef<T>(value: T): RefObject<T> {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  })
  return ref
}
