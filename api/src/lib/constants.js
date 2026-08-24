export const ORDER_STATUSES = [
  'pending',
  'packed',
  'shipped',
  'out_for_delivery',
  'delivered',
  'cancelled',
];

export const STATUS_TRANSITIONS = {
  pending: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export const STATUS_LABELS = {
  pending: 'Order Confirmed',
  packed: 'Packed with care',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const DEFAULT_STOCK = {
  sunni: 25,
  diabetic: 20,
  immunity: 30,
  kaphahara: 40,
  ashta: 35,
  navojas: 40,
  'kit-immunity': 15,
  'kit-glow': 15,
  'sample-trio': 50,
};

export const BUILTIN_PRODUCTS = [
  { id: 'sunni', name: 'Herbal Sunni Pindi', sub: 'Bath Powder', element: 'Earth', concern: 'Skin & Body', priceN: 249, kind: 'Product', isBuiltin: true },
  { id: 'diabetic', name: 'Sugar Balance Support', sub: 'Kashayam', element: 'Fire', concern: 'Sugar', priceN: 399, kind: 'Product', isBuiltin: true },
  { id: 'immunity', name: 'Daily Immunity', sub: 'Kashayam', element: 'Water', concern: 'Immunity', priceN: 349, kind: 'Product', isBuiltin: true },
  { id: 'kaphahara', name: 'Kaphahara', sub: 'Herbal Wellness Powder', element: 'Air', concern: 'Respiratory', priceN: 199, kind: 'Product', isBuiltin: true },
  { id: 'ashta', name: 'Ashtagandham', sub: 'Sacred Powder', element: 'Space', concern: 'Spiritual', priceN: 199, kind: 'Product', isBuiltin: true },
  { id: 'navojas', name: 'Navojas', sub: 'Herbal Wellness Powder', element: 'Fire', concern: 'Digestion', priceN: 199, kind: 'Product', isBuiltin: true },
  { id: 'kit-immunity', name: 'Immunity Ritual Kit', sub: 'Bundle', element: 'Water', concern: 'Immunity', priceN: 599, kind: 'Bundle', isBuiltin: true },
  { id: 'kit-glow', name: 'Glow & Cleanse Kit', sub: 'Bundle', element: 'Earth', concern: 'Skin & Body', priceN: 349, kind: 'Bundle', isBuiltin: true },
  { id: 'sample-trio', name: 'Sample Trio', sub: 'Bundle', element: 'All', concern: 'Immunity', priceN: 99, kind: 'Bundle', isBuiltin: true },
];
