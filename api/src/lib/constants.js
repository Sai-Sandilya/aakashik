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
  'herbal-bath': 25,
  kaphahara: 40,
  ashta: 35,
  navojas: 40,
  'amirit-ahaar': 30,
  aparajitha: 40,
  avartaki: 40,
  tulasi: 40,
  hibiscus: 40,
  'jamun-seed': 35,
  'tamarind-seed': 35,
  moringa: 40,
  'rose-water': 40,
  'kit-immunity': 15,
  'kit-glow': 15,
  'sample-trio': 50,
};

export const BUILTIN_PRODUCTS = [
  { id: 'herbal-bath', name: 'Herbal Bath Powder', sub: 'Bath Powder', element: 'Earth', concern: 'Skin & Body', priceN: 249, kind: 'Product', isBuiltin: true },
  { id: 'kaphahara', name: 'Kaphahara', sub: 'Herbal Wellness Powder', element: 'Air', concern: 'Respiratory', priceN: 599, kind: 'Product', isBuiltin: true },
  { id: 'ashta', name: 'Ashtagandham', sub: 'Sacred Powder', element: 'Space', concern: 'Spiritual', priceN: 199, kind: 'Product', isBuiltin: true },
  { id: 'navojas', name: 'Navojas', sub: 'Herbal Wellness Powder', element: 'Fire', concern: 'Digestion', priceN: 599, kind: 'Product', isBuiltin: true },
  { id: 'amirit-ahaar', name: 'Amirit Ahaar', sub: 'Health Mix', element: 'Earth', concern: 'Nutrition', priceN: 599, kind: 'Product', isBuiltin: true },
  { id: 'aparajitha', name: 'Dried Aparajitha Flower', sub: 'Butterfly Pea Flower', element: 'Water', concern: 'Spiritual', priceN: 349, kind: 'Product', isBuiltin: true },
  { id: 'avartaki', name: 'Avartaki', sub: "Tanner's Cassia Flower", element: 'Earth', concern: 'Spiritual', priceN: 119, kind: 'Product', isBuiltin: true },
  { id: 'tulasi', name: 'Dried Tulasi Leaves', sub: 'Holy Basil · Ocimum sanctum', element: 'Air', concern: 'Immunity', priceN: 69, kind: 'Product', isBuiltin: true },
  { id: 'hibiscus', name: 'Dried Hibiscus Flower', sub: 'Hibiscus rosa-sinensis', element: 'Water', concern: 'Spiritual', priceN: 75, kind: 'Product', isBuiltin: true },
  { id: 'jamun-seed', name: 'Jamun Seed Powder', sub: 'Indian Blackberry Seed', element: 'Fire', concern: 'Sugar', priceN: 75, kind: 'Product', isBuiltin: true },
  { id: 'tamarind-seed', name: 'Tamarind Seed Powder', sub: 'Tamarindus indica Seed', element: 'Earth', concern: 'Digestion', priceN: 60, kind: 'Product', isBuiltin: true },
  { id: 'moringa', name: 'Dried Moringa Leaves', sub: 'Drumstick Tree · Moringa oleifera', element: 'Earth', concern: 'Immunity', priceN: 149, kind: 'Product', isBuiltin: true },
  { id: 'rose-water', name: 'Rose Water', sub: 'Floral Ritual Mist', element: 'Water', concern: 'Spiritual', priceN: 0, kind: 'Product', isBuiltin: true },
  { id: 'kit-immunity', name: 'Immunity Ritual Kit', sub: 'Bundle', element: 'Water', concern: 'Immunity', priceN: 599, kind: 'Bundle', isBuiltin: true },
  { id: 'kit-glow', name: 'Glow & Cleanse Kit', sub: 'Bundle', element: 'Earth', concern: 'Skin & Body', priceN: 349, kind: 'Bundle', isBuiltin: true },
  { id: 'sample-trio', name: 'Sample Trio', sub: '7 × 50g trial sachets', element: 'All', concern: 'Immunity', priceN: 99, kind: 'Bundle', isBuiltin: true },
];
