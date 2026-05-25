import { test, describe, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";

const preloadSpy = mock.fn<
  (url: string, options: Record<string, unknown>) => void
>();

mock.module("react-dom", {
  namedExports: { preload: preloadSpy },
});

class MockIntersectionObserver implements IntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  observed: Element[] = [];
  disconnected = false;
  root: Element | Document | null;
  rootMargin: string;
  thresholds: readonly number[];

  constructor(
    cb: IntersectionObserverCallback,
    opts: IntersectionObserverInit = {},
  ) {
    this.callback = cb;
    this.root = (opts.root as Element | Document | null | undefined) ?? null;
    this.rootMargin = opts.rootMargin ?? "0px";
    this.thresholds = Array.isArray(opts.threshold)
      ? opts.threshold
      : [opts.threshold ?? 0];
    MockIntersectionObserver.instances.push(this);
  }

  observe(el: Element): void {
    this.observed.push(el);
  }
  unobserve(el: Element): void {
    this.observed = this.observed.filter((e) => e !== el);
  }
  disconnect(): void {
    this.observed = [];
    this.disconnected = true;
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
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
    }));
    this.callback(
      entries as IntersectionObserverEntry[],
      this as unknown as IntersectionObserver,
    );
  }
}

(globalThis as unknown as Record<string, unknown>).IntersectionObserver =
  MockIntersectionObserver;

const { renderHook, render, act, cleanup } = await import(
  "@testing-library/react"
);
const {
  usePreload,
  usePreloadCallback,
  usePreloadIntent,
  usePreloadViewport,
  Preload,
} = await import("../src/index.tsx");

beforeEach(() => {
  preloadSpy.mock.resetCalls();
  MockIntersectionObserver.instances = [];
});

afterEach(() => {
  cleanup();
});

describe("usePreloadCallback (manual trigger)", () => {
  test("returns a stable callback across renders", () => {
    const { result, rerender } = renderHook(() => usePreloadCallback());
    const first = result.current;
    rerender();
    assert.equal(result.current, first);
  });

  test("calls react-dom preload() with as=image and fetchPriority=high by default", () => {
    const { result } = renderHook(() => usePreloadCallback());
    act(() => {
      result.current("/foo.jpg");
    });

    assert.equal(preloadSpy.mock.callCount(), 1);
    const [url, opts] = preloadSpy.mock.calls[0].arguments;
    assert.equal(url, "/foo.jpg");
    assert.equal(opts.as, "image");
    assert.equal(opts.fetchPriority, "high");
  });

  test("passes user-provided options through", () => {
    const { result } = renderHook(() => usePreloadCallback());
    act(() => {
      result.current("/foo.jpg", {
        fetchPriority: "low",
        crossOrigin: "anonymous",
        referrerPolicy: "no-referrer",
      });
    });

    const [, opts] = preloadSpy.mock.calls[0].arguments;
    assert.equal(opts.fetchPriority, "low");
    assert.equal(opts.crossOrigin, "anonymous");
    assert.equal(opts.referrerPolicy, "no-referrer");
  });
});

describe("usePreload / <Preload> (render trigger)", () => {
  test("usePreload calls preload on render", () => {
    renderHook(() => usePreload("/hero.jpg"));
    assert.equal(preloadSpy.mock.callCount(), 1);
    assert.equal(preloadSpy.mock.calls[0].arguments[0], "/hero.jpg");
  });

  test("usePreload skips when enabled=false", () => {
    renderHook(() => usePreload("/hero.jpg", { enabled: false }));
    assert.equal(preloadSpy.mock.callCount(), 0);
  });

  test("usePreload fires when enabled flips from false to true", () => {
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        usePreload("/hero.jpg", { enabled }),
      { initialProps: { enabled: false } },
    );
    assert.equal(preloadSpy.mock.callCount(), 0);
    rerender({ enabled: true });
    assert.equal(preloadSpy.mock.callCount(), 1);
  });

  test("usePreload skips when url is nullish", () => {
    renderHook(() => usePreload(null));
    renderHook(() => usePreload(undefined));
    assert.equal(preloadSpy.mock.callCount(), 0);
  });

  test("<Preload> renders null and triggers preload", () => {
    const { container } = render(<Preload href="/hero.jpg" />);
    assert.equal(container.innerHTML, "");
    assert.equal(preloadSpy.mock.callCount(), 1);
    assert.equal(preloadSpy.mock.calls[0].arguments[0], "/hero.jpg");
  });
});

describe("usePreloadIntent (hover / touch / focus trigger)", () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ["setTimeout"] });
  });
  afterEach(() => {
    mock.timers.reset();
  });

  test("triggers preload 50ms after onMouseEnter", () => {
    const { result } = renderHook(() => usePreloadIntent("/hero.jpg"));
    act(() => {
      result.current.onMouseEnter();
    });
    assert.equal(preloadSpy.mock.callCount(), 0);
    act(() => {
      mock.timers.tick(50);
    });
    assert.equal(preloadSpy.mock.callCount(), 1);
    assert.equal(preloadSpy.mock.calls[0].arguments[0], "/hero.jpg");
  });

  test("cancels pending preload on onMouseLeave within delay window", () => {
    const { result } = renderHook(() => usePreloadIntent("/hero.jpg"));
    act(() => {
      result.current.onMouseEnter();
    });
    act(() => {
      result.current.onMouseLeave();
    });
    act(() => {
      mock.timers.tick(100);
    });
    assert.equal(preloadSpy.mock.callCount(), 0);
  });

  test("dedupes — same url only triggers once across multiple hovers", () => {
    const { result } = renderHook(() => usePreloadIntent("/hero.jpg"));
    act(() => {
      result.current.onMouseEnter();
    });
    act(() => {
      mock.timers.tick(50);
    });
    act(() => {
      result.current.onMouseLeave();
    });
    act(() => {
      result.current.onMouseEnter();
    });
    act(() => {
      mock.timers.tick(50);
    });
    assert.equal(preloadSpy.mock.callCount(), 1);
  });

  test("respects custom delay option", () => {
    const { result } = renderHook(() =>
      usePreloadIntent("/hero.jpg", { delay: 200 }),
    );
    act(() => {
      result.current.onMouseEnter();
    });
    act(() => {
      mock.timers.tick(199);
    });
    assert.equal(preloadSpy.mock.callCount(), 0);
    act(() => {
      mock.timers.tick(1);
    });
    assert.equal(preloadSpy.mock.callCount(), 1);
  });

  test("onTouchStart and onFocus also trigger after delay", () => {
    const touch = renderHook(() => usePreloadIntent("/a.jpg"));
    act(() => {
      touch.result.current.onTouchStart();
    });
    act(() => {
      mock.timers.tick(50);
    });
    assert.equal(preloadSpy.mock.callCount(), 1);

    const focus = renderHook(() => usePreloadIntent("/b.jpg"));
    act(() => {
      focus.result.current.onFocus();
    });
    act(() => {
      mock.timers.tick(50);
    });
    assert.equal(preloadSpy.mock.callCount(), 2);
  });

  test("unmount clears pending timer (no leak, no late call)", () => {
    const { result, unmount } = renderHook(() => usePreloadIntent("/x.jpg"));
    act(() => {
      result.current.onMouseEnter();
    });
    unmount();
    act(() => {
      mock.timers.tick(50);
    });
    assert.equal(preloadSpy.mock.callCount(), 0);
  });
});

describe("usePreloadViewport (IntersectionObserver trigger)", () => {
  test("registers an IntersectionObserver with default rootMargin=200px", () => {
    function Box(): React.ReactNode {
      const ref = usePreloadViewport<HTMLDivElement>("/hero.jpg");
      return <div ref={ref} />;
    }
    render(<Box />);
    assert.equal(MockIntersectionObserver.instances.length, 1);
    assert.equal(MockIntersectionObserver.instances[0].rootMargin, "200px");
  });

  test("triggers preload when entry becomes intersecting", () => {
    function Box(): React.ReactNode {
      const ref = usePreloadViewport<HTMLDivElement>("/hero.jpg");
      return <div ref={ref} />;
    }
    render(<Box />);
    assert.equal(preloadSpy.mock.callCount(), 0);
    act(() => {
      MockIntersectionObserver.instances[0].trigger(true);
    });
    assert.equal(preloadSpy.mock.callCount(), 1);
    assert.equal(preloadSpy.mock.calls[0].arguments[0], "/hero.jpg");
  });

  test("does not trigger when not intersecting", () => {
    function Box(): React.ReactNode {
      const ref = usePreloadViewport<HTMLDivElement>("/hero.jpg");
      return <div ref={ref} />;
    }
    render(<Box />);
    act(() => {
      MockIntersectionObserver.instances[0].trigger(false);
    });
    assert.equal(preloadSpy.mock.callCount(), 0);
  });

  test("disconnects observer after first intersecting trigger (dedup)", () => {
    function Box(): React.ReactNode {
      const ref = usePreloadViewport<HTMLDivElement>("/hero.jpg");
      return <div ref={ref} />;
    }
    render(<Box />);
    const observer = MockIntersectionObserver.instances[0];
    act(() => {
      observer.trigger(true);
    });
    assert.equal(observer.disconnected, true);
  });

  test("threshold array does not re-create observer on each render (deps stability)", () => {
    function Box(): React.ReactNode {
      const ref = usePreloadViewport<HTMLDivElement>("/hero.jpg", {
        threshold: [0, 0.5, 1],
      });
      return <div ref={ref} />;
    }
    const { rerender } = render(<Box />);
    rerender(<Box />);
    rerender(<Box />);
    assert.equal(MockIntersectionObserver.instances.length, 1);
  });
});

describe("native preload options forwarded to react-dom", () => {
  test("imageSrcSet, imageSizes, crossOrigin, referrerPolicy reach preload()", () => {
    render(
      <Preload
        href="/hero.jpg"
        imageSrcSet="/s.jpg 1x, /l.jpg 2x"
        imageSizes="100vw"
        crossOrigin="anonymous"
        referrerPolicy="no-referrer"
      />,
    );
    assert.equal(preloadSpy.mock.callCount(), 1);
    const [url, opts] = preloadSpy.mock.calls[0].arguments;
    assert.equal(url, "/hero.jpg");
    assert.equal(opts.as, "image");
    assert.equal(opts.imageSrcSet, "/s.jpg 1x, /l.jpg 2x");
    assert.equal(opts.imageSizes, "100vw");
    assert.equal(opts.crossOrigin, "anonymous");
    assert.equal(opts.referrerPolicy, "no-referrer");
  });
});
