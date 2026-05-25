import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import {
  ArticleCard,
  CommentBox,
  GalleryItem,
  ProductPage,
  ProductThumbnail,
  ResponsiveHero,
} from './examples'

const HERO_INTENT = 'https://picsum.photos/seed/hero-intent/1200/600'
const HERO_RENDER = 'https://picsum.photos/seed/hero-render/1200/600'
const THUMB = 'https://picsum.photos/seed/thumb/200/200'
const FULL_VIEWPORT = 'https://picsum.photos/seed/viewport/1600/900'
const FULL_COND = 'https://picsum.photos/seed/conditional/1600/900'

const fakeUpload = async (file: File): Promise<string> =>
  URL.createObjectURL(file)

function Section({
  id,
  title,
  hint,
  children,
}: {
  id: string
  title: string
  hint: string
  children: React.ReactNode
}): React.ReactNode {
  return (
    <section
      id={id}
      style={{
        marginBlock: 32,
        padding: 16,
        border: '1px solid #ddd',
        borderRadius: 8,
      }}
    >
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <p style={{ color: '#666', fontSize: 14, marginTop: 4 }}>{hint}</p>
      <div style={{ padding: 12, background: '#fafafa', borderRadius: 4 }}>
        {children}
      </div>
    </section>
  )
}

function App(): React.ReactNode {
  return (
    <div
      style={{
        maxWidth: 800,
        margin: '0 auto',
        padding: 24,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        lineHeight: 1.5,
      }}
    >
      <h1>react-preload-intent demo</h1>
      <p>
        DevTools <strong>Elements → &lt;head&gt;</strong>에{' '}
        <code>&lt;link rel="preload" as="image"&gt;</code> 가 추가되는지,{' '}
        <strong>Network</strong> 탭에 이미지 요청이 뜨는지 확인하세요. (Network
        탭의 Initiator 컬럼이 <code>Preload</code>면 정상.)
      </p>

      <Section
        id="render"
        title="1. Render trigger — <ProductPage>"
        hint="마운트 즉시 <head>에 hero preload가 박힘. 페이지 로드 후 head 확인."
      >
        <ProductPage productId="demo" />
        <small>
          (productId만 받음. 실제 hero src는 placeholder 경로라 404일 수 있음 —
          head에 link만 확인.)
        </small>
      </Section>

      <Section
        id="responsive"
        title="2. Render trigger + srcset — <ResponsiveHero>"
        hint="imageSrcSet/imageSizes로 viewport에 맞는 variant만 preload."
      >
        <ResponsiveHero />
      </Section>

      <Section
        id="intent"
        title="3. Intent trigger — <ArticleCard>"
        hint="아래 링크에 50ms 이상 hover → preload. 빠르게 떼면 트리거되지 않음."
      >
        <ArticleCard
          href="#intent"
          heroImageUrl={HERO_INTENT}
          title="hover me (50ms+)"
        />
      </Section>

      <Section
        id="conditional"
        title="4. 응용 — <ProductThumbnail> (조건부)"
        hint="hover 또는 클릭 시점에만 풀 사이즈 preload."
      >
        <ProductThumbnail thumbnailUrl={THUMB} fullSizeUrl={FULL_COND} />
      </Section>

      <Section
        id="manual"
        title="5. Manual trigger — <CommentBox>"
        hint="textarea에 이미지 클립보드 붙여넣기 → object URL을 preload + 표시. (로컬 URL이라 네트워크 요청은 없지만 link rel=preload는 head에 들어감.)"
      >
        <CommentBox uploadImage={fakeUpload} />
      </Section>

      <div
        style={{
          height: '120vh',
          color: '#bbb',
          textAlign: 'center',
          paddingTop: 60,
        }}
      >
        ↓ 다음 viewport 데모를 보려면 스크롤 ↓
      </div>

      <Section
        id="viewport"
        title="6. Viewport trigger — <GalleryItem>"
        hint="viewport 200px 이내로 진입 시 풀 사이즈 preload. Network 탭에서 스크롤 직전에 요청이 발생."
      >
        <GalleryItem thumbnailUrl={THUMB} fullSizeUrl={FULL_VIEWPORT} />
      </Section>

      <div style={{ height: '30vh' }} />

      <Section
        id="hero-render-ref"
        title="(참고) HERO_RENDER 변수의 실제 이미지"
        hint="위에서 preload 된 ProductPage hero가 placeholder가 아닌 실제 이미지였다면 이렇게 보임."
      >
        <img src={HERO_RENDER} alt="" style={{ maxWidth: '100%' }} />
      </Section>
    </div>
  )
}

const root = document.getElementById('root')
if (!root) throw new Error('#root element not found')
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
