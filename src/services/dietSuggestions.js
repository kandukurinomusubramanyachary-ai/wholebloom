// Bloom's Diet companion remains fully usable without a backend. Keep this
// module platform-neutral so its safety rules run consistently everywhere.

const PROFILE_LIST_LIMIT = 30;
const PROFILE_ITEM_LIMIT = 60;
const CUSTOM_INGREDIENT_LIMIT = 20;
const OBSERVATION_MINIMUM = 5;

export const INGREDIENT_CATALOG = Object.freeze([
  { id: 'rice', label: 'Rice', category: 'staple', aliases: [] },
  { id: 'roti', label: 'Roti', category: 'staple', aliases: ['chapati', 'chapatis', 'rotis'], allergens: ['gluten'] },
  { id: 'dal', label: 'Dal', category: 'protein', aliases: ['dhal', 'lentils'] },
  { id: 'curd', label: 'Curd', category: 'dairy', aliases: ['yoghurt', 'yogurt', 'dahi'], allergens: ['dairy', 'milk', 'lactose'] },
  { id: 'milk', label: 'Milk', category: 'dairy', aliases: [], allergens: ['dairy', 'lactose'] },
  { id: 'eggs', label: 'Eggs', category: 'protein', aliases: ['egg'], allergens: ['egg'] },
  { id: 'paneer', label: 'Paneer', category: 'protein', aliases: [], allergens: ['dairy', 'milk', 'lactose'] },
  { id: 'chicken', label: 'Chicken', category: 'protein', aliases: [] },
  { id: 'fish', label: 'Fish', category: 'protein', aliases: [], allergens: ['fish'] },
  { id: 'chana', label: 'Chana', category: 'protein', aliases: ['chickpeas', 'chickpea'] },
  { id: 'rajma', label: 'Rajma', category: 'protein', aliases: ['kidney beans'] },
  { id: 'peanuts', label: 'Peanuts', category: 'protein', aliases: ['peanut'], allergens: ['peanut', 'nuts'] },
  { id: 'vegetables', label: 'Vegetables', category: 'produce', aliases: ['vegetable', 'veggies'] },
  { id: 'cucumber', label: 'Cucumber', category: 'produce', aliases: [] },
  { id: 'tomato', label: 'Tomato', category: 'produce', aliases: ['tomatoes'] },
  { id: 'onion', label: 'Onion', category: 'produce', aliases: ['onions'] },
  { id: 'fruit', label: 'Fruit', category: 'produce', aliases: ['fruits'] },
  { id: 'banana', label: 'Banana', category: 'produce', aliases: ['bananas'] },
  { id: 'apple', label: 'Apple', category: 'produce', aliases: ['apples'] },
  { id: 'oats', label: 'Oats', category: 'staple', aliases: ['oatmeal'], allergens: ['gluten'] },
  { id: 'poha', label: 'Poha', category: 'staple', aliases: ['flattened rice'] },
  { id: 'upma', label: 'Upma', category: 'staple', aliases: [], allergens: ['gluten'] },
  { id: 'idli', label: 'Idli', category: 'staple', aliases: ['idlis'] },
  { id: 'dosa', label: 'Dosa', category: 'staple', aliases: ['dosas'] },
  { id: 'bread', label: 'Bread', category: 'staple', aliases: [], allergens: ['gluten'] },
  { id: 'sprouts', label: 'Sprouts', category: 'protein', aliases: ['sprouted beans'] },
  { id: 'sambar', label: 'Sambar', category: 'protein', aliases: ['sambhar'] },
  { id: 'millets', label: 'Millets', category: 'staple', aliases: ['millet'] },
  { id: 'tofu', label: 'Tofu', category: 'protein', aliases: [], allergens: ['soy'] },
  { id: 'buttermilk', label: 'Buttermilk', category: 'dairy', aliases: ['chaas'], allergens: ['dairy', 'milk', 'lactose'] },
]);

const CATALOG_BY_ID = new Map(INGREDIENT_CATALOG.map((item) => [item.id, item]));
const INGREDIENT_ALIASES = new Map();

function cleanText(value, maxLength = PROFILE_ITEM_LIMIT) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[<>]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);
}

function token(value) {
  return cleanText(value).toLowerCase().replace(/[_-]+/g, ' ');
}

INGREDIENT_CATALOG.forEach((item) => {
  INGREDIENT_ALIASES.set(token(item.id), item.id);
  INGREDIENT_ALIASES.set(token(item.label), item.id);
  (item.aliases || []).forEach((alias) => INGREDIENT_ALIASES.set(token(alias), item.id));
});

function cleanList(value, limit = PROFILE_LIST_LIMIT) {
  const seen = new Set();
  return (Array.isArray(value) ? value : [])
    .map((item) => cleanText(item))
    .filter((item) => {
      const key = token(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function normaliseEnum(value, aliases, fallback) {
  return aliases[token(value)] || fallback;
}

export const DEFAULT_DIET_PROFILE = Object.freeze({
  eatingPreference: 'no_preference',
  allergies: [],
  intolerances: [],
  dislikedFoods: [],
  religiousExclusions: [],
  culturalExclusions: [],
  cookingSetup: 'basic_kitchen',
  timeAvailable: 'under_15_minutes',
  budget: 'low_cost',
  goals: [],
});

const EATING_PREFERENCES = {
  '': 'no_preference',
  'no preference': 'no_preference',
  vegetarian: 'vegetarian',
  eggetarian: 'egg_inclusive_vegetarian',
  'egg vegetarian': 'egg_inclusive_vegetarian',
  'egg inclusive vegetarian': 'egg_inclusive_vegetarian',
  'non vegetarian': 'non_vegetarian',
  nonvegetarian: 'non_vegetarian',
  vegan: 'vegan',
};

const COOKING_SETUPS = {
  '': 'basic_kitchen',
  'no cooking': 'no_cooking',
  none: 'no_cooking',
  'hostel basic': 'hostel_basic',
  hostel: 'hostel_basic',
  basic: 'hostel_basic',
  'kettle only': 'kettle_only',
  kettle: 'kettle_only',
  'basic kitchen': 'basic_kitchen',
  'full kitchen': 'full_kitchen',
  full: 'full_kitchen',
};

const TIME_OPTIONS = {
  '': 'under_15_minutes',
  'under 5 minutes': 'under_5_minutes',
  'under 5': 'under_5_minutes',
  '5': 'under_5_minutes',
  'under 15 minutes': 'under_15_minutes',
  'under 15': 'under_15_minutes',
  '15': 'under_15_minutes',
  'under 30 minutes': 'under_30_minutes',
  'under 30': 'under_30_minutes',
  '30': 'under_30_minutes',
};

const BUDGET_OPTIONS = {
  '': 'low_cost',
  'low cost': 'low_cost',
  low: 'low_cost',
  regular: 'regular',
  flexible: 'flexible',
};

const GOALS = new Set([
  'steadier_energy',
  'feel_full_longer',
  'reduce_skipped_meals',
  'support_regular_eating',
  'notice_digestive_comfort',
  'build_balanced_meals',
]);

export function normalizeDietProfile(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const rawGoals = cleanList(source.goals).map((item) => token(item).replace(/\s/g, '_'));
  return {
    eatingPreference: normaliseEnum(
      source.eatingPreference || source.dietaryPreference,
      EATING_PREFERENCES,
      DEFAULT_DIET_PROFILE.eatingPreference
    ),
    allergies: cleanList(source.allergies),
    intolerances: cleanList(source.intolerances),
    dislikedFoods: cleanList(source.dislikedFoods || source.dislikes),
    religiousExclusions: cleanList(source.religiousExclusions),
    culturalExclusions: cleanList(source.culturalExclusions),
    cookingSetup: normaliseEnum(source.cookingSetup, COOKING_SETUPS, DEFAULT_DIET_PROFILE.cookingSetup),
    timeAvailable: normaliseEnum(
      source.timeAvailable || source.time,
      TIME_OPTIONS,
      DEFAULT_DIET_PROFILE.timeAvailable
    ),
    budget: normaliseEnum(source.budget, BUDGET_OPTIONS, DEFAULT_DIET_PROFILE.budget),
    goals: rawGoals.filter((goal) => GOALS.has(goal)),
  };
}

export function normalizeDietIngredients(ingredients, customIngredients = []) {
  const seen = new Set();
  const output = [];
  const add = (raw, custom = false) => {
    const value = typeof raw === 'object' && raw ? raw.id || raw.label || raw.name : raw;
    const cleaned = cleanText(value, 40);
    if (!cleaned) return;
    const id = INGREDIENT_ALIASES.get(token(cleaned)) || token(cleaned);
    if (!id || seen.has(id)) return;
    seen.add(id);
    output.push({
      id,
      label: CATALOG_BY_ID.get(id)?.label || cleaned,
      custom: !CATALOG_BY_ID.has(id) || custom,
    });
  };
  (Array.isArray(ingredients) ? ingredients : []).forEach((item) => add(item));
  (Array.isArray(customIngredients) ? customIngredients : [])
    .slice(0, CUSTOM_INGREDIENT_LIMIT)
    .forEach((item) => add(item, true));
  return output.slice(0, INGREDIENT_CATALOG.length + CUSTOM_INGREDIENT_LIMIT);
}

const ANIMAL_MEAT_WORDS = new Set([
  'chicken', 'fish', 'meat', 'beef', 'pork', 'mutton', 'lamb', 'prawn', 'prawns',
]);
const ANIMAL_PRODUCT_WORDS = new Set([
  'eggs', 'egg', 'milk', 'curd', 'yoghurt', 'yogurt', 'dahi', 'paneer',
  'buttermilk', 'ghee', 'cheese',
]);

function termVariants(value) {
  const normalized = token(value);
  const variants = new Set([normalized]);
  if (normalized.endsWith('ies') && normalized.length > 3) {
    variants.add(`${normalized.slice(0, -3)}y`);
  } else if (normalized.endsWith('s') && normalized.length > 3) {
    variants.add(normalized.slice(0, -1));
  }
  return [...variants].filter(Boolean);
}

function containsFoodTerm(value, foodTerm) {
  const valueVariants = termVariants(value);
  const foodVariants = termVariants(foodTerm);
  return valueVariants.some((candidate) => foodVariants.some((term) => (
    ` ${candidate} `.includes(` ${term} `)
    || ` ${term} `.includes(` ${candidate} `)
  )));
}

function preferenceAllows(id, preference) {
  const name = token(id);
  const hasMeat = [...ANIMAL_MEAT_WORDS].some((item) => containsFoodTerm(name, item));
  const hasAnimalProduct = [...ANIMAL_PRODUCT_WORDS]
    .some((item) => containsFoodTerm(name, item));
  if (preference === 'vegan') {
    return !hasMeat && !hasAnimalProduct;
  }
  if (preference === 'vegetarian') {
    return !hasMeat && !containsFoodTerm(name, 'egg');
  }
  if (preference === 'egg_inclusive_vegetarian') {
    return !hasMeat;
  }
  return true;
}

function exclusionTokens(profile) {
  return [
    ...profile.allergies,
    ...profile.intolerances,
    ...profile.dislikedFoods,
    ...profile.religiousExclusions,
    ...profile.culturalExclusions,
  ].map(token);
}

function ingredientConflict(id, profile) {
  const item = CATALOG_BY_ID.get(id);
  const aliases = new Set([
    id, item?.label, ...(item?.aliases || []), ...(item?.allergens || []),
  ].map(token));
  INGREDIENT_CATALOG.forEach((catalogItem) => {
    const names = [catalogItem.id, catalogItem.label, ...(catalogItem.aliases || [])];
    if (names.some((name) => containsFoodTerm(id, name))) {
      [
        catalogItem.id,
        catalogItem.label,
        catalogItem.category,
        ...(catalogItem.aliases || []),
        ...(catalogItem.allergens || []),
      ].map(token).filter(Boolean).forEach((signal) => aliases.add(signal));
    }
  });
  return exclusionTokens(profile).some((excluded) => {
    if (!excluded) return false;
    if ([...aliases].some((alias) => containsFoodTerm(alias, excluded))) return true;
    if (excluded === 'dairy' && item?.category === 'dairy') return true;
    if (excluded === 'nuts' && (item?.allergens || []).includes('peanut')) return true;
    return false;
  });
}

function ingredientAllowed(id, profile) {
  return preferenceAllows(id, profile.eatingPreference) && !ingredientConflict(id, profile);
}

const RECIPES = [
  {
    id: 'rice-dal-curd',
    name: 'Rice, dal and curd plate',
    ingredients: ['rice', 'dal', 'curd'],
    prepMinutes: 5,
    level: 0,
    cost: 1,
    filling: 5,
    preferredType: 'most_filling',
    explanation: 'Combines a familiar staple with dal for protein and curd alongside it; it may feel more filling than rice alone.',
    substitutions: ['Use buttermilk instead of curd if that suits you.'],
    steps: ['Add ready-prepared rice and dal to a plate.', 'Serve curd alongside and season in the way you normally enjoy.'],
  },
  {
    id: 'roti-dal-vegetables',
    name: 'Roti with dal and vegetables',
    ingredients: ['roti', 'dal', 'vegetables'],
    prepMinutes: 6,
    level: 0,
    cost: 1,
    filling: 5,
    preferredType: 'most_filling',
    explanation: 'Uses your roti and dal with vegetables for one practical, balanced plate.',
    substitutions: ['Use rice instead of roti if rice is already available.'],
    steps: ['Put the ready roti, dal and vegetables on one plate.', 'Add only the condiments you already use.'],
  },
  {
    id: 'eggs-bread-vegetables',
    name: 'Egg, bread and vegetable plate',
    ingredients: ['eggs', 'bread', 'vegetables'],
    prepMinutes: 12,
    level: 2,
    cost: 2,
    filling: 4,
    preferredType: 'quickest',
    explanation: 'Adds eggs as a source of protein and uses vegetables you already selected.',
    substitutions: ['Use roti instead of bread.'],
    steps: ['Prepare the eggs in your usual simple way.', 'Serve with bread and the available vegetables.'],
  },
  {
    id: 'poha-peanuts-curd',
    name: 'Poha with peanuts and curd',
    ingredients: ['poha', 'peanuts', 'curd'],
    prepMinutes: 15,
    level: 2,
    cost: 1,
    filling: 4,
    preferredType: 'lowest_effort_cost',
    explanation: 'Peanuts add a source of protein, while curd is an optional familiar side.',
    substitutions: ['Use sprouts instead of peanuts.'],
    steps: ['Prepare the poha in your usual simple way.', 'Add peanuts and serve curd alongside.'],
  },
  {
    id: 'idli-sambar',
    name: 'Idli with sambar',
    ingredients: ['idli', 'sambar'],
    prepMinutes: 4,
    level: 0,
    cost: 1,
    filling: 4,
    preferredType: 'quickest',
    explanation: 'A quick way to pair the idli you selected with sambar, which includes lentils.',
    substitutions: ['Use dal instead of sambar if that is what you have.'],
    steps: ['Place ready idli on a plate.', 'Serve the available sambar alongside.'],
  },
  {
    id: 'oats-milk-fruit',
    name: 'Oats with milk and fruit',
    ingredients: ['oats', 'milk', 'fruit'],
    prepMinutes: 8,
    level: 1,
    cost: 2,
    filling: 4,
    preferredType: 'quickest',
    explanation: 'Pairs oats with fruit and milk for a practical breakfast based on your selection.',
    substitutions: ['Use curd instead of milk for a cold bowl.'],
    steps: ['Soften the oats with hot water from a kettle.', 'Add milk and the available fruit.'],
  },
  {
    id: 'rajma-rice',
    name: 'Rajma rice bowl',
    ingredients: ['rajma', 'rice'],
    prepMinutes: 5,
    level: 0,
    cost: 1,
    filling: 5,
    preferredType: 'most_filling',
    explanation: 'Pairs rajma with rice; rajma adds protein and fibre-rich ingredients to the bowl.',
    substitutions: ['Use chana instead of rajma.'],
    steps: ['Add ready-prepared rajma and rice to a bowl.', 'Mix or serve side by side as you prefer.'],
  },
  {
    id: 'chana-roti',
    name: 'Chana with roti',
    ingredients: ['chana', 'roti'],
    prepMinutes: 5,
    level: 0,
    cost: 1,
    filling: 5,
    preferredType: 'lowest_effort_cost',
    explanation: 'Uses two affordable basics and adds chana as a source of protein and fibre.',
    substitutions: ['Use rice instead of roti.'],
    steps: ['Serve ready-prepared chana with roti.', 'Add cucumber or onion only if available and comfortable for you.'],
  },
  {
    id: 'paneer-roti-vegetables',
    name: 'Paneer, roti and vegetable plate',
    ingredients: ['paneer', 'roti', 'vegetables'],
    prepMinutes: 10,
    level: 0,
    cost: 3,
    filling: 5,
    preferredType: 'most_filling',
    explanation: 'Adds paneer as a source of protein beside roti and vegetables already available.',
    substitutions: ['Use tofu instead of paneer.'],
    steps: ['Slice ready-to-eat paneer if needed.', 'Serve with roti and the available vegetables.'],
  },
  {
    id: 'sprouts-curd-vegetables',
    name: 'Sprouts, curd and vegetable bowl',
    ingredients: ['sprouts', 'curd', 'vegetables'],
    prepMinutes: 5,
    level: 0,
    cost: 1,
    filling: 4,
    preferredType: 'quickest',
    explanation: 'An assemble-only bowl with sprouts for protein and fibre-rich vegetables.',
    substitutions: ['Use chana instead of sprouts.'],
    steps: ['Add ready-to-eat sprouts, curd and chopped vegetables to a bowl.', 'Mix gently with seasonings you already use.'],
  },
  {
    id: 'bread-banana-peanuts',
    name: 'Bread, banana and peanut plate',
    ingredients: ['bread', 'banana', 'peanuts'],
    prepMinutes: 3,
    level: 0,
    cost: 1,
    filling: 3,
    preferredType: 'lowest_effort_cost',
    explanation: 'A low-effort option that uses shelf-stable basics and needs no cooking.',
    substitutions: ['Use apple instead of banana.'],
    steps: ['Place the bread, banana and peanuts on a plate.', 'Eat them together or separately, whichever is easier.'],
  },
  {
    id: 'curd-fruit-bowl',
    name: 'Curd and fruit bowl',
    ingredients: ['curd', 'fruit'],
    prepMinutes: 3,
    level: 0,
    cost: 2,
    filling: 3,
    preferredType: 'quickest',
    explanation: 'A simple assemble-only option based on what you selected.',
    substitutions: ['Use banana or apple for the fruit.'],
    steps: ['Put curd in a bowl.', 'Add the available fruit and eat promptly.'],
  },
  {
    id: 'chana-cucumber-tomato',
    name: 'Chana and vegetable bowl',
    ingredients: ['chana', 'cucumber', 'tomato'],
    prepMinutes: 6,
    level: 0,
    cost: 1,
    filling: 4,
    preferredType: 'lowest_effort_cost',
    explanation: 'Uses ready chana for protein with simple vegetables for crunch and fibre.',
    substitutions: ['Use sprouts instead of chana.'],
    steps: ['Add ready-to-eat chana, cucumber and tomato to a bowl.', 'Mix with seasonings you already have.'],
  },
  {
    id: 'tofu-roti-vegetables',
    name: 'Tofu, roti and vegetable plate',
    ingredients: ['tofu', 'roti', 'vegetables'],
    prepMinutes: 8,
    level: 0,
    cost: 3,
    filling: 4,
    preferredType: 'most_filling',
    explanation: 'A vegan-friendly plate with tofu as a source of protein.',
    substitutions: ['Use chana instead of tofu.'],
    steps: ['Slice ready-to-eat tofu if needed.', 'Serve with roti and the available vegetables.'],
  },
];

const TYPE_META = {
  quickest: { label: 'Quickest' },
  most_filling: { label: 'Most filling' },
  lowest_effort_cost: { label: 'Lowest effort / cost' },
};

const SETUP_LEVEL = {
  no_cooking: 0,
  kettle_only: 1,
  hostel_basic: 2,
  basic_kitchen: 2,
  full_kitchen: 3,
};
const TIME_LIMIT = {
  under_5_minutes: 5,
  under_15_minutes: 15,
  under_30_minutes: 30,
};

function safeSubstitutions(recipe, profile) {
  return (recipe.substitutions || []).filter((line) => {
    const normalizedLine = token(line);
    return INGREDIENT_CATALOG.every((ingredient) => {
      const mentioned = normalizedLine.split(' ').includes(ingredient.id)
        || (ingredient.aliases || []).some((alias) => normalizedLine.includes(token(alias)));
      return !mentioned || ingredientAllowed(ingredient.id, profile);
    });
  }).slice(0, 3);
}

function allergyWarning(profile, excluded) {
  const allergyProfile = [...profile.allergies, ...profile.intolerances];
  if (excluded.length) {
    const labels = excluded.map((item) => item.label).slice(0, 3).join(', ');
    return `Excluded ${labels} because of your saved allergy, intolerance or food preferences. Check labels and shared preparation areas.`;
  }
  if (allergyProfile.length) {
    return 'Selected allergy and intolerance conflicts were left out. Check labels and shared preparation areas.';
  }
  return 'Check ingredient labels if you have an allergy or intolerance.';
}

function candidateFromRecipe(recipe, selected, profile, excluded) {
  if (recipe.level > SETUP_LEVEL[profile.cookingSetup]) return null;
  if (recipe.prepMinutes > TIME_LIMIT[profile.timeAvailable]) return null;
  if (recipe.ingredients.some((id) => !ingredientAllowed(id, profile))) return null;
  const selectedIds = new Set(selected.map((item) => item.id));
  const used = recipe.ingredients.filter((id) => selectedIds.has(id));
  const missing = recipe.ingredients.filter((id) => !selectedIds.has(id));
  if (!used.length || missing.length > 1) return null;
  return {
    recipe,
    used,
    missing,
    warning: allergyWarning(profile, excluded),
    substitutions: safeSubstitutions(recipe, profile),
  };
}

function labelForIngredient(id) {
  return CATALOG_BY_ID.get(id)?.label || cleanText(id, 40);
}

function rankCandidate(candidate, type, profile) {
  const { recipe, used, missing } = candidate;
  const exactBoost = missing.length === 0 ? 40 : 0;
  const preferredBoost = recipe.preferredType === type ? 35 : 0;
  if (type === 'quickest') {
    return exactBoost + preferredBoost + used.length * 20 - recipe.prepMinutes * 2 - missing.length * 18;
  }
  if (type === 'most_filling') {
    return exactBoost + preferredBoost + recipe.filling * 15 + used.length * 14 - missing.length * 20;
  }
  const budgetBoost = profile.budget === 'low_cost'
    ? (4 - recipe.cost) * 12
    : (4 - recipe.cost) * 6;
  return exactBoost + preferredBoost + budgetBoost + used.length * 15
    - recipe.prepMinutes - missing.length * 18;
}

function formatRecipeCandidate(candidate, type) {
  const { recipe, used, missing, warning, substitutions } = candidate;
  return {
    id: `${type}-${recipe.id}`,
    type,
    label: TYPE_META[type].label,
    source: 'local',
    name: recipe.name,
    usedIngredients: used.map(labelForIngredient),
    optionalMissingIngredient: missing.length ? labelForIngredient(missing[0]) : null,
    substitutions,
    steps: recipe.steps,
    prepMinutes: recipe.prepMinutes,
    explanation: recipe.explanation,
    allergyWarning: warning,
  };
}

function chooseSafeMissing(ids, profile) {
  const id = ids.find((candidate) => ingredientAllowed(candidate, profile));
  return id ? labelForIngredient(id) : 'One food you know is safe for you';
}

function genericSuggestion(type, selected, profile, excluded) {
  const available = selected.slice(0, 3);
  const first = available[0]?.label;
  const warning = allergyWarning(profile, excluded);
  if (type === 'quickest') {
    return {
      id: 'quickest-simple-plate',
      type,
      label: TYPE_META[type].label,
      source: 'local',
      name: first ? `${first} quick plate` : 'Quick start plate',
      usedIngredients: available.map((item) => item.label),
      optionalMissingIngredient: chooseSafeMissing(['fruit', 'banana', 'cucumber', 'bread'], profile),
      substitutions: ['Use another available fruit or staple that suits your preferences.'],
      steps: first
        ? ['Place the available foods together.', 'Add the optional item only if it is already easy to reach.']
        : ['Choose one food that is already ready to eat.', 'Add another available item only if that feels practical.'],
      prepMinutes: 3,
      explanation: 'One practical option when time and energy are limited.',
      allergyWarning: warning,
    };
  }
  if (type === 'most_filling') {
    return {
      id: 'most-filling-simple-bowl',
      type,
      label: TYPE_META[type].label,
      source: 'local',
      name: first ? `${first} and protein bowl` : 'Staple and protein bowl',
      usedIngredients: available.map((item) => item.label),
      optionalMissingIngredient: chooseSafeMissing(['dal', 'chana', 'sprouts', 'tofu'], profile),
      substitutions: ['Use another dal, bean or protein food that suits your preferences.'],
      steps: ['Start with the food already available.', 'Add the optional protein food if available, then serve together.'],
      prepMinutes: profile.timeAvailable === 'under_5_minutes' ? 4 : 10,
      explanation: 'Adding a source of protein may feel more filling than eating a staple by itself.',
      allergyWarning: warning,
    };
  }
  return {
    id: 'lowest-effort-simple-combination',
    type,
    label: TYPE_META[type].label,
    source: 'local',
    name: first ? `${first} low-effort combination` : 'Low-effort food combination',
    usedIngredients: available.map((item) => item.label),
    optionalMissingIngredient: chooseSafeMissing(['chana', 'banana', 'rice', 'roti'], profile),
    substitutions: ['Choose the lowest-cost available staple or fruit that fits your needs.'],
    steps: ['Use what is already prepared or ready to eat.', 'Keep the serving simple; extra ingredients are optional.'],
    prepMinutes: 4,
    explanation: 'Based on what you selected, this keeps preparation and extra shopping limited.',
    allergyWarning: warning,
  };
}

export function buildDietSuggestions({ ingredients = [], customIngredients = [], profile = {} } = {}) {
  const normalizedProfile = normalizeDietProfile(profile);
  const normalizedIngredients = normalizeDietIngredients(ingredients, customIngredients);
  const excluded = normalizedIngredients.filter((item) => !ingredientAllowed(item.id, normalizedProfile));
  const selected = normalizedIngredients.filter((item) => ingredientAllowed(item.id, normalizedProfile));
  const candidates = RECIPES
    .map((recipe) => candidateFromRecipe(recipe, selected, normalizedProfile, excluded))
    .filter(Boolean);
  const usedRecipeIds = new Set();

  return Object.keys(TYPE_META).map((type) => {
    const best = candidates
      .filter((candidate) => !usedRecipeIds.has(candidate.recipe.id))
      .sort((a, b) => (
        rankCandidate(b, type, normalizedProfile) - rankCandidate(a, type, normalizedProfile)
      ))[0];
    if (!best) return genericSuggestion(type, selected, normalizedProfile, excluded);
    usedRecipeIds.add(best.recipe.id);
    return formatRecipeCandidate(best, type);
  });
}

const UNSAFE_LANGUAGE = /\b(cures? pcos|reverses? pcos|fix(?:es)? hormones?|fix(?:es)? insulin resistance|guarantee(?:s|d)? weight loss|detox(?:es)? (?:the )?body|medically approved|prevents? disease|exact calories?|calorie estimate)\b/i;
const UNSAFE_FIELDS = new Set([
  'calories', 'calorieEstimate', 'medicalClaim', 'diagnosis', 'prescription', 'weightLoss',
]);

function validServerText(value, maxLength) {
  const cleaned = cleanText(value, maxLength);
  if (!cleaned || UNSAFE_LANGUAGE.test(cleaned)) return null;
  return cleaned;
}

function validateStringArray(value, maxItems, maxLength) {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const cleaned = value.map((item) => validServerText(item, maxLength));
  return cleaned.every(Boolean) ? cleaned : null;
}

export function sanitizeDietSuggestionResponse(rawValue, profile = {}) {
  const values = Array.isArray(rawValue) ? rawValue : rawValue?.suggestions;
  if (!Array.isArray(values) || values.length !== 3) return null;
  const normalizedProfile = normalizeDietProfile(profile);
  const seenTypes = new Set();
  const sanitized = [];

  for (const value of values) {
    if (!value || typeof value !== 'object') return null;
    if (Object.keys(value).some((key) => UNSAFE_FIELDS.has(key))) return null;
    const type = token(value.type)
      .replace(/\s/g, '_')
      .replace('lowest_effort_or_cost', 'lowest_effort_cost');
    if (!TYPE_META[type] || seenTypes.has(type)) return null;
    const name = validServerText(value.name, 90);
    const usedIngredients = validateStringArray(value.usedIngredients, 12, 40);
    const substitutions = validateStringArray(value.substitutions, 6, 100);
    const steps = validateStringArray(value.steps, 8, 180);
    const explanation = validServerText(value.explanation, 240);
    const allergyText = validServerText(value.allergyWarning, 180);
    const prepMinutes = Number(value.prepMinutes);
    const optionalMissingIngredient = value.optionalMissingIngredient == null
      || value.optionalMissingIngredient === ''
      ? null
      : validServerText(value.optionalMissingIngredient, 40);
    if (!name || !usedIngredients || !substitutions || !steps?.length || !explanation || !allergyText) {
      return null;
    }
    if (!Number.isInteger(prepMinutes) || prepMinutes < 1 || prepMinutes > 60) return null;
    if (value.optionalMissingIngredient && !optionalMissingIngredient) return null;
    const responseIngredients = normalizeDietIngredients([
      ...usedIngredients,
      ...(optionalMissingIngredient ? [optionalMissingIngredient] : []),
    ]);
    if (responseIngredients.some((item) => !ingredientAllowed(item.id, normalizedProfile))) return null;
    seenTypes.add(type);
    sanitized.push({
      id: `server-${type}-${sanitized.length + 1}`,
      type,
      label: TYPE_META[type].label,
      source: 'server',
      name,
      usedIngredients,
      optionalMissingIngredient,
      substitutions,
      steps,
      prepMinutes,
      explanation,
      allergyWarning: allergyText,
    });
  }

  return seenTypes.size === 3 ? sanitized : null;
}

export function buildDietSuggestionsWithFallback(input = {}, serverResult) {
  return sanitizeDietSuggestionResponse(serverResult, input.profile) || buildDietSuggestions(input);
}

const OUTCOME_ALIASES = {
  'energy felt steady': 'steady_energy',
  'steady energy': 'steady_energy',
  'became hungry quickly': 'hungry_quickly',
  'hungry quickly': 'hungry_quickly',
  'felt comfortably full': 'comfortably_full',
  'comfortably full': 'comfortably_full',
  'felt sleepy': 'sleepy',
  sleepy: 'sleepy',
  'experienced bloating': 'bloating',
  bloating: 'bloating',
  'experienced cravings': 'cravings',
  cravings: 'cravings',
  'felt comfortable': 'comfortable',
  comfortable: 'comfortable',
  'prefer not to answer': 'prefer_not_to_answer',
};

const OUTCOME_COPY = {
  steady_energy: 'steadier energy',
  hungry_quickly: 'becoming hungry quickly',
  comfortably_full: 'comfortable fullness',
  sleepy: 'feeling sleepy',
  bloating: 'bloating',
  cravings: 'cravings',
  comfortable: 'feeling comfortable',
};

function reflectionOutcomes(reflection) {
  const raw = reflection?.outcomes
    || reflection?.feelings
    || reflection?.responses
    || reflection?.response
    || reflection?.outcome
    || [];
  const list = Array.isArray(raw) ? raw : [raw];
  return [...new Set(list
    .map((item) => OUTCOME_ALIASES[token(item)])
    .filter((item) => item && item !== 'prefer_not_to_answer'))];
}

function mealIdentifier(meal) {
  return cleanText(meal?.id || meal?.mealId || meal?.mealLogId, 100);
}

function reflectionMealIdentifier(reflection) {
  return cleanText(reflection?.mealLogId || reflection?.mealId || reflection?.meal?.id, 100);
}

export function buildDietObservations(meals = [], reflections = [], options = {}) {
  const minimumSampleSize = Math.max(
    3,
    Math.min(20, Number(options.minimumSampleSize) || OBSERVATION_MINIMUM)
  );
  const dismissedIds = new Set(cleanList(
    options.dismissedObservationIds || options.dismissedIds,
    100
  ));
  const reflectionByMeal = new Map();
  (Array.isArray(reflections) ? reflections : []).forEach((reflection) => {
    const id = reflectionMealIdentifier(reflection);
    const outcomes = reflectionOutcomes(reflection);
    if (id && outcomes.length) reflectionByMeal.set(id, outcomes);
  });
  const samples = [];
  (Array.isArray(meals) ? meals : []).forEach((meal) => {
    const id = mealIdentifier(meal);
    const embedded = reflectionOutcomes(meal?.reflection);
    const outcomes = reflectionByMeal.get(id) || embedded;
    if (!id || !outcomes.length) return;
    samples.push({
      id,
      ingredients: normalizeDietIngredients(meal.ingredients || meal.usedIngredients)
        .map((item) => item.id),
      outcomes,
    });
  });
  const sampleSize = samples.length;
  if (sampleSize < minimumSampleSize) {
    const remaining = minimumSampleSize - sampleSize;
    return {
      status: 'insufficient_data',
      sampleSize,
      minimumSampleSize,
      observations: [],
      dismissedCount: 0,
      message: `Add reflections to ${remaining} more meal log${remaining === 1 ? '' : 's'} to look for a descriptive pattern.`,
    };
  }

  const outcomeCounts = new Map();
  samples.forEach((sample) => sample.outcomes.forEach((outcome) => {
    outcomeCounts.set(outcome, (outcomeCounts.get(outcome) || 0) + 1);
  }));
  const [outcome, outcomeCount] = [...outcomeCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] || [];
  const requiredCount = Math.max(3, Math.ceil(sampleSize * 0.6));
  if (!outcome || outcomeCount < requiredCount) {
    return {
      status: 'enough_data_no_pattern',
      sampleSize,
      minimumSampleSize,
      observations: [],
      dismissedCount: 0,
      message: `You have ${sampleSize} reflected meals. Bloom does not yet see a repeated descriptive pattern.`,
    };
  }

  const matchingSamples = samples.filter((sample) => sample.outcomes.includes(outcome));
  const ingredientCounts = new Map();
  matchingSamples.forEach((sample) => sample.ingredients.forEach((id) => {
    ingredientCounts.set(id, (ingredientCounts.get(id) || 0) + 1);
  }));
  const [ingredient, ingredientCount] = [...ingredientCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] || [];
  const specific = ingredient && ingredientCount >= requiredCount;
  const id = `diet-observation-${outcome}-${specific ? ingredient : 'all-meals'}`;
  const text = specific
    ? `In ${ingredientCount} of ${sampleSize} reflected meal logs that included ${labelForIngredient(ingredient).toLowerCase()}, you reported ${OUTCOME_COPY[outcome]}. This describes your entries; it does not show that the food caused the feeling.`
    : `In ${outcomeCount} of ${sampleSize} reflected meal logs, you reported ${OUTCOME_COPY[outcome]}. This is a description of your entries, not a conclusion about cause.`;
  const observation = {
    id,
    sampleSize,
    matchingCount: specific ? ingredientCount : outcomeCount,
    outcome,
    ingredient: specific ? ingredient : null,
    text,
    sourceMealIds: samples.map((sample) => sample.id),
    isCausal: false,
  };
  const dismissed = dismissedIds.has(id);
  return {
    status: dismissed ? 'observation_dismissed' : 'observation_available',
    sampleSize,
    minimumSampleSize,
    observations: dismissed ? [] : [observation],
    dismissedCount: dismissed ? 1 : 0,
    message: dismissed
      ? 'This observation is hidden. New or edited reflections will be recalculated.'
      : null,
  };
}

export function dismissDietObservation(dismissedIds = [], observationId) {
  return cleanList([
    ...(Array.isArray(dismissedIds) ? dismissedIds : []),
    observationId,
  ], 100);
}

export function removeMealAndReflections(meals = [], reflections = [], mealId) {
  const target = cleanText(mealId, 100);
  return {
    meals: (Array.isArray(meals) ? meals : [])
      .filter((meal) => mealIdentifier(meal) !== target),
    reflections: (Array.isArray(reflections) ? reflections : [])
      .filter((reflection) => reflectionMealIdentifier(reflection) !== target),
  };
}
