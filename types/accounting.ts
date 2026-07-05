import type { UserRole } from '~/types/auth'

export type FactoryName = 'Tepa shpaklevka' | 'Tepa kraska' | 'Past shpaklevka' | 'Past kraska'
export type ProductType = 'Kraska' | 'Mel'
export type VehicleType = 'Howo' | 'Kamaz'
export type SupplyMaterialType = 'stone' | 'bag'
export type BagType = 'xira' | 'oq'
export type ShipmentType = 'qoplik'
export type PaymentStatus = 'tolangan' | 'qisman' | 'qarzdor' | 'avans'
export type BalanceType = 'bizga_qarz' | 'bizdan_qarz' | 'yopilgan'
export type ContactType = 'client' | 'supplier'
export type ExpenseCategory =
  | 'Ishchi'
  | 'Ovqat'
  | 'Svet'
  | 'Qo‘shimcha xarajat'
  | 'Yuklash'
  | 'Tosh'
  | 'Xira qop'
  | 'Oq qop'
  | 'Zavod qarzi'
  | 'Soliq'
  | 'Boshqa'
export type PaymentMethod = 'Naqd' | 'Click' | 'Prichesleniya'
export type ReminderFrequency = 'daily' | 'every_2_days'
export type MonthlyArchiveSection = 'income' | 'expense' | 'note'
export type ArchiveFactoryScope = FactoryName | 'combined'
export type ScaleDirection = 'kirim' | 'chiqim' | 'unknown'
export type ScaleCashType = 'kirim' | 'chiqim'
export type AuditAction = 'add' | 'update' | 'delete'

export interface AuditLogRecord {
  id: string
  createdAt: string
  actorId: string
  actorName: string
  actorUsername: string
  actorRole: UserRole
  section: string
  entityType: string
  action: AuditAction
  recordId: string
  summary: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}

export interface CostProfile {
  sandPricePerTon: number
  chalkPricePerTon: number
  sandWorkerCostPerTon: number
  chalkWorkerCostPerTon: number
  marketCostPerTon: number
  loadingCostPerTon: number
  foodCostPerTon: number
  supervisorCostPerTon: number
  electricityCostPerTon: number
  stoneCostPerTon: number
  xiraBagCostPerTon: number
  oqBagCostPerTon: number
}

export interface DailyFactoryRecord extends CostProfile {
  id: string
  date: string
  factory: FactoryName
  productType: ProductType
  bagType: BagType
  incomingStoneTons: number
  usedStoneTons: number
  baggedOutputTons: number
  bulkOutputTons: number
  newBagCount: number
  oldBagCount: number
  notes: string
}

export interface IncomingLoadRecord {
  id: string
  date: string
  factory: FactoryName | ''
  materialType: SupplyMaterialType
  bagType: BagType
  vehicleType: VehicleType
  tons: number
  bagCount: number
  supplier: string
  pricePerTon: number
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  paymentStatus: PaymentStatus
  notes: string
}

export interface SaleRecord {
  id: string
  date: string
  time: string
  factory: FactoryName
  clientName: string
  productName: string
  shipmentType: ShipmentType
  tons: number
  pricePerTon: number
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  advanceAmount: number
  balanceAmount: number
  balanceType: BalanceType
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod
  notes: string
}

export interface PaymentRecord {
  id: string
  date: string
  factory: FactoryName
  clientName: string
  amount: number
  paymentMethod: PaymentMethod
  saleId: string
  saleDate: string
  notes: string
}

export interface BarterRecord {
  id: string
  date: string
  supplierName: string
  clientName: string
  productName: ProductType
  tons: number
  pricePerTon: number
  amount: number
  notes: string
}

export interface ManualDebtRecord {
  id: string
  date: string
  factory: FactoryName
  clientName: string
  amount: number
  paidAmount: number
  remainingAmount: number
  notes: string
}

export interface ContactRecord {
  id: string
  type: ContactType
  name: string
  phone: string
  notes: string
  createdAt: string
}

export interface ClientSummary {
  clientName: string
  totalTons: number
  totalRevenue: number
  averagePricePerTon: number
  totalDebt: number
  totalAdvance: number
  totalBarter: number
  balanceType: BalanceType
  balanceAmount: number
  lastPurchaseDate: string
  lastFactory: FactoryName
}

export interface OperationalExpense {
  id: string
  date: string
  factory: FactoryName | ''
  category: ExpenseCategory
  description: string
  amount: number
  paymentMethod: PaymentMethod
  materialType: SupplyMaterialType | ''
  bagType: BagType | ''
  materialQuantity: number
  notes: string
}

export interface DebtorSummary {
  clientName: string
  totalDebt: number
  totalPaid: number
  totalRevenue: number
  totalTons: number
  invoiceCount: number
  lastPurchaseDate: string
  lastFactory: FactoryName
}

export interface SupplierSummary {
  supplierName: string
  totalTons: number
  totalBagCount: number
  totalAmount: number
  totalPaid: number
  totalDebt: number
  totalAdvance: number
  totalBarter: number
  balanceType: BalanceType
  balanceAmount: number
  averagePricePerTon: number
  loadCount: number
  lastLoadDate: string
  lastFactory: FactoryName | ''
}

export interface SupplierPaymentRecord {
  id: string
  date: string
  factory: FactoryName | ''
  supplierName: string
  amount: number
  paymentMethod: PaymentMethod
  notes: string
}

export interface ScaleEntry {
  id: string
  date: string
  time: string
  direction: ScaleDirection
  tons: number
  netKg: number
  grossKg: number
  tareKg: number
  vehicleNumber: string
  material: string
  partnerName: string
  driverName: string
  rawText: string
  sourceChatId: string
  notes: string
  createdAt: string
}

export interface ScaleSyncMeta {
  lastSyncAt: string
  lastSyncedCount: number
  lastUpdateId: number
}

export interface ScaleCashEntry {
  id: string
  date: string
  type: ScaleCashType
  amount: number
  paymentMethod: PaymentMethod
  description: string
  notes: string
  source: 'manual'
  createdAt: string
}

export interface ClientReminderSetting {
  id: string
  clientName: string
  enabled: boolean
  frequency: ReminderFrequency
  time: string
  notes: string
  lastSentAt: string
}

export interface ClientDirectoryRecord extends ClientSummary {
  id: string
  phone: string
  notes: string
  saleCount: number
  hasSales: boolean
}

export interface MonthlyArchiveItem {
  label: string
  amount: number
  section: MonthlyArchiveSection
  note: string
}

export interface MonthlyArchiveRecord {
  id: string
  title: string
  startDate: string
  endDate: string
  factoryScope: ArchiveFactoryScope
  producedTons: number
  shippedTons: number
  stoneLoadSummary: string
  stonePaymentTotal: number
  incomingMoneyTotal: number
  declaredExpenseTotal: number
  declaredProfitTotal: number
  notes: string
  items: MonthlyArchiveItem[]
}

export interface OpeningBalanceRecord {
  id: string
  date: string
  factory: FactoryName
  stoneTons: number
  productTons: number
  kraskaTons: number
  melTons: number
  bagCount: number
  xiraBagCount: number
  oqBagCount: number
  notes: string
}

export interface AccountingStateSnapshot {
  defaultCosts: CostProfile
  openingBalances: OpeningBalanceRecord[]
  dailyRecords: DailyFactoryRecord[]
  incomingLoads: IncomingLoadRecord[]
  supplierPayments: SupplierPaymentRecord[]
  scaleEntries: ScaleEntry[]
  scaleSyncMeta: ScaleSyncMeta
  scaleCashEntries: ScaleCashEntry[]
  sales: SaleRecord[]
  manualDebts: ManualDebtRecord[]
  payments: PaymentRecord[]
  barterRecords: BarterRecord[]
  expenses: OperationalExpense[]
  contacts: ContactRecord[]
  reminders: ClientReminderSetting[]
  monthlyArchiveRecords: MonthlyArchiveRecord[]
  auditLogs: AuditLogRecord[]
  updatedAt: string
}
