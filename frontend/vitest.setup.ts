import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Auto-unmount React trees after each test (RTL auto-cleanup requires globals).
afterEach(() => {
  cleanup()
})

/**
 * jsdom lacks browser APIs that Radix UI relies on for positioning and
 * pointer handling. Stub them so overlay components (Select, Tooltip,
 * Dialog, Sheet) can mount and respond to keyboard interaction in tests.
 */
if (typeof window !== 'undefined') {
  if (!window.ResizeObserver) {
    class ResizeObserverStub implements ResizeObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    window.ResizeObserver = ResizeObserverStub
  }

  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function scrollIntoViewStub(): void {}
  }

  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = function hasPointerCaptureStub(): boolean {
      return false
    }
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = function setPointerCaptureStub(): void {}
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = function releasePointerCaptureStub(): void {}
  }
}
