/**
 * react-preload-intent
 *
 * React 19's react-dom/preload() with trigger taxonomy borrowed from TanStack
 * Router (intent / viewport / render).
 *
 * What Next.js's <Image priority> does internally — but as standalone,
 * composable hooks.
 */

import { type RefObject, useCallback, useEffect, useRef } from 'react'
import { preload as reactDomPreload } from 'react-dom'

export type FetchPriority = 'high' | 'low' | 'auto'

export interface PreloadOptions {
  fetchPriority?: FetchPriority
  crossOrigin?: 'anonymous' | 'use-credentials'
  /** srcset 대응 이미지를 프리로드할 때 */
  imageSrcSet?: string
  /** imageSrcSet과 함께 사용 */
  imageSizes?: string
  referrerPolicy?:
    | 'no-referrer'
    | 'no-referrer-when-downgrade'
    | 'origin'
    | 'origin-when-cross-origin'
    | 'unsafe-url'
}

/**
 * `fetchPriority` 디폴트를 `"high"`로 보정. JS로 주입되는 `<link rel="preload">`의 브라우저 기본값이
 * `"low"`라 명시 필요.
 */
function callPreload(url: string, options: PreloadOptions = {}): void {
  reactDomPreload(url, {
    as: 'image',
    fetchPriority: options.fetchPriority ?? 'high',
    crossOrigin: options.crossOrigin,
    imageSrcSet: options.imageSrcSet,
    imageSizes: options.imageSizes,
    referrerPolicy: options.referrerPolicy,
  })
}

export interface UsePreloadOptions extends PreloadOptions {
  /** `false`면 프리로드 스킵 (조건부) */
  enabled?: boolean
}

/**
 * Render trigger — 컴포넌트 렌더 중 프리로드.
 *
 * React 19가 idempotent + dedup + `<head>` hoist를 자동 처리하므로 렌더 중 직접 호출해도 안전.
 *
 * ⚠️ Suspense boundary 안에서 `await` 후에 호출되면 HTML stream 끝에 붙어 무의미해짐. README
 * "Suspense + streaming 함정" 참조.
 */
export function usePreload(
  url: string | null | undefined,
  options: UsePreloadOptions = {},
): void {
  const { enabled = true, ...preloadOpts } = options
  if (enabled && url) callPreload(url, preloadOpts)
}

/**
 * Manual trigger — 이벤트 핸들러에서 직접 호출할 수 있는 stable 콜백 반환. 붙여넣기 직후 프리로드처럼 React
 * 라이프사이클 밖에서 트리거할 때.
 */
export function usePreloadCallback(): (
  url: string,
  options?: PreloadOptions,
) => void {
  return useCallback((url, options) => callPreload(url, options), [])
}

export interface UsePreloadIntentOptions extends PreloadOptions {
  /** intent 시점부터 실제 트리거까지 지연 (기본 50ms) */
  delay?: number
}

export interface PreloadIntentHandlers {
  onMouseEnter: () => void
  onMouseLeave: () => void
  onTouchStart: () => void
  onFocus: () => void
}

/**
 * Intent trigger — hover / touch / focus 시 프리로드.
 *
 * TanStack Router와 동일한 50ms 지연 디폴트로 실수 hover를 필터. 마우스가 떠나면 (`onMouseLeave`) 타이머
 * 취소, URL당 1회만 트리거.
 */
export function usePreloadIntent(
  url: string | null | undefined,
  options: UsePreloadIntentOptions = {},
): PreloadIntentHandlers {
  const triggered = useRef<Set<string>>(new Set())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { delay = 50, ...preloadOpts } = options
  const optionsRef = useRef(preloadOpts)
  optionsRef.current = preloadOpts

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const trigger = useCallback(() => {
    if (!url || triggered.current.has(url)) return
    clearTimer()
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      if (!triggered.current.has(url)) {
        triggered.current.add(url)
        callPreload(url, optionsRef.current)
      }
    }, delay)
  }, [url, delay, clearTimer])

  useEffect(() => clearTimer, [clearTimer])

  return {
    onMouseEnter: trigger,
    onMouseLeave: clearTimer,
    onTouchStart: trigger,
    onFocus: trigger,
  }
}

export interface UsePreloadViewportOptions extends PreloadOptions {
  /** viewport 경계 확장 (기본 "200px") */
  rootMargin?: string
  threshold?: number | number[]
  root?: Element | null
}

/**
 * Viewport trigger — IntersectionObserver로 진입 직전 프리로드.
 *
 * `rootMargin`만큼 일찍 트리거되며, URL당 1회 후 observer disconnect. 무한 스크롤 / 갤러리에서 다음 이미지
 * 미리 받기에 사용.
 *
 * `threshold`가 배열일 때 매 렌더마다 새 array가 들어와도 effect가 재실행되지 않도록 내부에서 join한 문자열을
 * deps로 사용 (호출자가 `useMemo`로 안정화할 필요 없음).
 */
export function usePreloadViewport<T extends HTMLElement>(
  url: string | null | undefined,
  options: UsePreloadViewportOptions = {},
): RefObject<T | null> {
  const ref = useRef<T>(null)
  const triggered = useRef(false)
  const { rootMargin = '200px', threshold = 0, root, ...preloadOpts } = options
  const optionsRef = useRef(preloadOpts)
  optionsRef.current = preloadOpts

  const thresholdKey = Array.isArray(threshold)
    ? threshold.join(',')
    : String(threshold)

  useEffect(() => {
    const el = ref.current
    if (!url || !el || triggered.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !triggered.current) {
            triggered.current = true
            callPreload(url, optionsRef.current)
            observer.disconnect()
            return
          }
        }
      },
      { rootMargin, threshold, root: root ?? null },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [url, rootMargin, thresholdKey, root])

  return ref
}

export interface PreloadProps extends UsePreloadOptions {
  href: string
}

/** `usePreload`의 선언적 컴포넌트 버전. JSX 트리에서 의도를 명시할 때. */
export function Preload({ href, ...options }: PreloadProps): null {
  usePreload(href, options)
  return null
}
