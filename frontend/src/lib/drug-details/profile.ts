import type { Drug } from '@/lib/types/drugs'
import type { DrugDetailProfile } from '@/lib/types/drug-details'

const STORAGE_LABELS: Record<NonNullable<Drug['storageTemp']>, string> = {
  room: 'دمای اتاق (۱۵–۲۵°C)',
  fridge: 'یخچال (۲–۸°C)',
  freezer: 'فریزر (−۲۰°C)',
  light: 'محافظت از نور',
}

/** Build detail profile from a catalog drug row (mock or API). */
export function profileFromDrug(drug: Drug): DrugDetailProfile {
  const isControlled = drug.isControlled
  return {
    drugId: drug.id,
    nameEn: drug.brandName,
    irc: drug.genericCode.slice(0, 10),
    legalClassLabel: isControlled ? 'تحت کنترل' : 'عادی',
    storageLabel: drug.storageTemp
      ? STORAGE_LABELS[drug.storageTemp]
      : STORAGE_LABELS.room,
    fefoEnabled: true,
    rxLabel: isControlled ? 'نسخه ویژه' : 'با نسخه',
    clinicalNotes: [drug.category, `${drug.dosageForm} · ${drug.strength}`],
    logisticsNotes: [
      `سطح سفارش مجدد: ${drug.reorderLevel}`,
      'برچسب قفسه و بارکد را قبل از جابجایی بررسی کنید.',
    ],
    supplierName: drug.manufacturer,
    nameFa: drug.nameFa,
    brandName: drug.brandName,
    manufacturer: drug.manufacturer,
    atcCode: drug.atcCode ?? '',
    gtin: drug.gtin,
    dosageForm: drug.dosageForm,
    strength: drug.strength,
    reorderLevel: drug.reorderLevel,
    isControlled: drug.isControlled,
  }
}
