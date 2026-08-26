const RAW_RESCUES = [
  { id: 'banana-peanut', category: 'sweet', name: 'Banana peanut bowl', detail: 'Banana, peanut butter and a pinch of cinnamon', time: '2 min', price: 35, icon: 'nutrition-outline', searchTerm: 'banana peanut butter' },
  { id: 'curd-fruit', category: 'sweet', name: 'Fruit & chilled curd', detail: 'Cooling, creamy and gently sweet', time: '3 min', price: 45, icon: 'snow-outline', searchTerm: 'fruit curd bowl' },
  { id: 'dates-nuts', category: 'sweet', name: 'Dates with roasted nuts', detail: 'Chewy sweetness with a satisfying crunch', time: '1 min', price: 55, icon: 'leaf-outline', searchTerm: 'dates roasted nuts' },
  { id: 'cocoa-milk', category: 'sweet', name: 'Warm cocoa milk', detail: 'A warm, chocolatey pause without food rules', time: '4 min', price: 30, icon: 'cafe-outline', searchTerm: 'cocoa milk drink' },
  { id: 'masala-makhana', category: 'salty', name: 'Masala makhana', detail: 'Roasted, salty and easy to keep nearby', time: '5 min', price: 45, icon: 'ellipse-outline', searchTerm: 'masala makhana' },
  { id: 'chaat-cup', category: 'salty', name: 'Quick chana chaat', detail: 'Chana, onion, lemon and chaat masala', time: '6 min', price: 40, icon: 'restaurant-outline', searchTerm: 'chana chaat' },
  { id: 'egg-chaat', category: 'salty', name: 'Masala egg plate', detail: 'Boiled egg with salt, chilli and lemon', time: '5 min', price: 35, icon: 'egg-outline', searchTerm: 'boiled egg masala' },
  { id: 'paneer-bites', category: 'salty', name: 'Paneer pepper bites', detail: 'Soft paneer with pepper and chaat masala', time: '4 min', price: 65, icon: 'cube-outline', searchTerm: 'paneer snack' },
  { id: 'roasted-chana', category: 'crunchy', name: 'Roasted chana mix', detail: 'Crunchy, portable and shelf-friendly', time: '1 min', price: 25, icon: 'basket-outline', searchTerm: 'roasted chana' },
  { id: 'peanut-bhel', category: 'crunchy', name: 'Peanut murmura bhel', detail: 'Murmura, peanuts, lemon and coriander', time: '5 min', price: 30, icon: 'fast-food-outline', searchTerm: 'murmura peanut bhel' },
  { id: 'apple-chaat', category: 'crunchy', name: 'Apple chaat wedges', detail: 'Crisp apple with lemon and chaat masala', time: '3 min', price: 40, icon: 'nutrition-outline', searchTerm: 'apple chaat' },
  { id: 'toast-chutney', category: 'crunchy', name: 'Chutney toast fingers', detail: 'Warm toast with a bright, savoury spread', time: '7 min', price: 35, icon: 'restaurant-outline', searchTerm: 'chutney toast' },
  { id: 'dal-rice-cup', category: 'filling', name: 'Small dal-rice bowl', detail: 'A familiar, warm mini-meal', time: '8 min', price: 55, icon: 'restaurant-outline', searchTerm: 'dal rice bowl' },
  { id: 'curd-rice-cup', category: 'filling', name: 'Cooling curd rice', detail: 'Soft, cooling and ready in a few minutes', time: '5 min', price: 45, icon: 'snow-outline', searchTerm: 'curd rice' },
  { id: 'besan-chilla', category: 'filling', name: 'Quick besan chilla', detail: 'A warm savoury option when you can cook', time: '12 min', price: 40, icon: 'flame-outline', searchTerm: 'besan chilla' },
  { id: 'paneer-roti', category: 'filling', name: 'Paneer roti roll', detail: 'A simple handheld mini-meal', time: '8 min', price: 70, icon: 'restaurant-outline', searchTerm: 'paneer roti roll' },
  { id: 'ginger-tea', category: 'warm', name: 'Ginger tea & toast', detail: 'Warm, familiar and low-effort', time: '6 min', price: 25, icon: 'cafe-outline', searchTerm: 'ginger tea toast' },
  { id: 'pepper-rasam', category: 'warm', name: 'Pepper rasam cup', detail: 'A warm, savoury cup to sip slowly', time: '8 min', price: 30, icon: 'flame-outline', searchTerm: 'pepper rasam' },
  { id: 'oats-porridge', category: 'warm', name: 'Cardamom oats', detail: 'Soft oats with milk and cardamom', time: '7 min', price: 35, icon: 'cafe-outline', searchTerm: 'cardamom oats porridge' },
  { id: 'moong-soup', category: 'warm', name: 'Moong dal soup', detail: 'Gentle, warm and quietly filling', time: '10 min', price: 40, icon: 'restaurant-outline', searchTerm: 'moong dal soup' },
];

export const CRAVING_TYPES = [
  { id: 'sweet', label: 'Sweet', icon: 'ice-cream-outline' },
  { id: 'salty', label: 'Salty', icon: 'restaurant-outline' },
  { id: 'crunchy', label: 'Crunchy', icon: 'pizza-outline' },
  { id: 'filling', label: 'Filling', icon: 'fast-food-outline' },
  { id: 'warm', label: 'Warm', icon: 'cafe-outline' },
  { id: 'not_sure', label: 'Not sure', icon: 'sparkles-outline' },
];

export const RESCUE_CATALOG = Object.freeze(RAW_RESCUES);
export const RESCUE_BY_ID = new Map(RESCUE_CATALOG.map((item) => [item.id, item]));
export const DEFAULT_KIT_IDS = ['banana-peanut', 'masala-makhana', 'roasted-chana'];

export function getRescuesForCraving(category, { excludedIds = [], kitIds = [] } = {}) {
  const excluded = new Set(excludedIds);
  const kit = new Set(kitIds);
  const categories = category === 'not_sure' ? ['sweet', 'salty', 'crunchy'] : [category];
  return RESCUE_CATALOG
    .filter((item) => categories.includes(item.category) && !excluded.has(item.id))
    .sort((left, right) => Number(kit.has(right.id)) - Number(kit.has(left.id)))
    .slice(0, 3);
}

export function kitEstimate(ids = []) {
  return ids.reduce((total, id) => total + (RESCUE_BY_ID.get(id)?.price || 0), 0);
}

export function rotatingRescue(dateKey = '') {
  const seed = [...String(dateKey)].reduce((total, character) => total + character.charCodeAt(0), 0);
  return RESCUE_CATALOG[seed % RESCUE_CATALOG.length];
}
