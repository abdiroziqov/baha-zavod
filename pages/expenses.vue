<script setup lang="ts">
import type { CostProfile, ExpenseCategory, FactoryName, OperationalExpense, PaymentMethod } from '~/types/accounting'
import type { TableColumn } from '~/types/report'

definePageMeta({
  layout: 'dashboard'
})

const {
  expenses,
  expenseCategories,
  paymentMethods,
  defaultCosts,
  factoryOptions,
  latestDate,
  addExpense,
  updateExpense,
  removeExpense,
  updateDefaultCosts,
  getDefaultSalePricePerTon,
  buildSummary
} = useFactoryAccounting()
const { isAdmin } = useAuth()
const { formatSom } = useFormatting()
const { setRecentDays, setCurrentMonth } = useDateRangePresets()
const { t } = useUiLocale()

const createExpenseFormState = (): Omit<OperationalExpense, 'id'> => ({
  date: latestDate.value,
  factory: '',
  category: 'Ishchi',
  description: '',
  amount: 0,
  paymentMethod: 'Naqd',
  materialType: '',
  bagType: '',
  materialQuantity: 0,
  notes: ''
})

const filters = reactive({
  startDate: '',
  endDate: '',
  factory: '',
  category: ''
})

const expenseForm = reactive<Omit<OperationalExpense, 'id'>>(createExpenseFormState())
const costForm = reactive<CostProfile>({
  ...defaultCosts.value
})

const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const formError = ref('')

const deleteDialogOpen = ref(false)
const selectedExpense = ref<OperationalExpense | null>(null)
const previousWorkerSuggestion = ref(0)

const getMonthStart = (date: string) => `${date.slice(0, 7)}-01`
const getWorkerPayoutMode = (date: string, factory: FactoryName | '') => {
  if (!date || !factory) {
    return ''
  }

  return buildSummary(date, date).workerPaymentByFactory.find((item) => item.factory === factory)?.payoutMode ?? ''
}

const getWorkerSuggestion = (date: string, factory: FactoryName | '') => {
  if (!date || !factory) {
    return 0
  }

  if (getWorkerPayoutMode(date, factory) === 'daily') {
    const dailySummary = buildSummary(date, date)
    return dailySummary.workerPaymentByFactory.find((item) => item.factory === factory)?.paidNow ?? 0
  }

  const monthlySummary = buildSummary(getMonthStart(date), date)
  return monthlySummary.workerPaymentByFactory.find((item) => item.factory === factory)?.accrued ?? 0
}

const workerExpenseSuggestion = computed(() => {
  if (expenseForm.category !== 'Ishchi') {
    return 0
  }

  return getWorkerSuggestion(expenseForm.date, expenseForm.factory as FactoryName | '')
})

const workerPayoutModeLabel = computed(() => {
  if (expenseForm.category !== 'Ishchi' || !expenseForm.factory) {
    return ''
  }

  const payoutMode = getWorkerPayoutMode(expenseForm.date, expenseForm.factory as FactoryName | '')

  if (payoutMode === 'daily') {
    return `${expenseForm.factory} kunlik hisob bo'yicha olinadi.`
  }

  if (payoutMode === 'monthly') {
    return `${expenseForm.factory} joriy oy yig'ilgan oyligi bo'yicha olinadi.`
  }

  return ''
})

const isMaterialExpense = computed(() =>
  expenseForm.category === 'Tosh' || expenseForm.category === 'Xira qop' || expenseForm.category === 'Oq qop'
)

const materialExpenseLabel = computed(() => {
  if (expenseForm.category === 'Tosh') {
    return 'Tosh miqdori (t)'
  }

  if (expenseForm.category === 'Xira qop') {
    return 'Xira qop soni (dona)'
  }

  if (expenseForm.category === 'Oq qop') {
    return 'Oq qop soni (dona)'
  }

  return 'Miqdor'
})

const columns: TableColumn[] = [
  { key: 'date', label: 'Sana' },
  { key: 'factory', label: 'Zavod' },
  { key: 'category', label: 'Kategoriya' },
  { key: 'description', label: 'Tavsif' },
  { key: 'materialQuantity', label: 'Miqdor', align: 'right' },
  { key: 'paymentMethod', label: 'To`lov turi' },
  { key: 'amount', label: 'Summa', align: 'right' },
  { key: 'actions', label: 'Amal', align: 'right' }
]

const filteredExpenses = computed(() =>
  expenses.value
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

      if (filters.category && record.category !== filters.category) {
        return false
      }

      return true
    })
    .sort((left, right) => right.date.localeCompare(left.date))
)

const expensesSummary = computed(() => {
  const total = filteredExpenses.value.reduce((sum, record) => sum + record.amount, 0)
  const categories = new Set(filteredExpenses.value.map((record) => record.category))

  return {
    total,
    count: filteredExpenses.value.length,
    categories: categories.size
  }
})

const kraskaXiraCostPerTon = computed(() => getCostPerTon(costForm, 'Kraska', 'xira'))
const kraskaOqCostPerTon = computed(() => getCostPerTon(costForm, 'Kraska', 'oq'))
const chalkXiraCostPerTon = computed(() => getCostPerTon(costForm, 'Mel', 'xira'))
const chalkOqCostPerTon = computed(() => getCostPerTon(costForm, 'Mel', 'oq'))
const kraskaSalePricePerTon = computed(() => getDefaultSalePricePerTon(costForm, 'Kraska'))
const chalkSalePricePerTon = computed(() => getDefaultSalePricePerTon(costForm, 'Mel'))
const tableRows = computed<Record<string, unknown>[]>(() => [...filteredExpenses.value])

const resetExpenseForm = () => {
  Object.assign(expenseForm, createExpenseFormState())
  editingId.value = null
  formError.value = ''
}

const openCreateModal = () => {
  if (!isAdmin.value) {
    return
  }

  resetExpenseForm()
  previousWorkerSuggestion.value = 0
  modalOpen.value = true
}

const openEditModal = (row: Record<string, unknown>) => {
  if (!isAdmin.value) {
    return
  }

  const record = row as OperationalExpense

  Object.assign(expenseForm, {
    date: record.date,
    factory: record.factory,
    category: record.category,
    description: record.description,
    amount: record.amount,
    paymentMethod: record.paymentMethod,
    materialType: record.materialType,
    bagType: record.bagType,
    materialQuantity: record.materialQuantity,
    notes: record.notes
  })

  editingId.value = record.id
  previousWorkerSuggestion.value = 0
  formError.value = ''
  modalOpen.value = true
}

const saveExpense = () => {
  if (!isAdmin.value) {
    return
  }

  const payload: Omit<OperationalExpense, 'id'> = {
    date: expenseForm.date,
    factory: expenseForm.factory,
    category: expenseForm.category as ExpenseCategory,
    description: expenseForm.description.trim(),
    amount: Number(expenseForm.amount),
    paymentMethod: expenseForm.paymentMethod as PaymentMethod,
    materialType: expenseForm.category === 'Tosh' ? 'stone' : expenseForm.category === 'Xira qop' || expenseForm.category === 'Oq qop' ? 'bag' : '',
    bagType: expenseForm.category === 'Oq qop' ? 'oq' : expenseForm.category === 'Xira qop' ? 'xira' : '',
    materialQuantity: isMaterialExpense.value ? Number(expenseForm.materialQuantity) : 0,
    notes: expenseForm.notes.trim()
  }

  if (!payload.date || !payload.description) {
    formError.value = 'Sana va tavsifni kiriting.'
    return
  }

  if (payload.category === 'Ishchi' && !payload.factory) {
    formError.value = 'Ishchi chiqimi uchun zavodni tanlang.'
    return
  }

  if (isMaterialExpense.value && !payload.factory) {
    formError.value = 'Tosh yoki qop chiqimi uchun zavodni tanlang.'
    return
  }

  if (isMaterialExpense.value && payload.materialQuantity <= 0) {
    formError.value = 'Tosh yoki qop miqdorini kiriting.'
    return
  }

  if (payload.amount <= 0) {
    formError.value = 'Chiqim summasi 0 dan katta bo`lishi kerak.'
    return
  }

  if (editingId.value) {
    updateExpense({
      id: editingId.value,
      ...payload
    })
  } else {
    addExpense(payload)
  }

  modalOpen.value = false
  resetExpenseForm()
}

const askDelete = (row: Record<string, unknown>) => {
  if (!isAdmin.value) {
    return
  }

  selectedExpense.value = row as OperationalExpense
  deleteDialogOpen.value = true
}

const confirmDelete = () => {
  if (!isAdmin.value) {
    return
  }

  if (selectedExpense.value) {
    removeExpense(selectedExpense.value.id)
  }

  selectedExpense.value = null
  deleteDialogOpen.value = false
}

const closeDelete = () => {
  selectedExpense.value = null
  deleteDialogOpen.value = false
}

const clearFilters = () => {
  filters.startDate = ''
  filters.endDate = ''
  filters.factory = ''
  filters.category = ''
}

const saveDefaultCosts = () => {
  if (!isAdmin.value) {
    return
  }

  updateDefaultCosts({
    sandPricePerTon: Number(costForm.sandPricePerTon),
    chalkPricePerTon: Number(costForm.chalkPricePerTon),
    sandWorkerCostPerTon: Number(costForm.sandWorkerCostPerTon),
    chalkWorkerCostPerTon: Number(costForm.chalkWorkerCostPerTon),
    marketCostPerTon: Number(costForm.marketCostPerTon),
    loadingCostPerTon: Number(costForm.loadingCostPerTon),
    foodCostPerTon: Number(costForm.foodCostPerTon),
    supervisorCostPerTon: Number(costForm.supervisorCostPerTon),
    electricityCostPerTon: Number(costForm.electricityCostPerTon),
    stoneCostPerTon: Number(costForm.stoneCostPerTon),
    xiraBagCostPerTon: Number(costForm.xiraBagCostPerTon),
    oqBagCostPerTon: Number(costForm.oqBagCostPerTon)
  })
}

const resetCostForm = () => {
  Object.assign(costForm, defaultCosts.value)
}

watch(
  () => [expenseForm.category, expenseForm.factory, expenseForm.date] as const,
  () => {
    if (expenseForm.category !== 'Ishchi') {
      previousWorkerSuggestion.value = 0
      return
    }

    const suggestion = workerExpenseSuggestion.value

    if (Number(expenseForm.amount) <= 0 || Number(expenseForm.amount) === previousWorkerSuggestion.value) {
      expenseForm.amount = suggestion
    }

    previousWorkerSuggestion.value = suggestion
  },
  { immediate: true }
)

watch(
  () => expenseForm.category,
  (category) => {
    if (category === 'Tosh') {
      expenseForm.materialType = 'stone'
      expenseForm.bagType = ''
      return
    }

    if (category === 'Xira qop') {
      expenseForm.materialType = 'bag'
      expenseForm.bagType = 'xira'
      return
    }

    if (category === 'Oq qop') {
      expenseForm.materialType = 'bag'
      expenseForm.bagType = 'oq'
      return
    }

    expenseForm.materialType = ''
    expenseForm.bagType = ''
    expenseForm.materialQuantity = 0
  },
  { immediate: true }
)
</script>

<template>
  <section class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h2 class="page-title">{{ t('Chiqimlar') }}</h2>
      <p class="page-subtitle">{{ t("Kunlik chiqimlar, default sotuv narxlari va avtomatik tannarx sozlamalari.") }}</p>
      <AdminReadOnlyBanner v-if="!isAdmin" class="mt-3" />
    </div>
    <button v-if="isAdmin" type="button" class="btn-primary" @click="openCreateModal">{{ t("Chiqim qo'shish") }}</button>
  </section>

  <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <StatCard title="Jami chiqim" :value="formatSom(expensesSummary.total)" subtitle="filtrlangan yozuvlar" />
    <StatCard title="Yozuvlar" :value="expensesSummary.count" subtitle="chiqimlar soni" />
    <StatCard title="Kategoriya" :value="expensesSummary.categories" subtitle="faol turlar" />
    <StatCard title="Kraska · Xira qop" :value="formatSom(kraskaXiraCostPerTon)" subtitle="1 kg tannarx" />
    <StatCard title="Kraska · Oq qop" :value="formatSom(kraskaOqCostPerTon)" subtitle="1 kg tannarx" />
    <StatCard title="Mel · Xira qop" :value="formatSom(chalkXiraCostPerTon)" subtitle="1 kg tannarx" />
    <StatCard title="Mel · Oq qop" :value="formatSom(chalkOqCostPerTon)" subtitle="1 kg tannarx" />
  </section>

  <section class="panel p-4">
    <div class="flex flex-wrap gap-2 border-b border-slate-100 pb-4">
      <button type="button" class="btn-secondary !px-3 !py-1.5 text-xs" @click="setCurrentMonth(filters)">{{ t('Joriy oy') }}</button>
      <button type="button" class="btn-secondary !px-3 !py-1.5 text-xs" @click="setRecentDays(filters, 30)">{{ t('Oxirgi 30 kun') }}</button>
      <button type="button" class="btn-secondary !px-3 !py-1.5 text-xs" @click="setRecentDays(filters, 7)">{{ t('Oxirgi 7 kun') }}</button>
      <button type="button" class="btn-secondary !px-3 !py-1.5 text-xs" @click="clearFilters">{{ t('Hammasi') }}</button>
    </div>

    <div class="mt-4 grid gap-3 md:grid-cols-5">
      <AppInput v-model="filters.startDate" type="date" label="Boshlanish sanasi" />
      <AppInput v-model="filters.endDate" type="date" label="Tugash sanasi" />
      <AppSelect v-model="filters.factory" label="Zavod" :options="factoryOptions" placeholder="Hamma zavod" />
      <AppSelect
        v-model="filters.category"
        label="Kategoriya"
        :options="expenseCategories.map((item) => ({ label: item, value: item }))"
        placeholder="Hamma kategoriya"
      />
      <div class="flex items-end">
        <button type="button" class="btn-secondary w-full" @click="clearFilters">{{ t('Filtrni tozalash') }}</button>
      </div>
    </div>
  </section>

  <section class="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
    <article class="panel p-5">
      <header class="mb-4">
        <h3 class="text-base font-semibold text-slate-900">Kunlik chiqimlar</h3>
      </header>

      <AppTable :columns="columns" :rows="tableRows" empty-text="Chiqim yozuvlari topilmadi.">
        <template #cell-category="{ value }">
          <span class="data-chip">{{ value }}</span>
        </template>

        <template #cell-amount="{ value }">
          {{ formatSom(Number(value)) }}
        </template>

        <template #cell-materialQuantity="{ row, value }">
          <span v-if="row.materialType === 'stone'">{{ Number(value).toLocaleString('uz-UZ') }} t</span>
          <span v-else-if="row.materialType === 'bag'">{{ Math.round(Number(value)).toLocaleString('uz-UZ') }} dona</span>
          <span v-else>-</span>
        </template>

      <template #cell-actions="{ row }">
        <div class="flex justify-end gap-2">
          <template v-if="isAdmin">
            <button type="button" class="btn-secondary !px-3 !py-1.5 text-xs" @click="openEditModal(row)">{{ t('Tahrirlash') }}</button>
            <button type="button" class="btn-danger !px-3 !py-1.5 text-xs" @click="askDelete(row)">O'chirish</button>
          </template>
          <span v-else class="text-xs text-slate-400">Faqat admin</span>
        </div>
      </template>
      </AppTable>
    </article>

    <article class="panel p-5">
      <header class="mb-4 flex items-center justify-between">
        <div>
          <h3 class="text-base font-semibold text-slate-900">Avtomatik tannarx sozlamasi</h3>
          <p class="text-xs text-slate-500">Bu qiymatlar o'zgarsa kunlik hisob, dashboard va hisobotlar avtomatik yangilanadi</p>
        </div>
        <span class="data-chip">Xira va oq qop tannarxi alohida</span>
      </header>

      <div class="mb-4 grid gap-3 md:grid-cols-2">
        <div class="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
          <p class="text-xs text-sky-700">Kraska sotuv narxi / kg</p>
          <p class="mt-1 text-lg font-semibold text-sky-900">{{ formatSom(kraskaSalePricePerTon) }}</p>
        </div>
        <div class="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
          <p class="text-xs text-sky-700">Mel sotuv narxi / kg</p>
          <p class="mt-1 text-lg font-semibold text-sky-900">{{ formatSom(chalkSalePricePerTon) }}</p>
        </div>
      </div>

      <div class="mb-4 grid gap-3 md:grid-cols-2">
        <div class="rounded-2xl bg-slate-50 px-4 py-3">
          <p class="text-xs text-slate-500">Kraska · Xira / Oq qop</p>
          <p class="mt-1 text-lg font-semibold text-slate-900">{{ formatSom(kraskaXiraCostPerTon) }} / {{ formatSom(kraskaOqCostPerTon) }}</p>
        </div>
        <div class="rounded-2xl bg-slate-50 px-4 py-3">
          <p class="text-xs text-slate-500">Mel · Xira / Oq qop</p>
          <p class="mt-1 text-lg font-semibold text-slate-900">{{ formatSom(chalkXiraCostPerTon) }} / {{ formatSom(chalkOqCostPerTon) }}</p>
        </div>
      </div>

      <div class="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
        `450` sotuv narxi `/kg`. Tannarxga kirmaydi. Qoplik tannarxida `ishchi + qo‘shimcha xarajat + ortib berish + ovqat + boshqaruvchi + svet + tosh + tanlangan qop`
        hisoblanadi.
      </div>

      <div class="grid gap-3 md:grid-cols-2">
        <AppInput v-model="costForm.sandPricePerTon" type="number" min="0" step="0.01" label="Kraska sotuv narxi / kg" :disabled="!isAdmin" />
        <AppInput v-model="costForm.chalkPricePerTon" type="number" min="0" step="0.01" label="Mel sotuv narxi / kg" :disabled="!isAdmin" />
        <AppInput v-model="costForm.sandWorkerCostPerTon" type="number" min="0" step="0.01" label="Kraska ishchi" :disabled="!isAdmin" />
        <AppInput v-model="costForm.chalkWorkerCostPerTon" type="number" min="0" step="0.01" label="Mel ishchi" :disabled="!isAdmin" />
        <AppInput v-model="costForm.marketCostPerTon" type="number" min="0" step="0.01" label="Qo‘shimcha xarajat" :disabled="!isAdmin" />
        <AppInput v-model="costForm.loadingCostPerTon" type="number" min="0" step="0.01" label="Ortib berish" :disabled="!isAdmin" />
        <AppInput v-model="costForm.foodCostPerTon" type="number" min="0" step="0.01" label="Ovqat" :disabled="!isAdmin" />
        <AppInput v-model="costForm.supervisorCostPerTon" type="number" min="0" step="0.01" label="Boshqaruvchi" :disabled="!isAdmin" />
        <AppInput v-model="costForm.electricityCostPerTon" type="number" min="0" step="0.01" label="Svet" :disabled="!isAdmin" />
        <AppInput v-model="costForm.stoneCostPerTon" type="number" min="0" step="0.01" label="Tosh" :disabled="!isAdmin" />
        <AppInput v-model="costForm.xiraBagCostPerTon" type="number" min="0" step="0.01" label="Xira qop narxi" :disabled="!isAdmin" />
        <AppInput v-model="costForm.oqBagCostPerTon" type="number" min="0" step="0.01" label="Oq qop narxi" :disabled="!isAdmin" />
      </div>

      <div v-if="isAdmin" class="mt-4 flex justify-end gap-2">
        <button type="button" class="btn-secondary" @click="resetCostForm">{{ t('Orqaga qaytarish') }}</button>
        <button type="button" class="btn-primary" @click="saveDefaultCosts">{{ t('Saqlash') }}</button>
      </div>

      <div class="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Kraska va Mel ishchi tannarxi alohida. Sotuv narxlari tannarxga qo'shilmaydi.
        `Qo‘shimcha xarajat` ishlab chiqarilgan jami mahsulotga qo'shiladi. Qop narxi kunlik hisobda tanlangan qop turidan olinadi.
      </div>
    </article>
  </section>

  <AppModal :open="modalOpen" :title="editingId ? 'Chiqimni tahrirlash' : 'Chiqim qo`shish'" @close="modalOpen = false">
    <div class="grid gap-4 md:grid-cols-2">
      <AppInput v-model="expenseForm.date" type="date" label="Sana" :invalid="Boolean(formError) && !expenseForm.date" required />
      <AppSelect
        v-model="expenseForm.factory"
        label="Zavod"
        :options="factoryOptions"
        placeholder="Umumiy chiqim"
        :invalid="Boolean(formError) && expenseForm.category === 'Ishchi' && !expenseForm.factory"
      />
      <AppSelect
        v-model="expenseForm.category"
        label="Kategoriya"
        :options="expenseCategories.map((item) => ({ label: item, value: item }))"
        :invalid="Boolean(formError) && !expenseForm.category"
        required
      />
      <AppSelect
        v-model="expenseForm.paymentMethod"
        label="To`lov turi"
        :options="paymentMethods.map((item) => ({ label: item, value: item }))"
        :invalid="Boolean(formError) && !expenseForm.paymentMethod"
        required
      />
      <AppInput
        v-model="expenseForm.description"
        label="Tavsif"
        placeholder="Nimaga chiqim bo'ldi?"
        :invalid="Boolean(formError) && !expenseForm.description.trim()"
        required
      />
      <AppInput
        v-model="expenseForm.amount"
        type="number"
        min="0"
        step="0.01"
        label="Summa"
        :invalid="Boolean(formError) && Number(expenseForm.amount) <= 0"
        required
      />
      <AppInput
        v-if="isMaterialExpense"
        v-model="expenseForm.materialQuantity"
        type="number"
        min="0"
        :step="expenseForm.category === 'Tosh' ? '0.01' : '1'"
        :label="materialExpenseLabel"
        :invalid="Boolean(formError) && isMaterialExpense && Number(expenseForm.materialQuantity) <= 0"
        required
      />
      <div class="md:col-span-2">
        <AppInput v-model="expenseForm.notes" label="Izoh" placeholder="Qo'shimcha izoh" />
      </div>
    </div>

    <div
      v-if="expenseForm.category === 'Ishchi'"
      class="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900"
    >
      <p class="font-semibold">Ishchi puli tavsiyasi</p>
      <p class="mt-1">
        {{ expenseForm.factory ? `${expenseForm.factory} uchun berilishi kerak: ${formatSom(workerExpenseSuggestion)}` : 'Ishchi uchun zavodni tanlang.' }}
      </p>
      <p class="mt-1 text-xs text-sky-700">
        {{ workerPayoutModeLabel }}
      </p>
    </div>

    <p v-if="formError" class="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {{ formError }}
    </p>

    <template #footer>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-secondary" @click="modalOpen = false">{{ t('Bekor qilish') }}</button>
        <button type="button" class="btn-primary" @click="saveExpense">
          {{ editingId ? t('Saqlash') : t("Qo`shish") }}
        </button>
      </div>
    </template>
  </AppModal>

  <ConfirmDialog
    :open="deleteDialogOpen"
    title="Chiqim yozuvini o'chirish"
    :message="`Tanlangan ${selectedExpense?.description ?? ''} chiqimini o'chirasizmi?`"
    confirm-text="O'chirish"
    cancel-text="Bekor qilish"
    @confirm="confirmDelete"
    @cancel="closeDelete"
  />
</template>
