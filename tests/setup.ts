import { JSDOM } from "jsdom";

const dom = new JSDOM("<!DOCTYPE html><html><head></head><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});

const g = globalThis as unknown as Record<string, unknown>;

g.window = dom.window;
g.document = dom.window.document;
g.navigator = dom.window.navigator;
g.HTMLElement = dom.window.HTMLElement;
g.HTMLDivElement = dom.window.HTMLDivElement;
g.HTMLAnchorElement = dom.window.HTMLAnchorElement;
g.HTMLImageElement = dom.window.HTMLImageElement;
g.Element = dom.window.Element;
g.Node = dom.window.Node;
g.Event = dom.window.Event;
g.MouseEvent = dom.window.MouseEvent;
g.TouchEvent = dom.window.TouchEvent ?? dom.window.Event;
g.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
g.requestAnimationFrame = (cb: FrameRequestCallback): number =>
  setTimeout(() => cb(performance.now()), 16) as unknown as number;
g.cancelAnimationFrame = (id: number): void => clearTimeout(id);

g.IS_REACT_ACT_ENVIRONMENT = true;
