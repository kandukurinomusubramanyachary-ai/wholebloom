const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const babel = require('@babel/core');

function loadDietModule() {
  const filename = path.resolve(__dirname, '../src/services/dietSuggestions.js');
  const transformed = babel.transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    presets: [['babel-preset-expo', { lazyImports: false }]],
  });
  const moduleValue = { exports: {} };
  const evaluate = new Function(
    'require',
    'module',
    'exports',
    '__filename',
    '__dirname',
    transformed.code
  );
  evaluate(require, moduleValue, moduleValue.exports, filename, path.dirname(filename));
  return moduleValue.exports;
}

const diet = loadDietModule();

function assertThreeSafeSuggestions(suggestions) {
  assert.equal(suggestions.length, 3);
  assert.deepEqual(
    suggestions.map((item) => item.type),
    ['quickest', 'most_filling', 'lowest_effort_cost']
  );
  suggestions.forEach((item) => {
    assert.equal(item.source, 'local');
    assert.ok(item.name);
    assert.ok(Array.isArray(item.usedIngredients));
    assert.ok(Array.isArray(item.substitutions));
    assert.ok(item.steps.length > 0);
    assert.ok(Number.isInteger(item.prepMinutes));
    assert.ok(item.explanation);
    assert.ok(item.allergyWarning);
    assert.doesNotMatch(
      JSON.stringify(item),
      /cures pcos|fixes hormones|guarantees weight loss|exact calories/i
    );
  });
}

test('Diet local engine returns three useful options when no ingredients are selected', () => {
  const suggestions = diet.buildDietSuggestions();
  assertThreeSafeSuggestions(suggestions);
  assert.ok(suggestions.every((item) => item.usedIngredients.length === 0));
});

test('Diet local engine handles one ingredient without inventing that it was selected', () => {
  const suggestions = diet.buildDietSuggestions({ ingredients: ['rice'] });
  assertThreeSafeSuggestions(suggestions);
  assert.ok(suggestions.some((item) => item.usedIngredients.includes('Rice')));
  assert.ok(suggestions.every((item) => (
    item.usedIngredients.every((name) => name === 'Rice')
  )));
});

test('Diet local engine recognises a common Indian rice, dal and curd combination', () => {
  const suggestions = diet.buildDietSuggestions({ ingredients: ['rice', 'dal', 'curd'] });
  assertThreeSafeSuggestions(suggestions);
  const plate = suggestions.find((item) => item.name === 'Rice, dal and curd plate');
  assert.ok(plate);
  assert.deepEqual(plate.usedIngredients, ['Rice', 'Dal', 'Curd']);
  assert.equal(plate.optionalMissingIngredient, null);
});

test('Diet local engine excludes allergy conflicts from ingredients, missing items and substitutions', () => {
  const suggestions = diet.buildDietSuggestions({
    ingredients: ['poha', 'peanuts', 'curd'],
    profile: { allergies: ['peanuts'] },
  });
  assertThreeSafeSuggestions(suggestions);
  const foodFields = suggestions.map(({ allergyWarning, ...item }) => item);
  assert.doesNotMatch(JSON.stringify(foodFields), /peanut/i);
  assert.match(suggestions[0].allergyWarning, /Excluded Peanuts/i);
});

test('Diet local engine filters compound free-text foods against allergies and preferences', () => {
  const allergySuggestions = diet.buildDietSuggestions({
    customIngredients: ['peanut butter', 'banana'],
    profile: { allergies: ['peanuts'] },
  });
  const vegetarianSuggestions = diet.buildDietSuggestions({
    customIngredients: ['chicken biryani', 'cucumber'],
    profile: { eatingPreference: 'vegetarian' },
  });

  const allergyFood = allergySuggestions.map(({ allergyWarning, ...item }) => item);
  const vegetarianFood = vegetarianSuggestions.map(({ allergyWarning, ...item }) => item);
  assert.doesNotMatch(JSON.stringify(allergyFood), /peanut butter/i);
  assert.match(allergySuggestions[0].allergyWarning, /Excluded Peanut Butter/i);
  assert.doesNotMatch(JSON.stringify(vegetarianFood), /chicken biryani/i);
  assert.match(vegetarianSuggestions[0].allergyWarning, /Excluded chicken biryani/i);
});

test('Diet local engine respects vegetarian and egg-inclusive vegetarian preferences', () => {
  const vegetarian = diet.buildDietSuggestions({
    ingredients: ['eggs', 'bread', 'vegetables', 'paneer', 'roti'],
    profile: { dietaryPreference: 'vegetarian' },
  });
  const eggInclusive = diet.buildDietSuggestions({
    ingredients: ['eggs', 'bread', 'vegetables'],
    profile: { dietaryPreference: 'eggetarian', cookingSetup: 'basic kitchen' },
  });
  assertThreeSafeSuggestions(vegetarian);
  const vegetarianFood = vegetarian.map(({ allergyWarning, ...item }) => item);
  assert.doesNotMatch(JSON.stringify(vegetarianFood), /egg|chicken|fish/i);
  assert.ok(eggInclusive.some((item) => item.usedIngredients.includes('Eggs')));
});

test('Diet local engine respects vegan preference', () => {
  const suggestions = diet.buildDietSuggestions({
    ingredients: ['milk', 'curd', 'paneer', 'eggs', 'tofu', 'roti', 'vegetables'],
    profile: { eatingPreference: 'vegan' },
  });
  assertThreeSafeSuggestions(suggestions);
  const foodFields = suggestions.map(({ allergyWarning, ...item }) => item);
  const foodText = JSON.stringify(foodFields);
  assert.doesNotMatch(foodText, /milk|curd|paneer|egg|chicken|fish/i);
  assert.match(foodText, /tofu/i);
});

test('Diet local engine offers assemble-only instructions for no-cooking setup', () => {
  const suggestions = diet.buildDietSuggestions({
    ingredients: ['bread', 'banana', 'peanuts', 'curd', 'fruit'],
    profile: { cookingSetup: 'no cooking' },
  });
  assertThreeSafeSuggestions(suggestions);
  assert.doesNotMatch(
    suggestions.flatMap((item) => item.steps).join(' '),
    /\b(cook|boil|fry|bake|heat)\b/i
  );
});

test('Diet falls back locally when the optional backend is unavailable', () => {
  const suggestions = diet.buildDietSuggestionsWithFallback(
    { ingredients: ['idli', 'sambar'] },
    null
  );
  assertThreeSafeSuggestions(suggestions);
  assert.ok(suggestions.some((item) => item.name === 'Idli with sambar'));
});

test('Diet rejects a malformed or unsafe server response before falling back', () => {
  const malformed = {
    suggestions: [{
      type: 'quickest',
      name: 'Miracle meal',
      usedIngredients: ['rice'],
      substitutions: [],
      steps: ['Eat it'],
      prepMinutes: 2,
      explanation: 'This cures PCOS.',
      allergyWarning: 'None',
      calories: 120,
    }],
  };
  assert.equal(diet.sanitizeDietSuggestionResponse(malformed), null);
  const fallback = diet.buildDietSuggestionsWithFallback(
    { ingredients: ['rice', 'dal'] },
    malformed
  );
  assertThreeSafeSuggestions(fallback);
});

function observationFixtures(count) {
  const meals = [];
  const reflections = [];
  for (let index = 1; index <= count; index += 1) {
    meals.push({ id: `meal-${index}`, ingredients: ['dal', 'rice'] });
    reflections.push({ mealLogId: `meal-${index}`, outcomes: ['energy felt steady'] });
  }
  return { meals, reflections };
}

test('Diet observations stay in insufficient-data state below the sample threshold', () => {
  const fixtures = observationFixtures(4);
  const result = diet.buildDietObservations(fixtures.meals, fixtures.reflections);
  assert.equal(result.status, 'insufficient_data');
  assert.equal(result.sampleSize, 4);
  assert.equal(result.minimumSampleSize, 5);
  assert.deepEqual(result.observations, []);
});

test('Diet observations show sample size and noncausal language at the threshold and can be dismissed', () => {
  const fixtures = observationFixtures(5);
  const result = diet.buildDietObservations(fixtures.meals, fixtures.reflections);
  assert.equal(result.status, 'observation_available');
  assert.equal(result.sampleSize, 5);
  assert.equal(result.observations.length, 1);
  assert.match(result.observations[0].text, /5 of 5/);
  assert.match(result.observations[0].text, /does not show .* caused/i);
  assert.equal(result.observations[0].isCausal, false);
  const dismissed = diet.buildDietObservations(fixtures.meals, fixtures.reflections, {
    dismissedObservationIds: [result.observations[0].id],
  });
  assert.equal(dismissed.status, 'observation_dismissed');
  assert.deepEqual(dismissed.observations, []);
});

test('Diet meal deletion helper removes only the selected meal and its reflections', () => {
  const result = diet.removeMealAndReflections(
    [{ id: 'meal-1' }, { id: 'meal-2' }],
    [{ mealLogId: 'meal-1' }, { mealLogId: 'meal-2' }],
    'meal-1'
  );
  assert.deepEqual(result.meals, [{ id: 'meal-2' }]);
  assert.deepEqual(result.reflections, [{ mealLogId: 'meal-2' }]);
});
