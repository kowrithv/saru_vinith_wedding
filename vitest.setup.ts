import '@testing-library/jest-dom/vitest'

// jsdom hat kein IntersectionObserver - wird von framer-motions
// whileInView/viewport-Features (z.B. auf der Story-Seite) gebraucht.
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}

// @ts-expect-error - nur ein minimaler Test-Stub, keine echte Implementierung
globalThis.IntersectionObserver = IntersectionObserverStub
