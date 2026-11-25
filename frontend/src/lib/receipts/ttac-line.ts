import type { TtacProduct } from '@/lib/types/drugs'

export function ttacProductToLinePatch(product: TtacProduct): {
  gtin: string
  irc: string
  nameFa: string
} {
  return {
    gtin: product.gtin.trim(),
    irc: (product.irc ?? '').trim(),
    nameFa: product.nameFa.trim(),
  }
}
