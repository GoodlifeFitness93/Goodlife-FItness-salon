import { FormEvent, useState } from 'react';
import { calculateServicePricing } from '../lib/pricing';
import { findManagerConfig, ManagerConfig, normalizeManagerName } from '../lib/managerConfig';
import { calculateEntryTotals } from '../lib/calculations';
import { Field, PAYMENT_METHODS, PaymentMethod, SALON_SERVICE_OPTIONS, SPA_SERVICE_OPTIONS } from './EntryForm';

export type ServiceEntry = {
  id: string;
  client_name: string;
  phone_number: string;
  manager_name: string;
  services: string[];
  custom_service: string | null;
  total_price: number; // legacy alias
  actual_price: number;
  discount: number;
  final_price: number;
  owner_share: number;
  manager_share: number;
  payment_method: PaymentMethod;
  created_at: string;
  entry_month: string;
};

type EntryEditorProps = {
  entry: ServiceEntry;
  managerConfigs: ManagerConfig[];
  onClose: () => void;
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
};

export function EntryEditor({ entry, managerConfigs, onClose, onUpdateEntry }: EntryEditorProps) {
  const [form, setForm] = useState({
    clientName: entry.client_name,
    phoneNumber: entry.phone_number,
    managerName: entry.manager_name,
    services: entry.services,
    customService: entry.custom_service ?? '',
    totalPrice: String(entry.actual_price),
    discount: String(entry.discount),
    paymentMethod: entry.payment_method,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualPricePart, setManualPricePart] = useState(0);

  const hasCustomService = form.services.includes('Custom Service');
  const activeManagerConfig = findManagerConfig(managerConfigs, form.managerName);

  // If no active config found for this manager, use historical split as fallback for editing recalculations
  const ownerPct = activeManagerConfig?.owner_percentage ?? (entry.final_price > 0 ? Math.round((entry.owner_share / entry.final_price) * 100) : 60);
  const managerPct = activeManagerConfig?.manager_percentage ?? (100 - ownerPct);

  const financialTotals = calculateEntryTotals(
    form.totalPrice,
    form.discount,
    ownerPct,
    managerPct
  );

  function updateForm(key: string, value: any) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  }

  function handleTotalPriceChange(newPriceStr: string) {
    const newTotal = Math.max(0, Number(newPriceStr) || 0);
    const { autoTotal } = calculateServicePricing(form.services, 0);
    const newManual = Math.max(0, newTotal - autoTotal);

    setManualPricePart(newManual);
    updateForm('totalPrice', newPriceStr);
  }

  function toggleService(service: string) {
    setForm((current) => {
      const isSelected = current.services.includes(service);
      const nextServices = isSelected
        ? current.services.filter((item) => item !== service)
        : [...current.services, service];

      const { actualPrice } = calculateServicePricing(nextServices, manualPricePart);
      const nextTotalPrice = actualPrice > 0 ? String(actualPrice) : '';

      return {
        ...current,
        services: nextServices,
        totalPrice: nextTotalPrice,
      };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const newErrors: Record<string, string> = {};
    const cleanClient = form.clientName.trim();
    const cleanPhone = form.phoneNumber.trim();
    const cleanManager = normalizeManagerName(form.managerName);
    const cleanCustom = form.customService.trim();
    const actualNum = Number(form.totalPrice) || 0;
    const discountNum = Number(form.discount) || 0;

    if (!cleanClient) newErrors.clientName = 'Client name is required.';
    if (!/^\d{10}$/.test(cleanPhone)) newErrors.phoneNumber = 'Enter a valid 10-digit mobile number.';
    if (!cleanManager) newErrors.managerName = 'Manager name is required.';
    if (form.services.length === 0) newErrors.services = 'Select at least one service.';
    if (hasCustomService && !cleanCustom) newErrors.customService = 'Enter custom service description.';
    if (actualNum <= 0) newErrors.totalPrice = 'Total price must be greater than 0.';
    if (discountNum < 0) newErrors.discount = 'Discount cannot be negative.';
    if (discountNum > actualNum) newErrors.discount = 'Discount cannot exceed Total Price.';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    const totals = calculateEntryTotals(actualNum, discountNum, ownerPct, managerPct);

    const success = await onUpdateEntry(entry.id, {
      client_name: cleanClient,
      phone_number: cleanPhone,
      manager_name: cleanManager,
      services: form.services,
      custom_service: hasCustomService ? cleanCustom : null,
      actual_price: totals.actualPrice,
      discount: totals.discount,
      final_price: totals.finalPrice,
      owner_share: totals.ownerShare,
      manager_share: totals.managerShare,
      payment_method: form.paymentMethod as PaymentMethod,
    });

    setIsSubmitting(false);

    if (success) {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-2xl rounded-xl border border-white/10 bg-[#141414] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h2 className="text-xl font-black text-white">Edit Client Entry</h2>
          <button
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-white/70 hover:border-white/30 hover:text-white"
            type="button"
            onClick={onClose}
          >
            ✕ Close
          </button>
        </div>

        <form className="mt-4 grid gap-4" onSubmit={handleSubmit}>
          <Field label="Client Name" error={errors.clientName}>
            <input
              className="input"
              type="text"
              value={form.clientName}
              onChange={(e) => updateForm('clientName', e.target.value)}
            />
          </Field>

          <Field label="Phone Number" error={errors.phoneNumber}>
            <input
              className="input"
              inputMode="numeric"
              maxLength={10}
              type="tel"
              value={form.phoneNumber}
              onChange={(e) => updateForm('phoneNumber', e.target.value.replace(/\D/g, '').slice(0, 10))}
            />
          </Field>

          <Field label="Manager Name" error={errors.managerName}>
            <input
              className="input"
              type="text"
              value={form.managerName}
              onChange={(e) => updateForm('managerName', e.target.value)}
            />
          </Field>

          <Field label="Services Taken" error={errors.services}>
            <div className="grid max-h-48 gap-3 overflow-y-auto rounded-lg border border-white/10 bg-[#111] p-3">
              <p className="text-xs font-bold text-white/50">SALON SERVICES</p>
              <div className="grid grid-cols-2 gap-2">
                {SALON_SERVICE_OPTIONS.map((service) => (
                  <label
                    className={`flex items-center gap-2 rounded p-2 text-xs font-semibold cursor-pointer ${
                      form.services.includes(service) ? 'bg-goodlife-accent/20 text-goodlife-accent border border-goodlife-accent' : 'bg-[#1a1a1a] text-white/70'
                    }`}
                    key={service}
                  >
                    <input
                      checked={form.services.includes(service)}
                      type="checkbox"
                      onChange={() => toggleService(service)}
                    />
                    <span>{service}</span>
                  </label>
                ))}
              </div>

              <p className="mt-2 text-xs font-bold text-white/50">SPA SERVICES</p>
              <div className="grid grid-cols-2 gap-2">
                {SPA_SERVICE_OPTIONS.map((service) => (
                  <label
                    className={`flex items-center gap-2 rounded p-2 text-xs font-semibold cursor-pointer ${
                      form.services.includes(service) ? 'bg-goodlife-accent/20 text-goodlife-accent border border-goodlife-accent' : 'bg-[#1a1a1a] text-white/70'
                    }`}
                    key={service}
                  >
                    <input
                      checked={form.services.includes(service)}
                      type="checkbox"
                      onChange={() => toggleService(service)}
                    />
                    <span>{service}</span>
                  </label>
                ))}
              </div>
            </div>
          </Field>

          {hasCustomService ? (
            <Field label="Custom Service Description" error={errors.customService}>
              <input
                className="input"
                type="text"
                value={form.customService}
                onChange={(e) => updateForm('customService', e.target.value)}
              />
            </Field>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Total Price (Actual) (₹)" error={errors.totalPrice}>
              <input
                className="input"
                type="number"
                value={form.totalPrice}
                onChange={(e) => handleTotalPriceChange(e.target.value)}
              />
            </Field>

            <Field label="Discount (₹)" error={errors.discount}>
              <input
                className="input"
                type="number"
                value={form.discount}
                onChange={(e) => updateForm('discount', e.target.value)}
              />
            </Field>
          </div>

          <Field label="Recalculated Final Price (₹)">
            <div className="flex h-11 items-center rounded-lg border border-goodlife-accent/40 bg-goodlife-accent/10 px-3 font-black text-goodlife-accent">
              ₹{financialTotals.finalPrice.toLocaleString('en-IN')} (Owner: ₹{financialTotals.ownerShare.toLocaleString('en-IN')} | Mgr: ₹{financialTotals.managerShare.toLocaleString('en-IN')})
            </div>
          </Field>

          <Field label="Payment Method">
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

          <div className="mt-4 flex gap-3">
            <button
              className="h-11 flex-1 rounded-lg border border-white/10 text-sm font-bold text-white/70 hover:border-white/30"
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="h-11 flex-1 rounded-lg bg-goodlife-accent text-sm font-black text-white hover:bg-orange-500 disabled:opacity-50"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
