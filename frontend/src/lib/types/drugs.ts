export const DOSAGE_FORMS = [
  'قرص',
  'کپسول',
  'شربت',
  'آمپول',
  'ویال',
  'قلم تزریقی',
  'پماد',
  'قطره',
  'سرم',
] as const

export const DRUG_CATEGORIES = [
  'آنتی‌بیوتیک و ضدباکتری',
  'قلب و عروق',
  'دستگاه گوارش',
  'اعصاب و روان',
  'دیابت و غدد',
  'مسکن و ضدالتهاب',
  'تنفس و آلرژی',
  'ویتامین و مکمل',
  'تحت کنترل / مخدر',
] as const

export type DosageForm = (typeof DOSAGE_FORMS)[number]
export type DrugCategory = (typeof DRUG_CATEGORIES)[number]

export type Drug = {
  id: string
  nameFa: string
  brandName: string
  dosageForm: DosageForm
  strength: string
  gtin: string
  genericCode: string
  manufacturer: string
  category: DrugCategory
  isControlled: boolean
  totalStock: number
  reorderLevel: number
  /** ISO calendar date (YYYY-MM-DD). */
  nearestExpiry: string
  atcCode?: string
  storageTemp?: 'room' | 'fridge' | 'freezer' | 'light'
}

export type TtacProduct = {
  nameFa: string
  brandName: string
  dosageForm: DosageForm | ''
  strength: string
  gtin: string
  genericCode: string
  manufacturer: string
  atcCode: string
  licenseExpiry: string
  category: DrugCategory | ''
  irc?: string
  statusStr?: string
  packageConsumerPrice?: number
  fromCache?: boolean
}

export type TtacSearchHit = {
  irc: string
  gtin: string
  nameFa: string
  brandName: string
  manufacturer: string
  status: number
  statusStr: string
  packageConsumerPrice?: number
}

export type TtacLookupState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'found'; product: TtacProduct }
  | { status: 'not_found' }
  | { status: 'error'; message: string }
