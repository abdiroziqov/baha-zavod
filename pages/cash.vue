<script setup lang="ts">
import type { PaymentMethod, ScaleCashEntry, ScaleCashType } from '~/types/accounting'
import type { TableColumn } from '~/types/report'

definePageMeta({
  layout: 'dashboard'
})

const {
  scaleCashEntries,
  paymentMethods,
  latestDate,
  addCashEntry,
  updateCashEntry,
  removeCashEntry,
  buildSummary
} = useFactoryAccounting()
const { isAdmin } = useAuth()
const { formatSom, formatDate } = useFormatting()
const { t } = useUiLocale()

const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const formError = ref('')
const deleteDialogOpen = ref(false)
const selectedEntry = ref<ScaleCashEntry | null>(null)
const form = reactive({
  date: latestDate.value,
  type: 'kirim' as ScaleCashType,
  paymentMethod: 'Naqd' as PaymentMethod,
  amount: 0,
  description: '',
  notes: ''
})

const summary = computed(() => buildSummary())
const columns: TableColumn[] = [
  { key: 'date', label: 'Sana' },
  { key: 'type', label: 'Turi' },
  { key: 'paymentMethod', label: "To'lov turi" },
  { key: 'amount', label: 'Summa', align: 'right' },
  { key: 'description', label: 'Nomi' },
  { key: 'actions', label: 'Amal', align: 'right' }
]
const rows = computed<Record<string, unknown>[]>(() =>
  scaleCashEntries.value.slice().sort((left, right) => right.date.localeCompare(left.date))
)

const resetForm = () => {
  Object.assign(form, {
    date: latestDate.value,
    type: 'kirim',
    paymentMethod: 'Naqd',
    amount: 0,
    description: '',
    notes: ''
  })
  editingId.value = null
  formError.value = ''
}

const openCreateModal = (opening = false) => {
  if (!isAdmin.value) return
  resetForm()
  if (opening) form.description = "O'tgan oydan boshlang'ich qoldiq"
  modalOpen.value = true
}

const openEditModal = (row: Record<string, unknown>) => {
  if (!isAdmin.value) return
  const record = row as ScaleCashEntry
  Object.assign(form, {
    date: record.date,
    type: record.type,
    paymentMethod: record.paymentMethod,
    amount: record.amount,
    description: record.description,
    notes: record.notes
  })
  editingId.value = record.id
  modalOpen.value = true
}

const saveEntry = () => {
  if (!isAdmin.value) return

  if (!form.date || Number(form.amount) <= 0 || !form.description.trim()) {
    formError.value = 'Sana, summa va nomini kiriting.'
    return
  }

  const payload = {
    date: form.date,
    type: form.type,
    paymentMethod: form.paymentMethod,
    amount: Number(form.amount),
    description: form.description.trim(),
    notes: form.notes.trim()
  }

  if (editingId.value) {
    const existing = scaleCashEntries.value.find((record) => record.id === editingId.value)
    if (existing) updateCashEntry({ ...existing, ...payload })
  } else {
    addCashEntry(payload)
  }

  modalOpen.value = false
  resetForm()
}

const askDelete = (row: Record<string, unknown>) => {
  if (!isAdmin.value) return
  selectedEntry.value = row as ScaleCashEntry
  deleteDialogOpen.value = true
}

const confirmDelete = () => {
  if (!isAdmin.value || !selectedEntry.value) return
  removeCashEntry(selectedEntry.value.id)
  selectedEntry.value = null
  deleteDialogOpen.value = false
}
</script>

<template>
  <section class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h2 class="page-title">{{ t('Pul') }}</h2>
      <p class="page-subtitle">Naqd, Click va Prichesleniya pul qoldig‘i.</p>
    </div>
    <div class="flex flex-wrap gap-2">
      <NuxtLink to="/debtors" class="btn-secondary">Klientdan pul keldi</NuxtLink>
      <button v-if="isAdmin" type="button" class="btn-secondary" @click="openCreateModal(true)">O‘tgan oy qoldig‘i</button>
      <button v-if="isAdmin" type="button" class="btn-primary" @click="openCreateModal(false)">Pul qo‘shish</button>
    </div>
  </section>

  <section class="grid gap-4 sm:grid-cols-3">
    <StatCard
      v-for="item in summary.paymentMethodBreakdown"
      :key="item.method"
      :title="item.method"
      :value="formatSom(item.balance)"
      :subtitle="`Kirim ${formatSom(item.incoming)} · Chiqim ${formatSom(item.outgoing)}`"
    />
  </section>

  <p class="text-sm text-slate-500">
    Klientdan kelgan pulni kiritish: <NuxtLink to="/debtors" class="font-semibold text-blue-700">Qarzdorlar</NuxtLink>
    bo‘limida klient qatoridagi “To‘lov” tugmasini bosing.
  </p>

  <section class="panel p-5">
    <AppTable :columns="columns" :rows="rows" empty-text="Qo‘lda kiritilgan pul yozuvi yo‘q.">
      <template #cell-date="{ value }">{{ formatDate(String(value)) }}</template>
      <template #cell-type="{ value }">
        <span :class="value === 'kirim' ? 'data-chip text-emerald-700' : 'data-chip text-rose-700'">
          {{ value === 'kirim' ? 'Kirim' : 'Chiqim' }}
        </span>
      </template>
      <template #cell-amount="{ value }">{{ formatSom(Number(value)) }}</template>
      <template #cell-actions="{ row }">
        <div class="flex justify-end gap-2">
          <template v-if="isAdmin">
            <button type="button" class="btn-secondary !px-3 !py-1.5 text-xs" @click="openEditModal(row)">Tahrirlash</button>
            <button type="button" class="btn-danger !px-3 !py-1.5 text-xs" @click="askDelete(row)">O‘chirish</button>
          </template>
        </div>
      </template>
    </AppTable>
  </section>

  <AppModal :open="modalOpen" :title="editingId ? 'Pul yozuvini tahrirlash' : 'Pul qo‘shish'" size="lg" @close="modalOpen = false">
    <div class="grid gap-4 md:grid-cols-2">
      <AppInput v-model="form.date" type="date" label="Sana" required />
      <AppSelect
        v-model="form.type"
        label="Turi"
        :options="[
          { label: 'Kirim', value: 'kirim' },
          { label: 'Chiqim', value: 'chiqim' }
        ]"
      />
      <AppSelect
        v-model="form.paymentMethod"
        label="To‘lov turi"
        :options="paymentMethods.map((item) => ({ label: item, value: item }))"
      />
      <AppInput v-model="form.amount" type="number" min="0" step="1" label="Summa" required />
      <AppInput v-model="form.description" label="Nomi" placeholder="Masalan, o‘tgan oydan qoldiq" required />
      <AppInput v-model="form.notes" label="Izoh" />
    </div>

    <p v-if="formError" class="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ formError }}</p>

    <template #footer>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-secondary" @click="modalOpen = false">Bekor qilish</button>
        <button type="button" class="btn-primary" @click="saveEntry">Saqlash</button>
      </div>
    </template>
  </AppModal>

  <ConfirmDialog
    :open="deleteDialogOpen"
    title="Pul yozuvini o‘chirish"
    message="Tanlangan pul yozuvi o‘chirilsinmi?"
    confirm-text="O‘chirish"
    cancel-text="Bekor qilish"
    @confirm="confirmDelete"
    @cancel="deleteDialogOpen = false"
  />
</template>
