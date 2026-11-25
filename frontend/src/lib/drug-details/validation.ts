export type AddBatchInput = {
  batchNo: string
  productionISO: string
  expiryISO: string
  quantity: number
  buyPriceRial: number
  consumerPriceRial: number
  locationLabel: string
  supplierLabel: string
}

export type CatalogEditInput = {
  nameFa: string
  brandName: string
  manufacturer: string
  atcCode: string
  gtin: string
  dosageForm: string
  strength: string
  reorderLevel: number
  isControlled: boolean
}

export type ShelfMoveInput = {
  locationLabel: string
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: Record<string, string> }

function trim(value: string): string {
  return value.trim()
}

export function validateAddBatch(
  input: AddBatchInput,
): ValidationResult<AddBatchInput> {
  const errors: Record<string, string> = {}

  const batchNo = trim(input.batchNo)
  if (!batchNo) {
    errors.batchNo = 'شماره سری ساخت الزامی است.'
  }

  const productionISO = trim(input.productionISO)
  const expiryISO = trim(input.expiryISO)
  if (!expiryISO) {
    errors.expiryISO = 'تاریخ انقضا الزامی است.'
  }

  if (
    !errors.expiryISO &&
    productionISO &&
    expiryISO &&
    expiryISO < productionISO
  ) {
    errors.expiryISO = 'تاریخ انقضا نمی‌تواند قبل از تاریخ تولید باشد.'
  }

  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    errors.quantity = 'تعداد باید بزرگ‌تر از صفر باشد.'
  }

  if (!Number.isFinite(input.buyPriceRial) || input.buyPriceRial < 0) {
    errors.buyPriceRial = 'قیمت خرید نامعتبر است.'
  }

  if (!Number.isFinite(input.consumerPriceRial) || input.consumerPriceRial < 0) {
    errors.consumerPriceRial = 'قیمت مصرف‌کننده نامعتبر است.'
  }

  const locationLabel = trim(input.locationLabel)
  if (!locationLabel) {
    errors.locationLabel = 'محل نگهداری الزامی است.'
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    value: {
      batchNo,
      productionISO,
      expiryISO,
      quantity: input.quantity,
      buyPriceRial: input.buyPriceRial,
      consumerPriceRial: input.consumerPriceRial,
      locationLabel,
      supplierLabel: trim(input.supplierLabel),
    },
  }
}

export function validateCatalogEdit(
  input: CatalogEditInput,
): ValidationResult<CatalogEditInput> {
  const errors: Record<string, string> = {}

  const nameFa = trim(input.nameFa)
  if (!nameFa) {
    errors.nameFa = 'نام فارسی دارو الزامی است.'
  }

  if (!Number.isFinite(input.reorderLevel) || input.reorderLevel < 0) {
    errors.reorderLevel = 'سطح سفارش مجدد نامعتبر است.'
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    value: {
      nameFa,
      brandName: trim(input.brandName),
      manufacturer: trim(input.manufacturer),
      atcCode: trim(input.atcCode),
      gtin: trim(input.gtin),
      dosageForm: trim(input.dosageForm),
      strength: trim(input.strength),
      reorderLevel: input.reorderLevel,
      isControlled: Boolean(input.isControlled),
    },
  }
}

export function validateShelfMove(
  input: ShelfMoveInput,
): ValidationResult<ShelfMoveInput> {
  const errors: Record<string, string> = {}
  const locationLabel = trim(input.locationLabel)
  if (!locationLabel) {
    errors.locationLabel = 'محل قفسه الزامی است.'
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  return { ok: true, value: { locationLabel } }
}
