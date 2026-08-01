export type FinancialTotals = {
  actualPrice: number;
  discount: number;
  finalPrice: number;
  ownerShare: number;
  managerShare: number;
};

/**
  Centralized financial calculation engine used across entry creation,
  entry editing, dashboard stats, manager analytics, and CSV exports.
 */
export function calculateEntryTotals(
  actualPriceInput: number | string,
  discountInput: number | string,
  ownerPercentage: number,
  managerPercentage: number
): FinancialTotals {
  const actualPrice = Math.max(0, Number(actualPriceInput) || 0);
  const discount = Math.max(0, Number(discountInput) || 0);
  const finalPrice = Math.max(0, actualPrice - discount);

  const ownerShare = Math.round(((finalPrice * ownerPercentage) / 100) * 100) / 100;
  const managerShare = Math.round(((finalPrice * managerPercentage) / 100) * 100) / 100;

  return {
    actualPrice,
    discount,
    finalPrice,
    ownerShare,
    managerShare,
  };
}
