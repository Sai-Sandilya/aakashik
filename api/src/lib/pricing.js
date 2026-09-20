import { ApiError } from './errors.js';

export const MEMBER_RATE = 0.10;

/** Size price map for products with variants (matches storefront). */
export const SIZE_PRICES = {
  'herbal-bath': { '100g': 249, '500g': 999, '1kg': 1999 },
  kaphahara: { '250g': 599, '500g': 1199 },
  navojas: { '250g': 599, '500g': 1199 },
  'amirit-ahaar': { '250g': 599, '500g': 1199, '1kg': 2399 },
  aparajitha: { '50g': 349, '100g': 599 },
  avartaki: { '50g': 119, '100g': 199 },
  tulasi: { '50g': 69, '100g': 119 },
  hibiscus: { '50g': 75, '100g': 149 },
  'jamun-seed': { '50g': 75, '100g': 149 },
  'tamarind-seed': { '50g': 60, '100g': 119 },
  moringa: { '50g': 149, '100g': 299 },
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
  const base = product.priceN;
  if (!(Number(base) > 0)) {
    throw new ApiError(400, 'validation_error', `Pricing not available yet for ${product.id}`);
  }
  return base;
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
