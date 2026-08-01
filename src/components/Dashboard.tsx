import { FormEvent, useMemo, useState } from 'react';
import { ManagerConfig } from '../lib/managerConfig';
import { EntryCard } from './EntryCard';
import { EntryEditor, ServiceEntry } from './EntryEditor';
import { ManagerAnalytics } from './ManagerAnalytics';
import { ManagerConfiguration } from './ManagerConfiguration';
import { PaymentMethod, PAYMENT_METHODS } from './EntryForm';

type DashboardProps = {
  dashboardError: string;
  entries: ServiceEntry[];
  isDashboardUnlocked: boolean;
  isLoadingEntries: boolean;
  managerConfigs: ManagerConfig[];
  pin: string;
  selectedMonth: string;
  shouldGateDashboard: boolean;
  onDeleteEntry: (entryId: string) => Promise<boolean>;
  onUpdateEntry: (
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
  ) => Promise<boolean>;
  onMonthNext: () => void;
  onMonthPrevious: () => void;
  onPinChange: (pin: string) => void;
  onRefresh: () => void;
  onRefreshConfigs: () => void;
  onUnlock: (event: FormEvent<HTMLFormElement>) => void;
};

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function formatMonthLabel(month: string) {
  const [year, monthIndex] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(
    new Date(year, monthIndex - 1, 1)
  );
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

export function Dashboard({
  dashboardError,
  entries,
  isDashboardUnlocked,
  isLoadingEntries,
  managerConfigs,
  pin,
  selectedMonth,
  shouldGateDashboard,
  onDeleteEntry,
  onUpdateEntry,
  onMonthNext,
  onMonthPrevious,
  onPinChange,
  onRefresh,
  onRefreshConfigs,
  onUnlock,
}: DashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [managerFilter, setManagerFilter] = useState('All');
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [editingEntry, setEditingEntry] = useState<ServiceEntry | null>(null);
  const [isServicesOpen, setIsServicesOpen] = useState(true);
  const [isEntriesOpen, setIsEntriesOpen] = useState(true);

  // Filter entries based on search, manager, payment method
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchesSearch =
        !searchQuery ||
        entry.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.phone_number.includes(searchQuery);

      const matchesManager =
        managerFilter === 'All' || entry.manager_name.toLowerCase() === managerFilter.toLowerCase();

      const matchesPayment = paymentFilter === 'All' || entry.payment_method === paymentFilter;

      return matchesSearch && matchesManager && matchesPayment;
    });
  }, [entries, searchQuery, managerFilter, paymentFilter]);

  // Overall statistics calculated using final_price, owner_share, manager_share
  const dashboardStats = useMemo(() => {
    return entries.reduce(
      (stats, entry) => {
        const finalP = Number(entry.final_price || 0);
        const ownerP = Number(entry.owner_share || 0);
        const managerP = Number(entry.manager_share || 0);

        stats.totalFinal += finalP;
        stats.totalOwner += ownerP;
        stats.totalManager += managerP;
        stats.count += 1;
        stats.byPayment[entry.payment_method] = (stats.byPayment[entry.payment_method] || 0) + finalP;
        return stats;
      },
      {
        totalFinal: 0,
        totalOwner: 0,
        totalManager: 0,
        count: 0,
        byPayment: {
          Cash: 0,
          Card: 0,
          'Online UPI': 0,
        } as Record<PaymentMethod, number>,
      }
    );
  }, [entries]);

  // Service Breakdown using final_price
  const serviceBreakdown = useMemo(() => {
    const counts = new Map<string, number>();

    entries.forEach((entry) => {
      entry.services.forEach((service) => {
        if (service !== 'Custom Service') {
          counts.set(service, (counts.get(service) ?? 0) + 1);
        }
      });
    });

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [entries]);

  // Unique list of managers for dropdown filter
  const uniqueManagersList = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      if (e.manager_name) set.add(e.manager_name);
    });
    managerConfigs.forEach((m) => set.add(m.manager_name));
    return Array.from(set).sort();
  }, [entries, managerConfigs]);

  // Dynamic CSV Export sorted chronologically
  function downloadCsv() {
    const chronologicalEntries = [...entries].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const headers = [
      'Date',
      'Client Name',
      'Phone Number',
      'Manager Name',
      'Services',
      'Actual Price',
      'Discount',
      'Final Price',
      'Owner Share',
      'Manager Share',
      'Payment Method',
      'Month',
      'Year',
    ];

    const rows = chronologicalEntries.map((entry) => {
      const d = new Date(entry.created_at);
      const monthName = d.toLocaleString('en-IN', { month: 'long' });
      const yearStr = String(d.getFullYear());

      return [
        formatEntryDate(entry.created_at),
        entry.client_name,
        entry.phone_number,
        entry.manager_name,
        entryServices(entry),
        String(Number(entry.actual_price).toFixed(2)),
        String(Number(entry.discount).toFixed(2)),
        String(Number(entry.final_price).toFixed(2)),
        String(Number(entry.owner_share).toFixed(2)),
        String(Number(entry.manager_share).toFixed(2)),
        entry.payment_method,
        monthName,
        yearStr,
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    // Dynamic filename: GoodlifeSalon-Month-Year.csv
    const [year, monthIndex] = selectedMonth.split('-');
    const dateObj = new Date(Number(year), Number(monthIndex) - 1, 1);
    const formattedMonth = dateObj.toLocaleString('en-US', { month: 'long' });
    const fileName = `GoodlifeSalon-${formattedMonth}-${year}.csv`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (shouldGateDashboard && !isDashboardUnlocked) {
    return (
      <section className="flex flex-col justify-center gap-5 pt-6">
        <header>
          <p className="text-3xl font-black tracking-normal text-white sm:text-4xl">
            <span className="text-goodlife-accent">Goodlife</span> Salon
          </p>
          <h1 className="mt-1 text-base font-medium text-white/60">Dashboard Security Gate</h1>
        </header>

        <form className="rounded-xl border border-white/10 bg-goodlife-card p-4 shadow-premium sm:p-6" onSubmit={onUnlock}>
          <div className="grid gap-3">
            <label className="text-xs font-bold uppercase tracking-wider text-white/70">Dashboard PIN</label>
            <input
              className="input text-center text-xl tracking-[0.35em]"
              inputMode="numeric"
              maxLength={4}
              placeholder="••••"
              type="password"
              value={pin}
              onChange={(e) => onPinChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
            {dashboardError ? <p className="text-xs font-semibold text-red-400">{dashboardError}</p> : null}
            <button className="mt-2 h-12 w-full rounded-lg bg-goodlife-accent text-base font-black text-white" type="submit">
              Unlock Dashboard
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5 pt-2">
      {/* Header & Controls */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-3xl font-black tracking-normal text-white sm:text-4xl">
            <span className="text-goodlife-accent">Goodlife</span> Salon
          </p>
          <h1 className="mt-1 text-base font-medium text-white/60">Revenue & Manager Dashboard</h1>
        </div>

        <button
          className="h-10 rounded-lg border border-white/10 px-4 text-sm font-bold text-white/80 transition hover:border-goodlife-accent/70"
          type="button"
          onClick={onRefresh}
        >
          {isLoadingEntries ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </header>

      {/* Month Selector */}
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

      {/* Overall Financial Stats Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat featured label="Total Final Revenue" value={inr.format(dashboardStats.totalFinal)} />
        <Stat label="Owner's Share Total" value={inr.format(dashboardStats.totalOwner)} />
        <Stat label="Manager Share Total" value={inr.format(dashboardStats.totalManager)} />
      </div>

      {/* Payment Method Breakdown */}
      <div className="rounded-xl border border-white/10 bg-goodlife-card p-4 shadow-premium sm:p-6">
        <h2 className="text-lg font-black">Payment Breakdown (Final Revenue)</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PAYMENT_METHODS.map((method) => (
            <Stat compact key={method} label={method} value={inr.format(dashboardStats.byPayment[method])} />
          ))}
          <Stat compact label="Total Clients" value={String(dashboardStats.count)} />
        </div>
      </div>

      {/* Manager Configuration Owner Panel */}
      <ManagerConfiguration configs={managerConfigs} onRefreshConfigs={onRefreshConfigs} />

      {/* Manager Analytics Section */}
      <ManagerAnalytics entries={entries} />

      {/* Services Breakdown Collapsible */}
      <CollapsibleSection
        count={serviceBreakdown.length}
        isOpen={isServicesOpen}
        onToggle={() => setIsServicesOpen((v) => !v)}
        title="Services Breakdown"
      >
        <div className="grid gap-2">
          {serviceBreakdown.length === 0 ? (
            <p className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
              No services recorded for this month.
            </p>
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

      {/* Entries List with Search, Filters, & CSV Export */}
      <CollapsibleSection
        count={filteredEntries.length}
        isOpen={isEntriesOpen}
        onToggle={() => setIsEntriesOpen((v) => !v)}
        title="Client Entries List"
      >
        {/* Search & Filter Controls */}
        <div className="mb-4 grid gap-3 rounded-lg border border-white/10 bg-[#111] p-3 sm:grid-cols-3">
          <div>
            <label className="text-[11px] font-bold uppercase text-white/50">Search Client / Phone</label>
            <input
              className="input mt-1 h-9 text-xs"
              placeholder="Filter by name or phone..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase text-white/50">Filter Manager</label>
            <select
              className="input mt-1 h-9 text-xs cursor-pointer"
              value={managerFilter}
              onChange={(e) => setManagerFilter(e.target.value)}
            >
              <option value="All">All Managers</option>
              {uniqueManagersList.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase text-white/50">Filter Payment Method</label>
            <select
              className="input mt-1 h-9 text-xs cursor-pointer"
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
            >
              <option value="All">All Payment Methods</option>
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* CSV Export Button */}
        <div className="mb-4 flex justify-between items-center">
          <span className="text-xs text-white/50">
            Showing {filteredEntries.length} of {entries.length} entries
          </span>
          <button
            className="h-10 rounded-lg bg-goodlife-accent px-4 text-xs font-black text-white transition hover:bg-orange-500 disabled:opacity-50"
            disabled={entries.length === 0}
            type="button"
            onClick={downloadCsv}
          >
            Download Report (CSV)
          </button>
        </div>

        {/* Entries List */}
        <div className="grid gap-3">
          {filteredEntries.length === 0 ? (
            <p className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
              No matching client entries found.
            </p>
          ) : (
            filteredEntries.map((entry) => (
              <EntryCard
                entry={entry}
                key={entry.id}
                onDelete={onDeleteEntry}
                onEdit={(item) => setEditingEntry(item)}
              />
            ))
          )}
        </div>
      </CollapsibleSection>

      {/* Edit Entry Modal */}
      {editingEntry ? (
        <EntryEditor
          entry={editingEntry}
          managerConfigs={managerConfigs}
          onClose={() => setEditingEntry(null)}
          onUpdateEntry={onUpdateEntry}
        />
      ) : null}
    </section>
  );
}

type StatProps = {
  compact?: boolean;
  featured?: boolean;
  label: string;
  value: string;
};

function Stat({ compact, featured, label, value }: StatProps) {
  return (
    <div
      className={`rounded-xl border p-4 shadow-premium ${
        featured ? 'border-goodlife-accent/40 bg-goodlife-accent/10' : 'border-white/10 bg-goodlife-card'
      } ${compact ? 'py-3' : ''}`}
    >
      <p className="text-xs font-bold uppercase tracking-wider text-white/60">{label}</p>
      <p className={`mt-1 font-black ${featured ? 'text-2xl text-goodlife-accent' : 'text-xl text-white'}`}>{value}</p>
    </div>
  );
}

type CollapsibleSectionProps = {
  children: any;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  title: string;
};

function CollapsibleSection({ children, count, isOpen, onToggle, title }: CollapsibleSectionProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-goodlife-card p-4 shadow-premium sm:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-black">{title}</h2>
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-bold text-white/80">{count}</span>
        </div>
        <button
          className="h-8 rounded-lg border border-white/10 px-3 text-xs font-bold text-white/80 transition hover:border-goodlife-accent/70"
          type="button"
          onClick={onToggle}
        >
          {isOpen ? 'Hide' : 'Show'}
        </button>
      </div>

      {isOpen ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
