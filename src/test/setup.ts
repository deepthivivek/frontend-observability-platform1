import '@testing-library/jest-dom/vitest';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverMock;
}

if (typeof window !== 'undefined' && typeof window.ResizeObserver === 'undefined') {
  window.ResizeObserver = ResizeObserverMock;
}
