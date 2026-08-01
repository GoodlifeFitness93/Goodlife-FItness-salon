export const AUTOMATIC_PRICED_SERVICES: Record<string, number> = {
  'HIJAMA (PER CUPPING)': 99,
  'CUPPING THERAPY': 499,
  'BODY WAX': 1199,
  'BODY SCRUB': 1499,
  'DEEP TISSUE MASSAGE': 1999,
};

/**
  Normalizes service name for pricing lookup (trimmed, uppercase comparison)
 */
function normalizeServiceName(serviceName: string): string {
  return serviceName.trim().toUpperCase();
}

/**
  Checks if a given service has predefined automatic pricing
 */
export function isAutoPricedService(serviceName: string): boolean {
  const key = normalizeServiceName(serviceName);
  return key in AUTOMATIC_PRICED_SERVICES;
}

/**
  Gets the predefined price for an automatic service, or 0 if not auto-priced
 */
export function getAutoServicePrice(serviceName: string): number {
  const key = normalizeServiceName(serviceName);
  return AUTOMATIC_PRICED_SERVICES[key] ?? 0;
}

/**
  Single primary calculation API for service pricing.
  Calculates automatic total for predefined services, manual price for unpriced services,
  and total actual price.
 */
export function calculateServicePricing(
  selectedServices: string[],
  manualPriceInput: number | string
): {
  autoTotal: number;
  manualPrice: number;
  actualPrice: number;
} {
  let autoTotal = 0;

  selectedServices.forEach((service) => {
    if (service !== 'Custom Service') {
      autoTotal += getAutoServicePrice(service);
    }
  });

  const parsedManual = Math.max(0, Number(manualPriceInput) || 0);
  const actualPrice = autoTotal + parsedManual;

  return {
    autoTotal,
    manualPrice: parsedManual,
    actualPrice,
  };
}
