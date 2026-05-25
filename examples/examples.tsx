/**
 * Examples — 4가지 trigger 및 응용 패턴
 */

import { useState } from "react";
import {
  usePreload,
  usePreloadCallback,
  usePreloadIntent,
  usePreloadViewport,
  Preload,
} from "../src/index";

declare function uploadImage(file: File): Promise<string>;

// ─────────────────────────────────────────────────────────────
// 1. Manual — 붙여넣기 → 프리로드 → submit 시 즉시 표시 (원문 시나리오)
// ─────────────────────────────────────────────────────────────

export function CommentBox() {
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const preload = usePreloadCallback();

  const handlePaste = async (e: React.ClipboardEvent) => {
    const file = Array.from(e.clipboardData.files).find((f) =>
      f.type.startsWith("image/"),
    );
    if (!file) return;

    const url = await uploadImage(file);

    // ⬇️ 업로드 직후 프리로드. submit 시 <img />가 즉시 표시됨.
    preload(url);
    setPendingUrl(url);
  };

  return (
    <div>
      <textarea onPaste={handlePaste} />
      {pendingUrl && <img src={pendingUrl} alt="preview" />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. Intent — 호버/포커스 시 다음 페이지 hero 이미지 프리로드
// ─────────────────────────────────────────────────────────────

export function ArticleCard({
  href,
  heroImageUrl,
  title,
}: {
  href: string;
  heroImageUrl: string;
  title: string;
}) {
  const intent = usePreloadIntent(heroImageUrl);

  // 50ms hover 지연 + 마우스 떠나면 취소 (TanStack과 동일)
  return (
    <a href={href} {...intent}>
      <h3>{title}</h3>
    </a>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. Viewport — 무한 스크롤 진입 직전 큰 이미지 받기
// ─────────────────────────────────────────────────────────────

export function GalleryItem({
  thumbnailUrl,
  fullSizeUrl,
}: {
  thumbnailUrl: string;
  fullSizeUrl: string;
}) {
  // viewport에서 200px 이내로 들어오면 풀 사이즈 프리로드
  const ref = usePreloadViewport<HTMLDivElement>(fullSizeUrl, {
    rootMargin: "200px",
  });

  return (
    <div ref={ref}>
      <img src={thumbnailUrl} alt="" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. Render — 라우트 상단에서 선언적
// ─────────────────────────────────────────────────────────────

export function ProductPage({ productId }: { productId: string }) {
  const heroUrl = `/api/products/${productId}/hero.jpg`;

  return (
    <>
      {/* 렌더 트리에 프리로드 의도 명시. React가 head로 hoist */}
      <Preload href={heroUrl} fetchPriority="high" />
      <article>{/* ... */}</article>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// 응용 1. 조건부 — 모달 열릴 때만 프리로드
// ─────────────────────────────────────────────────────────────

export function ProductThumbnail({
  thumbnailUrl,
  fullSizeUrl,
}: {
  thumbnailUrl: string;
  fullSizeUrl: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [hovering, setHovering] = useState(false);

  // enabled로 조건부 트리거. true가 된 순간 프리로드됨.
  usePreload(fullSizeUrl, { enabled: hovering || modalOpen });

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
  );
}

// ─────────────────────────────────────────────────────────────
// 응용 2. srcset 대응 — 정확한 variant만 프리로드
// ─────────────────────────────────────────────────────────────

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
  );
}

// ─────────────────────────────────────────────────────────────
// ⚠️ 안티패턴 — Suspense boundary 안에서의 await
// ─────────────────────────────────────────────────────────────

// ❌ BAD — SlowComponent의 await가 길면 <Preload>가 생성한 <link>가
//         HTML stream 끝에 붙어 무의미해짐.
//
// <Suspense fallback={<Skeleton />}>
//   <SlowComponent>      {/* 여기서 await */}
//     <Preload href={url} />
//     <img src={url} />
//   </SlowComponent>
// </Suspense>

// ✅ GOOD — Suspense boundary 밖, await 전에 호출.
//
// <>
//   <Preload href={url} />
//   <Suspense fallback={<Skeleton />}>
//     <SlowComponent>
//       <img src={url} />
//     </SlowComponent>
//   </Suspense>
// </>
