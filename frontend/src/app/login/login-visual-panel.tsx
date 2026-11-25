'use client'

import * as React from 'react'
import { Icon } from '@/components/ui'

const LOGIN_VIDEO_SRC = '/videos/login-warehouse.mp4'

/**
 * Marketing stage — illustrated loop video + readable overlay copy.
 * Memoized so form focus/blur re-renders do not remount the media element.
 */
function LoginVisualPanelComponent() {
  const videoRef = React.useRef<HTMLVideoElement>(null)

  React.useEffect(() => {
    const video = videoRef.current
    if (!video) return
    // Browsers may block autoplay until muted play() is called explicitly.
    void video.play().catch(() => undefined)
  }, [])

  return (
    <div
      data-slot="login-visual"
      className="relative isolate flex min-h-[280px] flex-col overflow-hidden bg-[color:var(--ps-p-teal-900)] md:min-h-full"
    >
      <video
        ref={videoRef}
        className="absolute inset-0 size-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden
        tabIndex={-1}
      >
        <source src={LOGIN_VIDEO_SRC} type="video/mp4" />
      </video>

      {/* Readability scrim — keeps Persian copy legible over motion */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-[color-mix(in_srgb,var(--ps-p-slate-900)_82%,transparent)] via-[color-mix(in_srgb,var(--ps-p-teal-900)_45%,transparent)] to-[color-mix(in_srgb,var(--ps-p-teal-900)_25%,transparent)]"
      />

      <div className="relative z-10 flex h-full min-h-[280px] flex-col justify-between gap-space-lg p-space-lg text-white md:min-h-[640px] md:p-space-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-space-sm">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
              <Icon name="local_pharmacy" size={24} />
            </div>
            <div>
              <p className="text-title-md font-semibold tracking-tight">
                فارما استاک
              </p>
              <p className="text-label-sm text-white/70">سامانه انبار دارو</p>
            </div>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-label-sm text-white/85 ring-1 ring-white/20">
            اتصال TTAC
          </span>
        </div>

        <div className="space-y-space-sm">
          <p className="max-w-md text-headline-md font-semibold leading-snug tracking-tight text-white">
            موجودی دقیق، کاردکس شفاف، انبار همیشه تحت کنترل
          </p>
          <p className="max-w-md text-body-md text-white/80">
            ثبت ورود و خروج دارو، هشدار انقضا و ردیابی بچ — همه‌چیز در یک سامانه
            برای تیم داروخانه.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {['ردیابی بچ', 'هشدار انقضا', 'کاردکس لحظه‌ای'].map((chip) => (
              <span
                key={chip}
                className="rounded-full bg-white/10 px-3 py-1 text-label-sm text-white/85 ring-1 ring-white/15"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export const LoginVisualPanel = React.memo(LoginVisualPanelComponent)
