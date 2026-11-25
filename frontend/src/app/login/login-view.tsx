'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Button,
  Card,
  Checkbox,
  Icon,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { AlertBanner } from '@/components/shared'
import { generateCaptchaCode } from '@/lib/auth/captcha'
import {
  firstInvalidField,
  validateLoginForm,
  type LoginFieldErrors,
  type LoginFormValues,
} from '@/lib/auth/login-validation'
import { authenticate, type AuthFailure } from '@/lib/auth/authenticate'
import { toPersianDigits } from '@/lib/persian'
import { LoginVisualPanel } from './login-visual-panel'
import './login.css'

const BRANCHES = [
  {
    id: 'central',
    label: 'داروخانه مرکزی - انبار شماره ۱ (کاردکس کل)',
  },
  {
    id: 'cold_chain',
    label: 'انبار زنجیره سرد (واکسن و بیولوژیک)',
  },
  {
    id: 'valiasr',
    label: 'واحد توزیع و بالینی شعبه ولیعصر',
  },
  {
    id: 'emergency',
    label: 'ترالی اورژانس و اقلام حیاتی',
  },
] as const

const FIELD_IDS = {
  branchId: 'login-branch',
  username: 'login-username',
  password: 'login-password',
  captcha: 'login-captcha',
} as const

type TouchedMap = Partial<Record<keyof LoginFormValues, boolean>>

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="text-label-sm text-status-critical-fg" role="alert">
      {message}
    </p>
  )
}

function safeNextPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/login')) {
    return null
  }
  return raw
}

export function LoginView() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [values, setValues] = React.useState<LoginFormValues>({
    branchId: 'central',
    username: '',
    password: '',
    captcha: '',
  })
  // Empty until mount — Math.random() in useState causes SSR/client hydration mismatch.
  const [challenge, setChallenge] = React.useState('')
  const [rememberSession, setRememberSession] = React.useState(true)
  const [showPassword, setShowPassword] = React.useState(false)
  const [capsLockOn, setCapsLockOn] = React.useState(false)
  const [touched, setTouched] = React.useState<TouchedMap>({})
  const [submitted, setSubmitted] = React.useState(false)
  const [errors, setErrors] = React.useState<LoginFieldErrors>({})
  const [pending, setPending] = React.useState(false)
  const [authFailure, setAuthFailure] = React.useState<AuthFailure | null>(null)
  const [lockSeconds, setLockSeconds] = React.useState(0)

  const usernameRef = React.useRef<HTMLInputElement>(null)
  const passwordRef = React.useRef<HTMLInputElement>(null)
  const captchaRef = React.useRef<HTMLInputElement>(null)
  const branchTriggerRef = React.useRef<HTMLButtonElement>(null)

  const showFieldError = (field: keyof LoginFormValues) =>
    Boolean((submitted || touched[field]) && errors[field])

  React.useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) setChallenge(generateCaptchaCode())
    })
    return () => {
      active = false
    }
  }, [])

  React.useEffect(() => {
    if (lockSeconds <= 0) return
    const timer = window.setInterval(() => {
      setLockSeconds((prev) => {
        if (prev <= 1) {
          setAuthFailure(null)
          return 0
        }
        const next = prev - 1
        setAuthFailure({
          ok: false,
          code: 'temporary_lock',
          retryAfterSeconds: next,
          message: `ورود موقتاً قفل شده است. ${toPersianDigits(next)} ثانیه دیگر دوباره تلاش کنید.`,
        })
        return next
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [lockSeconds > 0]) // eslint-disable-line react-hooks/exhaustive-deps -- tick only while locked

  function refreshCaptcha() {
    setChallenge(generateCaptchaCode())
    setValues((prev) => ({ ...prev, captcha: '' }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next.captcha
      return next
    })
  }

  function updateField<K extends keyof LoginFormValues>(
    field: K,
    value: LoginFormValues[K],
  ) {
    setValues((prev) => {
      const next = { ...prev, [field]: value }
      if (submitted || touched[field]) {
        setErrors(validateLoginForm(next, challenge))
      }
      return next
    })
  }

  function markTouched(field: keyof LoginFormValues) {
    setTouched((prev) => ({ ...prev, [field]: true }))
    setErrors(validateLoginForm(values, challenge))
  }

  function focusField(field: keyof LoginFormValues) {
    const map = {
      branchId: branchTriggerRef,
      username: usernameRef,
      password: passwordRef,
      captcha: captchaRef,
    } as const
    map[field].current?.focus()
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || lockSeconds > 0) return

    setSubmitted(true)
    const nextErrors = validateLoginForm(values, challenge)
    setErrors(nextErrors)

    const first = firstInvalidField(nextErrors)
    if (first) {
      window.requestAnimationFrame(() => focusField(first))
      return
    }

    setPending(true)
    setAuthFailure(null)
    try {
      const result = await authenticate(
        {
          username: values.username,
          password: values.password,
          branchId: values.branchId,
        },
        { rememberSession },
      )
      if (result.ok) {
        router.push(safeNextPath(searchParams.get('next')) ?? '/dashboard')
        return
      }
      setAuthFailure(result)
      if (result.code === 'temporary_lock') {
        setLockSeconds(result.retryAfterSeconds ?? 30)
      }
      if (
        result.code === 'network_error' ||
        result.code === 'account_locked' ||
        result.code === 'invalid_credentials'
      ) {
        refreshCaptcha()
      }
    } finally {
      setPending(false)
    }
  }

  function onPasswordKey(event: React.KeyboardEvent<HTMLInputElement>) {
    setCapsLockOn(event.getModifierState('CapsLock'))
  }

  const challengeDigits = (
    challenge ? toPersianDigits(challenge) : '····'
  ).split('')
  const formLocked = pending || lockSeconds > 0 || !challenge

  return (
    <div
      data-slot="login-page"
      className="ps-login-mesh relative flex min-h-screen flex-col overflow-x-hidden text-text-primary antialiased"
    >
      <header className="relative z-20 flex items-center justify-between px-margin-mobile py-space-md sm:px-gutter-lg">
        <div className="flex items-center gap-space-sm">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-shell">
            <Icon name="local_pharmacy" size={20} />
          </div>
          <span className="text-title-md font-semibold tracking-tight text-text-primary">
            فارما استاک
          </span>
        </div>
        <div className="hidden items-center gap-space-md text-label-md text-text-secondary sm:flex">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-status-valid-fg" />
            شبکه سلامت
          </span>
          <Link href="#" className="hover:text-primary">
            پشتیبانی
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-margin-mobile py-space-md sm:px-gutter-lg sm:py-space-xl">
        <Card className="grid w-full max-w-6xl gap-0 overflow-hidden rounded-xl border-border-subtle bg-card p-0 shadow-dialog md:grid-cols-[1.05fr_0.95fr] md:items-stretch">
          {/* Form — inline-start in RTL; solid surface avoids blur flash on focus */}
          <section className="relative flex flex-col justify-center bg-card px-space-lg py-space-xl sm:px-space-xl lg:px-12">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-10 -end-px hidden w-px bg-gradient-to-b from-transparent via-border-subtle to-transparent md:block"
            />

            <div className="mx-auto w-full max-w-md space-y-space-lg">
              <div className="space-y-space-sm">
                <p className="inline-flex items-center gap-2 rounded-full bg-primary-tint px-3 py-1 text-label-sm font-medium text-primary">
                  <Icon name="lock" size={14} />
                  ورود امن پرسنل
                </p>
                <h1 className="text-balance text-[1.75rem] font-bold leading-tight tracking-tight text-text-primary sm:text-headline-lg">
                  ورود به انبار دارو
                </h1>
                <p className="text-body-md text-text-secondary">
                  به فضای کاری فارما استاک خوش آمدید — یک ورود برای کل عملیات انبار.
                </p>
              </div>

              <div
                data-slot="login-live"
                className="sr-only"
                aria-live="polite"
                aria-atomic="true"
              >
                {Object.values(errors)
                  .filter(Boolean)
                  .join('، ')}
                {authFailure?.message ?? ''}
              </div>

              {authFailure ? (
                <AlertBanner
                  tone={
                    authFailure.code === 'network_error' ? 'warning' : 'critical'
                  }
                  title={authFailure.message}
                  action={
                    authFailure.canRetry ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => {
                          setAuthFailure(null)
                          const form = document.getElementById(
                            'login-form',
                          ) as HTMLFormElement | null
                          form?.requestSubmit()
                        }}
                      >
                        تلاش مجدد
                      </Button>
                    ) : undefined
                  }
                />
              ) : null}

              <form
                id="login-form"
                className="flex flex-col gap-space-md"
                onSubmit={handleSubmit}
                noValidate
              >
                <div className="flex flex-col gap-space-xs">
                  <Label htmlFor={FIELD_IDS.branchId}>شعبه / واحد انبار</Label>
                  <Select
                    value={values.branchId}
                    onValueChange={(value) => updateField('branchId', value)}
                    disabled={formLocked}
                  >
                    <SelectTrigger
                      ref={branchTriggerRef}
                      id={FIELD_IDS.branchId}
                      aria-invalid={showFieldError('branchId') || undefined}
                      aria-describedby={
                        showFieldError('branchId')
                          ? `${FIELD_IDS.branchId}-error`
                          : undefined
                      }
                      className="h-11 rounded-xl border-border-subtle bg-surface-subtle"
                      onBlur={() => markTouched('branchId')}
                    >
                      <SelectValue placeholder="شعبه را انتخاب کنید" />
                    </SelectTrigger>
                    <SelectContent>
                      {BRANCHES.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError
                    id={`${FIELD_IDS.branchId}-error`}
                    message={
                      showFieldError('branchId') ? errors.branchId : undefined
                    }
                  />
                </div>

                <div className="flex flex-col gap-space-xs">
                  <Label htmlFor={FIELD_IDS.username}>شناسه پرسنلی</Label>
                  <Input
                    ref={usernameRef}
                    id={FIELD_IDS.username}
                    name="username"
                    autoComplete="username"
                    dir="ltr"
                    size="lg"
                    className="h-11 rounded-xl border-border-subtle bg-surface-subtle text-start font-latin"
                    placeholder="personnel id"
                    value={values.username}
                    disabled={formLocked}
                    error={showFieldError('username')}
                    aria-describedby={
                      showFieldError('username')
                        ? `${FIELD_IDS.username}-error`
                        : undefined
                    }
                    onChange={(event) =>
                      updateField('username', event.target.value)
                    }
                    onBlur={() => markTouched('username')}
                  />
                  <FieldError
                    id={`${FIELD_IDS.username}-error`}
                    message={
                      showFieldError('username') ? errors.username : undefined
                    }
                  />
                </div>

                <div className="flex flex-col gap-space-xs">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor={FIELD_IDS.password}>کلمه عبور</Label>
                    <Link
                      href="#"
                      className="text-label-sm font-medium text-primary hover:text-primary-hover"
                    >
                      بازیابی دسترسی
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      ref={passwordRef}
                      id={FIELD_IDS.password}
                      name="password"
                      autoComplete="current-password"
                      type={showPassword ? 'text' : 'password'}
                      dir="ltr"
                      size="lg"
                      className="h-11 rounded-xl border-border-subtle bg-surface-subtle pe-11 text-start font-latin"
                      placeholder="••••••••"
                      value={values.password}
                      disabled={formLocked}
                      error={showFieldError('password')}
                      aria-describedby={
                        [
                          showFieldError('password')
                            ? `${FIELD_IDS.password}-error`
                            : null,
                          capsLockOn ? `${FIELD_IDS.password}-caps` : null,
                        ]
                          .filter(Boolean)
                          .join(' ') || undefined
                      }
                      onChange={(event) =>
                        updateField('password', event.target.value)
                      }
                      onBlur={() => markTouched('password')}
                      onKeyDown={onPasswordKey}
                      onKeyUp={onPasswordKey}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="absolute start-1.5 top-1/2 -translate-y-1/2 text-text-secondary"
                      aria-label={
                        showPassword
                          ? 'پنهان کردن کلمه عبور'
                          : 'نمایش کلمه عبور'
                      }
                      aria-pressed={showPassword}
                      disabled={formLocked}
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      <Icon
                        name={showPassword ? 'visibility_off' : 'visibility'}
                        size={20}
                      />
                    </Button>
                  </div>
                  {capsLockOn ? (
                    <p
                      id={`${FIELD_IDS.password}-caps`}
                      className="text-label-sm text-status-warning-fg"
                      role="status"
                    >
                      Caps Lock روشن است
                    </p>
                  ) : null}
                  <FieldError
                    id={`${FIELD_IDS.password}-error`}
                    message={
                      showFieldError('password') ? errors.password : undefined
                    }
                  />
                </div>

                <div className="flex flex-col gap-space-xs">
                  <Label htmlFor={FIELD_IDS.captcha}>کد اعتبارسنجی</Label>
                  <div className="grid grid-cols-12 items-center gap-space-sm">
                    <div className="relative col-span-5 flex h-11 items-center justify-between overflow-hidden rounded-xl border border-border-subtle bg-surface-muted px-space-sm select-none">
                      <div
                        data-slot="login-captcha-challenge"
                        data-ready={challenge ? 'true' : 'false'}
                        dir="ltr"
                        className="flex items-center gap-1 text-title-md font-semibold tracking-[0.2em] text-text-primary"
                      >
                        {challengeDigits.map((digit, index) => (
                          <span key={`${digit}-${index}`}>{digit}</span>
                        ))}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-text-secondary hover:text-primary"
                        aria-label="تغییر کد امنیتی"
                        disabled={formLocked}
                        onClick={refreshCaptcha}
                      >
                        <Icon name="refresh" size={18} />
                      </Button>
                    </div>
                    <div className="col-span-7">
                      <Input
                        ref={captchaRef}
                        id={FIELD_IDS.captcha}
                        name="captcha"
                        inputMode="numeric"
                        maxLength={4}
                        autoComplete="off"
                        dir="ltr"
                        size="lg"
                        className="h-11 rounded-xl border-border-subtle bg-surface-subtle text-center tabular-nums-data"
                        placeholder="۴ رقم"
                        value={values.captcha}
                        disabled={formLocked}
                        error={showFieldError('captcha')}
                        aria-describedby={
                          showFieldError('captcha')
                            ? `${FIELD_IDS.captcha}-error`
                            : undefined
                        }
                        onChange={(event) =>
                          updateField('captcha', event.target.value)
                        }
                        onBlur={() => markTouched('captcha')}
                      />
                    </div>
                  </div>
                  <FieldError
                    id={`${FIELD_IDS.captcha}-error`}
                    message={
                      showFieldError('captcha') ? errors.captcha : undefined
                    }
                  />
                </div>

                <label className="flex cursor-pointer items-center gap-space-sm select-none">
                  <Checkbox
                    checked={rememberSession}
                    disabled={formLocked}
                    onCheckedChange={(checked) =>
                      setRememberSession(checked === true)
                    }
                    aria-label="ذخیره نشست کاری در پایانه"
                  />
                  <span className="text-label-md text-text-secondary">
                    این دستگاه را به‌خاطر بسپار
                  </span>
                </label>

                <Button
                  type="submit"
                  size="lg"
                  className="ps-login-cta-glow mt-space-xs h-12 w-full rounded-xl text-label-lg"
                  loading={pending}
                  disabled={formLocked}
                >
                  {pending ? (
                    <span>در حال ورود...</span>
                  ) : (
                    <>
                      <span>ادامه به فضای کاری</span>
                      <Icon name="arrow_back" size={18} className="opacity-90" />
                    </>
                  )}
                </Button>
              </form>

              <p className="text-center text-label-sm text-text-muted">
                با ورود، شرایط استفاده را می‌پذیرید · نسخه{' '}
                <span className="tabular-nums-data">
                  {toPersianDigits('2.4.0')}
                </span>
              </p>
            </div>
          </section>

          <LoginVisualPanel />
        </Card>
      </main>
    </div>
  )
}
