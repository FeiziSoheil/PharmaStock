import type { Metadata } from 'next'
import { DrugCatalogView } from './drug-catalog-view'

export const metadata: Metadata = {
  title: 'کاتالوگ دارو | انبار دارو',
  description: 'کاتالوگ جامع دارو و ثبت اقلام با استعلام تی‌تک',
}

export default function DrugCatalogPage() {
  return <DrugCatalogView />
}
