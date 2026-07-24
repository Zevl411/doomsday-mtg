import { afterEach, beforeEach, vi } from 'vitest';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const visualViewportStub = {
  width: 1024,
  height: 768,
  offsetLeft: 0,
  offsetTop: 0,
  addEventListener() {},
  removeEventListener() {},
};

vi.stubGlobal('ResizeObserver', ResizeObserverStub);
vi.stubGlobal('visualViewport', visualViewportStub);

beforeEach(() => {
  if (typeof localStorage.clear === 'function') {
    localStorage.clear();
  }
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  vi.stubGlobal('visualViewport', visualViewportStub);

  if (typeof localStorage.clear === 'function') {
    localStorage.clear();
  }
});
