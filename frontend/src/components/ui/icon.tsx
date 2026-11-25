import type { CSSProperties, HTMLAttributes } from 'react'
import { resolveIcon, type IconName } from '@/lib/icons'
import { cn } from '@/lib/utils'

export interface IconProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Stitch icon name or Material Symbols Outlined ligature name */
  name: IconName
  /** Icon size in pixels (default 20px for dense clinical UI) */
  size?: number
  /** Material Symbols FILL axis (0 = outlined, 1 = filled) */
  filled?: boolean
  /** Material Symbols weight axis (100-700, default 400) */
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700
  /** Optional accessible label; when omitted the icon is decorative (`aria-hidden`) */
  label?: string
}

/**
 * Centralized Material Symbols Outlined icon component using local font assets
 * and Stitch-compatible icon name resolution.
 */
export function Icon({
  name,
  size = 20,
  filled,
  weight = 400,
  label,
  className,
  style,
  ...rest
}: IconProps) {
  const resolved = resolveIcon(name, { filled })
  const fillAxis = resolved.filled ? 1 : 0
  const opsz = size <= 20 ? 20 : size >= 40 ? 40 : 24

  const mergedStyle: CSSProperties = {
    fontSize: `${size}px`,
    width: `${size}px`,
    height: `${size}px`,
    fontVariationSettings: `'FILL' ${fillAxis}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${opsz}`,
    ...style,
  }

  return (
    <span
      {...rest}
      data-icon-requested={resolved.originalName}
      data-icon-resolved={resolved.symbol}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      className={cn(
        'material-symbols-outlined inline-flex items-center justify-center leading-none select-none',
        className,
      )}
      style={mergedStyle}
    >
      {resolved.symbol}
    </span>
  )
}
