/**
 * react-preload-intent
 *
 * React 19's react-dom/preload() with trigger taxonomy borrowed
 * from TanStack Router (intent / viewport / render).
 *
 * What Next.js's <Image priority> does internally — but as
 * standalone, composable hooks.
 */

import {
  useCallback,
  useEffect,
  useRef,
  type RefObject,
} from "react";
import { preload as reactDomPreload } from "react-dom";

// ─────────────────────────────────────────────────────────────
// 공통 타입
// ─────────────────────────────────────────────────────────────

export type FetchPriority = "high" | "low" | "auto";

export interface PreloadOptions {
  fetchPriority?: FetchPriority;
  crossOrigin?: "anonymous" | "use-credentials";
  /** srcset 대응 이미지를 프리로드할 때 */
  imageSrcSet?: string;
  /** imageSrcSet과 함께 사용 */
  imageSizes?: string;
  referrerPolicy?:
    | "no-referrer"
    | "no-referrer-when-downgrade"
    | "origin"
    | "origin-when-cross-origin"
    | "unsafe-url";
}

function callPreload(url: string, options: PreloadOptions = {}): void {
  reactDomPreload(url, {
    as: "image",
    fetchPriority: options.fetchPriority ?? "high",
    crossOrigin: options.crossOrigin,
    imageSrcSet: options.imageSrcSet,
    imageSizes: options.imageSizes,
    referrerPolicy: options.referrerPolicy,
  });
}

// ─────────────────────────────────────────────────────────────
// 1. usePreload — render trigger
// ─────────────────────────────────────────────────────────────
//
// 렌더 중에 호출. React가 idempotent + dedup + head로 hoist 처리.
// Suspense boundary 안에서 await 후 호출되면 stream 끝에 붙어
// 무의미해질 수 있음 → README "Suspense + streaming 함정" 참조.

export interface UsePreloadOptions extends PreloadOptions {
  /** false면 프리로드 스킵 (조건부) */
  enabled?: boolean;
}

export function usePreload(
  url: string | null | undefined,
  options: UsePreloadOptions = {},
): void {
  const { enabled = true, ...preloadOpts } = options;
  if (enabled && url) callPreload(url, preloadOpts);
}

// ─────────────────────────────────────────────────────────────
// 2. usePreloadCallback — manual trigger
// ─────────────────────────────────────────────────────────────
//
// 이벤트 핸들러에서 호출. 붙여넣기 직후 프리로드 같은 케이스.

export function usePreloadCallback(): (
  url: string,
  options?: PreloadOptions,
) => void {
  return useCallback((url, options) => callPreload(url, options), []);
}

// ─────────────────────────────────────────────────────────────
// 3. usePreloadIntent — hover / touch / focus trigger
// ─────────────────────────────────────────────────────────────
//
// TanStack Router와 동일하게 50ms 지연 디폴트 (실수 hover 필터).
// 마우스가 떠나면 취소. URL당 1회만 트리거.

export interface UsePreloadIntentOptions extends PreloadOptions {
  /** intent 시점부터 실제 트리거까지 지연 (기본 50ms) */
  delay?: number;
}

export interface PreloadIntentHandlers {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onTouchStart: () => void;
  onFocus: () => void;
}

export function usePreloadIntent(
  url: string | null | undefined,
  options: UsePreloadIntentOptions = {},
): PreloadIntentHandlers {
  const triggered = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { delay = 50, ...preloadOpts } = options;
  const optionsRef = useRef(preloadOpts);
  optionsRef.current = preloadOpts;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const trigger = useCallback(() => {
    if (!url || triggered.current.has(url)) return;
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (!triggered.current.has(url)) {
        triggered.current.add(url);
        callPreload(url, optionsRef.current);
      }
    }, delay);
  }, [url, delay, clearTimer]);

  // 언마운트 시 timer cleanup
  useEffect(() => clearTimer, [clearTimer]);

  return {
    onMouseEnter: trigger,
    onMouseLeave: clearTimer,
    onTouchStart: trigger,
    onFocus: trigger,
  };
}

// ─────────────────────────────────────────────────────────────
// 4. usePreloadViewport — IntersectionObserver trigger
// ─────────────────────────────────────────────────────────────
//
// 진입 직전 (rootMargin 만큼 일찍) 트리거. URL당 1회.
// 무한 스크롤, 갤러리에서 다음 이미지 미리 받기.

export interface UsePreloadViewportOptions extends PreloadOptions {
  /** viewport 경계 확장 (기본 "200px") */
  rootMargin?: string;
  threshold?: number | number[];
  root?: Element | null;
}

export function usePreloadViewport<T extends HTMLElement>(
  url: string | null | undefined,
  options: UsePreloadViewportOptions = {},
): RefObject<T | null> {
  const ref = useRef<T>(null);
  const triggered = useRef(false);
  const {
    rootMargin = "200px",
    threshold = 0,
    root,
    ...preloadOpts
  } = options;
  const optionsRef = useRef(preloadOpts);
  optionsRef.current = preloadOpts;

  // threshold가 array일 때 deps 안정화. 사용자가 직접 useMemo 안 해도 되도록.
  const thresholdKey = Array.isArray(threshold)
    ? threshold.join(",")
    : String(threshold);

  useEffect(() => {
    const el = ref.current;
    if (!url || !el || triggered.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !triggered.current) {
            triggered.current = true;
            callPreload(url, optionsRef.current);
            observer.disconnect();
            return;
          }
        }
      },
      { rootMargin, threshold, root: root ?? null },
    );

    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, rootMargin, thresholdKey, root]);

  return ref;
}

// ─────────────────────────────────────────────────────────────
// 5. <Preload /> — render trigger의 선언적 컴포넌트
// ─────────────────────────────────────────────────────────────

export interface PreloadProps extends UsePreloadOptions {
  href: string;
}

export function Preload({ href, ...options }: PreloadProps): null {
  usePreload(href, options);
  return null;
}
