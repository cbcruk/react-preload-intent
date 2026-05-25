# react-preload-intent

> React 19's `react-dom/preload()` with trigger taxonomy.

Next.js의 `<Image priority>`가 내부적으로 하는 일 — 적절한 시점에 `ReactDOM.preload()`를 호출해서 `<link rel="preload">`를 document head에 넣는 패턴 — 을 standalone hooks로 분리한 라이브러리. 트리거 명명은 [TanStack Router](https://tanstack.com/router/v1/docs/framework/react/guide/preloading)에서 차용.

## Why this exists

React 19부터 `react-dom`이 `preload()`를 노출합니다. React가 dedup + hoist + streaming 통합을 자동 처리하므로 `<link rel="preload">`를 직접 주입하는 것보다 이쪽이 옳은 방식. 하지만 *언제* 호출할지는 여전히 결정해야 합니다.

이 라이브러리는 그 결정을 4가지로 정리:

| Trigger | Hook | When |
|---|---|---|
| **render** | `usePreload`, `<Preload>` | 컴포넌트 렌더 중 |
| **intent** | `usePreloadIntent` | hover / touchstart / focus |
| **viewport** | `usePreloadViewport` | IntersectionObserver |
| **manual** | `usePreloadCallback` | 이벤트 핸들러에서 직접 |

## Requirements

- React 19+ (uses `react-dom/preload`)

## Usage

### Render — 컴포넌트가 보이는 순간 프리로드

```tsx
import { usePreload, Preload } from "react-preload-intent";

function ProductPage() {
  // Hook 방식
  usePreload("/hero.jpg");

  // 또는 선언적 컴포넌트
  return <><Preload href="/hero.jpg" /> ... </>;
}
```

`enabled` 옵션으로 조건부 트리거:

```tsx
usePreload(modalImageUrl, { enabled: modalOpen || hovering });
```

### Manual — 이벤트 핸들러에서 직접 호출

원문 시나리오: 사용자가 코멘트 박스에 이미지를 붙여넣은 직후 프리로드해두면, submit 시 즉시 표시됨.

```tsx
import { usePreloadCallback } from "react-preload-intent";

function CommentBox() {
  const preload = usePreloadCallback();

  const onPaste = async (e) => {
    const url = await uploadImage(e.clipboardData.files[0]);
    preload(url); // ← submit 시 <img />가 즉시 표시됨
  };

  return <textarea onPaste={onPaste} />;
}
```

### Intent — hover / touch / focus

```tsx
import { usePreloadIntent } from "react-preload-intent";

function ArticleCard({ href, heroUrl }) {
  const intent = usePreloadIntent(heroUrl);
  // intent = { onMouseEnter, onMouseLeave, onTouchStart, onFocus }
  return <a href={href} {...intent}>...</a>;
}
```

TanStack Router와 동일하게 50ms 지연이 디폴트(실수 hover 필터링). 마우스가 떠나면 취소.

### Viewport — IntersectionObserver

```tsx
import { usePreloadViewport } from "react-preload-intent";

function GalleryItem({ thumbUrl, fullUrl }) {
  const ref = usePreloadViewport<HTMLDivElement>(fullUrl, {
    rootMargin: "200px",
  });
  return <div ref={ref}><img src={thumbUrl} /></div>;
}
```

## Responsive images

`imageSrcSet` / `imageSizes`로 srcset 대응 이미지의 *정확한* variant만 프리로드. `<link rel="preload" as="image">`의 native 속성을 그대로 노출.

```tsx
<Preload
  href="/hero-large.jpg"
  imageSrcSet="/hero-small.jpg 480w, /hero-large.jpg 1200w"
  imageSizes="(max-width: 600px) 480px, 1200px"
/>
```

## ⚠️ Suspense + streaming 함정

`preload()`가 생성하는 `<link>`는 호출 시점의 React render에서 head로 hoist됩니다. 즉:

**위험한 패턴:**

```tsx
<Suspense fallback={<Skeleton />}>
  <SlowComponent>          {/* 여기서 await가 길면... */}
    <Preload href={url} />
    <img src={url} />
  </SlowComponent>
</Suspense>
```

`SlowComponent`의 await 동안 stream이 시작되면, `<Preload>`가 생성한 `<link>`는 HTML stream 끝에 붙어 무의미해집니다.

**해결:** `await` 이전, Suspense boundary 밖에서 호출.

```tsx
<>
  <Preload href={url} />   {/* head에 즉시 hoist됨 */}
  <Suspense fallback={<Skeleton />}>
    <SlowComponent>
      <img src={url} />
    </SlowComponent>
  </Suspense>
</>
```

자세한 분석: [Karuna — Next.js Images, Preloading, and React Suspense](https://karuna.dev/nextjs-preloading-react-suspense/)

## What this library is NOT

이미지 로딩 상태(`loading | loaded | error`)나 dimensions를 추적하거나, Suspense로 페인팅을 막는 hook은 포함하지 않습니다. 그 케이스에는:

- [`react-image`](https://github.com/mbrevda/react-image) — Suspense + fallback 체인
- [`use-image`](https://github.com/konvajs/use-image) — react-konva용 DOM Image element

이 라이브러리는 **언제 프리로드를 트리거할지**만 다룹니다. 위 라이브러리들과 함께 써도 무관 — 책임이 겹치지 않아요.

## Credits

- Trigger taxonomy: [TanStack Router preloading](https://tanstack.com/router/v1/docs/framework/react/guide/preloading)
- Suspense interaction analysis: [Karuna — Next.js Images, Preloading, and React Suspense](https://karuna.dev/nextjs-preloading-react-suspense/)
- Origin: [Alex MacArthur — Your options for preloading images with JavaScript](https://macarthur.me/posts/preloading-images)

## License

MIT
