import { FormEvent, ReactNode, useState } from 'react';
import { motion } from 'framer-motion';
import { calculateServicePricing, getAutoServicePrice, isAutoPricedService } from '../lib/pricing';
import { findManagerConfig, ManagerConfig, normalizeManagerName } from '../lib/managerConfig';
import { calculateEntryTotals } from '../lib/calculations';
import { hasSupabaseConfig } from '../lib/supabase';

export const SALON_SERVICE_OPTIONS = [
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
] as const;

// The top 5 auto-priced Spa services MUST appear FIRST in exact order requested
export const SPA_SERVICE_OPTIONS = [
  'HIJAMA (PER CUPPING)',
  'CUPPING THERAPY',
  'BODY WAX',
  'BODY SCRUB',
  'DEEP TISSUE MASSAGE',
  'Full Body Massage',
  'Swedish Massage',
  'Aromatherapy Massage',
  'Hot Stone Massage',
  'Head & Neck Massage',
  'Back & Shoulder Massage',
  'Foot Reflexology',
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

export const PAYMENT_METHODS = ['Cash', 'Card', 'Online UPI'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type FormState = {
  clientName: string;
  phoneNumber: string;
  managerName: string;
  services: string[];
  customService: string;
  totalPrice: string; // Actual Price
  discount: string;
  paymentMethod: PaymentMethod | '';
};

export type FormErrors = Partial<Record<keyof FormState | 'supabase' | 'general', string>>;

export const initialForm: FormState = {
  clientName: '',
  phoneNumber: '',
  managerName: '',
  services: [],
  customService: '',
  totalPrice: '',
  discount: '0',
  paymentMethod: '',
};

type ServiceCategoryTab = 'salon' | 'spa' | 'custom';

type EntryFormProps = {
  managerConfigs: ManagerConfig[];
  isSaving: boolean;
  onSaveEntry: (entryData: {
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
  }) => Promise<boolean>;
};

export function EntryForm({ managerConfigs, isSaving, onSaveEntry }: EntryFormProps) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [manualPricePart, setManualPricePart] = useState<number>(0);
  const [activeCategoryTab, setActiveCategoryTab] = useState<ServiceCategoryTab>('salon');

  const hasCustomService = form.services.includes('Custom Service');

  // Counts of selected services per category for tab badges
  const salonSelectedCount = form.services.filter((s) => (SALON_SERVICE_OPTIONS as readonly string[]).includes(s)).length;
  const spaSelectedCount = form.services.filter((s) => (SPA_SERVICE_OPTIONS as readonly string[]).includes(s)).length;

  // Find manager config matching current input
  const activeManagerConfig = findManagerConfig(managerConfigs, form.managerName);

  // Financial calculations via centralized engine
  const financialTotals = calculateEntryTotals(
    form.totalPrice,
    form.discount,
    activeManagerConfig?.owner_percentage ?? 0,
    activeManagerConfig?.manager_percentage ?? 0
  );

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, general: undefined }));
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
    setErrors((current) => ({ ...current, services: undefined, totalPrice: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const newErrors: FormErrors = {};
    const cleanClientName = form.clientName.trim();
    const cleanPhone = form.phoneNumber.trim();
    const cleanManagerName = normalizeManagerName(form.managerName);
    const cleanCustom = form.customService.trim();
    const actualPriceNum = Number(form.totalPrice) || 0;
    const discountNum = Number(form.discount) || 0;

    if (!cleanClientName) {
      newErrors.clientName = 'Client name is required.';
    }

    if (!/^\d{10}$/.test(cleanPhone)) {
      newErrors.phoneNumber = 'Enter a valid 10-digit mobile number.';
    }

    if (!cleanManagerName) {
      newErrors.managerName = 'Manager name is required.';
    } else {
      const config = findManagerConfig(managerConfigs, cleanManagerName);
      if (!config) {
        newErrors.managerName = `Manager configuration for "${cleanManagerName}" not found. Please add manager rule in Dashboard.`;
      } else if (!config.is_active) {
        newErrors.managerName = `Manager "${config.manager_name}" is currently inactive. Please select an active manager.`;
      }
    }

    if (form.services.length === 0) {
      newErrors.services = 'Select at least one service.';
    }

    if (hasCustomService && !cleanCustom) {
      newErrors.customService = 'Enter the custom service description.';
    }

    if (actualPriceNum <= 0) {
      newErrors.totalPrice = 'Enter a total price greater than 0.';
    }

    if (discountNum < 0) {
      newErrors.discount = 'Discount cannot be negative.';
    } else if (discountNum > actualPriceNum) {
      newErrors.discount = 'Discount cannot exceed Total Price.';
    }

    if (!form.paymentMethod) {
      newErrors.paymentMethod = 'Select a payment method.';
    }

    if (!hasSupabaseConfig) {
      newErrors.supabase = 'Add Supabase credentials to .env before saving entries.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const config = findManagerConfig(managerConfigs, cleanManagerName)!;
    const totals = calculateEntryTotals(
      actualPriceNum,
      discountNum,
      config.owner_percentage,
      config.manager_percentage
    );

    const success = await onSaveEntry({
      clientName: cleanClientName,
      phoneNumber: cleanPhone,
      managerName: config.manager_name,
      services: form.services,
      customService: hasCustomService ? cleanCustom : null,
      actualPrice: totals.actualPrice,
      discount: totals.discount,
      finalPrice: totals.finalPrice,
      ownerShare: totals.ownerShare,
      managerShare: totals.managerShare,
      paymentMethod: form.paymentMethod as PaymentMethod,
    });

    if (success) {
      setForm(initialForm);
      setManualPricePart(0);
      setErrors({});
      setActiveCategoryTab('salon');
    }
  }

  return (
    <section className="flex flex-col gap-5">
      <header className="pt-2">
        <p className="text-3xl font-black tracking-normal text-white sm:text-4xl">
          <span className="text-goodlife-accent">Goodlife</span> Salon
        </p>
        <h1 className="mt-1 text-base font-medium text-white/60">New Client Entry</h1>
      </header>

      <form className="rounded-xl border border-white/10 bg-goodlife-card p-4 shadow-premium sm:p-6" onSubmit={handleSubmit}>
        <div className="grid gap-4">
          {/* 1. Client Name */}
          <Field label="Client Name" error={errors.clientName}>
            <input
              className="input"
              placeholder="Enter client name"
              type="text"
              value={form.clientName}
              onChange={(event) => updateForm('clientName', event.target.value)}
            />
          </Field>

          {/* 2. Phone Number */}
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

          {/* 3. Manager Name */}
          <Field label="Manager Name" error={errors.managerName}>
            <input
              className="input"
              placeholder="Enter manager name (e.g. Rahul, Amit, Sachin)"
              type="text"
              value={form.managerName}
              onChange={(event) => updateForm('managerName', event.target.value)}
            />
            {activeManagerConfig ? (
              <p className="mt-1 text-xs font-semibold text-emerald-400">
                Rule found: Owner {activeManagerConfig.owner_percentage}% | Manager {activeManagerConfig.manager_percentage}%
              </p>
            ) : null}
          </Field>

          {/* 4. Services Taken - Segmented Control Tabs View */}
          <Field label="Services Taken" error={errors.services}>
            {/* Segmented Control Header */}
            <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-[#111] p-1 text-center text-xs font-black">
              <button
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 transition ${
                  activeCategoryTab === 'salon'
                    ? 'bg-goodlife-accent text-white shadow-md'
                    : 'text-white/60 hover:text-white'
                }`}
                type="button"
                onClick={() => setActiveCategoryTab('salon')}
              >
                <span>Salon</span>
                {salonSelectedCount > 0 ? (
                  <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">{salonSelectedCount}</span>
                ) : null}
              </button>

              <button
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 transition ${
                  activeCategoryTab === 'spa'
                    ? 'bg-goodlife-accent text-white shadow-md'
                    : 'text-white/60 hover:text-white'
                }`}
                type="button"
                onClick={() => setActiveCategoryTab('spa')}
              >
                <span>Spa</span>
                {spaSelectedCount > 0 ? (
                  <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">{spaSelectedCount}</span>
                ) : null}
              </button>

              <button
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 transition ${
                  activeCategoryTab === 'custom'
                    ? 'bg-goodlife-accent text-white shadow-md'
                    : 'text-white/60 hover:text-white'
                }`}
                type="button"
                onClick={() => setActiveCategoryTab('custom')}
              >
                <span>Custom</span>
                {hasCustomService ? (
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                ) : null}
              </button>
            </div>

            {/* Selected Services Counter Summary */}
            {form.services.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                <span className="font-bold text-white/50">Selected ({form.services.length}):</span>
                {form.services.map((svc) => (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-goodlife-accent/15 px-2.5 py-0.5 text-[11px] font-bold text-goodlife-accent border border-goodlife-accent/30"
                    key={svc}
                  >
                    <span>{svc}</span>
                    <button
                      aria-label={`Remove ${svc}`}
                      className="hover:text-white"
                      type="button"
                      onClick={() => toggleService(svc)}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            {/* Category Tab Content */}
            <div className="mt-2 min-h-[220px]">
              {activeCategoryTab === 'salon' ? (
                <ServiceGroup
                  label="Salon Services"
                  options={SALON_SERVICE_OPTIONS}
                  selectedServices={form.services}
                  toggleService={toggleService}
                />
              ) : null}

              {activeCategoryTab === 'spa' ? (
                <ServiceGroup
                  label="Spa Services (Top 5 include auto-pricing)"
                  options={SPA_SERVICE_OPTIONS}
                  selectedServices={form.services}
                  toggleService={toggleService}
                />
              ) : null}

              {activeCategoryTab === 'custom' ? (
                <div className="grid gap-3 rounded-xl border border-white/10 bg-[#111] p-4">
                  <motion.label
                    className={`service-chip ${hasCustomService ? 'service-chip-active' : ''}`}
                    animate={{
                      backgroundColor: hasCustomService ? 'rgba(249, 115, 22, 0.1)' : '#111111',
                      borderColor: hasCustomService ? '#f97316' : 'rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    <input
                      checked={hasCustomService}
                      type="checkbox"
                      onChange={() => toggleService('Custom Service')}
                    />
                    <span className="chip-box" aria-hidden="true" />
                    <span className="font-bold">Enable Custom Service</span>
                  </motion.label>

                  {hasCustomService ? (
                    <div className="mt-1 grid gap-2">
                      <label className="text-xs font-bold uppercase text-white/70">Custom Service Description</label>
                      <input
                        className="input"
                        placeholder="Enter custom service details"
                        type="text"
                        value={form.customService}
                        onChange={(e) => updateForm('customService', e.target.value)}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-white/50">
                      Check the box above to add a custom service description and manual price.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </Field>

          {/* 5. Total Price (Actual Price) */}
          <Field label="Total Price (Actual Price) (₹)" error={errors.totalPrice}>
            <input
              className="input"
              inputMode="decimal"
              min="1"
              placeholder="0"
              type="number"
              value={form.totalPrice}
              onChange={(event) => handleTotalPriceChange(event.target.value)}
            />
          </Field>

          {/* 6. Discount */}
          <Field label="Discount (₹)" error={errors.discount}>
            <input
              className="input"
              inputMode="decimal"
              min="0"
              placeholder="0"
              type="number"
              value={form.discount}
              onChange={(event) => updateForm('discount', event.target.value)}
            />
          </Field>

          {/* 7. Final Price (Read-only) */}
          <Field label="Final Price (₹) (Read Only)">
            <div className="flex h-11 w-full items-center rounded-lg border border-goodlife-accent/40 bg-goodlife-accent/10 px-3 text-base font-black text-goodlife-accent">
              ₹{financialTotals.finalPrice.toLocaleString('en-IN')}
            </div>
          </Field>

          {/* Live Revenue Breakdown Preview */}
          {activeManagerConfig && financialTotals.finalPrice > 0 ? (
            <div className="rounded-lg border border-white/10 bg-[#111] p-3 text-xs">
              <div className="flex justify-between text-white/60">
                <span>Owner Share ({activeManagerConfig.owner_percentage}%):</span>
                <span className="font-bold text-white">₹{financialTotals.ownerShare.toLocaleString('en-IN')}</span>
              </div>
              <div className="mt-1 flex justify-between text-white/60">
                <span>Manager Share ({activeManagerConfig.manager_percentage}%):</span>
                <span className="font-bold text-white">₹{financialTotals.managerShare.toLocaleString('en-IN')}</span>
              </div>
            </div>
          ) : null}

          {/* 8. Payment Method */}
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

          {/* 9. Add Entry Submit Button */}
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

type FieldProps = {
  children: ReactNode;
  error?: string;
  label: string;
};

export function Field({ children, error, label }: FieldProps) {
  return (
    <div className="grid gap-1.5">
      <label className="text-xs font-bold uppercase tracking-wider text-white/70">{label}</label>
      {children}
      {error ? <p className="text-xs font-semibold text-red-400">{error}</p> : null}
    </div>
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
          const isAuto = isAutoPricedService(service);
          const autoPrice = isAuto ? getAutoServicePrice(service) : 0;

          return (
            <motion.label
              className={`service-chip justify-between ${selected ? 'service-chip-active' : ''}`}
              key={service}
              animate={{
                scale: selected ? [1, 1.02, 1] : [1, 0.985, 1],
                backgroundColor: selected ? 'rgba(249, 115, 22, 0.1)' : '#111111',
                borderColor: selected ? '#f97316' : 'rgba(255, 255, 255, 0.1)',
              }}
              transition={{
                scale: { type: 'spring', stiffness: 520, damping: 24 },
                backgroundColor: { duration: 0.2, ease: 'easeInOut' },
                borderColor: { duration: 0.2, ease: 'easeInOut' },
              }}
            >
              <div className="flex items-center gap-2.5">
                <input className="sr-only" checked={selected} type="checkbox" onChange={() => toggleService(service)} />
                <span className="chip-box" aria-hidden="true" />
                <span className="text-xs font-bold">{service}</span>
              </div>

              {isAuto ? (
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-black ${
                    selected ? 'bg-goodlife-accent text-white' : 'bg-white/10 text-goodlife-accent'
                  }`}
                >
                  ₹{autoPrice}
                </span>
              ) : null}
            </motion.label>
          );
        })}
      </div>
    </div>
  );
}
