import { FormEvent, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { hasSupabaseConfig, supabase } from './lib/supabase';
import { fetchManagerConfigs, ManagerConfig } from './lib/managerConfig';
import { EntryForm, PaymentMethod } from './components/EntryForm';
import { Dashboard } from './components/Dashboard';
import { ServiceEntry } from './components/EntryEditor';

const DASHBOARD_UNLOCK_KEY = 'goodlife-dashboard-unlocked';

type Tab = 'entry' | 'dashboard';
type Toast = {
  message: string;
  tone: 'success' | 'error';
};

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(month: string, offset: number) {
  const [year, monthIndex] = month.split('-').map(Number);
  const next = new Date(year, monthIndex - 1 + offset, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function normalizeEntryRecord(raw: any): ServiceEntry {
  const actual = Number(raw.actual_price ?? raw.total_price ?? 0);
  const disc = Number(raw.discount ?? 0);
  const finalP = Number(raw.final_price ?? Math.max(0, actual - disc));
  const oShare = Number(raw.owner_share ?? finalP * 0.6);
  const mShare = Number(raw.manager_share ?? finalP * 0.4);
  const mgrName = raw.manager_name ?? 'General';

  return {
    id: raw.id,
    client_name: raw.client_name,
    phone_number: raw.phone_number,
    manager_name: mgrName,
    services: Array.isArray(raw.services) ? raw.services : [],
    custom_service: raw.custom_service ?? null,
    total_price: actual,
    actual_price: actual,
    discount: disc,
    final_price: finalP,
    owner_share: oShare,
    manager_share: mShare,
    payment_method: raw.payment_method,
    created_at: raw.created_at,
    entry_month: raw.entry_month,
  };
}

export function App() {
  const dashboardPin = import.meta.env.VITE_DASHBOARD_PIN?.trim() ?? '';
  const shouldGateDashboard = Boolean(dashboardPin);
  const [activeTab, setActiveTab] = useState<Tab>('entry');
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [entries, setEntries] = useState<ServiceEntry[]>([]);
  const [managerConfigs, setManagerConfigs] = useState<ManagerConfig[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [isDashboardUnlocked, setIsDashboardUnlocked] = useState(() => {
    if (!shouldGateDashboard) return true;
    return sessionStorage.getItem(DASHBOARD_UNLOCK_KEY) === 'true';
  });
  const [pin, setPin] = useState('');
  const [dashboardError, setDashboardError] = useState('');
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3800);
    return () => clearTimeout(timer);
  }, [toast]);

  // Load Manager Configurations from Supabase on mount
  useEffect(() => {
    loadManagerConfigs();
  }, []);

  // Load entries when selectedMonth changes
  useEffect(() => {
    loadEntries(selectedMonth);
  }, [selectedMonth]);

  async function loadManagerConfigs() {
    const configs = await fetchManagerConfigs();
    setManagerConfigs(configs);
  }

  async function loadEntries(month = selectedMonth) {
    if (!supabase) {
      setDashboardError('Add Supabase credentials to .env to load dashboard data.');
      setEntries([]);
      return;
    }

    setIsLoadingEntries(true);
    const { data, error } = await supabase
      .from('service_entries')
      .select('*')
      .eq('entry_month', month)
      .order('created_at', { ascending: false });
    setIsLoadingEntries(false);

    if (error) {
      setDashboardError(error.message);
      return;
    }

    const normalized = (data ?? []).map(normalizeEntryRecord);
    setEntries(normalized);
    setDashboardError('');
  }

  async function handleSaveNewEntry(entryData: {
    clientName: string;
    phoneNumber: string;
    managerName: string;
    services: string[];
    customService: string | null;
    actualPrice: number;
    discount: number;
    finalPrice: number;
    ownerShare: number;
    managerShare: number;
    paymentMethod: PaymentMethod;
  }): Promise<boolean> {
    if (!supabase) {
      setToast({ message: 'Add Supabase credentials to .env before saving entries.', tone: 'error' });
      return false;
    }

    setIsSaving(true);
    const month = currentMonth();

    const { data, error } = await supabase
      .from('service_entries')
      .insert({
        client_name: entryData.clientName,
        phone_number: entryData.phoneNumber,
        manager_name: entryData.managerName,
        services: entryData.services,
        custom_service: entryData.customService,
        total_price: entryData.actualPrice, // legacy alias
        actual_price: entryData.actualPrice,
        discount: entryData.discount,
        final_price: entryData.finalPrice,
        owner_share: entryData.ownerShare,
        manager_share: entryData.managerShare,
        payment_method: entryData.paymentMethod,
        entry_month: month,
      })
      .select('*')
      .single();

    setIsSaving(false);

    if (error) {
      setToast({ message: error.message, tone: 'error' });
      return false;
    }

    if (data) {
      const newEntry = normalizeEntryRecord(data);
      if (month === selectedMonth) {
        setEntries((current) => [newEntry, ...current]);
      }
      setToast({ message: 'Client entry added successfully!', tone: 'success' });
      return true;
    }

    return false;
  }

  async function handleUpdateEntry(
    entryId: string,
    updatedData: {
      client_name: string;
      phone_number: string;
      manager_name: string;
      services: string[];
      custom_service: string | null;
      actual_price: number;
      discount: number;
      final_price: number;
      owner_share: number;
      manager_share: number;
      payment_method: PaymentMethod;
    }
  ): Promise<boolean> {
    if (!supabase) {
      setToast({ message: 'Add Supabase credentials before editing entries.', tone: 'error' });
      return false;
    }

    const { data, error } = await supabase
      .from('service_entries')
      .update({
        client_name: updatedData.client_name,
        phone_number: updatedData.phone_number,
        manager_name: updatedData.manager_name,
        services: updatedData.services,
        custom_service: updatedData.custom_service,
        total_price: updatedData.actual_price,
        actual_price: updatedData.actual_price,
        discount: updatedData.discount,
        final_price: updatedData.final_price,
        owner_share: updatedData.owner_share,
        manager_share: updatedData.manager_share,
        payment_method: updatedData.payment_method,
      })
      .eq('id', entryId)
      .select('*')
      .single();

    if (error) {
      setToast({ message: error.message, tone: 'error' });
      return false;
    }

    if (data) {
      const updated = normalizeEntryRecord(data);
      setEntries((current) => current.map((item) => (item.id === entryId ? updated : item)));
      setToast({ message: 'Entry updated successfully!', tone: 'success' });
      return true;
    }

    return false;
  }

  async function handleDeleteEntry(entryId: string): Promise<boolean> {
    if (!supabase) {
      setToast({ message: 'Add Supabase credentials before deleting entries.', tone: 'error' });
      return false;
    }

    const previousEntries = entries;
    setEntries((current) => current.filter((entry) => entry.id !== entryId));

    const { error } = await supabase.from('service_entries').delete().eq('id', entryId);

    if (error) {
      setEntries(previousEntries);
      setToast({ message: error.message, tone: 'error' });
      return false;
    }

    setToast({ message: 'Entry deleted successfully.', tone: 'success' });
    return true;
  }

  function handleUnlockDashboard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shouldGateDashboard) {
      setIsDashboardUnlocked(true);
      return;
    }

    if (pin.trim() === dashboardPin) {
      setIsDashboardUnlocked(true);
      sessionStorage.setItem(DASHBOARD_UNLOCK_KEY, 'true');
      setDashboardError('');
      setPin('');
      return;
    }

    setDashboardError('Incorrect PIN.');
  }

  return (
    <main className="min-h-screen bg-goodlife-bg text-white pb-24">
      <div className="mx-auto flex w-full max-w-4xl flex-col px-4 py-5 sm:px-6 sm:py-8">
        <AnimatePresence mode="wait" initial={false}>
          {activeTab === 'entry' ? (
            <motion.div
              key="entry"
              className="flex flex-col"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              <EntryForm
                isSaving={isSaving}
                managerConfigs={managerConfigs}
                onSaveEntry={handleSaveNewEntry}
              />
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              className="flex flex-col"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              <Dashboard
                dashboardError={dashboardError}
                entries={entries}
                isDashboardUnlocked={isDashboardUnlocked}
                isLoadingEntries={isLoadingEntries}
                managerConfigs={managerConfigs}
                pin={pin}
                selectedMonth={selectedMonth}
                shouldGateDashboard={shouldGateDashboard}
                onDeleteEntry={handleDeleteEntry}
                onMonthNext={() => setSelectedMonth((month) => shiftMonth(month, 1))}
                onMonthPrevious={() => setSelectedMonth((month) => shiftMonth(month, -1))}
                onPinChange={setPin}
                onRefresh={() => loadEntries(selectedMonth)}
                onRefreshConfigs={loadManagerConfigs}
                onUnlock={handleUnlockDashboard}
                onUpdateEntry={handleUpdateEntry}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toast ? (
          <motion.div
            className={`fixed bottom-24 left-4 right-4 z-50 mx-auto max-w-sm rounded-lg border px-4 py-3 text-center text-sm font-bold text-white shadow-premium ${
              toast.tone === 'success' ? 'border-emerald-500/30 bg-emerald-500' : 'border-red-500/30 bg-red-500'
            }`}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          >
            {toast.message}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Bottom Navigation Bar */}
      <nav className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-[#111]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-3">
          <button
            className={`tab-button ${activeTab === 'entry' ? 'tab-button-active' : ''}`}
            type="button"
            onClick={() => setActiveTab('entry')}
          >
            <span aria-hidden="true">+</span>
            New Entry
          </button>
          <button
            className={`tab-button ${activeTab === 'dashboard' ? 'tab-button-active' : ''}`}
            type="button"
            onClick={() => setActiveTab('dashboard')}
          >
            <span aria-hidden="true">₹</span>
            Dashboard
          </button>
        </div>
      </nav>
    </main>
  );
}

export default App;
