import { useMemo } from 'react';
import { ServiceEntry } from './EntryEditor';

type ManagerAnalyticsProps = {
  entries: ServiceEntry[];
};

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function ManagerAnalytics({ entries }: ManagerAnalyticsProps) {
  const managerStats = useMemo(() => {
    const map = new Map<
      string,
      {
        count: number;
        actualTotal: number;
        discountTotal: number;
        finalTotal: number;
        ownerTotal: number;
        managerTotal: number;
      }
    >();

    entries.forEach((entry) => {
      const name = entry.manager_name || 'General';
      const existing = map.get(name) ?? {
        count: 0,
        actualTotal: 0,
        discountTotal: 0,
        finalTotal: 0,
        ownerTotal: 0,
        managerTotal: 0,
      };

      existing.count += 1;
      existing.actualTotal += Number(entry.actual_price || 0);
      existing.discountTotal += Number(entry.discount || 0);
      existing.finalTotal += Number(entry.final_price || 0);
      existing.ownerTotal += Number(entry.owner_share || 0);
      existing.managerTotal += Number(entry.manager_share || 0);

      map.set(name, existing);
    });

    return Array.from(map.entries()).map(([name, stats]) => ({
      name,
      ...stats,
    }));
  }, [entries]);

  if (managerStats.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-white/10 bg-goodlife-card p-4 shadow-premium sm:p-6">
      <h2 className="text-lg font-black text-white">Manager Performance Analytics</h2>
      <p className="mt-0.5 text-xs text-white/60">Revenue, client counts, and earnings breakdown by manager</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {managerStats.map((manager) => (
          <div className="rounded-lg border border-white/10 bg-[#111] p-4 shadow-md" key={manager.name}>
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="font-black text-white">{manager.name}</span>
              <span className="rounded-full bg-goodlife-accent/20 px-2 py-0.5 text-xs font-bold text-goodlife-accent">
                {manager.count} {manager.count === 1 ? 'client' : 'clients'}
              </span>
            </div>

            <div className="mt-3 grid gap-1.5 text-xs">
              <div className="flex justify-between text-white/70">
                <span>Total Final Revenue:</span>
                <span className="font-bold text-goodlife-accent">{inr.format(manager.finalTotal)}</span>
              </div>

              {manager.discountTotal > 0 ? (
                <div className="flex justify-between text-white/50 text-[11px]">
                  <span>Total Discounts Given:</span>
                  <span>-{inr.format(manager.discountTotal)}</span>
                </div>
              ) : null}

              <div className="flex justify-between text-white/70">
                <span>Owner Share:</span>
                <span className="font-bold text-white">{inr.format(manager.ownerTotal)}</span>
              </div>

              <div className="flex justify-between text-white/70">
                <span>Manager Share:</span>
                <span className="font-bold text-emerald-400">{inr.format(manager.managerTotal)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
