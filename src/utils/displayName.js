function compact(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function truncate(value, limit) {
  const characters = Array.from(value);
  if (characters.length <= limit) return value;
  return `${characters.slice(0, Math.max(1, limit - 1)).join('')}…`;
}

export function preferredDisplayName(profile = {}) {
  const selected = compact(profile.preferredName);
  if (selected) return truncate(selected, 32);

  const stored = compact(profile.name || profile.firstName);
  const firstName = stored.split(' ')[0] || '';
  return truncate(firstName, 24);
}
