;(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

export class MockIntersectionObserver implements IntersectionObserver {
  static instances: MockIntersectionObserver[] = []
  callback: IntersectionObserverCallback
  observed: Element[] = []
  disconnected = false
  root: Element | Document | null
  rootMargin: string
  scrollMargin = '0px'
  thresholds: readonly number[]

  constructor(
    cb: IntersectionObserverCallback,
    opts: IntersectionObserverInit = {},
  ) {
    this.callback = cb
    this.root = (opts.root as Element | Document | null | undefined) ?? null
    this.rootMargin = opts.rootMargin ?? '0px'
    this.thresholds = Array.isArray(opts.threshold)
      ? opts.threshold
      : [opts.threshold ?? 0]
    MockIntersectionObserver.instances.push(this)
  }

  observe(el: Element): void {
    this.observed.push(el)
  }
  unobserve(el: Element): void {
    this.observed = this.observed.filter((e) => e !== el)
  }
  disconnect(): void {
    this.observed = []
    this.disconnected = true
  }
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }

  trigger(isIntersecting: boolean): void {
    const entries = this.observed.map((target) => ({
      target,
      isIntersecting,
      intersectionRatio: isIntersecting ? 1 : 0,
      boundingClientRect: {} as DOMRectReadOnly,
      intersectionRect: {} as DOMRectReadOnly,
      rootBounds: null,
      time: Date.now(),
    }))
    this.callback(
      entries as IntersectionObserverEntry[],
      this as unknown as IntersectionObserver,
    )
  }
}

;(globalThis as unknown as Record<string, unknown>).IntersectionObserver =
  MockIntersectionObserver
