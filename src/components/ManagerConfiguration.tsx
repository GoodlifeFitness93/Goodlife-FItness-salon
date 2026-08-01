import { FormEvent, useState } from 'react';
import {
  createOrUpdateManagerConfig,
  findManagerConfig,
  ManagerConfig,
  normalizeManagerName,
  toggleManagerActiveStatus,
} from '../lib/managerConfig';

type ManagerConfigurationProps = {
  configs: ManagerConfig[];
  onRefreshConfigs: () => void;
};

export function ManagerConfiguration({ configs, onRefreshConfigs }: ManagerConfigurationProps) {
  const [managerName, setManagerName] = useState('');
  const [ownerPct, setOwnerPct] = useState<string>('60');
  const [managerPct, setManagerPct] = useState<string>('40');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleOwnerPctChange(val: string) {
    setOwnerPct(val);
    const num = Number(val);
    if (!isNaN(num) && num >= 0 && num <= 100) {
      setManagerPct(String(100 - num));
    }
    setError('');
  }

  function handleManagerPctChange(val: string) {
    setManagerPct(val);
    const num = Number(val);
    if (!isNaN(num) && num >= 0 && num <= 100) {
      setOwnerPct(String(100 - num));
    }
    setError('');
  }

  function startEditing(config: ManagerConfig) {
    setEditingId(config.id);
    setManagerName(config.manager_name);
    setOwnerPct(String(config.owner_percentage));
    setManagerPct(String(config.manager_percentage));
    setError('');
  }

  function cancelEditing() {
    setEditingId(null);
    setManagerName('');
    setOwnerPct('60');
    setManagerPct('40');
    setError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanName = normalizeManagerName(managerName);
    const ownerNum = Math.round(Number(ownerPct));
    const managerNum = Math.round(Number(managerPct));

    if (!cleanName) {
      setError('Manager name is required.');
      return;
    }

    if (isNaN(ownerNum) || ownerNum < 0 || ownerNum > 100) {
      setError('Owner percentage must be between 0 and 100.');
      return;
    }

    if (isNaN(managerNum) || managerNum < 0 || managerNum > 100) {
      setError('Manager percentage must be between 0 and 100.');
      return;
    }

    if (ownerNum + managerNum !== 100) {
      setError('Owner percentage and Manager percentage must sum to 100%.');
      return;
    }

    // Check unique duplicate name if adding new
    if (!editingId) {
      const duplicate = findManagerConfig(configs, cleanName);
      if (duplicate) {
        setError(`A manager rule for "${cleanName}" already exists.`);
        return;
      }
    }

    setIsSubmitting(true);
    setError('');

    const res = await createOrUpdateManagerConfig(
      {
        manager_name: cleanName,
        owner_percentage: ownerNum,
        manager_percentage: managerNum,
      },
      editingId ?? undefined
    );

    setIsSubmitting(false);

    if (res.error) {
      setError(res.error);
    } else {
      cancelEditing();
      onRefreshConfigs();
    }
  }

  async function handleToggleActive(config: ManagerConfig) {
    const nextStatus = !config.is_active;
    const res = await toggleManagerActiveStatus(config.id, nextStatus);
    if (res.error) {
      setError(res.error);
    } else {
      onRefreshConfigs();
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-goodlife-card p-4 shadow-premium sm:p-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div>
          <h2 className="text-lg font-black text-white">Manager Revenue Divider Configuration</h2>
          <p className="mt-0.5 text-xs text-white/60">Configure custom revenue splits for each manager</p>
        </div>
        <span className="rounded bg-goodlife-accent/10 px-2.5 py-1 text-xs font-bold text-goodlife-accent">
          {configs.filter((c) => c.is_active).length} Active Managers
        </span>
      </div>

      {/* Add / Edit Manager Rule Form */}
      <form className="mt-4 grid gap-3 rounded-lg border border-white/10 bg-[#111] p-3 sm:p-4" onSubmit={handleSubmit}>
        <h3 className="text-xs font-black uppercase text-white/50">
          {editingId ? 'Edit Manager Rule' : 'Create New Manager Rule'}
        </h3>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs font-bold text-white/70">Manager Name</label>
            <input
              className="input mt-1"
              placeholder="e.g. Rahul, Sachin"
              type="text"
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-white/70">Owner Percentage (%)</label>
            <input
              className="input mt-1"
              inputMode="numeric"
              max={100}
              min={0}
              placeholder="60"
              type="number"
              value={ownerPct}
              onChange={(e) => handleOwnerPctChange(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-white/70">Manager Percentage (%)</label>
            <input
              className="input mt-1"
              inputMode="numeric"
              max={100}
              min={0}
              placeholder="40"
              type="number"
              value={managerPct}
              onChange={(e) => handleManagerPctChange(e.target.value)}
            />
          </div>
        </div>

        {error ? <p className="text-xs font-semibold text-red-400">{error}</p> : null}

        <div className="flex gap-2">
          {editingId ? (
            <button
              className="h-10 rounded-lg border border-white/10 px-4 text-xs font-bold text-white/70 hover:border-white/30"
              type="button"
              onClick={cancelEditing}
            >
              Cancel
            </button>
          ) : null}
          <button
            className="h-10 flex-1 rounded-lg bg-goodlife-accent text-xs font-black text-white hover:bg-orange-500 disabled:opacity-50"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Saving...' : editingId ? 'Update Rule' : '+ Save Manager Rule'}
          </button>
        </div>
      </form>

      {/* Rules List Table / Cards */}
      <div className="mt-4 grid gap-2">
        {configs.length === 0 ? (
          <p className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
            No manager configurations created yet. Use the form above to add manager rules.
          </p>
        ) : (
          configs.map((config) => (
            <div
              className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 ${
                config.is_active ? 'border-white/10 bg-[#111]' : 'border-white/5 bg-white/[0.02] opacity-60'
              }`}
              key={config.id}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{config.manager_name}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      config.is_active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                    }`}
                  >
                    {config.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-white/60">
                  Owner: <span className="font-bold text-white">{config.owner_percentage}%</span> | Manager:{' '}
                  <span className="font-bold text-white">{config.manager_percentage}%</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-bold text-white/80 hover:border-goodlife-accent hover:text-white"
                  type="button"
                  onClick={() => startEditing(config)}
                >
                  Edit
                </button>
                <button
                  className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${
                    config.is_active
                      ? 'border-red-500/30 text-red-300 hover:bg-red-500/10'
                      : 'border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10'
                  }`}
                  type="button"
                  onClick={() => handleToggleActive(config)}
                >
                  {config.is_active ? 'Deactivate (Soft Delete)' : 'Activate'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
