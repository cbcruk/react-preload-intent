/**
 * 아직 렌더되지 않은 이미지를 트리거 시점에 `react-dom`의 `preload()`로 미리 받는 hooks.
 *
 * 트리거 분류(render / intent / viewport / manual)는 TanStack Router에서 차용. 이미 렌더되는
 * `<img>`는 SSR에서 React가 preload hint를 자동 생성하므로 이 라이브러리가 필요 없음 — README "React가
 * 이미 해주는 것" 참조.
 */

import { type RefObject, useCallback, useEffect, useRef } from 'react'
import { preload as reactDomPreload } from 'react-dom'

/** 이미지 요청의 상대적 fetch 우선순위. */
export type FetchPriority = 'high' | 'low' | 'auto'

/**
 * 모든 트리거가 공통으로 받는 preload 옵션.
 *
 * 각 값은 [`preload()`](https://react.dev/reference/react-dom/preload)로 그대로 전달되며,
 * `fetchPriority`만 기본값이 다름.
 */
export interface PreloadOptions {
  /** 기본 `"high"` — React의 `preload()` 기본값(`"auto"`)과 다름. */
  fetchPriority?: FetchPriority
  /** 실제 `<img>`의 `crossOrigin`과 같아야 preload 응답이 재사용됨. */
  crossOrigin?: 'anonymous' | 'use-credentials'
  /** 실제 `<img>`의 `srcSet`과 같은 값. 다르면 브라우저가 다른 후보를 받을 수 있음. */
  imageSrcSet?: string
  /** 실제 `<img>`의 `sizes`와 같은 값. `imageSrcSet`과 함께 사용. */
  imageSizes?: string
  /**
   * 리소스 MIME 타입 (예: `"image/avif"`). 브라우저가 지원하지 않는 타입이면 다운로드를 건너뛰므로
   * `<picture>`의 `<source type>`과 맞춰 쓸 때 유용.
   */
  type?: string
  /** 요청에 보낼 Referer 정책. */
  referrerPolicy?:
    | 'no-referrer'
    | 'no-referrer-when-downgrade'
    | 'origin'
    | 'origin-when-cross-origin'
    | 'unsafe-url'
}

/**
 * 모든 트리거가 공유하는 `preload()` 호출부. `as: "image"`를 고정하고 옵션을 보정함.
 *
 * `fetchPriority` 디폴트를 `"high"`로 보정. JS로 주입되는 `<link rel="preload">`의 브라우저 기본값이
 * `"low"`라 명시 필요.
 *
 * `data:` URL은 이미 인라인된 리소스라 fetch할 게 없으므로 스킵 — React도 `<img>` 자동 preload에서 동일하게
 * 제외함.
 */
function callPreload(url: string, options: PreloadOptions = {}): void {
  if (/^data:/i.test(url)) return
  reactDomPreload(url, {
    as: 'image',
    fetchPriority: options.fetchPriority ?? 'high',
    crossOrigin: options.crossOrigin,
    imageSrcSet: options.imageSrcSet,
    imageSizes: options.imageSizes,
    type: options.type,
    referrerPolicy: options.referrerPolicy,
  })
}

/** {@link usePreload}와 {@link Preload}의 옵션. */
export interface UsePreloadOptions extends PreloadOptions {
  /** `false`면 프리로드 스킵. 기본 `true`. */
  enabled?: boolean
}

/**
 * Render trigger — 컴포넌트 렌더 중 프리로드.
 *
 * React 19가 idempotent + dedup + `<head>` hoist를 자동 처리하므로 렌더 중 직접 호출해도 안전. 같은
 * 컴포넌트가 렌더하는 `<img>`라면 SSR에서 React가 이미 preload하므로 불필요 — 모달처럼 아직 렌더되지 않은 이미지에 쓸
 * 것.
 *
 * ⚠️ Suspense boundary 안에서 `await` 후에 호출되면 HTML stream 끝에 붙어 무의미해짐. README
 * "Suspense + streaming 함정" 참조.
 *
 * @param url `null` / `undefined` / 빈 문자열이면 스킵.
 *
 * @example 모달이 열릴 때만
 * ```tsx
 * import { useState } from 'react'
 * import { usePreload } from 'react-preload-intent'
 *
 * function ProductThumbnail({ fullSizeUrl }: { fullSizeUrl: string }) {
 *   const [open, setOpen] = useState(false)
 *   usePreload(fullSizeUrl, { enabled: open })
 *   return <button onClick={() => setOpen(true)}>크게 보기</button>
 * }
 * ```
 */
export function usePreload(
  url: string | null | undefined,
  options: UsePreloadOptions = {},
): void {
  const { enabled = true, ...preloadOpts } = options
  if (enabled && url) callPreload(url, preloadOpts)
}

/**
 * Manual trigger — 이벤트 핸들러에서 직접 호출할 수 있는 stable 콜백 반환.
 *
 * 붙여넣기 직후 업로드된 URL을 프리로드하는 것처럼 React 라이프사이클 밖에서 트리거할 때 사용.
 *
 * @example 업로드 직후
 * ```tsx
 * import { usePreloadCallback } from 'react-preload-intent'
 *
 * function CommentBox({
 *   upload,
 * }: {
 *   upload: (file: File) => Promise<string>
 * }) {
 *   const preload = usePreloadCallback()
 *   const onPaste = async (e: React.ClipboardEvent) => {
 *     const file = e.clipboardData.files[0]
 *     if (file) preload(await upload(file))
 *   }
 *   return <textarea onPaste={onPaste} />
 * }
 * ```
 */
export function usePreloadCallback(): (
  url: string,
  options?: PreloadOptions,
) => void {
  return useCallback((url, options) => callPreload(url, options), [])
}

/** {@link usePreloadIntent}의 옵션. */
export interface UsePreloadIntentOptions extends PreloadOptions {
  /** intent 시점부터 실제 트리거까지 지연(ms). 기본 50ms. */
  delay?: number
}

/** {@link usePreloadIntent}가 반환하는, 대상 요소에 spread할 이벤트 핸들러. */
export interface PreloadIntentHandlers {
  /** `delay` 후 프리로드하도록 타이머 시작. */
  onMouseEnter: () => void
  /** 아직 발동하지 않은 타이머 취소. */
  onMouseLeave: () => void
  /** `onMouseEnter`와 같음 — 터치 기기용. */
  onTouchStart: () => void
  /** `onMouseEnter`와 같음 — 키보드 탐색용. */
  onFocus: () => void
}

/**
 * Intent trigger — hover / touch / focus 시 프리로드.
 *
 * TanStack Router와 동일한 50ms 지연 디폴트로 실수 hover를 필터. 마우스가 떠나면 (`onMouseLeave`) 타이머
 * 취소, URL당 1회만 트리거.
 *
 * `<ViewTransition>`과 함께 쓰면 클릭 후 이미지 로드 대기가 줄어듦 — README "Intent +
 * `<ViewTransition>`" 참조.
 *
 * @example 링크 hover
 * ```tsx
 * import { usePreloadIntent } from 'react-preload-intent'
 *
 * function ArticleCard({ href, heroUrl }: { href: string; heroUrl: string }) {
 * const intent = usePreloadIntent(heroUrl)
 * return <a href={href} {...intent}>기사 보기</a>
 * }
 * ```
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

/** {@link usePreloadViewport}의 옵션. `IntersectionObserver` 옵션을 함께 받음. */
export interface UsePreloadViewportOptions extends PreloadOptions {
  /** viewport 경계 확장. 클수록 일찍 트리거됨. 기본 `"200px"`. */
  rootMargin?: string
  /** 교차 비율 임계값. 배열을 매 렌더 새로 만들어도 됨. 기본 `0`. */
  threshold?: number | number[]
  /** 교차 판정 기준 요소. 기본 `null`(브라우저 viewport). */
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
 *
 * @returns 관찰할 요소에 붙일 ref.
 *
 * @example 갤러리 아이템
 * ```tsx
 * import { usePreloadViewport } from 'react-preload-intent'
 *
 * function GalleryItem({
 *   thumbUrl,
 *   fullUrl,
 * }: {
 *   thumbUrl: string
 *   fullUrl: string
 * }) {
 *   const ref = usePreloadViewport<HTMLDivElement>(fullUrl)
 *   return (
 *     <div ref={ref}>
 *       <img src={thumbUrl} alt="" />
 *     </div>
 *   )
 * }
 * ```
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

/** {@link Preload}의 props. */
export interface PreloadProps extends UsePreloadOptions {
  /** 프리로드할 이미지 URL. */
  href: string
}

/**
 * {@link usePreload}의 선언적 컴포넌트 버전. 아무것도 렌더하지 않음.
 *
 * JSX 트리에서 프리로드 의도를 명시할 때 사용.
 */
export function Preload({ href, ...options }: PreloadProps): null {
  usePreload(href, options)
  return null
}
