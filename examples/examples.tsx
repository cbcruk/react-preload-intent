/**
 * 4가지 trigger 사용 예시 및 응용 패턴.
 *
 * Suspense + streaming 안티패턴은 CLAUDE.md / README의 "Suspense + streaming 함정" 참조.
 */

import {
  startTransition,
  useLayoutEffect,
  useState,
  ViewTransition,
} from 'react'

import {
  Preload,
  usePreload,
  usePreloadCallback,
  usePreloadIntent,
  usePreloadViewport,
} from '../src/index'

/**
 * Manual trigger — 붙여넣기 → 업로드 직후 프리로드 → submit 시 `<img />` 즉시 표시.
 *
 * `uploadImage`는 호스트 앱이 주입 (실제 업로드 API).
 */
export function CommentBox({
  uploadImage,
}: {
  uploadImage: (file: File) => Promise<string>
}) {
  const [pendingUrl, setPendingUrl] = useState<string | null>(null)
  const preload = usePreloadCallback()

  const handlePaste = async (e: React.ClipboardEvent) => {
    const file = Array.from(e.clipboardData.files).find((f) =>
      f.type.startsWith('image/'),
    )
    if (!file) return

    const url = await uploadImage(file)
    preload(url)
    setPendingUrl(url)
  }

  return (
    <div>
      <textarea onPaste={handlePaste} />
      {pendingUrl && <img src={pendingUrl} alt="preview" />}
    </div>
  )
}

/** Intent trigger — 카드 hover/focus 시 다음 페이지 hero 이미지 프리로드 (50ms 지연). */
export function ArticleCard({
  href,
  heroImageUrl,
  title,
}: {
  href: string
  heroImageUrl: string
  title: string
}) {
  const intent = usePreloadIntent(heroImageUrl)
  return (
    <a href={href} {...intent}>
      <h3>{title}</h3>
    </a>
  )
}

/** Viewport trigger — 무한 스크롤에서 viewport 200px 이내 진입 시 풀 사이즈 받기. */
export function GalleryItem({
  thumbnailUrl,
  fullSizeUrl,
}: {
  thumbnailUrl: string
  fullSizeUrl: string
}) {
  const ref = usePreloadViewport<HTMLDivElement>(fullSizeUrl, {
    rootMargin: '200px',
  })

  return (
    <div ref={ref}>
      <img src={thumbnailUrl} alt="" />
    </div>
  )
}

/** Render trigger — 라우트 상단에서 선언적으로 프리로드 의도 명시 (React가 `<head>`로 hoist). */
export function ProductPage({ productId }: { productId: string }) {
  const heroUrl = `/api/products/${productId}/hero.jpg`
  return (
    <>
      <Preload href={heroUrl} fetchPriority="high" />
      <article>{/* ... */}</article>
    </>
  )
}

/** 응용 — `enabled`로 조건부 트리거. hover 또는 모달 오픈 시점에만 풀 사이즈 프리로드. */
export function ProductThumbnail({
  thumbnailUrl,
  fullSizeUrl,
}: {
  thumbnailUrl: string
  fullSizeUrl: string
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [hovering, setHovering] = useState(false)

  usePreload(fullSizeUrl, { enabled: hovering || modalOpen })

  return (
    <>
      <img
        src={thumbnailUrl}
        onMouseEnter={() => setHovering(true)}
        onClick={() => setModalOpen(true)}
        alt=""
      />
      {modalOpen && <img src={fullSizeUrl} alt="" />}
    </>
  )
}

/** 응용 — `imageSrcSet`/`imageSizes`로 responsive 이미지의 정확한 variant만 프리로드. */
export function ResponsiveHero() {
  return (
    <>
      <Preload
        href="/hero-large.jpg"
        imageSrcSet="/hero-small.jpg 480w, /hero-medium.jpg 800w, /hero-large.jpg 1200w"
        imageSizes="(max-width: 600px) 480px, (max-width: 1024px) 800px, 1200px"
      />
      <img
        src="/hero-large.jpg"
        srcSet="/hero-small.jpg 480w, /hero-medium.jpg 800w, /hero-large.jpg 1200w"
        sizes="(max-width: 600px) 480px, (max-width: 1024px) 800px, 1200px"
        alt=""
      />
    </>
  )
}

/**
 * 응용 — intent preload + `<ViewTransition>`. React는 transition 중 새 `<img>`의
 * 로드/디코드를 기다렸다가 애니메이션을 시작하므로, hover 시점에 미리 받아 두면 클릭 후 대기가 거의 사라짐.
 *
 * `preloadOnIntent={false}`면 비교용 baseline. `onReveal`은 데모에서 클릭 → 커밋 시간을 재기 위한
 * 훅.
 */
export function ViewTransitionReveal({
  imageUrl,
  preloadOnIntent = true,
  onReveal,
}: {
  imageUrl: string
  preloadOnIntent?: boolean
  onReveal?: () => void
}) {
  const [shown, setShown] = useState(false)
  const intent = usePreloadIntent(preloadOnIntent ? imageUrl : null)

  return (
    <>
      <button
        {...intent}
        onClick={() => startTransition(() => setShown(true))}
        disabled={shown}
      >
        이미지 보기
      </button>
      {shown && (
        <ViewTransition>
          <RevealedImage src={imageUrl} onReveal={onReveal} />
        </ViewTransition>
      )}
    </>
  )
}

function RevealedImage({
  src,
  onReveal,
}: {
  src: string
  onReveal?: () => void
}) {
  useLayoutEffect(() => onReveal?.(), [onReveal])
  return (
    <img
      src={src}
      alt=""
      width={320}
      height={160}
      style={{ display: 'block', marginTop: 12, borderRadius: 8 }}
    />
  )
}
