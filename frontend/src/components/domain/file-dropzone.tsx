'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

export type FileDropzoneProps = {
  accept?: string
  multiple?: boolean
  maxSizeBytes?: number
  disabled?: boolean
  busy?: boolean
  title?: string
  hint?: string
  files?: File[]
  error?: string | null
  onFilesSelected?: (files: File[]) => void
  onFileRemove?: (index: number) => void
  className?: string
}

const DEFAULT_TITLE = 'بارگذاری فایل'
const DEFAULT_HINT =
  'فایل را بکشید و رها کنید یا برای انتخاب کلیک کنید / Enter بزنید'

function parseAcceptTokens(accept?: string): string[] {
  if (!accept?.trim()) return []
  return accept
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
}

function fileMatchesAccept(file: File, acceptTokens: string[]): boolean {
  if (acceptTokens.length === 0) return true

  const name = file.name.toLowerCase()
  const type = (file.type || '').toLowerCase()

  return acceptTokens.some((token) => {
    if (token.startsWith('.')) {
      return name.endsWith(token)
    }
    if (token.endsWith('/*')) {
      const prefix = token.slice(0, -1)
      return type.startsWith(prefix)
    }
    return type === token
  })
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Client-only file picker / drop zone. Emits selected File[] via callbacks;
 * does not upload or call APIs.
 */
function FileDropzone({
  accept,
  multiple = false,
  maxSizeBytes,
  disabled = false,
  busy = false,
  title = DEFAULT_TITLE,
  hint = DEFAULT_HINT,
  files = [],
  error = null,
  onFilesSelected,
  onFileRemove,
  className,
}: FileDropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const hintId = React.useId()
  const errorId = React.useId()
  const [isDragging, setIsDragging] = React.useState(false)
  const [localError, setLocalError] = React.useState<string | null>(null)

  const isInactive = disabled || busy
  const displayedError = error ?? localError
  const acceptTokens = React.useMemo(() => parseAcceptTokens(accept), [accept])

  const openPicker = React.useCallback(() => {
    if (isInactive) return
    inputRef.current?.click()
  }, [isInactive])

  const validateAndEmit = React.useCallback(
    (incoming: FileList | File[] | null) => {
      if (!incoming || isInactive) return

      const list = Array.from(incoming)
      if (list.length === 0) return

      const candidates = multiple ? list : list.slice(0, 1)
      const valid: File[] = []
      const messages: string[] = []

      for (const file of candidates) {
        if (!fileMatchesAccept(file, acceptTokens)) {
          messages.push(`نوع فایل «${file.name}» مجاز نیست.`)
          continue
        }
        if (typeof maxSizeBytes === 'number' && file.size > maxSizeBytes) {
          messages.push(
            `حجم «${file.name}» از حد مجاز (${formatBytes(maxSizeBytes)}) بیشتر است.`,
          )
          continue
        }
        valid.push(file)
      }

      if (messages.length > 0) {
        setLocalError(messages[0] ?? null)
      } else {
        setLocalError(null)
      }

      if (valid.length > 0) {
        onFilesSelected?.(valid)
      }
    },
    [acceptTokens, isInactive, maxSizeBytes, multiple, onFilesSelected],
  )

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    validateAndEmit(event.target.files)
    // Allow selecting the same file again
    event.target.value = ''
  }

  const handleDragEnter = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (isInactive) return
    setIsDragging(true)
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (isInactive) return
    setIsDragging(true)
  }

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return
    }
    setIsDragging(false)
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)
    if (isInactive) return
    validateAndEmit(event.dataTransfer.files)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isInactive) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openPicker()
    }
  }

  const selectedAnnouncement =
    files.length === 0
      ? 'هیچ فایلی انتخاب نشده است.'
      : `${files.length} فایل انتخاب شده: ${files.map((f) => f.name).join('، ')}`

  return (
    <div
      data-slot="file-dropzone"
      className={cn('flex w-full flex-col gap-3', className)}
    >
      <div
        role="button"
        tabIndex={isInactive ? -1 : 0}
        aria-disabled={isInactive || undefined}
        aria-busy={busy || undefined}
        aria-label={title}
        aria-describedby={
          displayedError ? `${hintId} ${errorId}` : hintId
        }
        data-dragging={isDragging ? 'true' : undefined}
        data-disabled={isInactive ? 'true' : undefined}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-3',
          'rounded-default border-2 border-dashed px-4 py-8 sm:px-6 sm:py-10 md:px-8',
          'bg-surface text-center transition-[border-color,background-color,box-shadow]',
          'outline-none focus-visible:border-primary focus-visible:shadow-focus',
          isDragging && !isInactive
            ? 'border-primary bg-primary-tint'
            : 'border-border-default hover:border-border-strong hover:bg-surface-hover',
          isInactive && 'pointer-events-none cursor-not-allowed opacity-50',
          !isInactive && 'cursor-pointer',
          displayedError && 'border-status-critical-border',
        )}
        onClick={openPicker}
        onKeyDown={handleKeyDown}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span className="flex size-12 items-center justify-center rounded-default bg-primary-tint text-primary">
          <Icon name="move_up" size={28} data-slot="icon" />
        </span>

        <div className="flex max-w-md flex-col gap-1">
          <p className="text-title-sm font-semibold text-text-primary">{title}</p>
          <p id={hintId} className="text-body-sm text-text-secondary">
            {hint}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isInactive}
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation()
            openPicker()
          }}
        >
          <Icon name="post_add" size={16} data-slot="icon" />
          انتخاب فایل
        </Button>

        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          tabIndex={-1}
          accept={accept}
          multiple={multiple}
          disabled={isInactive}
          aria-hidden
          onChange={handleInputChange}
        />
      </div>

      {busy ? (
        <div className="flex flex-col gap-2" aria-live="polite">
          <p className="text-body-sm text-text-secondary">در حال پردازش فایل…</p>
          <Progress value={68} aria-label="پیشرفت بارگذاری فایل" />
        </div>
      ) : null}

      {displayedError ? (
        <p
          id={errorId}
          role="alert"
          className="text-body-sm text-status-critical-fg"
          data-slot="file-dropzone-error"
        >
          {displayedError}
        </p>
      ) : null}

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {selectedAnnouncement}
      </div>

      {files.length > 0 ? (
        <ul
          className="flex flex-col gap-2"
          aria-label="فایل‌های انتخاب‌شده"
          data-slot="file-dropzone-list"
        >
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
              className={cn(
                'flex items-center gap-3 rounded-default border border-border-default',
                'bg-surface px-3 py-2',
              )}
            >
              <Icon
                name="description"
                size={20}
                className="shrink-0 text-primary"
                data-slot="icon"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-start">
                <span className="truncate text-body-sm text-text-primary" dir="auto">
                  {file.name}
                </span>
                <span className="text-label-sm text-text-secondary" dir="ltr">
                  {formatBytes(file.size)}
                </span>
              </div>
              <Icon
                name="check_circle"
                size={16}
                className="shrink-0 text-status-valid-fg"
                data-slot="icon"
              />
              {onFileRemove ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={isInactive}
                  aria-label={`حذف ${file.name}`}
                  onClick={() => onFileRemove(index)}
                >
                  <Icon name="close" size={16} data-slot="icon" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export { FileDropzone }
