import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ServiceEntry } from './EntryEditor';

type EntryCardProps = {
  entry: ServiceEntry;
  onEdit: (entry: ServiceEntry) => void;
  onDelete: (entryId: string) => Promise<boolean>;
};

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

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function EntryCard({ entry, onEdit, onDelete }: EntryCardProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleConfirmDelete() {
    setIsDeleting(true);
    const deleted = await onDelete(entry.id);
    setIsDeleting(false);
    if (deleted) {
      setIsConfirmingDelete(false);
    }
  }

  return (
    <motion.article
      className="overflow-hidden rounded-lg border border-white/10 bg-[#111] p-4 shadow-md transition hover:border-white/20"
      layout
      initial={false}
      exit={{ height: 0, opacity: 0, paddingTop: 0, paddingBottom: 0, marginTop: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {/* Left Column: Client & Services */}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase text-white/40">{formatEntryDate(entry.created_at)}</span>
            <span className="rounded bg-white/10 px-2 py-0.5 text-xs font-bold text-goodlife-accent">
              Manager: {entry.manager_name}
            </span>
          </div>

          <h3 className="mt-1 text-base font-black text-white">{entry.client_name}</h3>
          <p className="text-xs font-semibold text-white/60">{entry.phone_number}</p>
          <p className="mt-2 text-sm text-white/80">{entryServices(entry)}</p>
        </div>

        {/* Right Column: Financial Breakdown & Actions */}
        <div className="flex flex-col items-start sm:items-end">
          <div className="text-left sm:text-right">
            <p className="text-lg font-black text-goodlife-accent">{inr.format(entry.final_price)}</p>
            {entry.discount > 0 ? (
              <p className="text-xs text-white/50">
                Actual: <span className="line-through">{inr.format(entry.actual_price)}</span> | Disc: -{inr.format(entry.discount)}
              </p>
            ) : null}
            <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold text-white/60 sm:justify-end">
              <span>Owner: {inr.format(entry.owner_share)}</span>
              <span>•</span>
              <span>Manager: {inr.format(entry.manager_share)}</span>
            </div>
            <span className="mt-1 inline-block rounded bg-white/5 px-2 py-0.5 text-xs font-bold uppercase text-white/50">
              {entry.payment_method}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="mt-3 flex items-center gap-2">
            <button
              className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-bold text-white/70 transition hover:border-goodlife-accent hover:text-white"
              type="button"
              onClick={() => onEdit(entry)}
            >
              Edit
            </button>
            <button
              className="rounded-lg border border-red-500/30 px-2.5 py-1 text-xs font-bold text-red-300 transition hover:border-red-400 hover:bg-red-500/10 disabled:opacity-50"
              disabled={isDeleting}
              type="button"
              onClick={() => setIsConfirmingDelete(true)}
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Box */}
      <AnimatePresence>
        {isConfirmingDelete ? (
          <motion.div
            className="mt-3 flex flex-col gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 sm:flex-row sm:items-center sm:justify-between"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <p className="text-sm font-bold text-red-100">Delete this entry for {entry.client_name}?</p>
            <div className="flex gap-2">
              <button
                className="h-8 rounded-lg bg-red-500 px-3 text-xs font-black text-white transition hover:bg-red-400 disabled:opacity-60"
                disabled={isDeleting}
                type="button"
                onClick={handleConfirmDelete}
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button
                className="h-8 rounded-lg border border-white/10 px-3 text-xs font-black text-white/70 transition hover:border-white/30 disabled:opacity-60"
                disabled={isDeleting}
                type="button"
                onClick={() => setIsConfirmingDelete(false)}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.article>
  );
}
