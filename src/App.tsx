import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { hasSupabaseConfig, supabase } from './lib/supabase';

const SALON_SERVICE_OPTIONS = [
  'Haircut & Styling',
  'Hair Wash & Blow Dry',
  'Hair Coloring / Highlights',
  'Beard Trim & Shape',
  'Clean Shave',
  'Head Massage',
  'Face Cleanup',
  'Face Massage & De-Tan',
  'Manicure',
  'Pedicure',
  'Waxing / Threading',
  'Hair Spa Treatment',
  'Keratin / Smoothening Treatment',
  'Dandruff Treatment',
  'Scalp Treatment',
  'Ear / Nose Wax Cleaning',
  'Custom Service',
] as const;

const SPA_SERVICE_OPTIONS = [
  'Full Body Massage',
  'Swedish Massage',
  'Deep Tissue Massage',
  'Aromatherapy Massage',
  'Hot Stone Massage',
  'Head & Neck Massage',
  'Back & Shoulder Massage',
  'Foot Reflexology',
  'Body Scrub & Exfoliation',
  'Body Wrap Treatment',
  'Hydrating Facial',
  'Anti-Aging Facial',
  'Gold Facial',
  'Fruit Facial',
  'Cleanup & De-Tan',
  'Under-Eye Treatment',
  'Lip Care Treatment',
  'Hand & Foot Spa',
  'Nail Art & Extensions',
  'Wax Strip Full Body',
  'Wax Strip Half Body',
  'Charcoal Detox Treatment',
  'Oxygen Facial',
  'Steam Bath',
  'Jacuzzi Session',
] as const;

const PAYMENT_METHODS = ['Cash', 'Card', 'Online UPI'] as const;
const DASHBOARD_UNLOCK_KEY = 'goodlife-dashboard-unlocked';

type PaymentMethod = (typeof PAYMENT_METHODS)[number];
type Tab = 'entry' | 'dashboard';

type ServiceEntry = {
  id: string;
  client_name: string;
  phone_number: string;
  services: string[];
  custom_service: string | null;
  total_price: number;
  payment_method: PaymentMethod;
  created_at: string;
  entry_month: string;
};

type FormState = {
  clientName: string;
  phoneNumber: string;
  services: string[];
  customService: string;
  totalPrice: string;
  paymentMethod: PaymentMethod | '';
};

type FormErrors = Partial<Record<keyof FormState | 'supabase', string>>;
type Toast = {
  message: string;
  tone: 'success' | 'error';
};

const initialForm: FormState = {
  clientName: '',
  phoneNumber: '',
  services: [],
  customService: '',
  totalPrice: '',
  paymentMethod: '',
};

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(month: string) {
  const [year, monthIndex] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(
    new Date(year, monthIndex - 1, 1),
  );
}

function shiftMonth(month: string, offset: number) {
  const [year, monthIndex] = month.split('-').map(Number);
  const next = new Date(year, monthIndex - 1 + offset, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
}

function formatEntryDate(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function entryServices(entry: ServiceEntry) {
  return [...entry.services.filter((service) => service !== 'Custom Service'), entry.custom_service]
    .filter(Boolean)
    .join(', ');
}

function validateForm(form: FormState) {
  const errors: FormErrors = {};
  const hasCustom = form.services.includes('Custom Service');

  if (!form.clientName.trim()) errors.clientName = 'Client name is required.';
  if (!/^\d{10}$/.test(form.phoneNumber.trim())) errors.phoneNumber = 'Enter a valid 10-digit phone number.';
  if (form.services.length === 0) errors.services = 'Select at least one service.';
  if (hasCustom && !form.customService.trim()) errors.customService = 'Add the custom service name.';
  if (!form.totalPrice || Number(form.totalPrice) <= 0) errors.totalPrice = 'Enter a price greater than 0.';
  if (!form.paymentMethod) errors.paymentMethod = 'Select a payment method.';
  if (!hasSupabaseConfig) errors.supabase = 'Add Supabase credentials to .env before saving entries.';

  return errors;
}

function App() {
  const dashboardPin = import.meta.env.VITE_DASHBOARD_PIN?.trim() ?? '';
  const shouldGateDashboard = Boolean(dashboardPin);
  const [activeTab, setActiveTab] = useState<Tab>('entry');
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [entries, setEntries] = useState<ServiceEntry[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [isDashboardUnlocked, setIsDashboardUnlocked] = useState(() => {
    if (!shouldGateDashboard) return true;
    return sessionStorage.getItem(DASHBOARD_UNLOCK_KEY) === 'true';
  });
  const [pin, setPin] = useState('');
  const [dashboardError, setDashboardError] = useState('');
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [isServicesOpen, setIsServicesOpen] = useState(true);
  const [isEntriesOpen, setIsEntriesOpen] = useState(true);

  const hasCustomService = form.services.includes('Custom Service');

  const dashboardStats = useMemo(() => {
    return entries.reduce(
      (stats, entry) => {
        const price = Number(entry.total_price);
        stats.total += price;
        stats.count += 1;
        stats.byPayment[entry.payment_method] += price;
        return stats;
      },
      {
        total: 0,
        count: 0,
        byPayment: {
          Cash: 0,
          Card: 0,
          'Online UPI': 0,
        } as Record<PaymentMethod, number>,
      },
    );
  }, [entries]);

  const serviceBreakdown = useMemo(() => {
    const counts = new Map<string, number>();

    entries.forEach((entry) => {
      entry.services.forEach((service) => {
        if (service !== 'Custom Service') {
          counts.set(service, (counts.get(service) ?? 0) + 1);
        }
      });

      if (entry.custom_service) {
        counts.set(entry.custom_service, (counts.get(entry.custom_service) ?? 0) + 1);
      }
    });

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [entries]);

  useEffect(() => {
    if (toast) {
      const timer = window.setTimeout(() => setToast(null), 2500);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [toast]);

  useEffect(() => {
    if (!shouldGateDashboard) {
      setIsDashboardUnlocked(true);
    }
  }, [shouldGateDashboard]);

  useEffect(() => {
    if (activeTab === 'dashboard' && isDashboardUnlocked) {
      void loadEntries(selectedMonth);
    }
  }, [activeTab, isDashboardUnlocked, selectedMonth]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, supabase: undefined }));
  }

  function toggleService(service: string) {
    setForm((current) => {
      const exists = current.services.includes(service);
      const nextServices = exists
        ? current.services.filter((item) => item !== service)
        : [...current.services, service];

      return {
        ...current,
        services: nextServices,
        customService: nextServices.includes('Custom Service') ? current.customService : '',
      };
    });
    setErrors((current) => ({ ...current, services: undefined, customService: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateForm(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0 || !supabase) {
      return;
    }

    setIsSaving(true);
    const payload = {
      client_name: form.clientName.trim(),
      phone_number: form.phoneNumber.trim(),
      services: form.services,
      custom_service: hasCustomService ? form.customService.trim() : null,
      total_price: Number(form.totalPrice),
      payment_method: form.paymentMethod,
      entry_month: currentMonth(),
    };

    const { error } = await supabase.from('service_entries').insert(payload);
    setIsSaving(false);

    if (error) {
      setErrors({ supabase: error.message });
      return;
    }

    setForm(initialForm);
    setErrors({});
    setToast({ message: 'Entry Added \u2713', tone: 'success' });
    if (isDashboardUnlocked && selectedMonth === currentMonth()) {
      void loadEntries(selectedMonth);
    }
  }

  function unlockDashboard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!shouldGateDashboard || pin === dashboardPin) {
      setIsDashboardUnlocked(true);
      sessionStorage.setItem(DASHBOARD_UNLOCK_KEY, 'true');
      setDashboardError('');
      void loadEntries(selectedMonth);
      return;
    }

    setDashboardError('Incorrect PIN.');
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

    setEntries((data ?? []) as ServiceEntry[]);
    setDashboardError('');
  }

  async function deleteEntry(entryId: string) {
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

    return true;
  }

  function downloadCsv() {
    const headers = ['Date', 'Client Name', 'Phone', 'Services', 'Custom Service', 'Total Price', 'Payment Method'];
    const rows = entries.map((entry) => [
      formatEntryDate(entry.created_at),
      entry.client_name,
      entry.phone_number,
      entry.services.filter((service) => service !== 'Custom Service').join(', '),
      entry.custom_service ?? '',
      String(Number(entry.total_price).toFixed(2)),
      entry.payment_method,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `goodlife-salon-${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-goodlife-bg text-white pb-0 sm:pb-24">
      <div className="mx-auto flex min-h-0 sm:min-h-screen w-full max-w-4xl flex-col px-4 pt-5 pb-0 sm:px-6 sm:py-8">
        <AnimatePresence mode="wait" initial={false}>
          {activeTab === 'entry' ? (
            <motion.div
              key="entry"
              className="flex flex-col sm:flex-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              <EntryScreen
                errors={errors}
                form={form}
                hasCustomService={hasCustomService}
                isSaving={isSaving}
                onSubmit={handleSubmit}
                toggleService={toggleService}
                updateForm={updateForm}
              />
            </motion.div>
          ) : (
            <motion.div
              key="dashboard"
              className="flex flex-col sm:flex-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              <DashboardScreen
                dashboardError={dashboardError}
                dashboardStats={dashboardStats}
                entries={entries}
                isDashboardUnlocked={isDashboardUnlocked}
                isEntriesOpen={isEntriesOpen}
                isLoadingEntries={isLoadingEntries}
                isServicesOpen={isServicesOpen}
                onDeleteEntry={deleteEntry}
                onDownloadCsv={downloadCsv}
                onEntriesToggle={() => setIsEntriesOpen((value) => !value)}
                onMonthNext={() => setSelectedMonth((month) => shiftMonth(month, 1))}
                onMonthPrevious={() => setSelectedMonth((month) => shiftMonth(month, -1))}
                onPinChange={setPin}
                onRefresh={() => loadEntries(selectedMonth)}
                onServicesToggle={() => setIsServicesOpen((value) => !value)}
                onUnlock={unlockDashboard}
                pin={pin}
                selectedMonth={selectedMonth}
                serviceBreakdown={serviceBreakdown}
                shouldGateDashboard={shouldGateDashboard}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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

type EntryScreenProps = {
  errors: FormErrors;
  form: FormState;
  hasCustomService: boolean;
  isSaving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  toggleService: (service: string) => void;
  updateForm: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
};

function EntryScreen({ errors, form, hasCustomService, isSaving, onSubmit, toggleService, updateForm }: EntryScreenProps) {
  return (
    <section className="flex flex-col sm:flex-1 gap-5">
      <header className="pt-2">
        <p className="text-3xl font-black tracking-normal text-white sm:text-4xl">
          <span className="text-goodlife-accent">Goodlife</span> Salon
        </p>
        <h1 className="mt-1 text-base font-medium text-white/60">New Client Entry</h1>
      </header>

      <form className="rounded-xl border border-white/10 bg-goodlife-card p-4 pb-[88px] shadow-premium sm:p-6 sm:pb-6" onSubmit={onSubmit}>
        <div className="grid gap-4">
          <Field label="Client Name" error={errors.clientName}>
            <input
              className="input"
              placeholder="Enter client name"
              type="text"
              value={form.clientName}
              onChange={(event) => updateForm('clientName', event.target.value)}
            />
          </Field>

          <Field label="Phone Number" error={errors.phoneNumber}>
            <input
              className="input"
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit mobile number"
              type="tel"
              value={form.phoneNumber}
              onChange={(event) => updateForm('phoneNumber', event.target.value.replace(/\D/g, '').slice(0, 10))}
            />
          </Field>

          <Field label="Services Taken" error={errors.services}>
            <div className="grid max-h-[48vh] gap-5 overflow-y-auto pr-1 sm:max-h-none sm:overflow-visible sm:pr-0">
              <ServiceGroup
                label="Salon Services"
                options={SALON_SERVICE_OPTIONS}
                selectedServices={form.services}
                toggleService={toggleService}
              />
              <ServiceGroup
                label="Spa Services"
                options={SPA_SERVICE_OPTIONS}
                selectedServices={form.services}
                toggleService={toggleService}
              />
            </div>
          </Field>

          {hasCustomService ? (
            <Field label="Custom Service" error={errors.customService}>
              <input
                className="input"
                placeholder="Enter custom service"
                type="text"
                value={form.customService}
                onChange={(event) => updateForm('customService', event.target.value)}
              />
            </Field>
          ) : null}

          <Field label="Total Price (₹)" error={errors.totalPrice}>
            <input
              className="input"
              inputMode="decimal"
              min="1"
              placeholder="0"
              type="number"
              value={form.totalPrice}
              onChange={(event) => updateForm('totalPrice', event.target.value)}
            />
          </Field>

          <Field label="Payment Method" error={errors.paymentMethod}>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  className={`payment-toggle ${form.paymentMethod === method ? 'payment-toggle-active' : ''}`}
                  key={method}
                  type="button"
                  onClick={() => updateForm('paymentMethod', method)}
                >
                  {method}
                </button>
              ))}
            </div>
          </Field>

          {errors.supabase ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{errors.supabase}</p>
          ) : null}

          <motion.button
            className="mt-2 h-12 w-full rounded-lg bg-goodlife-accent text-base font-black text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving}
            whileHover={isSaving ? undefined : { scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            type="submit"
          >
            {isSaving ? 'Adding Entry...' : 'Add Entry'}
          </motion.button>
        </div>
      </form>
    </section>
  );
}

type ServiceGroupProps = {
  label: string;
  options: readonly string[];
  selectedServices: string[];
  toggleService: (service: string) => void;
};

function ServiceGroup({ label, options, selectedServices, toggleService }: ServiceGroupProps) {
  return (
    <div className="grid gap-2">
      <p className="text-xs font-black uppercase tracking-normal text-white/45">{label}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((service) => {
          const selected = selectedServices.includes(service);
          return (
            <motion.label
              className={`service-chip ${selected ? 'service-chip-active' : ''}`}
              key={service}
              animate={{
                scale: selected ? [1, 1.03, 1] : [1, 0.985, 1],
                backgroundColor: selected ? 'rgba(249, 115, 22, 0.1)' : '#111111',
                borderColor: selected ? '#f97316' : 'rgba(255, 255, 255, 0.1)',
              }}
              transition={{
                scale: { type: 'spring', stiffness: 520, damping: 24 },
                backgroundColor: { duration: 0.2, ease: 'easeInOut' },
                borderColor: { duration: 0.2, ease: 'easeInOut' },
              }}
            >
              <input className="sr-only" checked={selected} type="checkbox" onChange={() => toggleService(service)} />
              <span className="chip-box" aria-hidden="true" />
              <span>{service}</span>
            </motion.label>
          );
        })}
      </div>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 11v6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7l1-2h4l1 2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7l1 13h6l1-13" />
    </svg>
  );
}

type DashboardScreenProps = {
  dashboardError: string;
  dashboardStats: {
    total: number;
    count: number;
    byPayment: Record<PaymentMethod, number>;
  };
  entries: ServiceEntry[];
  isDashboardUnlocked: boolean;
  isEntriesOpen: boolean;
  isLoadingEntries: boolean;
  isServicesOpen: boolean;
  onDeleteEntry: (entryId: string) => Promise<boolean>;
  onDownloadCsv: () => void;
  onEntriesToggle: () => void;
  onMonthNext: () => void;
  onMonthPrevious: () => void;
  onPinChange: (value: string) => void;
  onRefresh: () => void;
  onServicesToggle: () => void;
  onUnlock: (event: FormEvent<HTMLFormElement>) => void;
  pin: string;
  selectedMonth: string;
  serviceBreakdown: Array<{ name: string; count: number }>;
  shouldGateDashboard: boolean;
};

function DashboardScreen({
  dashboardError,
  dashboardStats,
  entries,
  isDashboardUnlocked,
  isEntriesOpen,
  isLoadingEntries,
  isServicesOpen,
  onDeleteEntry,
  onDownloadCsv,
  onEntriesToggle,
  onMonthNext,
  onMonthPrevious,
  onPinChange,
  onRefresh,
  onServicesToggle,
  onUnlock,
  pin,
  selectedMonth,
  serviceBreakdown,
  shouldGateDashboard,
}: DashboardScreenProps) {
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);

  async function confirmDelete(entryId: string) {
    setDeletingEntryId(entryId);
    const deleted = await onDeleteEntry(entryId);
    setDeletingEntryId(null);

    if (deleted) {
      setConfirmingDeleteId(null);
    }
  }

  if (shouldGateDashboard && !isDashboardUnlocked) {
    return (
      <section className="flex flex-1 flex-col justify-center gap-5 pb-[88px] sm:pb-0">
        <header>
          <p className="text-3xl font-black tracking-normal text-white sm:text-4xl">
            <span className="text-goodlife-accent">Goodlife</span> Salon
          </p>
          <h1 className="mt-1 text-base font-medium text-white/60">Dashboard</h1>
        </header>

        <form className="rounded-xl border border-white/10 bg-goodlife-card p-4 shadow-premium sm:p-6" onSubmit={onUnlock}>
          <Field label="Dashboard PIN" error={dashboardError}>
            <input
              className="input text-center text-xl tracking-[0.35em]"
              inputMode="numeric"
              maxLength={4}
              placeholder="••••"
              type="password"
              value={pin}
              onChange={(event) => onPinChange(event.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          </Field>
          <button className="mt-4 h-12 w-full rounded-lg bg-goodlife-accent text-base font-black text-white" type="submit">
            Unlock Dashboard
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="flex flex-col sm:flex-1 gap-5 pb-[88px] sm:pb-0">
      <header className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-3xl font-black tracking-normal text-white sm:text-4xl">
            <span className="text-goodlife-accent">Goodlife</span> Salon
          </p>
          <h1 className="mt-1 text-base font-medium text-white/60">Revenue Dashboard</h1>
        </div>
        <button
          className="h-10 rounded-lg border border-white/10 px-3 text-sm font-bold text-white/80 transition hover:border-goodlife-accent/70"
          type="button"
          onClick={onRefresh}
        >
          {isLoadingEntries ? 'Refreshing...' : 'Refresh'}
        </button>
      </header>

      <div className="rounded-xl border border-white/10 bg-goodlife-card p-4 shadow-premium sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <button className="month-arrow" type="button" aria-label="Previous month" onClick={onMonthPrevious}>
            ←
          </button>
          <p className="text-center text-lg font-black">{formatMonthLabel(selectedMonth)}</p>
          <button className="month-arrow" type="button" aria-label="Next month" onClick={onMonthNext}>
            →
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Stat featured delay={0} label="Total Revenue" value={inr.format(dashboardStats.total)} />
        <Stat delay={0.1} label="Owner's Share 60%" value={inr.format(dashboardStats.total * 0.6)} />
        <Stat delay={0.2} label="Manager's Share 40%" value={inr.format(dashboardStats.total * 0.4)} />
      </div>

      <div className="rounded-xl border border-white/10 bg-goodlife-card p-4 shadow-premium sm:p-6">
        <h2 className="text-lg font-black">Payment Breakdown</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PAYMENT_METHODS.map((method) => (
            <Stat compact key={method} label={method} value={inr.format(dashboardStats.byPayment[method])} />
          ))}
          <Stat compact label="Total Clients" value={String(dashboardStats.count)} />
        </div>
      </div>

      <CollapsibleSection
        count={serviceBreakdown.length}
        isOpen={isServicesOpen}
        onToggle={onServicesToggle}
        title="Services Breakdown"
      >
        <div className="grid gap-2">
          {serviceBreakdown.length === 0 ? (
            <p className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">No services booked for this month.</p>
          ) : (
            serviceBreakdown.map((service) => (
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-[#111] px-3 py-3" key={service.name}>
                <span className="text-sm font-bold text-white/80">{service.name}</span>
                <span className="rounded-full bg-goodlife-accent px-2.5 py-1 text-xs font-black text-white">
                  {service.count} {service.count === 1 ? 'time' : 'times'}
                </span>
              </div>
            ))
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection count={entries.length} isOpen={isEntriesOpen} onToggle={onEntriesToggle} title="Entries List">
        <div className="mb-4 flex justify-end">
          <button
            className="h-11 rounded-lg bg-goodlife-accent px-4 text-sm font-black text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={entries.length === 0}
            type="button"
            onClick={onDownloadCsv}
          >
            Download Report (CSV)
          </button>
        </div>

        <div className="grid gap-3">
          {entries.length === 0 && !isLoadingEntries ? (
            <p className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">No entries found for this month.</p>
          ) : null}

          <AnimatePresence initial={false}>
            {entries.map((entry) => {
              const isConfirmingDelete = confirmingDeleteId === entry.id;
              const isDeleting = deletingEntryId === entry.id;

              return (
                <motion.article
                  className="overflow-hidden rounded-lg border border-white/10 bg-[#111] p-3"
                  key={entry.id}
                  layout
                  initial={false}
                  exit={{ height: 0, opacity: 0, paddingTop: 0, paddingBottom: 0, marginTop: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                >
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-start">
                    <div>
                      <p className="text-xs font-bold uppercase text-white/40">{formatEntryDate(entry.created_at)}</p>
                      <h3 className="mt-1 font-black">{entry.client_name}</h3>
                      <p className="mt-2 text-sm text-white/70">{entryServices(entry)}</p>
                    </div>
                    <div className="sm:text-right">
                      <p className="font-black text-goodlife-accent">{inr.format(Number(entry.total_price))}</p>
                      <p className="mt-1 text-xs font-bold uppercase text-white/50">{entry.payment_method}</p>
                    </div>
                    <button
                      className="grid h-10 w-10 place-items-center justify-self-end rounded-lg border border-red-500/30 text-red-300 transition hover:border-red-400 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                      type="button"
                      aria-label={`Delete entry for ${entry.client_name}`}
                      disabled={isDeleting}
                      onClick={() => setConfirmingDeleteId(entry.id)}
                    >
                      <TrashIcon />
                    </button>
                  </div>

                  <AnimatePresence>
                    {isConfirmingDelete ? (
                      <motion.div
                        className="mt-3 flex flex-col gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 sm:flex-row sm:items-center sm:justify-between"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                      >
                        <p className="text-sm font-bold text-red-100">Delete this entry?</p>
                        <div className="flex gap-2">
                          <button
                            className="h-9 rounded-lg bg-red-500 px-3 text-xs font-black text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                            type="button"
                            disabled={isDeleting}
                            onClick={() => void confirmDelete(entry.id)}
                          >
                            {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                          </button>
                          <button
                            className="h-9 rounded-lg border border-white/10 px-3 text-xs font-black text-white/70 transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-60"
                            type="button"
                            disabled={isDeleting}
                            onClick={() => setConfirmingDeleteId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      </CollapsibleSection>

      {dashboardError ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{dashboardError}</p>
      ) : null}
    </section>
  );
}

type FieldProps = {
  children: ReactNode;
  error?: string;
  label: string;
};

function Field({ children, error, label }: FieldProps) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-bold text-white/70">{label}</span>
      {children}
      {error ? <span className="text-sm text-red-300">{error}</span> : null}
    </label>
  );
}

type StatProps = {
  compact?: boolean;
  delay?: number;
  featured?: boolean;
  label: string;
  value: string;
};

function Stat({ compact, delay = 0, featured, label, value }: StatProps) {
  return (
    <motion.div
      className={`rounded-xl border border-white/10 bg-goodlife-card p-4 shadow-premium ${featured ? 'border-goodlife-accent/50' : ''}`}
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut', delay }}
    >
      <p className="text-xs font-bold uppercase text-white/40">{label}</p>
      <p className={`mt-2 font-black ${featured ? 'text-3xl text-goodlife-accent' : compact ? 'text-xl text-white' : 'text-2xl text-white'}`}>
        {value}
      </p>
    </motion.div>
  );
}

type CollapsibleSectionProps = {
  children: ReactNode;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  title: string;
};

function CollapsibleSection({ children, count, isOpen, onToggle, title }: CollapsibleSectionProps) {
  return (
    <section className="rounded-xl border border-white/10 bg-goodlife-card p-4 shadow-premium sm:p-6">
      <button className="flex w-full items-center justify-between gap-3 text-left" type="button" onClick={onToggle}>
        <span>
          <span className="block text-lg font-black">{title}</span>
          <span className="mt-1 block text-sm text-white/50">{count} records</span>
        </span>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 text-xl font-black text-goodlife-accent">
          {isOpen ? '−' : '+'}
        </span>
      </button>
      {isOpen ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

export default App;
