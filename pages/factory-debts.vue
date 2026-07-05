<script setup lang="ts">
import type { FactoryName, OperationalExpense, PaymentMethod } from '~/types/accounting'
import type { TableColumn } from '~/types/report'

definePageMeta({
  layout: 'dashboard'
})

const {
  expenses,
  factoryOptions,
  paymentMethods,
  latestDate,
  addExpense,
  removeExpense
} = useFactoryAccounting()
const { isAdmin } = useAuth()
const { formatSom, formatDate } = useFormatting()
const { t } = useUiLocale()

const filters = reactive({
  factory: ''
})
const form = reactive({
  date: latestDate.value,
  factory: 'Tepa shpaklevka' as FactoryName,
  description: 'Zavod qarzi',
  amount: 0,
  paymentMethod: 'Naqd' as PaymentMethod,
  notes: ''
})
const modalOpen = ref(false)
const formError = ref('')
const deleteDialogOpen = ref(false)
const selectedRecord = ref<OperationalExpense | null>(null)

const columns: TableColumn[] = [
  { key: 'date', label: 'Sana' },
  { key: 'factory', label: 'Zavod' },
  { key: 'description', label: 'Tavsif' },
  { key: 'paymentMethod', label: 'To`lov turi' },
  { key: 'amount', label: 'Summa', align: 'right' },
  { key: 'actions', label: 'Amal', align: 'right' }
]

const rows = computed<Record<string, unknown>[]>(() =>
  expenses.value
    .filter((record) => record.category === 'Zavod qarzi')
    .filter((record) => !filters.factory || record.factory === filters.factory)
    .slice()
    .sort((left, right) => right.date.localeCompare(left.date))
)

const totalDebt = computed(() =>
  rows.value.reduce((sum, record) => sum + Number(record.amount), 0)
)

const resetForm = () => {
  Object.assign(form, {
    date: latestDate.value,
    factory: 'Tepa shpaklevka',
    description: 'Zavod qarzi',
    amount: 0,
    paymentMethod: 'Naqd',
    notes: ''
  })
  formError.value = ''
}

const openCreateModal = () => {
  if (!isAdmin.value) return
  resetForm()
  modalOpen.value = true
}

const saveDebt = () => {
  if (!isAdmin.value) return

  if (!form.date || !form.factory || !form.description.trim()) {
    formError.value = 'Sana, zavod va tavsifni kiriting.'
    return
  }

  if (Number(form.amount) <= 0) {
    formError.value = 'Summa 0 dan katta bo`lishi kerak.'
    return
  }

  addExpense({
    date: form.date,
    factory: form.factory,
    category: 'Zavod qarzi',
    description: form.description.trim(),
    amount: Number(form.amount),
    paymentMethod: form.paymentMethod,
    materialType: '',
    bagType: '',
    materialQuantity: 0,
    notes: form.notes.trim()
  })

  modalOpen.value = false
  resetForm()
}

const askDelete = (row: Record<string, unknown>) => {
  if (!isAdmin.value) return
  selectedRecord.value = row as OperationalExpense
  deleteDialogOpen.value = true
}

const confirmDelete = () => {
  if (!isAdmin.value || !selectedRecord.value) return
  removeExpense(selectedRecord.value.id)
  selectedRecord.value = null
  deleteDialogOpen.value = false
}
</script>

<template>
  <section class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h2 class="page-title">{{ t('Zavod qarzi') }}</h2>
      <p class="page-subtitle">{{ t("Zavodga bog'langan qarz va alohida to'lovlar shu yerda yuritiladi.") }}</p>
      <AdminReadOnlyBanner v-if="!isAdmin" class="mt-3" />
    </div>
    <button v-if="isAdmin" type="button" class="btn-primary" @click="openCreateModal">{{ t("Qarz qo'shish") }}</button>
  </section>

  <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <StatCard title="Jami zavod qarzi" :value="formatSom(totalDebt)" subtitle="filtrlangan yozuvlar" />
    <StatCard title="Yozuvlar" :value="rows.length" subtitle="qarz yozuvlari" />
  </section>

  <section class="panel p-4">
    <div class="grid gap-3 md:grid-cols-[1fr_auto]">
      <AppSelect v-model="filters.factory" label="Zavod" :options="factoryOptions" placeholder="Hamma zavod" />
      <div class="flex items-end">
        <button type="button" class="btn-secondary w-full" @click="filters.factory = ''">{{ t('Filtrni tozalash') }}</button>
      </div>
    </div>
  </section>

  <section class="panel p-5">
    <AppTable :columns="columns" :rows="rows" empty-text="Zavod qarzi yozuvlari topilmadi.">
      <template #cell-date="{ value }">{{ formatDate(String(value)) }}</template>
      <template #cell-amount="{ value }">{{ formatSom(Number(value)) }}</template>
      <template #cell-actions="{ row }">
        <div class="flex justify-end gap-2">
          <button v-if="isAdmin" type="button" class="btn-danger !px-3 !py-1.5 text-xs" @click="askDelete(row)">
            {{ t("O'chirish") }}
          </button>
        </div>
      </template>
    </AppTable>
  </section>

  <AppModal :open="modalOpen" title="Zavod qarzi qo`shish" size="lg" @close="modalOpen = false">
    <div class="grid gap-4 md:grid-cols-2">
      <AppInput v-model="form.date" type="date" label="Sana" required />
      <AppSelect v-model="form.factory" label="Zavod" :options="factoryOptions" required />
      <AppInput v-model="form.description" label="Tavsif" placeholder="Masalan, ustaga qarz" required />
      <AppSelect
        v-model="form.paymentMethod"
        label="To`lov turi"
        :options="paymentMethods.map((item) => ({ label: item, value: item }))"
        required
      />
      <AppInput v-model="form.amount" type="number" min="0" step="0.01" label="Summa" required />
      <AppInput v-model="form.notes" label="Izoh" placeholder="Qo'shimcha izoh" />
    </div>

    <p v-if="formError" class="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ formError }}</p>

    <template #footer>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-secondary" @click="modalOpen = false">{{ t('Bekor qilish') }}</button>
        <button type="button" class="btn-primary" @click="saveDebt">{{ t("Qo`shish") }}</button>
      </div>
    </template>
  </AppModal>

  <ConfirmDialog
    :open="deleteDialogOpen"
    title="Zavod qarzini o'chirish"
    message="Tanlangan zavod qarzi yozuvi o'chirilsinmi?"
    confirm-text="O'chirish"
    cancel-text="Bekor qilish"
    @confirm="confirmDelete"
    @cancel="deleteDialogOpen = false"
  />
</template>
