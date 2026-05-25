/**
 * 4가지 trigger 사용 예시 및 응용 패턴.
 *
 * Suspense + streaming 안티패턴은 CLAUDE.md / README의 "Suspense + streaming 함정" 참조.
 */

import { useState } from 'react'

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
