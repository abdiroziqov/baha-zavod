<script setup lang="ts">
import type { FactoryName, ManualDebtRecord, PaymentMethod, SaleRecord } from '~/types/accounting'
import type { TableColumn } from '~/types/report'

definePageMeta({
  layout: 'dashboard'
})

type OutstandingEntry = {
  id: string
  entryType: 'sale' | 'manualDebt'
  date: string
  factory: FactoryName
  clientName: string
  tons: number
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  notes: string
  label: string
  saleRef: SaleRecord | null
  debtRef: ManualDebtRecord | null
}

const {
  sales,
  manualDebts,
  payments,
  paymentMethods,
  latestDate,
  clientOptions,
  updateSale,
  addManualDebt,
  updateManualDebt,
  removeManualDebt,
  addPayment,
  getClientProfile,
  getClientReminder,
  reminderList
} = useFactoryAccounting()
const { isAdmin } = useAuth()
const { formatSom, formatTons, formatDate } = useFormatting()
const { setRecentDays, setCurrentMonth } = useDateRangePresets()
const { t } = useUiLocale()

const filters = reactive({
  search: '',
  startDate: '',
  endDate: ''
})

const paymentModalOpen = ref(false)
const selectedEntry = ref<OutstandingEntry | null>(null)
const paymentError = ref('')
const paymentForm = reactive({
  date: latestDate.value,
  amount: 0,
  paymentMethod: 'Naqd' as PaymentMethod,
  notes: ''
})

const manualDebtModalOpen = ref(false)
const manualDebtError = ref('')
const editingManualDebtId = ref('')
const manualDebtForm = reactive({
  date: latestDate.value,
  clientName: '',
  amount: 0,
  notes: ''
})

const deleteManualDebtDialogOpen = ref(false)
const selectedManualDebt = ref<ManualDebtRecord | null>(null)

const debtorColumns: TableColumn[] = [
    { key: 'clientName', label: 'Klient', headerClass: 'font-bold text-brand-700' },
    { key: 'phone', label: 'Telefon' },
    { key: 'totalTons', label: 'Tonna', align: 'right' },
    { key: 'totalRevenue', label: 'Jami yozuv', align: 'right' },
    { key: 'totalPaid', label: 'To`langan', align: 'right' },
    { key: 'totalDebt', label: 'Qarz', align: 'right' },
    { key: 'actions', label: 'Amal', align: 'right' }
]

const invoiceColumns: TableColumn[] = [
  { key: 'date', label: 'Sana' },
  { key: 'entryTypeLabel', label: 'Turi' },
  { key: 'clientName', label: 'Klient', headerClass: 'font-bold text-brand-700' },
  { key: 'factory', label: 'Zavod' },
  { key: 'tons', label: 'Tonna', align: 'right' },
  { key: 'totalAmount', label: 'Jami', align: 'right' },
  { key: 'paidAmount', label: 'To`langan', align: 'right' },
  { key: 'remainingAmount', label: 'Qarz', align: 'right' },
  { key: 'actions', label: 'Amal', align: 'right' }
]

const paymentColumns: TableColumn[] = [
  { key: 'date', label: 'To`lov sanasi' },
  { key: 'clientName', label: 'Klient', headerClass: 'font-bold text-brand-700' },
  { key: 'factory', label: 'Zavod' },
  { key: 'amount', label: 'Summa', align: 'right' },
  { key: 'paymentMethod', label: 'To`lov turi' },
  { key: 'saleDate', label: 'Asl sana' },
  { key: 'notes', label: 'Izoh' }
]

const matchesDateRange = (value: string) => {
  if (filters.startDate && value < filters.startDate) {
    return false
  }

  if (filters.endDate && value > filters.endDate) {
    return false
  }

  return true
}

const normalizedSearch = computed(() => filters.search.trim().toLowerCase())

const filteredOutstandingEntries = computed<OutstandingEntry[]>(() => {
  const saleEntries = sales.value
    .filter((record) => {
      if (record.remainingAmount <= 0) {
        return false
      }

      const haystack = `${record.clientName} ${record.notes}`.toLowerCase()

      if (normalizedSearch.value && !haystack.includes(normalizedSearch.value)) {
        return false
      }

      return matchesDateRange(record.date)
    })
    .map<OutstandingEntry>((record) => ({
      id: record.id,
      entryType: 'sale',
      date: record.date,
      factory: record.factory,
      clientName: record.clientName,
      tons: record.tons,
      totalAmount: record.totalAmount,
      paidAmount: record.paidAmount,
      remainingAmount: record.remainingAmount,
      notes: record.notes,
      label: 'Sotuv',
      saleRef: record,
      debtRef: null
    }))

  const debtEntries = manualDebts.value
    .filter((record) => {
      if (record.remainingAmount <= 0) {
        return false
      }

      const haystack = `${record.clientName} ${record.notes}`.toLowerCase()

      if (normalizedSearch.value && !haystack.includes(normalizedSearch.value)) {
        return false
      }

      return matchesDateRange(record.date)
    })
    .map<OutstandingEntry>((record) => ({
      id: record.id,
      entryType: 'manualDebt',
      date: record.date,
      factory: record.factory,
      clientName: record.clientName,
      tons: 0,
      totalAmount: record.amount,
      paidAmount: record.paidAmount,
      remainingAmount: record.remainingAmount,
      notes: record.notes,
      label: 'Eski qarz',
      saleRef: null,
      debtRef: record
    }))

  return [...saleEntries, ...debtEntries]
    .filter((entry) => getClientProfile(entry.clientName).summary?.balanceType === 'bizga_qarz')
    .sort((left, right) => right.date.localeCompare(left.date))
})

const filteredDebtors = computed(() => {
  const summaryMap = new Map<
    string,
    {
      clientName: string
      phone: string
      totalDebt: number
      totalPaid: number
      totalRevenue: number
      totalTons: number
      invoiceCount: number
      lastPurchaseDate: string
      lastFactory: FactoryName
    }
  >()

  filteredOutstandingEntries.value.forEach((entry) => {
    const profile = getClientProfile(entry.clientName)
    const clientBalance = profile.summary

    if (!clientBalance || clientBalance.balanceType !== 'bizga_qarz') {
      return
    }

    const current = summaryMap.get(entry.clientName) ?? {
      clientName: entry.clientName,
      phone: profile.contact?.phone ?? '',
      totalDebt: 0,
      totalPaid: 0,
      totalRevenue: 0,
      totalTons: 0,
      invoiceCount: 0,
      lastPurchaseDate: entry.date,
      lastFactory: entry.factory
    }

    current.totalDebt = clientBalance.balanceAmount
    current.totalPaid += entry.paidAmount
    current.totalRevenue += entry.totalAmount
    current.totalTons += entry.tons
    current.invoiceCount += 1
    current.phone = profile.contact?.phone ?? current.phone

    if (entry.date >= current.lastPurchaseDate) {
      current.lastPurchaseDate = entry.date
      current.lastFactory = entry.factory
    }

    summaryMap.set(entry.clientName, current)
  })

  return Array.from(summaryMap.values()).sort((left, right) => right.totalDebt - left.totalDebt)
})

const getEditableManualDebtForClient = (clientName: string) => {
  const clientEntries = filteredOutstandingEntries.value.filter((entry) => entry.clientName === clientName)

  if (clientEntries.some((entry) => entry.entryType === 'sale')) {
    return null
  }

  const manualEntries = clientEntries.filter((entry) => entry.entryType === 'manualDebt' && entry.debtRef)

  if (manualEntries.length !== 1) {
    return null
  }

  return manualEntries[0].debtRef
}

const filteredPayments = computed(() =>
  payments.value
    .filter((record) => {
      if (normalizedSearch.value) {
        const haystack = `${record.clientName} ${record.notes}`.toLowerCase()

        if (!haystack.includes(normalizedSearch.value)) {
          return false
        }
      }

      return matchesDateRange(record.date)
    })
    .sort((left, right) => right.date.localeCompare(left.date))
)

const summary = computed(() => ({
  totalDebt: filteredDebtors.value.reduce((sum, record) => sum + record.totalDebt, 0),
  totalClients: filteredDebtors.value.length,
  totalInvoices: filteredDebtors.value.reduce((sum, record) => sum + record.invoiceCount, 0),
  totalPayments: filteredPayments.value.reduce((sum, record) => sum + record.amount, 0),
  activeReminders: reminderList.value.filter((record) => record.active).length
}))

const debtorRows = computed<Record<string, unknown>[]>(() =>
  filteredDebtors.value.map((record) => {
    const reminder = getClientReminder(record.clientName)
    const editableManualDebt = getEditableManualDebtForClient(record.clientName)

    return {
      ...record,
      reminder: reminder?.enabled ? `Yoqilgan · ${reminder.frequency === 'daily' ? 'Har kun' : '2 kunda bir'} · ${reminder.time}` : 'O`chiq',
      editableManualDebt
    }
  })
)

const invoiceRows = computed<Record<string, unknown>[]>(() =>
  filteredOutstandingEntries.value.map((entry) => ({
    ...entry,
    entryTypeLabel: entry.label
  }))
)

const paymentRows = computed<Record<string, unknown>[]>(() => [...filteredPayments.value])

const openPaymentModal = (row: Record<string, unknown>) => {
  if (!isAdmin.value) {
    return
  }

  selectedEntry.value = row as OutstandingEntry
  paymentForm.date = latestDate.value
  paymentForm.amount = selectedEntry.value.remainingAmount
  paymentForm.paymentMethod = 'Naqd'
  paymentForm.notes = ''
  paymentError.value = ''
  paymentModalOpen.value = true
}

const closePaymentModal = () => {
  paymentModalOpen.value = false
  selectedEntry.value = null
  paymentForm.date = latestDate.value
  paymentForm.amount = 0
  paymentForm.paymentMethod = 'Naqd'
  paymentForm.notes = ''
  paymentError.value = ''
}

const openManualDebtModal = () => {
  if (!isAdmin.value) {
    return
  }

  editingManualDebtId.value = ''
  manualDebtForm.date = latestDate.value
  manualDebtForm.clientName = ''
  manualDebtForm.amount = 0
  manualDebtForm.notes = ''
  manualDebtError.value = ''
  manualDebtModalOpen.value = true
}

const closeManualDebtModal = () => {
  manualDebtModalOpen.value = false
  editingManualDebtId.value = ''
  manualDebtForm.date = latestDate.value
  manualDebtForm.clientName = ''
  manualDebtForm.amount = 0
  manualDebtForm.notes = ''
  manualDebtError.value = ''
}

const saveManualDebt = () => {
  if (!isAdmin.value) {
    return
  }

  const clientName = manualDebtForm.clientName.trim()
  const amount = Number(manualDebtForm.amount)

  if (!manualDebtForm.date || !clientName) {
    manualDebtError.value = 'Sana va klient nomini kiriting.'
    return
  }

  if (amount <= 0) {
    manualDebtError.value = 'Qarz summasi 0 dan katta bo`lishi kerak.'
    return
  }

  if (editingManualDebtId.value) {
    const existing = manualDebts.value.find((record) => record.id === editingManualDebtId.value)

    if (!existing) {
      manualDebtError.value = 'Qarz yozuvi topilmadi.'
      return
    }

    updateManualDebt({
      ...existing,
      date: manualDebtForm.date,
      clientName,
      amount,
      notes: manualDebtForm.notes.trim()
    })
  } else {
    addManualDebt({
      date: manualDebtForm.date,
      factory: (getClientProfile(clientName).summary?.lastFactory ?? 'Tepa shpaklevka') as FactoryName,
      clientName,
      amount,
      paidAmount: 0,
      notes: manualDebtForm.notes.trim()
    })
  }

  closeManualDebtModal()
}

const openEditManualDebtModal = (record: ManualDebtRecord) => {
  if (!isAdmin.value) {
    return
  }

  editingManualDebtId.value = record.id
  manualDebtForm.date = record.date
  manualDebtForm.clientName = record.clientName
  manualDebtForm.amount = record.amount
  manualDebtForm.notes = record.notes
  manualDebtError.value = ''
  manualDebtModalOpen.value = true
}

const askDeleteManualDebt = (record: ManualDebtRecord) => {
  if (!isAdmin.value) {
    return
  }

  selectedManualDebt.value = record
  deleteManualDebtDialogOpen.value = true
}

const closeDeleteManualDebt = () => {
  selectedManualDebt.value = null
  deleteManualDebtDialogOpen.value = false
}

const confirmDeleteManualDebt = () => {
  if (!isAdmin.value || !selectedManualDebt.value) {
    return
  }

  removeManualDebt(selectedManualDebt.value.id)
  closeDeleteManualDebt()
}

const savePayment = () => {
  if (!isAdmin.value) {
    return
  }

  if (!selectedEntry.value) {
    return
  }

  const amount = Number(paymentForm.amount)

  if (!paymentForm.date) {
    paymentError.value = 'To`lov sanasini kiriting.'
    return
  }

  if (amount <= 0 || amount > selectedEntry.value.remainingAmount) {
    paymentError.value = 'To`lov summasi qarzdan oshmasligi kerak.'
    return
  }

  if (selectedEntry.value.entryType === 'sale' && selectedEntry.value.saleRef) {
    updateSale({
      id: selectedEntry.value.saleRef.id,
      date: selectedEntry.value.saleRef.date,
      time: selectedEntry.value.saleRef.time,
      factory: selectedEntry.value.saleRef.factory,
      clientName: selectedEntry.value.saleRef.clientName,
      productName: selectedEntry.value.saleRef.productName,
      shipmentType: selectedEntry.value.saleRef.shipmentType,
      tons: selectedEntry.value.saleRef.tons,
      pricePerTon: selectedEntry.value.saleRef.pricePerTon,
      paidAmount: selectedEntry.value.saleRef.paidAmount + amount,
      paymentMethod: selectedEntry.value.saleRef.paymentMethod,
      notes: selectedEntry.value.saleRef.notes
    })
  }

  if (selectedEntry.value.entryType === 'manualDebt' && selectedEntry.value.debtRef) {
    updateManualDebt({
      ...selectedEntry.value.debtRef,
      paidAmount: selectedEntry.value.debtRef.paidAmount + amount
    })
  }

  addPayment({
    date: paymentForm.date,
    factory: selectedEntry.value.factory,
    clientName: selectedEntry.value.clientName,
    amount,
    paymentMethod: paymentForm.paymentMethod,
    saleId: selectedEntry.value.id,
    saleDate: selectedEntry.value.date,
    notes: paymentForm.notes.trim()
  })

  closePaymentModal()
}

const clearFilters = () => {
  filters.search = ''
  filters.startDate = ''
  filters.endDate = ''
}
</script>

<template>
  <section>
    <h2 class="page-title">{{ t('Qarzdorlar') }}</h2>
    <p class="page-subtitle">
      {{ t("Eski qarzlarni qo'lda qo'shish va keyin to'lov bilan yopish shu yerda.") }}
    </p>
    <AdminReadOnlyBanner v-if="!isAdmin" class="mt-3" />
  </section>

  <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <StatCard title="Jami qarz" :value="formatSom(summary.totalDebt)" subtitle="filtr bo`yicha" />
    <StatCard title="Qarzdor klientlar" :value="summary.totalClients" subtitle="ochiq qarzi borlar" />
    <StatCard title="Ochiq yozuvlar" :value="summary.totalInvoices" subtitle="sotuv va eski qarz" />
    <StatCard title="To'lovlar" :value="formatSom(summary.totalPayments)" subtitle="filtrlangan to'lov tarixi" />
  </section>

  <section class="panel p-4">
    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn-secondary !px-3 !py-1.5 text-xs" @click="setCurrentMonth(filters)">{{ t('Joriy oy') }}</button>
        <button type="button" class="btn-secondary !px-3 !py-1.5 text-xs" @click="setRecentDays(filters, 30)">{{ t('Oxirgi 30 kun') }}</button>
        <button type="button" class="btn-secondary !px-3 !py-1.5 text-xs" @click="setRecentDays(filters, 7)">{{ t('Oxirgi 7 kun') }}</button>
        <button type="button" class="btn-secondary !px-3 !py-1.5 text-xs" @click="clearFilters">{{ t('Hammasi') }}</button>
      </div>

      <button v-if="isAdmin" type="button" class="btn-primary" @click="openManualDebtModal">{{ t("Qarz qo'shish") }}</button>
    </div>

    <div class="mt-4 grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto]">
      <AppInput v-model="filters.search" label="Klient qidirish" placeholder="Masalan, Begzod" />
      <AppInput v-model="filters.startDate" type="date" label="Boshlanish sanasi" />
      <AppInput v-model="filters.endDate" type="date" label="Tugash sanasi" />
      <div class="flex items-end">
        <button type="button" class="btn-secondary" @click="clearFilters">{{ t('Tozalash') }}</button>
      </div>
    </div>
  </section>

  <section class="grid gap-4">
    <article class="panel p-5">
      <header class="mb-4">
        <h3 class="text-base font-semibold text-slate-900">{{ t("Klientlar bo`yicha qarz") }}</h3>
      </header>

      <AppTable :columns="debtorColumns" :rows="debtorRows" empty-text="Qarzdor klient topilmadi.">
        <template #cell-clientName="{ value }">
          <span class="font-bold text-brand-700">{{ value }}</span>
        </template>

        <template #cell-totalTons="{ value }">
          <span v-if="Number(value) > 0">{{ formatTons(Number(value)) }}</span>
          <span v-else class="text-slate-400">-</span>
        </template>

        <template #cell-totalRevenue="{ value }">
          {{ formatSom(Number(value)) }}
        </template>

        <template #cell-totalPaid="{ value }">
          {{ formatSom(Number(value)) }}
        </template>

        <template #cell-totalDebt="{ value }">
          <span class="font-semibold text-rose-700">{{ formatSom(Number(value)) }}</span>
        </template>

        <template #cell-actions="{ row }">
          <div class="flex justify-end gap-2">
            <button
              v-if="isAdmin && row.editableManualDebt"
              type="button"
              class="btn-secondary !px-3 !py-1.5 text-xs"
              @click="openEditManualDebtModal(row.editableManualDebt as ManualDebtRecord)"
            >
              Tahrirlash
            </button>
            <button
              v-if="isAdmin && row.editableManualDebt"
              type="button"
              class="btn-danger !px-3 !py-1.5 text-xs"
              @click="askDeleteManualDebt(row.editableManualDebt as ManualDebtRecord)"
            >
              O'chirish
            </button>
          </div>
        </template>
      </AppTable>
    </article>

    <article class="panel p-5">
      <header class="mb-4">
        <h3 class="text-base font-semibold text-slate-900">{{ t("Yozuvlar bo`yicha qarz") }}</h3>
      </header>

      <AppTable :columns="invoiceColumns" :rows="invoiceRows" empty-text="Ochiq qarz yozuvlari topilmadi.">
        <template #cell-clientName="{ value }">
          <span class="font-bold text-brand-700">{{ value }}</span>
        </template>

        <template #cell-entryTypeLabel="{ value }">
          <span
            :class="[
              'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
              value === 'Eski qarz' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'
            ]"
          >
            {{ value }}
          </span>
        </template>

        <template #cell-tons="{ row, value }">
          <span v-if="String(row.entryType) === 'sale'">{{ formatTons(Number(value)) }}</span>
          <span v-else class="text-slate-400">-</span>
        </template>

        <template #cell-totalAmount="{ value }">
          {{ formatSom(Number(value)) }}
        </template>

        <template #cell-paidAmount="{ value }">
          {{ formatSom(Number(value)) }}
        </template>

        <template #cell-remainingAmount="{ value }">
          <span class="font-semibold text-rose-700">{{ formatSom(Number(value)) }}</span>
        </template>

        <template #cell-actions="{ row }">
          <div class="flex justify-end gap-2">
            <button v-if="isAdmin" type="button" class="btn-secondary !px-3 !py-1.5 text-xs" @click="openPaymentModal(row)">
              To'lov
            </button>
            <button
              v-if="isAdmin && String(row.entryType) === 'manualDebt'"
              type="button"
              class="btn-secondary !px-3 !py-1.5 text-xs"
              @click="openEditManualDebtModal((row.debtRef as ManualDebtRecord))"
            >
              Tahrirlash
            </button>
            <button
              v-if="isAdmin && String(row.entryType) === 'manualDebt'"
              type="button"
              class="btn-danger !px-3 !py-1.5 text-xs"
              @click="askDeleteManualDebt((row.debtRef as ManualDebtRecord))"
            >
              O'chirish
            </button>
          </div>
        </template>
      </AppTable>
    </article>
  </section>

  <section class="panel p-5">
    <header class="mb-4">
      <h3 class="text-base font-semibold text-slate-900">{{ t("To'lovlar tarixi") }}</h3>
      <p class="text-xs text-slate-500">Kim qachon pul berganini shu jadvaldan ko'rasiz.</p>
    </header>

    <AppTable :columns="paymentColumns" :rows="paymentRows" empty-text="To'lov tarixi topilmadi.">
      <template #cell-clientName="{ value }">
        <span class="font-bold text-brand-700">{{ value }}</span>
      </template>

      <template #cell-amount="{ value }">
        <span class="font-semibold text-emerald-700">{{ formatSom(Number(value)) }}</span>
      </template>
    </AppTable>
  </section>

  <AppModal :open="manualDebtModalOpen" :title="editingManualDebtId ? 'Eski qarzni tahrirlash' : 'Eski qarz qo`shish'" size="sm" @close="closeManualDebtModal">
    <div class="space-y-4">
      <AppInput v-model="manualDebtForm.date" type="date" label="Sana" :invalid="Boolean(manualDebtError) && !manualDebtForm.date" />
      <AppSelect
        v-model="manualDebtForm.clientName"
        label="Klient"
        :options="clientOptions"
        :translate-options="false"
        :searchable="true"
        placeholder="Klientni tanlang"
        :invalid="Boolean(manualDebtError) && !manualDebtForm.clientName.trim()"
      />
      <AppInput
        v-model="manualDebtForm.amount"
        type="number"
        min="0"
        step="0.01"
        label="Qarz summasi"
        :invalid="Boolean(manualDebtError) && Number(manualDebtForm.amount) <= 0"
      />
      <AppInput v-model="manualDebtForm.notes" label="Izoh" placeholder="Masalan, yozda beradi" />

      <p v-if="manualDebtError" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {{ manualDebtError }}
      </p>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-secondary" @click="closeManualDebtModal">{{ t('Bekor qilish') }}</button>
        <button v-if="isAdmin" type="button" class="btn-primary" @click="saveManualDebt">{{ t('Saqlash') }}</button>
      </div>
    </template>
  </AppModal>

  <ConfirmDialog
    :open="deleteManualDebtDialogOpen"
    title="Eski qarzni o'chirish"
    :message="`Tanlangan ${selectedManualDebt?.clientName ?? ''} qarz yozuvini o'chirasizmi?`"
    confirm-text="O'chirish"
    cancel-text="Bekor qilish"
    @confirm="confirmDeleteManualDebt"
    @cancel="closeDeleteManualDebt"
  />

  <AppModal :open="paymentModalOpen" title="To'lov kiritish" size="sm" @close="closePaymentModal">
    <div class="space-y-4">
      <div class="rounded-2xl bg-slate-50 p-4 text-sm">
        <div class="flex items-center justify-between">
          <span class="text-slate-500">Klient</span>
          <strong class="text-slate-900">{{ selectedEntry?.clientName }}</strong>
        </div>
        <div class="mt-2 flex items-center justify-between">
          <span class="text-slate-500">Yozuv turi</span>
          <strong class="text-slate-900">{{ selectedEntry?.label }}</strong>
        </div>
        <div class="mt-2 flex items-center justify-between">
          <span class="text-slate-500">Asl sana</span>
          <strong class="text-slate-900">{{ formatDate(selectedEntry?.date) }}</strong>
        </div>
        <div class="mt-2 flex items-center justify-between">
          <span class="text-slate-500">Jami qarz</span>
          <strong class="text-rose-700">{{ formatSom(selectedEntry?.remainingAmount ?? 0) }}</strong>
        </div>
      </div>

      <AppInput v-model="paymentForm.date" type="date" label="To'lov sanasi" :invalid="Boolean(paymentError) && !paymentForm.date" />
      <AppInput
        v-model="paymentForm.amount"
        type="number"
        min="0"
        step="0.01"
        label="To'lov summasi"
        :invalid="Boolean(paymentError) && Number(paymentForm.amount) <= 0"
      />
      <AppSelect
        v-model="paymentForm.paymentMethod"
        label="To`lov turi"
        :options="paymentMethods.map((item) => ({ label: item, value: item }))"
      />
      <AppInput v-model="paymentForm.notes" label="Izoh" placeholder="Masalan, qisman to'lov berdi" />

      <p v-if="paymentError" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {{ paymentError }}
      </p>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-secondary" @click="closePaymentModal">{{ t('Bekor qilish') }}</button>
        <button v-if="isAdmin" type="button" class="btn-primary" @click="savePayment">{{ t('Saqlash') }}</button>
      </div>
    </template>
  </AppModal>

</template>
