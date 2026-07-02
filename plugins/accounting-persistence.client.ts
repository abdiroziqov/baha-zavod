import { watch } from 'vue'
import type { AccountingStateSnapshot } from '~/types/accounting'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', () => {
    const {
      defaultCosts,
      openingBalances,
      dailyRecords,
      incomingLoads,
      scaleEntries,
      scaleSyncMeta,
      scaleCashEntries,
      payments,
      barterRecords,
      sales,
      manualDebts,
      expenses,
      contacts,
      reminders,
      monthlyArchiveRecords,
      auditLogs
    } =
      useFactoryAccounting()
    const { isAdmin } = useAuth()
    const storagePrefix = 'ming-bir-hazina:'
    let saveTimer: ReturnType<typeof setTimeout> | null = null
    let syncReady = false
    let lastSerializedSnapshot = ''

    const buildSnapshot = (): AccountingStateSnapshot => ({
      defaultCosts: defaultCosts.value,
      openingBalances: openingBalances.value,
      dailyRecords: dailyRecords.value,
      incomingLoads: incomingLoads.value,
      scaleEntries: scaleEntries.value,
      scaleSyncMeta: scaleSyncMeta.value,
      scaleCashEntries: scaleCashEntries.value,
      sales: sales.value,
      manualDebts: manualDebts.value,
      payments: payments.value,
      barterRecords: [],
      expenses: expenses.value,
      contacts: contacts.value,
      reminders: reminders.value,
      monthlyArchiveRecords: monthlyArchiveRecords.value,
      auditLogs: auditLogs.value,
      updatedAt: new Date().toISOString()
    })

    const applySnapshot = (snapshot: AccountingStateSnapshot) => {
      const legacyBagCost = Number((snapshot.defaultCosts as typeof snapshot.defaultCosts & { bagCostPerTon?: number }).bagCostPerTon ?? 20)
      defaultCosts.value = {
        ...defaultCostProfile,
        ...snapshot.defaultCosts,
        xiraBagCostPerTon: Number(snapshot.defaultCosts.xiraBagCostPerTon ?? legacyBagCost),
        oqBagCostPerTon: Number(snapshot.defaultCosts.oqBagCostPerTon ?? legacyBagCost)
      }
      openingBalances.value = snapshot.openingBalances ?? []
      dailyRecords.value = snapshot.dailyRecords
      incomingLoads.value = snapshot.incomingLoads
      scaleEntries.value = snapshot.scaleEntries
      scaleSyncMeta.value = snapshot.scaleSyncMeta
      scaleCashEntries.value = snapshot.scaleCashEntries
      sales.value = snapshot.sales
      manualDebts.value = snapshot.manualDebts
      payments.value = snapshot.payments
      barterRecords.value = []
      expenses.value = snapshot.expenses
      contacts.value = snapshot.contacts
      reminders.value = snapshot.reminders
      monthlyArchiveRecords.value = snapshot.monthlyArchiveRecords
      auditLogs.value = snapshot.auditLogs
      lastSerializedSnapshot = JSON.stringify(buildSnapshot())
    }

    const hasServerContent = (snapshot: AccountingStateSnapshot) =>
      Boolean(
        snapshot.openingBalances.length ||
          snapshot.dailyRecords.length ||
          snapshot.incomingLoads.length ||
          snapshot.scaleEntries.length ||
          snapshot.scaleCashEntries.length ||
          snapshot.sales.length ||
          snapshot.manualDebts.length ||
          snapshot.payments.length ||
          snapshot.barterRecords.length ||
          snapshot.expenses.length ||
          snapshot.contacts.length ||
          snapshot.reminders.length ||
          snapshot.monthlyArchiveRecords.length ||
          snapshot.auditLogs.length
      )

    const readLocalSnapshot = (): AccountingStateSnapshot | null => {
      try {
        const localSnapshot = {
          defaultCosts: JSON.parse(window.localStorage.getItem(`${storagePrefix}default-costs`) || 'null'),
          openingBalances: JSON.parse(window.localStorage.getItem(`${storagePrefix}opening-balances`) || '[]'),
          dailyRecords: JSON.parse(window.localStorage.getItem(`${storagePrefix}daily-records`) || '[]'),
          incomingLoads: JSON.parse(window.localStorage.getItem(`${storagePrefix}incoming-loads`) || '[]'),
          scaleEntries: JSON.parse(window.localStorage.getItem(`${storagePrefix}scale-entries`) || '[]'),
          scaleSyncMeta: JSON.parse(window.localStorage.getItem(`${storagePrefix}scale-sync-meta`) || 'null'),
          scaleCashEntries: JSON.parse(window.localStorage.getItem(`${storagePrefix}scale-cash-entries`) || '[]'),
          sales: JSON.parse(window.localStorage.getItem(`${storagePrefix}sales`) || '[]'),
          manualDebts: JSON.parse(window.localStorage.getItem(`${storagePrefix}manual-debts`) || '[]'),
          payments: JSON.parse(window.localStorage.getItem(`${storagePrefix}payments`) || '[]'),
          barterRecords: JSON.parse(window.localStorage.getItem(`${storagePrefix}barter-records`) || '[]'),
          expenses: JSON.parse(window.localStorage.getItem(`${storagePrefix}expenses`) || '[]'),
          contacts: JSON.parse(window.localStorage.getItem(`${storagePrefix}contacts`) || '[]'),
          reminders: JSON.parse(window.localStorage.getItem(`${storagePrefix}reminders`) || '[]'),
          monthlyArchiveRecords: JSON.parse(window.localStorage.getItem(`${storagePrefix}monthly-archive-records`) || '[]'),
          auditLogs: JSON.parse(window.localStorage.getItem(`${storagePrefix}audit-logs`) || '[]'),
          updatedAt: new Date().toISOString()
        } as AccountingStateSnapshot

        if (localSnapshot.defaultCosts?.chalkPricePerTon === 250) {
          localSnapshot.defaultCosts.chalkPricePerTon = 450
        }

        return hasServerContent(localSnapshot) ? localSnapshot : null
      } catch (error) {
        console.error('Local storage migration parse failed', error)
        return null
      }
    }

    const writeLocalSnapshot = (snapshot: AccountingStateSnapshot) => {
      try {
        window.localStorage.setItem(`${storagePrefix}default-costs`, JSON.stringify(snapshot.defaultCosts))
        window.localStorage.setItem(`${storagePrefix}opening-balances`, JSON.stringify(snapshot.openingBalances))
        window.localStorage.setItem(`${storagePrefix}daily-records`, JSON.stringify(snapshot.dailyRecords))
        window.localStorage.setItem(`${storagePrefix}incoming-loads`, JSON.stringify(snapshot.incomingLoads))
        window.localStorage.setItem(`${storagePrefix}scale-entries`, JSON.stringify(snapshot.scaleEntries))
        window.localStorage.setItem(`${storagePrefix}scale-sync-meta`, JSON.stringify(snapshot.scaleSyncMeta))
        window.localStorage.setItem(`${storagePrefix}scale-cash-entries`, JSON.stringify(snapshot.scaleCashEntries))
        window.localStorage.setItem(`${storagePrefix}sales`, JSON.stringify(snapshot.sales))
        window.localStorage.setItem(`${storagePrefix}manual-debts`, JSON.stringify(snapshot.manualDebts))
        window.localStorage.setItem(`${storagePrefix}payments`, JSON.stringify(snapshot.payments))
        window.localStorage.setItem(`${storagePrefix}barter-records`, JSON.stringify(snapshot.barterRecords))
        window.localStorage.setItem(`${storagePrefix}expenses`, JSON.stringify(snapshot.expenses))
        window.localStorage.setItem(`${storagePrefix}contacts`, JSON.stringify(snapshot.contacts))
        window.localStorage.setItem(`${storagePrefix}reminders`, JSON.stringify(snapshot.reminders))
        window.localStorage.setItem(
          `${storagePrefix}monthly-archive-records`,
          JSON.stringify(snapshot.monthlyArchiveRecords)
        )
        window.localStorage.setItem(`${storagePrefix}audit-logs`, JSON.stringify(snapshot.auditLogs))
      } catch (error) {
        console.error('Local accounting state save failed', error)
      }
    }

    const saveSnapshot = async () => {
      if (!isAdmin.value) {
        return
      }

      const snapshot = buildSnapshot()
      const serializedSnapshot = JSON.stringify(snapshot)

      if (serializedSnapshot === lastSerializedSnapshot) {
        return
      }

      writeLocalSnapshot(snapshot)

      try {
        await $fetch('/api/accounting/state', {
          method: 'PUT',
          body: snapshot
        })
        lastSerializedSnapshot = serializedSnapshot
      } catch (error) {
        console.error('Accounting state save failed', error)
      }
    }

    const scheduleSave = () => {
      if (!syncReady || !isAdmin.value) {
        return
      }

      if (saveTimer) {
        clearTimeout(saveTimer)
      }

      saveTimer = setTimeout(() => {
        void saveSnapshot()
      }, 500)
    }

    const bootSync = async () => {
      try {
        const response = await $fetch<{ state: AccountingStateSnapshot }>('/api/accounting/state')
        const localSnapshot = readLocalSnapshot()

        if (localSnapshot && !hasServerContent(response.state) && isAdmin.value) {
          try {
            const migratedResponse = await $fetch<{ state: AccountingStateSnapshot }>('/api/accounting/state', {
              method: 'PUT',
              body: localSnapshot
            })
            applySnapshot(migratedResponse.state)
          } catch (error) {
            console.error('Accounting state migration failed, using local state', error)
            applySnapshot(localSnapshot)
          }
        } else {
          applySnapshot(response.state)
        }
      } catch (error) {
        console.error('Accounting state load failed', error)
        const localSnapshot = readLocalSnapshot()

        if (localSnapshot) {
          applySnapshot(localSnapshot)
        }
      } finally {
        syncReady = true

        watch(
          [
            defaultCosts,
            openingBalances,
            dailyRecords,
            incomingLoads,
            scaleEntries,
            scaleSyncMeta,
            scaleCashEntries,
            sales,
            manualDebts,
            payments,
            barterRecords,
            expenses,
            contacts,
            reminders,
            monthlyArchiveRecords,
            auditLogs
          ],
          scheduleSave,
          { deep: true }
        )
      }
    }

    void bootSync()
  })
})
