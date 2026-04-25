import { useEffect } from 'react'

/**
 * Mantiene la pantalla despierta mientras `active` sea true (Screen Wake
 * Lock API). Diseñado para mobile durante el modo piano: sin esto, en
 * móviles la pantalla se apaga durante la canción.
 *
 * Detalles:
 * - Requiere HTTPS y un browser que soporte `navigator.wakeLock` (Chrome,
 *   Safari iOS 16.4+, Firefox). En el resto, el hook es no-op silencioso.
 * - El navegador libera el lock automáticamente al ocultar la pestaña
 *   (`document.hidden`). Re-adquirimos en `visibilitychange` para cubrir
 *   el caso de salir/volver del tab mientras la canción sigue.
 * - `acquire()` puede fallar (permisos, batería baja en algunos OS).
 *   Catch silencioso — no es un fallo crítico.
 */
export function useScreenWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const acquire = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) {
          void lock.release()
          return
        }
        sentinel = lock
      } catch {
        // permisos denegados, batería baja, etc. — no es crítico.
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !sentinel) {
        void acquire()
      }
    }

    void acquire()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibility)
      void sentinel?.release()
      sentinel = null
    }
  }, [active])
}
