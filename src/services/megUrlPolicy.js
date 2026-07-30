const PRODUCTION_URL_ERROR =
  'EXPO_PUBLIC_MEG_API_URL must use a public HTTPS host in production; localhost, loopback, and private-network addresses are not allowed.';

function normalizedHostname(hostname) {
  const normalized = String(hostname || '').trim().toLowerCase();
  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    return normalized.slice(1, -1);
  }
  return normalized.replace(/\.+$/, '');
}

function parseIpv4(hostname) {
  const parts = hostname.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) {
    return null;
  }
  const octets = parts.map(Number);
  return octets.every((octet) => octet >= 0 && octet <= 255) ? octets : null;
}

function isNonPublicIpv4(hostname) {
  const octets = parseIpv4(hostname);
  if (!octets) return false;

  const [first, second] = octets;
  return first === 0
    || first === 10
    || first === 127
    || (first === 100 && second >= 64 && second <= 127)
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || (first === 198 && (second === 18 || second === 19))
    || first >= 224;
}

function isNonPublicIpv6(hostname) {
  if (!hostname.includes(':')) return false;
  const mappedIpv4 = hostname.match(/(?:^|:)ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mappedIpv4) return isNonPublicIpv4(mappedIpv4[1]);

  return hostname === '::'
    || hostname === '::1'
    || hostname.startsWith('::ffff:')
    || /^(?:fc|fd)/i.test(hostname)
    || /^(?:fe[89ab])/i.test(hostname);
}

function isNonPublicHostname(hostname) {
  const normalized = normalizedHostname(hostname);
  return normalized === 'localhost'
    || normalized.endsWith('.localhost')
    || normalized.endsWith('.local')
    || isNonPublicIpv4(normalized)
    || isNonPublicIpv6(normalized);
}

function resolveMegApiBaseUrl({
  configuredValue,
  isDevelopment,
  developmentFallback = '',
} = {}) {
  const value = String(
    configuredValue || (isDevelopment ? developmentFallback : '')
  ).trim();
  if (!value) {
    throw new Error('EXPO_PUBLIC_MEG_API_URL is required for production builds.');
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch (_error) {
    throw new Error('EXPO_PUBLIC_MEG_API_URL must be a valid HTTP or HTTPS URL.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('EXPO_PUBLIC_MEG_API_URL must be a valid HTTP or HTTPS URL.');
  }
  if (!isDevelopment && (
    parsed.protocol !== 'https:' || isNonPublicHostname(parsed.hostname)
  )) {
    throw new Error(PRODUCTION_URL_ERROR);
  }

  return value.replace(/\/+$/, '');
}

module.exports = {
  PRODUCTION_URL_ERROR,
  isNonPublicHostname,
  resolveMegApiBaseUrl,
};
