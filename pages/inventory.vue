<script setup lang="ts">
import type { FactoryName, OpeningBalanceRecord } from '~/types/accounting'
import type { TableColumn } from '~/types/report'

definePageMeta({
  layout: 'dashboard'
})

const {
  factoryOptions,
  openingBalances,
  addOpeningBalance,
  updateOpeningBalance,
  removeOpeningBalance,
  buildSummary
} = useFactoryAccounting()
const { isAdmin } = useAuth()
const { formatTons, formatDate } = useFormatting()
const { setRecentDays, setCurrentMonth } = useDateRangePresets()
const { t } = useUiLocale()

const filters = reactive({
  startDate: '',
  endDate: '',
  factory: ''
})
const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const formError = ref('')
const deleteDialogOpen = ref(false)
const selectedOpening = ref<OpeningBalanceRecord | null>(null)
const form = reactive({
  date: new Date().toISOString().slice(0, 10),
  factory: 'Tepa shpaklevka' as FactoryName,
  stoneTons: 0,
  kraskaTons: 0,
  melTons: 0,
  xiraBagCount: 0,
  oqBagCount: 0,
  notes: ''
})

const summary = computed(() => buildSummary(filters.startDate, filters.endDate, filters.factory as FactoryName | ''))

const balanceColumns: TableColumn[] = [
  { key: 'factory', label: 'Zavod' },
  { key: 'stoneBalance', label: 'Tosh qoldiq', align: 'right' },
  { key: 'remainingKraskaTons', label: 'Kraska qoldiq', align: 'right' },
  { key: 'remainingMelTons', label: 'Mel qoldiq', align: 'right' },
  { key: 'remainingXiraBagCount', label: 'Xira qop', align: 'right' },
  { key: 'remainingOqBagCount', label: 'Oq qop', align: 'right' }
]

const openingColumns: TableColumn[] = [
  { key: 'date', label: 'Sana' },
  { key: 'factory', label: 'Zavod' },
  { key: 'stoneTons', label: 'Tosh', align: 'right' },
  { key: 'kraskaTons', label: 'Kraska', align: 'right' },
  { key: 'melTons', label: 'Mel', align: 'right' },
  { key: 'xiraBagCount', label: 'Xira qop', align: 'right' },
  { key: 'oqBagCount', label: 'Oq qop', align: 'right' },
  { key: 'actions', label: 'Amal', align: 'right' }
]

const balanceRows = computed<Record<string, unknown>[]>(() => [...summary.value.factoryBreakdown])
const openingRows = computed<Record<string, unknown>[]>(() =>
  openingBalances.value.slice().sort((left, right) => right.date.localeCompare(left.date))
)

const clearFilters = () => {
  filters.startDate = ''
  filters.endDate = ''
  filters.factory = ''
}

const balanceClass = (value: number) => (value < 0 ? 'text-rose-700' : 'text-emerald-700')

const resetForm = () => {
  Object.assign(form, {
    date: new Date().toISOString().slice(0, 10),
    factory: 'Tepa shpaklevka',
    stoneTons: 0,
    kraskaTons: 0,
    melTons: 0,
    xiraBagCount: 0,
    oqBagCount: 0,
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
  const record = row as OpeningBalanceRecord
  Object.assign(form, {
    date: record.date,
    factory: record.factory,
    stoneTons: record.stoneTons,
    kraskaTons: record.kraskaTons,
    melTons: record.melTons,
    xiraBagCount: record.xiraBagCount,
    oqBagCount: record.oqBagCount,
    notes: record.notes
  })
  editingId.value = record.id
  formError.value = ''
  modalOpen.value = true
}

const saveOpening = () => {
  if (!isAdmin.value) return

  if (!form.date || !form.factory) {
    formError.value = 'Sana va zavodni kiriting.'
    return
  }

  if ([form.stoneTons, form.kraskaTons, form.melTons, form.xiraBagCount, form.oqBagCount].some((value) => Number(value) < 0)) {
    formError.value = 'Qoldiq manfiy bo`lmasligi kerak.'
    return
  }

  const payload = {
    date: form.date,
    factory: form.factory,
    stoneTons: Number(form.stoneTons),
    kraskaTons: Number(form.kraskaTons),
    melTons: Number(form.melTons),
    xiraBagCount: Math.round(Number(form.xiraBagCount)),
    oqBagCount: Math.round(Number(form.oqBagCount)),
    bagCount: Math.round(Number(form.xiraBagCount) + Number(form.oqBagCount)),
    notes: form.notes.trim()
  }

  if (editingId.value) {
    updateOpeningBalance({
      id: editingId.value,
      productTons: payload.kraskaTons + payload.melTons,
      ...payload
    })
  } else {
    addOpeningBalance(payload)
  }

  modalOpen.value = false
  resetForm()
}

const askDelete = (row: Record<string, unknown>) => {
  if (!isAdmin.value) return
  selectedOpening.value = row as OpeningBalanceRecord
  deleteDialogOpen.value = true
}

const confirmDelete = () => {
  if (!isAdmin.value || !selectedOpening.value) return
  removeOpeningBalance(selectedOpening.value.id)
  selectedOpening.value = null
  deleteDialogOpen.value = false
}
</script>

<template>
  <section class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h2 class="page-title">{{ t('Ostatka') }}</h2>
      <p class="page-subtitle">
        {{ t("Qancha tosh va qoplik mahsulot qolganini shu yerda ko'rasiz. Manfiy chiqsa kamomad bor.") }}
      </p>
    </div>
    <button v-if="isAdmin" type="button" class="btn-primary" @click="openCreateModal">
      {{ t("Boshlang'ich qoldiq qo'shish") }}
    </button>
  </section>

  <section class="panel p-4">
    <div class="flex flex-wrap gap-2 border-b border-slate-100 pb-4">
      <button type="button" class="btn-secondary !px-3 !py-1.5 text-xs" @click="setCurrentMonth(filters)">{{ t('Joriy oy') }}</button>
      <button type="button" class="btn-secondary !px-3 !py-1.5 text-xs" @click="setRecentDays(filters, 30)">{{ t('Oxirgi 30 kun') }}</button>
      <button type="button" class="btn-secondary !px-3 !py-1.5 text-xs" @click="setRecentDays(filters, 7)">{{ t('Oxirgi 7 kun') }}</button>
      <button type="button" class="btn-secondary !px-3 !py-1.5 text-xs" @click="clearFilters">{{ t('Hammasi') }}</button>
    </div>

    <div class="mt-4 grid gap-3 md:grid-cols-4">
      <AppInput v-model="filters.startDate" type="date" label="Boshlanish sanasi" />
      <AppInput v-model="filters.endDate" type="date" label="Tugash sanasi" />
      <AppSelect v-model="filters.factory" label="Zavod" :options="factoryOptions" placeholder="Hamma zavod" />
      <div class="flex items-end">
        <button type="button" class="btn-secondary w-full" @click="clearFilters">{{ t('Filtrni tozalash') }}</button>
      </div>
    </div>
  </section>

  <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <StatCard title="Tosh qoldiq" :value="formatTons(summary.remainingStoneTons)" subtitle="kirim - sarf">
      <template #icon>TS</template>
    </StatCard>
    <StatCard title="Mel qoldiq" :value="formatTons(summary.remainingMelTons)" subtitle="boshlang'ich + ishlab chiqdi - sotildi">
      <template #icon>ML</template>
    </StatCard>
    <StatCard title="Kraska qoldiq" :value="formatTons(summary.remainingKraskaTons)" subtitle="boshlang'ich + ishlab chiqdi - sotildi">
      <template #icon>KR</template>
    </StatCard>
    <StatCard title="Xira qop" :value="summary.remainingXiraBagCount" subtitle="kirim - ishlatilgan">
      <template #icon>XQ</template>
    </StatCard>
    <StatCard title="Oq qop" :value="summary.remainingOqBagCount" subtitle="kirim - ishlatilgan">
      <template #icon>OQ</template>
    </StatCard>
    <StatCard title="Ishlatilgan qop" :value="summary.totalNewBags" subtitle="jami sarflangan qop">
      <template #icon>QB</template>
    </StatCard>
  </section>

  <section class="grid gap-4 lg:grid-cols-3">
    <article class="panel p-5 lg:col-span-2">
      <header class="mb-4">
        <h3 class="text-base font-semibold text-slate-900">{{ t("Zavodlar bo`yicha ostatka") }}</h3>
        <p class="text-xs text-slate-500">{{ t("Har bir zavodda qolgan tosh va tayyor yuk ko'rinadi.") }}</p>
      </header>

      <AppTable :columns="balanceColumns" :rows="balanceRows" empty-text="Tanlangan davrda ostatka ma'lumoti topilmadi.">
        <template #cell-stoneBalance="{ value }">
          <span :class="['font-semibold', balanceClass(Number(value))]">
            {{ formatTons(Number(value)) }}
          </span>
        </template>

        <template #cell-remainingMelTons="{ value }">
          <span :class="['font-semibold', balanceClass(Number(value))]">
            {{ formatTons(Number(value)) }}
          </span>
        </template>

        <template #cell-remainingKraskaTons="{ value }">
          <span :class="['font-semibold', balanceClass(Number(value))]">
            {{ formatTons(Number(value)) }}
          </span>
        </template>

        <template #cell-remainingXiraBagCount="{ value }">
          <span :class="['font-semibold', balanceClass(Number(value))]">
            {{ Number(value).toLocaleString('uz-UZ') }} dona
          </span>
        </template>

        <template #cell-remainingOqBagCount="{ value }">
          <span :class="['font-semibold', balanceClass(Number(value))]">
            {{ Number(value).toLocaleString('uz-UZ') }} dona
          </span>
        </template>

      </AppTable>
    </article>

    <article class="panel p-5">
      <header class="mb-4">
        <h3 class="text-base font-semibold text-slate-900">{{ t('Qanday hisoblanadi') }}</h3>
      </header>

      <div class="space-y-3 text-sm text-slate-600">
        <div class="rounded-2xl bg-amber-50 px-4 py-3 text-amber-800">
          <p class="font-semibold text-amber-900">O'tgan oydan qolgan qoldiq</p>
          <p class="mt-1">
            `Boshlang'ich qoldiq qo'shish` orqali sana, zavod, tosh, Kraska, Mel va qop qoldig'ini kiriting.
            Keyingi oylar `Hisobotlar`dagi `Oy yopish` orqali avtomatik ko'chadi.
          </p>
        </div>
        <div class="rounded-2xl bg-slate-50 px-4 py-3">
          <p class="font-semibold text-slate-900">Tosh qoldiq</p>
          <p class="mt-1">Kirim tosh - ishlab chiqarishda ketgan tosh</p>
        </div>
        <div class="rounded-2xl bg-slate-50 px-4 py-3">
          <p class="font-semibold text-slate-900">Tayyor yuk</p>
          <p class="mt-1">Ishlab chiqarilgan mahsulot - klientga sotilgan yuk</p>
        </div>
        <div class="rounded-2xl bg-slate-50 px-4 py-3">
          <p class="font-semibold text-slate-900">Qop qoldiq</p>
          <p class="mt-1">Boshlang'ich qop - ishlab chiqarishda ishlatilgan qop</p>
        </div>
      </div>
    </article>
  </section>

  <section class="panel p-5">
    <header class="mb-4">
      <h3 class="text-base font-semibold text-slate-900">{{ t("Boshlang'ich qoldiqlar") }}</h3>
      <p class="text-xs text-slate-500">{{ t("O'tgan oydan yangi davrga o'tgan tosh, Mel va qop.") }}</p>
    </header>

    <AppTable :columns="openingColumns" :rows="openingRows" empty-text="Boshlang'ich qoldiq kiritilmagan.">
      <template #cell-date="{ value }">{{ formatDate(String(value)) }}</template>
      <template #cell-stoneTons="{ value }">{{ formatTons(Number(value)) }}</template>
      <template #cell-kraskaTons="{ value }">{{ formatTons(Number(value)) }}</template>
      <template #cell-melTons="{ value }">{{ formatTons(Number(value)) }}</template>
      <template #cell-xiraBagCount="{ value }">{{ Number(value).toLocaleString('uz-UZ') }} dona</template>
      <template #cell-oqBagCount="{ value }">{{ Number(value).toLocaleString('uz-UZ') }} dona</template>
      <template #cell-actions="{ row }">
        <div class="flex justify-end gap-2">
          <template v-if="isAdmin">
            <button type="button" class="btn-secondary !px-3 !py-1.5 text-xs" @click="openEditModal(row)">{{ t('Tahrirlash') }}</button>
            <button type="button" class="btn-danger !px-3 !py-1.5 text-xs" @click="askDelete(row)">{{ t("O'chirish") }}</button>
          </template>
        </div>
      </template>
    </AppTable>
  </section>

  <AppModal :open="modalOpen" :title="editingId ? 'Boshlang`ich qoldiqni tahrirlash' : 'Boshlang`ich qoldiq qo`shish'" size="lg" @close="modalOpen = false">
    <div class="grid gap-4 md:grid-cols-2">
      <AppInput v-model="form.date" type="date" label="Yangi davr sanasi" required />
      <AppSelect v-model="form.factory" label="Zavod" :options="factoryOptions" required />
      <AppInput v-model="form.stoneTons" type="number" min="0" step="0.01" label="Tosh qoldiq (t)" />
      <AppInput v-model="form.kraskaTons" type="number" min="0" step="0.01" label="Kraska qoldiq (t)" />
      <AppInput v-model="form.melTons" type="number" min="0" step="0.01" label="Mel qoldiq (t)" />
      <AppInput v-model="form.xiraBagCount" type="number" min="0" step="1" label="Xira qop qoldiq (dona)" />
      <AppInput v-model="form.oqBagCount" type="number" min="0" step="1" label="Oq qop qoldiq (dona)" />
      <AppInput v-model="form.notes" label="Izoh" placeholder="Masalan, iyun oyidan qoldiq" />
    </div>

    <p v-if="formError" class="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ formError }}</p>

    <template #footer>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-secondary" @click="modalOpen = false">{{ t('Bekor qilish') }}</button>
        <button type="button" class="btn-primary" @click="saveOpening">{{ editingId ? t('Saqlash') : t("Qo`shish") }}</button>
      </div>
    </template>
  </AppModal>

  <ConfirmDialog
    :open="deleteDialogOpen"
    title="Boshlang'ich qoldiqni o'chirish"
    message="Tanlangan qoldiq yozuvi o'chirilsinmi?"
    confirm-text="O'chirish"
    cancel-text="Bekor qilish"
    @confirm="confirmDelete"
    @cancel="deleteDialogOpen = false"
  />
</template>
