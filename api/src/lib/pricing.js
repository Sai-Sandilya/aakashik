import { ApiError } from './errors.js';

export const MEMBER_RATE = 0.10;

/** Size price map for products with variants (matches storefront). */
export const SIZE_PRICES = {
  kaphahara: { '100g': 199, '250g': 399, '500g': 599 },
  navojas: { '100g': 199, '250g': 399, '500g': 599 },
};

export function resolveBasePrice(product, { size, sizePrice }) {
  if (SIZE_PRICES[product.id]) {
    if (size && SIZE_PRICES[product.id][size] != null) {
      return SIZE_PRICES[product.id][size];
    }
    if (sizePrice != null && Number.isFinite(sizePrice)) {
      const allowed = Object.values(SIZE_PRICES[product.id]);
      if (!allowed.includes(sizePrice)) {
        throw new ApiError(400, 'validation_error', `Invalid size price for ${product.id}`);
      }
      return sizePrice;
    }
    return product.priceN;
  }
  return product.priceN;
}

/**
 * One 10% discount per line — subscribe preferred over member (never stacked).
 * Matches Aakashik Landing checkout rules.
 */
export function lineUnitPrice(basePrice, { subscribe, memberPricing }) {
  const applyDiscount = subscribe || (!subscribe && memberPricing);
  if (!applyDiscount) return basePrice;
  return Math.max(0, Math.round(basePrice * (1 - MEMBER_RATE)));
}

export function computeOrderTotals(lines) {
  let subtotal = 0;
  let total = 0;
  for (const line of lines) {
    subtotal += line.basePrice * line.qty;
    total += line.unitPrice * line.qty;
  }
  const memberDiscount = Math.max(0, subtotal - total);
  return {
    subtotal,
    total,
    memberDiscount,
  };
}
