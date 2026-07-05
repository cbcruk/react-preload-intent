# react-preload-intent

> React 19의 `react-dom/preload()`를 트리거 단위로 노출하는 hooks.

Next.js의 `<Image priority>`가 내부적으로 하는 일 — 적절한 시점에 `ReactDOM.preload()`를 호출해서 `<link rel="preload">`를 head에 넣는 것 — 을 standalone hooks로 분리. 트리거 명명은 [TanStack Router](https://tanstack.com/router/v1/docs/framework/react/guide/preloading)에서 차용.

## Install

```sh
pnpm add react-preload-intent
```

Requires React 19+ (`react-dom/preload` 사용).

## Demo

```sh
pnpm install
pnpm demo
```

4가지 트리거를 인터랙티브하게 발동시켜 볼 수 있는 데모. 우하단 **`<head>` preload
monitor** 패널이 `ReactDOM.preload()`로 주입되는 `<link rel="preload">`를 실시간으로
보여주고, 각 섹션 배지가 해당 이미지의 preload 시점(ms)을 표시 — DevTools 없이 결과물을
바로 확인할 수 있습니다. (`examples/`)

## Triggers

| Trigger      | Hook                      | When                       |
| ------------ | ------------------------- | -------------------------- |
| **render**   | `usePreload`, `<Preload>` | 컴포넌트 렌더 중           |
| **intent**   | `usePreloadIntent`        | hover / touchstart / focus |
| **viewport** | `usePreloadViewport`      | IntersectionObserver       |
| **manual**   | `usePreloadCallback`      | 이벤트 핸들러에서 직접     |

## Usage

### Render

```tsx
import { Preload, usePreload } from 'react-preload-intent'

function ProductPage() {
  usePreload('/hero.jpg')
  // 또는: <Preload href="/hero.jpg" />
  // 또는: usePreload(url, { enabled: modalOpen })
}
```

### Intent — hover / touch / focus

```tsx
import { usePreloadIntent } from 'react-preload-intent'

function ArticleCard({ href, heroUrl }) {
  const intent = usePreloadIntent(heroUrl)
  return (
    <a href={href} {...intent}>
      ...
    </a>
  )
}
```

TanStack Router와 동일하게 50ms 지연이 디폴트(실수 hover 필터). 마우스가 떠나면 취소.

### Viewport — IntersectionObserver

```tsx
import { usePreloadViewport } from 'react-preload-intent'

function GalleryItem({ thumbUrl, fullUrl }) {
  const ref = usePreloadViewport<HTMLDivElement>(fullUrl, {
    rootMargin: '200px',
  })
  return (
    <div ref={ref}>
      <img src={thumbUrl} />
    </div>
  )
}
```

### Manual — 이벤트 핸들러

```tsx
import { usePreloadCallback } from 'react-preload-intent'

function CommentBox() {
  const preload = usePreloadCallback()
  const onPaste = async (e) => {
    const url = await uploadImage(e.clipboardData.files[0])
    preload(url) // submit 시 <img />가 즉시 표시됨
  }
  return <textarea onPaste={onPaste} />
}
```

### Responsive images

`imageSrcSet` / `imageSizes`로 srcset variant 중 *정확히 사용될 것*만 프리로드:

```tsx
<Preload
  href="/hero-large.jpg"
  imageSrcSet="/hero-small.jpg 480w, /hero-large.jpg 1200w"
  imageSizes="(max-width: 600px) 480px, 1200px"
/>
```

## ⚠️ Suspense + streaming 함정

Suspense boundary **안에서** `await` 후 `<Preload>` / `usePreload`를 호출하면, 생성된 `<link>`가 HTML stream 끝에 붙어 무의미해집니다. boundary **밖, await 이전**에 호출하세요.

자세한 설명: [Karuna — Next.js Images, Preloading, and React Suspense](https://karuna.dev/nextjs-preloading-react-suspense/).

## Scope

이미지 **로딩 상태**(`loading | loaded | error`) 추적이나 Suspense 페인팅 제어는 다루지 않습니다. 그쪽은 [`react-image`](https://github.com/mbrevda/react-image) 또는 [`use-image`](https://github.com/konvajs/use-image)와 함께 쓰세요 — 책임이 겹치지 않습니다.

## Credits

- Trigger taxonomy: [TanStack Router preloading](https://tanstack.com/router/v1/docs/framework/react/guide/preloading)
- Origin: [Alex MacArthur — Your options for preloading images with JavaScript](https://macarthur.me/posts/preloading-images)
