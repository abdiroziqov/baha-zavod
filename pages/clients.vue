<script setup lang="ts">
import type { ContactRecord } from '~/types/accounting'
import type { TableColumn } from '~/types/report'

definePageMeta({
  layout: 'dashboard'
})

const {
  clientContacts,
  clientSummaries,
  addContact,
  updateContact,
  removeContact
} = useFactoryAccounting()
const { isAdmin } = useAuth()
const { formatSom, formatTons, formatDate } = useFormatting()
const { t } = useUiLocale()

const search = ref('')
const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const formError = ref('')
const deleteDialogOpen = ref(false)
const selectedClient = ref<ContactRecord | null>(null)
const form = reactive({
  name: '',
  phone: '',
  notes: ''
})

const columns: TableColumn[] = [
  { key: 'name', label: 'Klient' },
  { key: 'phone', label: 'Telefon' },
  { key: 'totalTons', label: 'Tonna', align: 'right' },
  { key: 'balanceAmount', label: 'Balans', align: 'right' },
  { key: 'lastPurchaseDate', label: 'Oxirgi savdo' },
  { key: 'actions', label: 'Amal', align: 'right' }
]

const rows = computed<Record<string, unknown>[]>(() => {
  const query = search.value.trim().toLowerCase()

  return clientContacts.value
    .filter((contact) => !query || `${contact.name} ${contact.phone}`.toLowerCase().includes(query))
    .map((contact) => {
      const summary = clientSummaries.value.find(
        (record) => record.clientName.trim().toLowerCase() === contact.name.trim().toLowerCase()
      )

      return {
        ...contact,
        totalTons: summary?.totalTons ?? 0,
        balanceType: summary?.balanceType ?? 'yopilgan',
        balanceAmount: summary?.balanceAmount ?? 0,
        lastPurchaseDate: summary?.lastPurchaseDate ?? ''
      }
    })
})

const totalDebt = computed(() =>
  clientSummaries.value
    .filter((record) => record.balanceType === 'bizga_qarz')
    .reduce((sum, record) => sum + record.balanceAmount, 0)
)
const totalAdvance = computed(() =>
  clientSummaries.value
    .filter((record) => record.balanceType === 'bizdan_qarz')
    .reduce((sum, record) => sum + record.balanceAmount, 0)
)
const totalTons = computed(() => clientSummaries.value.reduce((sum, record) => sum + record.totalTons, 0))

const balanceClass = (value: unknown) => {
  if (value === 'bizga_qarz') return 'text-rose-700'
  if (value === 'bizdan_qarz') return 'text-sky-700'
  return 'text-emerald-700'
}

const balanceLabel = (value: unknown) => {
  if (value === 'bizga_qarz') return 'Bizga qarz'
  if (value === 'bizdan_qarz') return 'Bizdan qarz'
  return 'Yopilgan'
}

const resetForm = () => {
  Object.assign(form, {
    name: '',
    phone: '',
    notes: ''
  })
  editingId.value = null
  formError.value = ''
}

const openCreateModal = () => {
  if (!isAdmin.value) return
  resetForm()
  modalOpen.value = true
}

const openEditModal = (row: Record<string, unknown>) => {
  if (!isAdmin.value) return
  const record = row as ContactRecord
  Object.assign(form, {
    name: record.name,
    phone: record.phone,
    notes: record.notes
  })
  editingId.value = record.id
  formError.value = ''
  modalOpen.value = true
}

const saveClient = () => {
  if (!isAdmin.value) return
  const name = form.name.trim()

  if (!name) {
    formError.value = 'Klient nomini kiriting.'
    return
  }

  const duplicate = clientContacts.value.find(
    (contact) => contact.id !== editingId.value && contact.name.trim().toLowerCase() === name.toLowerCase()
  )

  if (duplicate) {
    formError.value = 'Bu klient ro`yxatda bor.'
    return
  }

  const payload = {
    type: 'client' as const,
    name,
    phone: form.phone.trim(),
    notes: form.notes.trim()
  }

  if (editingId.value) {
    const existing = clientContacts.value.find((contact) => contact.id === editingId.value)
    if (existing) updateContact({ ...existing, ...payload })
  } else {
    addContact(payload)
  }

  modalOpen.value = false
  resetForm()
}

const askDelete = (row: Record<string, unknown>) => {
  if (!isAdmin.value) return
  selectedClient.value = row as ContactRecord
  deleteDialogOpen.value = true
}

const confirmDelete = () => {
  if (!isAdmin.value || !selectedClient.value) return
  removeContact(selectedClient.value.id)
  selectedClient.value = null
  deleteDialogOpen.value = false
}
</script>

<template>
  <section class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h2 class="page-title">{{ t('Klientlar') }}</h2>
      <p class="page-subtitle">{{ t("Klient kontakti, sotuv hajmi va joriy balansi.") }}</p>
      <AdminReadOnlyBanner v-if="!isAdmin" class="mt-3" />
    </div>
    <button v-if="isAdmin" type="button" class="btn-primary" @click="openCreateModal">
      {{ t("Klient qo'shish") }}
    </button>
  </section>

  <section class="grid gap-4 sm:grid-cols-3">
    <StatCard title="Klientlar" :value="clientContacts.length" subtitle="ro'yxatdagi klientlar" />
    <StatCard title="Bizga qarz" :value="formatSom(totalDebt)" subtitle="ochiq klient qarzi" />
    <StatCard title="Jami sotuv" :value="formatTons(totalTons)" :subtitle="`Avans: ${formatSom(totalAdvance)}`" />
  </section>

  <section class="panel p-4">
    <AppInput v-model="search" label="Qidirish" placeholder="Klient yoki telefon" />
  </section>

  <section class="panel p-5">
    <AppTable :columns="columns" :rows="rows" empty-text="Klient topilmadi.">
      <template #cell-phone="{ value }">{{ value || '-' }}</template>
      <template #cell-totalTons="{ value }">{{ formatTons(Number(value)) }}</template>
      <template #cell-balanceAmount="{ row, value }">
        <span :class="['font-semibold', balanceClass(row.balanceType)]">
          {{ balanceLabel(row.balanceType) }}: {{ formatSom(Number(value)) }}
        </span>
      </template>
      <template #cell-lastPurchaseDate="{ value }">{{ value ? formatDate(String(value)) : '-' }}</template>
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

  <AppModal :open="modalOpen" :title="editingId ? 'Klientni tahrirlash' : 'Klient qo`shish'" size="lg" @close="modalOpen = false">
    <div class="grid gap-4 md:grid-cols-2">
      <AppInput v-model="form.name" label="Nomi" :invalid="Boolean(formError) && !form.name.trim()" required />
      <AppInput v-model="form.phone" label="Telefon" placeholder="+998..." />
      <div class="md:col-span-2">
        <AppInput v-model="form.notes" label="Izoh" />
      </div>
    </div>

    <p v-if="formError" class="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ formError }}</p>

    <template #footer>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-secondary" @click="modalOpen = false">{{ t('Bekor qilish') }}</button>
        <button type="button" class="btn-primary" @click="saveClient">{{ editingId ? t('Saqlash') : t("Qo`shish") }}</button>
      </div>
    </template>
  </AppModal>

  <ConfirmDialog
    :open="deleteDialogOpen"
    title="Klientni o'chirish"
    :message="`${selectedClient?.name ?? ''} ro'yxatdan o'chirilsinmi? Eski sotuv yozuvlari o'chmaydi.`"
    confirm-text="O'chirish"
    cancel-text="Bekor qilish"
    @confirm="confirmDelete"
    @cancel="deleteDialogOpen = false"
  />
</template>
