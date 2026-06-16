import type { ProductType, ShipmentType } from '~/types/accounting'

const normalizeProductText = (value: unknown) => (typeof value === 'string' ? value.trim().toLowerCase() : '')

export const getProductTypeFromText = (value: unknown): ProductType | null => {
  const normalizedValue = normalizeProductText(value)

  if (!normalizedValue) {
    return null
  }

  if (normalizedValue.includes('mel')) {
    return 'Mel'
  }

  if (normalizedValue.includes('qum')) {
    return 'Qum'
  }

  return null
}

export const isBulkAllowedForProduct = (_value: unknown) => false

export const normalizeBulkOutputTons = (_productType: unknown, _bulkOutputTons: number) =>
  0

export const normalizeShipmentTypeForProduct = (_productName: unknown, _shipmentType: ShipmentType): ShipmentType =>
  'qoplik'
