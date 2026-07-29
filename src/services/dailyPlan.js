const LOW_MOODS = new Set(['low', 'anxious', 'overwhelmed', 'emotionally_sensitive']);

function action(id, type, title, status = 'pending') {
  return { id, type, title, status };
}

export function buildDailyPlan({
  date,
  checkin = null,
  meals = [],
  movements = [],
  previousPlan = null,
}) {
  const dayMeals = meals.filter((item) => item.date === date && !item.skipped);
  const dayMovement = movements.find((item) => item.date === date);
  const lowEnergy = checkin?.energy != null && checkin.energy <= 3;
  const poorSleep = checkin?.sleepQuality === 'poor'
    || (checkin?.sleep != null && checkin.sleep < 5);
  const highPain = checkin?.pain != null && checkin.pain >= 7;
  const heavyFlow = checkin?.flow === 'heavy';
  const hasCravings = checkin?.cravings && checkin.cravings !== 'none';
  const hasProtein = dayMeals.some((item) => item.protein);

  let foodTitle = 'Add one familiar protein source to your next meal.';
  if (hasCravings) {
    foodTitle = 'Enjoy what you are craving, and pair it with protein or fibre if you can.';
  } else if (dayMeals.length && hasProtein) {
    foodTitle = 'Keep your next meal simple; you already included a useful protein source today.';
  } else if (dayMeals.length) {
    foodTitle = 'Add dal, curd, eggs, paneer, chana, fish, or another protein you enjoy.';
  }

  let movementTitle = 'Take a comfortable 10-minute walk when it fits your day.';
  if (heavyFlow || highPain) {
    movementTitle = 'Choose rest, breathing, or very gentle stretching today.';
  } else if (lowEnergy || poorSleep) {
    movementTitle = 'Try five minutes of mobility or a short, easy walk—rest also counts.';
  } else if (dayMovement?.status === 'completed') {
    movementTitle = 'Your movement is done for today. Let recovery be enough.';
  }

  let emotionalTitle = 'Give yourself five quiet minutes before bed.';
  if (LOW_MOODS.has(checkin?.mood)) {
    emotionalTitle = 'Name one thing that feels heavy, without asking yourself to solve it all.';
  } else if (checkin?.stress != null && checkin.stress >= 7) {
    emotionalTitle = 'Take five slow breaths and make the next task smaller.';
  }

  const previousStatuses = Object.fromEntries(
    (previousPlan?.actions || []).map((item) => [item.id, item.status])
  );
  const actions = [
    action('food', 'food', foodTitle, previousStatuses.food || 'pending'),
    action('movement', 'movement', movementTitle, previousStatuses.movement || 'pending'),
    action('emotional', 'emotional', emotionalTitle, previousStatuses.emotional || 'pending'),
  ];

  let careNotice = null;
  if (heavyFlow && highPain) {
    careNotice = 'Rest and gentle care may help. If bleeding is unusually heavy for you, pain is severe, you feel faint, or you are worried, contact a healthcare professional or urgent care.';
  } else if (highPain) {
    careNotice = 'If this pain is severe, worsening, or difficult to manage, consider checking in with a healthcare professional.';
  }

  return {
    id: date,
    date,
    actions,
    careNotice,
    updatedAt: new Date().toISOString(),
  };
}

export function updatePlanAction(plan, actionId, status) {
  return {
    ...plan,
    actions: plan.actions.map((item) => item.id === actionId ? { ...item, status } : item),
    updatedAt: new Date().toISOString(),
  };
}
