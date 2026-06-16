<script setup lang="ts">
import type { BalanceType, ContactRecord, FactoryName, IncomingLoadRecord, PaymentStatus, VehicleType } from '~/types/accounting'
import type { TableColumn } from '~/types/report'

definePageMeta({
  layout: 'dashboard'
})

type IncomingLoadFormState = {
  date: string
  factory: FactoryName | ''
  vehicleType: VehicleType
  vehicleCount: string
  tons: number
  supplier: string
  totalAmount: number
  paidAmount: number
  notes: string
}

type SupplierFormState = {
  name: string
  phone: string
  telegramUsername: string
  address: string
  notes: string
}

const {
  incomingLoads,
  factoryOptions,
  supplierContacts,
  supplierSummaries,
  latestDate,
  addContact,
  updateContact,
  removeContact,
  addIncomingLoad,
  updateIncomingLoad,
  removeIncomingLoad
} = useFactoryAccounting()
const { isAdmin } = useAuth()
const { formatSom, formatTons, formatDate } = useFormatting()
const { setRecentDays, setCurrentMonth } = useDateRangePresets()
const { getSupplierChipClass, getSupplierInputClass } = useSupplierHighlight()
const { downloadWorkbook } = useExcelExport()
const { printWorkbook } = usePdfExport()
const { t } = useUiLocale()

const getVehicleDefaultTons = (vehicleType: VehicleType) => (vehicleType === 'Howo' ? 28 : 13)

const createFormState = (): IncomingLoadFormState => ({
  date: latestDate.value,
  factory: '',
  vehicleType: 'Howo',
  vehicleCount: '1',
  tons: getVehicleDefaultTons('Howo'),
  supplier: '',
  totalAmount: 0,
  paidAmount: 0,
  notes: ''
})

const filters = reactive({
  startDate: '',
  endDate: '',
  factory: '',
  vehicleType: '',
  supplier: ''
})

const form = reactive<IncomingLoadFormState>(createFormState())
const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const formError = ref('')

const deleteDialogOpen = ref(false)
const selectedLoad = ref<IncomingLoadRecord | null>(null)
const supplierModalOpen = ref(false)
const supplierDeleteDialogOpen = ref(false)
const editingSupplierId = ref<string | null>(null)
const selectedSupplier = ref<ContactRecord | null>(null)
const supplierError = ref('')
const supplierForm = reactive<SupplierFormState>({
  name: '',
  phone: '',
  telegramUsername: '',
  address: '',
  notes: ''
})

const supplierSelectOptions = computed(() =>
  supplierContacts.value.map((contact) => ({
    label: contact.name,
    value: contact.name
  }))
)

const supplierRows = computed<Record<string, unknown>[]>(() =>
  supplierContacts.value.map((contact) => {
    const summary = supplierSummaries.value.find((record) => record.supplierName.trim().toLowerCase() === contact.name.trim().toLowerCase())

    return {
      ...contact,
      balanceType: summary?.balanceType ?? 'yopilgan',
      balanceAmount: summary?.balanceAmount ?? 0,
      totalTons: summary?.totalTons ?? 0,
      loadCount: summary?.loadCount ?? 0
    }
  })
)

const columns: TableColumn[] = [
  { key: 'date', label: 'Sana' },
  { key: 'factory', label: 'Zavod' },
  { key: 'vehicleType', label: 'Mashina' },
  { key: 'tons', label: 'Tonna', align: 'right' },
  { key: 'pricePerTon', label: 'Narx / tonna', align: 'right' },
  { key: 'supplier', label: "Ta'minotchi" },
  { key: 'totalAmount', label: 'Jami narx', align: 'right' },
  { key: 'balance', label: 'Balans', align: 'right' },
  { key: 'actions', label: 'Amal', align: 'right' }
]

const supplierColumns: TableColumn[] = [
  { key: 'name', label: "Ta'minotchi" },
  { key: 'phone', label: 'Telefon' },
  { key: 'balanceAmount', label: 'Balans', align: 'right' },
  { key: 'totalTons', label: 'Tonna', align: 'right' },
  { key: 'actions', label: 'Amal', align: 'right' }
]

const filteredLoads = computed(() =>
  incomingLoads.value
    .filter((record) => {
      if (filters.startDate && record.date < filters.startDate) {
        return false
      }

      if (filters.endDate && record.date > filters.endDate) {
        return false
      }

      if (filters.factory && record.factory !== filters.factory) {
        return false
      }

      if (filters.vehicleType && record.vehicleType !== filters.vehicleType) {
        return false
      }

      if (filters.supplier && !record.supplier.toLowerCase().includes(filters.supplier.trim().toLowerCase())) {
        return false
      }

      return true
    })
    .sort((left, right) => right.date.localeCompare(left.date))
)

const loadSummary = computed(() => {
  const totalTons = filteredLoads.value.reduce((sum, record) => sum + record.tons, 0)
  const totalAmount = filteredLoads.value.reduce((sum, record) => sum + record.totalAmount, 0)
  const totalPaid = filteredLoads.value.reduce((sum, record) => sum + record.paidAmount, 0)
  const totalDebt = filteredLoads.value.reduce((sum, record) => sum + record.remainingAmount, 0)
  const totalAdvance = filteredLoads.value.reduce(
    (sum, record) => sum + getLoadAdvanceAmount(record.totalAmount, record.paidAmount),
    0
  )

  return {
    totalTons,
    totalAmount,
    totalPaid,
    totalDebt,
    totalAdvance
  }
})

const tableRows = computed<Record<string, unknown>[]>(() =>
  filteredLoads.value.map((record) => {
    const advanceAmount = getLoadAdvanceAmount(record.totalAmount, record.paidAmount)
    const balanceType: BalanceType = advanceAmount > 0 ? 'bizga_qarz' : record.remainingAmount > 0 ? 'bizdan_qarz' : 'yopilgan'

    return {
      ...record,
      balance: advanceAmount > 0 ? advanceAmount : record.remainingAmount,
      balanceType,
      advanceAmount
    }
  })
)

const formTotalAmount = computed(() => Number(form.totalAmount || 0))
const formPricePerTon = computed(() => getLoadPricePerTon(Number(form.tons), formTotalAmount.value))
const formRemainingAmount = computed(() => getRemainingAmount(formTotalAmount.value, Number(form.paidAmount || 0)))
const formAdvanceAmount = computed(() => getLoadAdvanceAmount(formTotalAmount.value, Number(form.paidAmount || 0)))
const formBalanceType = computed<BalanceType>(() => {
  if (formAdvanceAmount.value > 0) {
    return 'bizga_qarz'
  }

  if (formRemainingAmount.value > 0) {
    return 'bizdan_qarz'
  }

  return 'yopilgan'
})
const formPaymentStatus = computed<PaymentStatus>(() => getPaymentStatus(formTotalAmount.value, Number(form.paidAmount || 0)))

watch(
  () => [form.vehicleType, form.vehicleCount] as const,
  ([vehicleType, vehicleCount], previousValues) => {
    const previousVehicleType = previousValues?.[0]
    const previousVehicleCount = Number(previousValues?.[1] ?? '1')
    const previousDefault = previousVehicleType ? getVehicleDefaultTons(previousVehicleType) * previousVehicleCount : 0
    const nextDefault = getVehicleDefaultTons(vehicleType) * Number(vehicleCount || '1')

    if (Number(form.tons) <= 0 || Number(form.tons) === previousDefault) {
      form.tons = nextDefault
    }
  }
)

const buildFilteredLoadSheets = () => {
  return [
    {
      name: 'Tosh kirimi',
      columns: [
        { key: 'date', label: 'Sana' },
        { key: 'factory', label: 'Zavod' },
        { key: 'vehicleType', label: 'Mashina' },
        { key: 'supplier', label: "Ta'minotchi" },
        { key: 'tons', label: 'Tonna' },
        { key: 'pricePerTon', label: 'Narx / tonna' },
        { key: 'totalAmount', label: 'Jami narx' },
        { key: 'paidAmount', label: "To'langan" },
        { key: 'remainingDebt', label: 'Biz qarzmiz' },
        { key: 'advanceAmount', label: 'U qarz' },
        { key: 'balanceLabel', label: 'Holat' },
        { key: 'notes', label: 'Izoh' }
      ],
      rows: filteredLoads.value.map((record) => {
        const advanceAmount = getLoadAdvanceAmount(record.totalAmount, record.paidAmount)
        const balanceType: BalanceType = advanceAmount > 0 ? 'bizga_qarz' : record.remainingAmount > 0 ? 'bizdan_qarz' : 'yopilgan'

        return {
          date: formatDate(record.date),
          factory: record.factory,
          vehicleType: record.vehicleType,
          supplier: record.supplier,
          tons: Number(record.tons.toFixed(2)),
          pricePerTon: Math.round(record.pricePerTon),
          totalAmount: Math.round(record.totalAmount),
          paidAmount: Math.round(record.paidAmount),
          remainingDebt: Math.round(record.remainingAmount),
          advanceAmount: Math.round(advanceAmount),
          balanceLabel: balanceLabel(balanceType),
          notes: record.notes
        }
      })
    },
    {
      name: 'Xulosa',
      rows: [
        { metric: 'Jami tonna', value: Number(loadSummary.value.totalTons.toFixed(2)) },
        { metric: 'Jami summa', value: Math.round(loadSummary.value.totalAmount) },
        { metric: "To'langan", value: Math.round(loadSummary.value.totalPaid) },
        { metric: 'Biz qarzmiz', value: Math.round(loadSummary.value.totalDebt) },
        { metric: 'U qarz', value: Math.round(loadSummary.value.totalAdvance) }
      ]
    }
  ]
}

const exportFilteredLoadsExcel = () => {
  downloadWorkbook('tosh-kirimi', buildFilteredLoadSheets())
}

const exportFilteredLoadsPdf = () => {
  printWorkbook('Tosh kirimi', buildFilteredLoadSheets())
}

const balanceToneClass = (balanceType: unknown) => {
  if (balanceType === 'bizdan_qarz') {
    return 'text-rose-700'
  }

  if (balanceType === 'bizga_qarz') {
    return 'text-sky-700'
  }

  return 'text-emerald-700'
}

const balanceLabel = (balanceType: unknown) => {
  if (balanceType === 'bizdan_qarz') {
    return 'Biz qarzmiz'
  }

  if (balanceType === 'bizga_qarz') {
    return 'U qarz'
  }

  return 'Yopilgan'
}

const resetForm = () => {
  Object.assign(form, createFormState())
  editingId.value = null
  formError.value = ''
}

const openCreateModal = () => {
  if (!isAdmin.value) {
    return
  }

  resetForm()
  modalOpen.value = true
}

const openEditModal = (row: Record<string, unknown>) => {
  if (!isAdmin.value) {
    return
  }

  const record = row as IncomingLoadRecord

  Object.assign(form, {
    date: record.date,
    factory: record.factory,
    vehicleType: record.vehicleType,
    vehicleCount: '1',
    tons: record.tons,
    supplier: record.supplier,
    totalAmount: record.totalAmount,
    paidAmount: record.paidAmount,
    notes: record.notes
  })

  editingId.value = record.id
  formError.value = ''
  modalOpen.value = true
}

const saveLoad = () => {
  if (!isAdmin.value) {
    return
  }

  const totalAmount = Number(form.totalAmount)
  const paidAmount = Number(form.paidAmount)
  const pricePerTon = getLoadPricePerTon(Number(form.tons), totalAmount)

  const payload: Omit<IncomingLoadRecord, 'id'> = {
    date: form.date,
    factory: form.factory,
    vehicleType: form.vehicleType as VehicleType,
    tons: Number(form.tons),
    supplier: form.supplier.trim(),
    pricePerTon,
    totalAmount,
    paidAmount,
    remainingAmount: getRemainingAmount(totalAmount, paidAmount),
    paymentStatus: getPaymentStatus(totalAmount, paidAmount),
    notes: form.notes.trim()
  }

  if (!payload.date || !payload.vehicleType) {
    formError.value = 'Sana va mashina turini kiriting.'
    return
  }

  if (!payload.supplier) {
    formError.value = 'Ta`minotchini kiriting.'
    return
  }

  if (payload.totalAmount <= 0 || payload.paidAmount < 0) {
    formError.value = 'Jami narx 0 dan katta bo`lsin, to`langan summa esa manfiy bo`lmasin.'
    return
  }

  if (editingId.value) {
    updateIncomingLoad({
      id: editingId.value,
      ...payload
    })
  } else {
    addIncomingLoad(payload)
  }

  modalOpen.value = false
  resetForm()
}

const askDelete = (row: Record<string, unknown>) => {
  if (!isAdmin.value) {
    return
  }

  selectedLoad.value = row as IncomingLoadRecord
  deleteDialogOpen.value = true
}

const confirmDelete = () => {
  if (!isAdmin.value) {
    return
  }

  if (selectedLoad.value) {
    removeIncomingLoad(selectedLoad.value.id)
  }

  selectedLoad.value = null
  deleteDialogOpen.value = false
}

const closeDelete = () => {
  selectedLoad.value = null
  deleteDialogOpen.value = false
}

const resetSupplierForm = () => {
  Object.assign(supplierForm, {
    name: '',
    phone: '',
    telegramUsername: '',
    address: '',
    notes: ''
  })
  editingSupplierId.value = null
  supplierError.value = ''
}

const openSupplierCreateModal = () => {
  if (!isAdmin.value) {
    return
  }

  resetSupplierForm()
  supplierModalOpen.value = true
}

const openSupplierEditModal = (row: Record<string, unknown>) => {
  if (!isAdmin.value) {
    return
  }

  const record = row as ContactRecord
  Object.assign(supplierForm, {
    name: record.name,
    phone: record.phone,
    telegramUsername: record.telegramUsername,
    address: record.address,
    notes: record.notes
  })
  editingSupplierId.value = record.id
  supplierError.value = ''
  supplierModalOpen.value = true
}

const saveSupplier = () => {
  if (!isAdmin.value) {
    return
  }

  const name = supplierForm.name.trim()

  if (!name) {
    supplierError.value = 'Ta`minotchi nomini kiriting.'
    return
  }

  const duplicate = supplierContacts.value.find(
    (contact) => contact.id !== editingSupplierId.value && contact.name.trim().toLowerCase() === name.toLowerCase()
  )

  if (duplicate) {
    supplierError.value = 'Bu ta`minotchi ro`yxatda bor.'
    return
  }

  const payload = {
    type: 'supplier' as const,
    name,
    phone: supplierForm.phone.trim(),
    telegramChatId: '',
    telegramUsername: supplierForm.telegramUsername.trim(),
    address: supplierForm.address.trim(),
    notes: supplierForm.notes.trim()
  }

  if (editingSupplierId.value) {
    const existing = supplierContacts.value.find((contact) => contact.id === editingSupplierId.value)

    if (existing) {
      updateContact({
        ...existing,
        ...payload
      })
    }
  } else {
    addContact(payload)
  }

  supplierModalOpen.value = false
  resetSupplierForm()
}

const askSupplierDelete = (row: Record<string, unknown>) => {
  if (!isAdmin.value) {
    return
  }

  selectedSupplier.value = row as ContactRecord
  supplierDeleteDialogOpen.value = true
}

const confirmSupplierDelete = () => {
  if (!isAdmin.value || !selectedSupplier.value) {
    return
  }

  removeContact(selectedSupplier.value.id)
  selectedSupplier.value = null
  supplierDeleteDialogOpen.value = false
}

const closeSupplierDelete = () => {
  selectedSupplier.value = null
  supplierDeleteDialogOpen.value = false
}

const clearFilters = () => {
  filters.startDate = ''
  filters.endDate = ''
  filters.factory = ''
  filters.vehicleType = ''
  filters.supplier = ''
}
</script>

<template>
  <section class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h2 class="page-title">{{ t('Tosh Kirimi') }}</h2>
      <p class="page-subtitle">{{ t("Howo yoki Kamazda kelgan tosh uchun jami kelish narxini kiriting. Narx / tonna avtomatik hisoblanadi.") }}</p>
      <AdminReadOnlyBanner v-if="!isAdmin" class="mt-3" />
    </div>
    <div class="flex flex-wrap gap-2">
      <ExportActions @excel="exportFilteredLoadsExcel" @pdf="exportFilteredLoadsPdf" />
      <button v-if="isAdmin" type="button" class="btn-primary" @click="openCreateModal">{{ t("Kirim qo'shish") }}</button>
    </div>
  </section>

  <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
    <StatCard title="Jami kirim" :value="formatTons(loadSummary.totalTons)" subtitle="filtrlangan yozuvlar" />
    <StatCard title="Jami summa" :value="formatSom(loadSummary.totalAmount)" subtitle="supplier bo`yicha" />
    <StatCard title="To'langan" :value="formatSom(loadSummary.totalPaid)" subtitle="berilgan pul" />
    <StatCard title="Biz qarzmiz" :value="formatSom(loadSummary.totalDebt)" subtitle="supplierga qoldiq" />
    <StatCard title="U qarz" :value="formatSom(loadSummary.totalAdvance)" subtitle="ortiqcha to'lov" />
  </section>

  <section class="panel p-4">
    <div class="flex flex-wrap gap-2 border-b border-slate-100 pb-4">
      <button type="button" class="btn-secondary !px-3 !py-1.5 text-xs" @click="setCurrentMonth(filters)">{{ t('Joriy oy') }}</button>
      <button type="button" class="btn-secondary !px-3 !py-1.5 text-xs" @click="setRecentDays(filters, 30)">{{ t('Oxirgi 30 kun') }}</button>
      <button type="button" class="btn-secondary !px-3 !py-1.5 text-xs" @click="setRecentDays(filters, 7)">{{ t('Oxirgi 7 kun') }}</button>
      <button type="button" class="btn-secondary !px-3 !py-1.5 text-xs" @click="clearFilters">{{ t('Hammasi') }}</button>
    </div>

    <div class="mt-4 grid gap-3 md:grid-cols-6">
      <AppInput v-model="filters.startDate" type="date" label="Boshlanish sanasi" />
      <AppInput v-model="filters.endDate" type="date" label="Tugash sanasi" />
      <AppSelect v-model="filters.factory" label="Zavod" :options="factoryOptions" placeholder="Hamma zavod" />
      <AppSelect
        v-model="filters.vehicleType"
        label="Mashina turi"
        :options="[
          { label: 'Howo', value: 'Howo' },
          { label: 'Kamaz', value: 'Kamaz' }
        ]"
        placeholder="Hammasi"
      />
      <AppInput
        v-model="filters.supplier"
        label="Ta'minotchi"
        placeholder="Kimdan kelgan?"
        :input-class="getSupplierInputClass(filters.supplier)"
      />
      <div class="flex items-end">
        <button type="button" class="btn-secondary w-full" @click="clearFilters">{{ t('Filtrni tozalash') }}</button>
      </div>
    </div>
  </section>

  <section class="panel p-5">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="text-base font-semibold text-slate-900">{{ t("Ta'minotchilar") }}</h3>
        <p class="mt-1 text-sm text-slate-500">{{ t("Tosh kirimida ishlatiladigan supplier ro'yxati.") }}</p>
      </div>
      <button v-if="isAdmin" type="button" class="btn-secondary" @click="openSupplierCreateModal">
        {{ t("Ta'minotchi qo'shish") }}
      </button>
    </div>

    <AppTable :columns="supplierColumns" :rows="supplierRows" empty-text="Ta'minotchi topilmadi.">
      <template #cell-name="{ value }">
        <span :class="getSupplierChipClass(value)">{{ value }}</span>
      </template>

      <template #cell-phone="{ value }">
        {{ value || '-' }}
      </template>

      <template #cell-balanceAmount="{ row, value }">
        <span :class="['font-semibold', balanceToneClass(row.balanceType)]">
          {{ balanceLabel(row.balanceType) }}: {{ formatSom(Number(value)) }}
        </span>
      </template>

      <template #cell-totalTons="{ value }">
        {{ formatTons(Number(value)) }}
      </template>

      <template #cell-actions="{ row }">
        <div class="flex justify-end gap-2">
          <template v-if="isAdmin">
            <button type="button" class="btn-secondary !px-3 !py-1.5 text-xs" @click="openSupplierEditModal(row)">{{ t('Tahrirlash') }}</button>
            <button type="button" class="btn-danger !px-3 !py-1.5 text-xs" @click="askSupplierDelete(row)">{{ t("O'chirish") }}</button>
          </template>
          <span v-else class="text-xs text-slate-400">Faqat admin</span>
        </div>
      </template>
    </AppTable>
  </section>

  <section class="panel p-5">
    <AppTable :columns="columns" :rows="tableRows" empty-text="Tosh kirimi yozuvlari topilmadi.">
      <template #cell-vehicleType="{ value }">
        <span class="data-chip">{{ value }}</span>
      </template>

      <template #cell-factory="{ value }">
        {{ value || '-' }}
      </template>

      <template #cell-tons="{ value }">
        {{ formatTons(Number(value)) }}
      </template>

      <template #cell-pricePerTon="{ value }">
        {{ formatSom(Number(value)) }}
      </template>

      <template #cell-supplier="{ value }">
        <span :class="getSupplierChipClass(value)">
          {{ value }}
        </span>
      </template>

      <template #cell-totalAmount="{ value }">
        {{ formatSom(Number(value)) }}
      </template>

      <template #cell-balance="{ row, value }">
        <span :class="['font-semibold', balanceToneClass(row.balanceType)]">
          {{ balanceLabel(row.balanceType) }}: {{ formatSom(Number(value)) }}
        </span>
      </template>

      <template #cell-actions="{ row }">
        <div class="flex justify-end gap-2">
          <template v-if="isAdmin">
            <button type="button" class="btn-secondary !px-3 !py-1.5 text-xs" @click="openEditModal(row)">{{ t('Tahrirlash') }}</button>
            <button type="button" class="btn-danger !px-3 !py-1.5 text-xs" @click="askDelete(row)">{{ t("O'chirish") }}</button>
          </template>
          <span v-else class="text-xs text-slate-400">Faqat admin</span>
        </div>
      </template>
    </AppTable>
  </section>

  <AppModal :open="modalOpen" :title="editingId ? 'Kirimni tahrirlash' : 'Kirim qo`shish'" size="xl" @close="modalOpen = false">
    <div class="grid gap-4 md:grid-cols-2">
      <AppInput v-model="form.date" type="date" label="Sana" :invalid="Boolean(formError) && !form.date" required />
      <AppSelect v-model="form.factory" label="Zavod" :options="factoryOptions" placeholder="Ixtiyoriy" />
      <AppSelect
        v-model="form.vehicleType"
        label="Mashina turi"
        :options="[
          { label: 'Howo', value: 'Howo' },
          { label: 'Kamaz', value: 'Kamaz' }
        ]"
        :invalid="Boolean(formError) && !form.vehicleType"
        required
      />
      <AppSelect
        v-model="form.vehicleCount"
        label="Soni"
        :options="[
          { label: '1 ta', value: '1' },
          { label: '2 ta', value: '2' },
          { label: '3 ta', value: '3' },
          { label: '4 ta', value: '4' },
          { label: '5 ta', value: '5' }
        ]"
      />
      <AppInput v-model="form.tons" type="number" min="0" step="0.01" label="Tonna" placeholder="Ixtiyoriy" />
      <AppInput
        v-model="form.totalAmount"
        type="number"
        min="0"
        step="0.01"
        label="Jami narx"
        :invalid="Boolean(formError) && Number(form.totalAmount) <= 0"
        required
      />
      <AppInput v-model="form.paidAmount" type="number" min="0" step="0.01" label="To'langan summa" />
      <AppSelect
        v-model="form.supplier"
        label="Ta'minotchi"
        :options="supplierSelectOptions"
        :translate-options="false"
        :searchable="true"
        placeholder="Karer yoki ta'minotchi nomi"
        :invalid="Boolean(formError) && !form.supplier.trim()"
        required
      />
      <div class="md:col-span-2">
        <AppInput v-model="form.notes" label="Izoh" placeholder="Masalan, ertalabgi Howo yuk" />
      </div>
    </div>

    <div class="mt-4 rounded-2xl bg-slate-50 p-4">
      <div class="grid gap-3 md:grid-cols-4">
        <div>
          <p class="text-xs uppercase tracking-wide text-slate-500">Jami summa</p>
          <p class="mt-1 text-lg font-bold text-slate-900">{{ formatSom(formTotalAmount) }}</p>
        </div>
        <div>
          <p class="text-xs uppercase tracking-wide text-slate-500">Avtomatik narx / tonna</p>
          <p class="mt-1 text-lg font-bold text-slate-900">{{ formatSom(formPricePerTon) }}</p>
        </div>
        <div>
          <p class="text-xs uppercase tracking-wide text-slate-500">Biz qarzmiz</p>
          <p class="mt-1 text-lg font-bold text-rose-700">{{ formatSom(formRemainingAmount) }}</p>
        </div>
        <div>
          <p class="text-xs uppercase tracking-wide text-slate-500">U qarz</p>
          <p class="mt-1 text-lg font-bold text-sky-700">{{ formatSom(formAdvanceAmount) }}</p>
        </div>
        <div>
          <p class="text-xs uppercase tracking-wide text-slate-500">Holat</p>
          <p class="mt-1 text-lg font-bold" :class="balanceToneClass(formBalanceType)">{{ balanceLabel(formBalanceType) }}</p>
        </div>
      </div>
      <p class="mt-3 text-xs text-slate-500">Holat: {{ formPaymentStatus }}</p>
      <p class="mt-2 text-xs text-slate-500">Masalan, 1 Howo uchun `2 000 000` yoki `1 800 000` jami narx kiriting. Tonna kiritilsa narx / tonna avtomatik chiqadi.</p>
    </div>

    <p v-if="formError" class="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {{ formError }}
    </p>

    <template #footer>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-secondary" @click="modalOpen = false">{{ t('Bekor qilish') }}</button>
        <button type="button" class="btn-primary" @click="saveLoad">
          {{ editingId ? t('Saqlash') : t("Qo`shish") }}
        </button>
      </div>
    </template>
  </AppModal>

  <AppModal :open="supplierModalOpen" :title="editingSupplierId ? 'Ta`minotchini tahrirlash' : 'Ta`minotchi qo`shish'" size="lg" @close="supplierModalOpen = false">
    <div class="grid gap-4 md:grid-cols-2">
      <AppInput v-model="supplierForm.name" label="Nomi" :invalid="Boolean(supplierError) && !supplierForm.name.trim()" required />
      <AppInput v-model="supplierForm.phone" label="Telefon" placeholder="+998..." />
      <AppInput v-model="supplierForm.telegramUsername" label="Telegram" placeholder="@username" />
      <AppInput v-model="supplierForm.address" label="Manzil" />
      <div class="md:col-span-2">
        <AppInput v-model="supplierForm.notes" label="Izoh" />
      </div>
    </div>

    <p v-if="supplierError" class="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {{ supplierError }}
    </p>

    <template #footer>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-secondary" @click="supplierModalOpen = false">{{ t('Bekor qilish') }}</button>
        <button type="button" class="btn-primary" @click="saveSupplier">
          {{ editingSupplierId ? t('Saqlash') : t("Qo`shish") }}
        </button>
      </div>
    </template>
  </AppModal>

  <ConfirmDialog
    :open="deleteDialogOpen"
    title="Kirim yozuvini o'chirish"
    :message="`Tanlangan ${selectedLoad?.vehicleType ?? ''} kirimini o'chirasizmi?`"
    confirm-text="O'chirish"
    cancel-text="Bekor qilish"
    @confirm="confirmDelete"
    @cancel="closeDelete"
  />

  <ConfirmDialog
    :open="supplierDeleteDialogOpen"
    title="Ta'minotchini o'chirish"
    :message="`${selectedSupplier?.name ?? ''} ro'yxatdan o'chirilsinmi? Eski kirim yozuvlari o'chmaydi.`"
    confirm-text="O'chirish"
    cancel-text="Bekor qilish"
    @confirm="confirmSupplierDelete"
    @cancel="closeSupplierDelete"
  />
</template>
