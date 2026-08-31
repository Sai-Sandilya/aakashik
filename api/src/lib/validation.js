import { ORDER_STATUSES } from './constants.js';
import { ApiError } from './errors.js';

export const LIMITS = {
  NAME_MAX: 120,
  DESC_MAX: 2000,
  ADDRESS_MAX: 300,
  CITY_MAX: 80,
  STATE_MAX: 60,
  PHOTO_MAX_BYTES: 1_500_000,
  QTY_MAX: 99,
  STOCK_MAX: 999_999,
  PRICE_MAX: 1_000_000,
};

export const VALID_CONCERNS = [
  'Immunity', 'Sugar', 'Respiratory', 'Digestion', 'Skin & Body', 'Spiritual',
];

export const VALID_PAY_METHODS = ['cod', 'upi', 'card'];
export const VALID_INVENTORY_FILTERS = ['all', 'in_stock', 'low', 'out'];

const ORDER_ID_RE = /^AAK-\d{5,}$/;

export function assertNonEmptyString(value, field, message) {
  const s = String(value ?? '').trim();
  if (!s) throw new ApiError(400, 'validation_error', message || `${field} is required`);
  return s;
}

export function assertMaxLen(value, max, message) {
  if (String(value).length > max) throw new ApiError(400, 'validation_error', message);
}

export function validateOrderId(id) {
  const s = String(id || '').trim();
  if (!ORDER_ID_RE.test(s)) {
    throw new ApiError(400, 'validation_error', 'Invalid order ID format');
  }
  return s;
}

export function validateOrderStatusFilter(status) {
  if (!status || status === 'all') return status;
  if (!ORDER_STATUSES.includes(status)) {
    throw new ApiError(400, 'validation_error', 'Invalid order status filter');
  }
  return status;
}

export function validateInventoryFilter(filter) {
  const f = String(filter || 'all');
  if (!VALID_INVENTORY_FILTERS.includes(f)) {
    throw new ApiError(400, 'validation_error', 'Invalid inventory filter');
  }
  return f;
}

export function validateDelivery(delivery) {
  const d = delivery || {};
  const name = assertNonEmptyString(d.name, 'name', 'Enter your full name');
  assertMaxLen(name, LIMITS.NAME_MAX, 'Name is too long');
  const phone = String(d.phone || '').replace(/\D/g, '');
  const email = String(d.email || '').trim();
  const address = assertNonEmptyString(d.address, 'address', 'Enter your delivery address');
  assertMaxLen(address, LIMITS.ADDRESS_MAX, 'Address is too long');
  const city = assertNonEmptyString(d.city, 'city', 'Enter your city');
  assertMaxLen(city, LIMITS.CITY_MAX, 'City name is too long');
  const state = assertNonEmptyString(d.state, 'state', 'Select your state / UT');
  assertMaxLen(state, LIMITS.STATE_MAX, 'State name is too long');
  const pincode = String(d.pincode || '').trim();

  if (!phone && !email) throw new ApiError(400, 'validation_error', 'Enter phone or email for delivery');
  if (phone && (!/^\d{10}$/.test(phone) || !/^[6-9]/.test(phone))) {
    throw new ApiError(400, 'validation_error', 'Enter a valid 10-digit phone');
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new ApiError(400, 'validation_error', 'Enter a valid email format');
  }
  if (!/^\d{6}$/.test(pincode)) throw new ApiError(400, 'validation_error', 'Enter a valid 6-digit pin code');

  return { name, phone, email, address, city, state, pincode };
}

export function validateCartItem(raw, index) {
  const productId = String(raw?.productId || raw?.id || '').trim();
  if (!productId) {
    throw new ApiError(400, 'validation_error', `Line ${index + 1}: productId is required`);
  }
  const qty = Math.floor(Number(raw?.qty));
  if (!Number.isFinite(qty) || qty < 1) {
    throw new ApiError(400, 'validation_error', `Line ${index + 1}: quantity must be at least 1`);
  }
  if (qty > LIMITS.QTY_MAX) {
    throw new ApiError(400, 'validation_error', `Line ${index + 1}: quantity cannot exceed ${LIMITS.QTY_MAX}`);
  }
  return {
    productId,
    qty,
    subscribe: !!raw?.subscribe,
    size: raw?.size ? String(raw.size).trim() : null,
    sizePrice: raw?.sizePrice != null ? Math.round(Number(raw.sizePrice)) : null,
  };
}

export function validatePayMethod(payMethod) {
  const method = String(payMethod || 'cod').toLowerCase();
  if (!VALID_PAY_METHODS.includes(method)) {
    throw new ApiError(400, 'validation_error', 'Invalid payment method');
  }
  return method;
}

export function validatePaymentDetails(method, payment = {}) {
  if (method === 'upi') {
    const upi = String(payment.upiId || payment.upi || '').trim();
    if (!/^[\w.\-]{2,}@[\w]{2,}$/i.test(upi)) {
      throw new ApiError(400, 'validation_error', 'Enter a valid UPI ID (e.g. name@upi)');
    }
    return { method: 'upi', mock: true, status: 'authorized', upiMask: upi.replace(/.(?=@)/g, '•') };
  }
  if (method === 'card') {
    const num = String(payment.cardNumber || '').replace(/\s+/g, '');
    const exp = String(payment.cardExpiry || '').trim();
    const cvv = String(payment.cardCvv || '').trim();
    if (!/^\d{16}$/.test(num)) throw new ApiError(400, 'validation_error', 'Enter a valid 16-digit card number');
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(exp)) {
      throw new ApiError(400, 'validation_error', 'Enter card expiry as MM/YY');
    }
    if (!/^\d{3,4}$/.test(cvv)) throw new ApiError(400, 'validation_error', 'Enter a valid CVV');
    return { method: 'card', mock: true, status: 'authorized', last4: num.slice(-4) };
  }
  return { method: 'cod', mock: true, status: 'cod' };
}

export function validateProductInput(body, { partial = false } = {}) {
  const out = {};
  if (!partial || body.name !== undefined) {
    out.name = assertNonEmptyString(body.name, 'name', 'Enter a product name');
    assertMaxLen(out.name, LIMITS.NAME_MAX, 'Product name is too long');
  }
  if (!partial || body.description !== undefined) {
    out.description = assertNonEmptyString(body.description, 'description', 'Enter a product description');
    assertMaxLen(out.description, LIMITS.DESC_MAX, 'Product description is too long');
  }
  if (!partial || body.priceN !== undefined || body.listPriceN !== undefined) {
    const priceN = Math.round(Number(body.priceN ?? body.listPriceN));
    if (!Number.isFinite(priceN) || priceN <= 0 || priceN > LIMITS.PRICE_MAX) {
      throw new ApiError(400, 'validation_error', 'Enter a valid price greater than 0');
    }
    out.listPriceN = priceN;
  }
  if (body.discountPct !== undefined) {
    const discountPct = Math.round(Number(body.discountPct));
    if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct > 90) {
      throw new ApiError(400, 'validation_error', 'Discount must be 0–90%');
    }
    out.discountPct = discountPct;
  }
  if (body.stock !== undefined) {
    const stock = Math.floor(Number(body.stock));
    if (!Number.isFinite(stock) || stock < 0 || stock > LIMITS.STOCK_MAX) {
      throw new ApiError(400, 'validation_error', 'Enter a valid stock quantity');
    }
    out.stock = stock;
  }
  if (body.concern !== undefined) {
    const concern = String(body.concern).trim();
    if (!VALID_CONCERNS.includes(concern)) {
      throw new ApiError(400, 'validation_error', 'Invalid product category');
    }
    out.concern = concern;
  }
  if (body.photo !== undefined && body.photo) {
    validatePhoto(body.photo);
    out.photo = body.photo;
  }
  if (body.active !== undefined) out.active = body.active !== false;
  return out;
}

export function validatePhoto(photo) {
  const raw = String(photo || '');
  if (!raw) return;
  const base64 = raw.includes(',') ? raw.split(',')[1] : raw;
  const bytes = Math.ceil((base64.length * 3) / 4);
  if (bytes > LIMITS.PHOTO_MAX_BYTES) {
    throw new ApiError(400, 'validation_error', 'Photo must be under 1.5 MB');
  }
}

export function validateAdminLogin(body) {
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  if (!email || !password) throw new ApiError(400, 'validation_error', 'Email and password are required');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new ApiError(400, 'validation_error', 'Enter a valid admin email');
  }
  return { email, password };
}

export function validateStatusUpdate(body) {
  const status = String(body?.status || '').trim();
  if (!status) throw new ApiError(400, 'validation_error', 'status is required');
  if (!ORDER_STATUSES.includes(status)) throw new ApiError(400, 'invalid_status', 'Unknown order status');
  return status;
}

export function validateNewsletterEmail(raw) {
  const email = String(raw || '').trim().toLowerCase();
  if (!email) throw new ApiError(400, 'validation_error', 'Enter a valid email');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new ApiError(400, 'validation_error', 'Enter a valid email');
  }
  return email;
}

export function validateReminderTime(raw) {
  const time = String(raw || '').trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new ApiError(400, 'validation_error', 'Enter a valid reminder time');
  }
  return time;
}

export function validateReminderSubscribe(body = {}) {
  const email = validateNewsletterEmail(body.email);
  const remindTime = validateReminderTime(body.time ?? body.remindTime);
  const timezone = String(body.timezone || 'Asia/Kolkata').trim() || 'Asia/Kolkata';
  return { email, remindTime, timezone };
}
