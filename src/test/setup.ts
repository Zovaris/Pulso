import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});

if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

const silent = () => Promise.resolve();

Element.prototype.animate = (() => ({
  finished: silent(),
  cancel: () => {},
  addEventListener: () => {},
  playState: "finished",
})) as unknown as typeof Element.prototype.animate;

Element.prototype.getAnimations =
  (() => []) as typeof Element.prototype.getAnimations;

Element.prototype.scrollIntoView =
  (() => {}) as typeof Element.prototype.scrollIntoView;
