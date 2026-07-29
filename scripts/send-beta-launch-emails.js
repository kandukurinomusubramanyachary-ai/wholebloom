const path = require('node:path');

require('dotenv').config({
  path: path.resolve(__dirname, '..', '.env'),
  quiet: true,
});

const { isValidBetaEmail, normalizeBetaEmail } = require('../server/betaAccess');
const {
  createFirestoreBetaLaunchRepository,
} = require('../server/betaLaunchEmail/firestore');
const {
  createResendEmailProvider,
} = require('../server/betaLaunchEmail/provider');
const {
  DEFAULT_BATCH_DELAY_MS,
  runBetaLaunchCampaign,
} = require('../server/betaLaunchEmail/service');
const { validateBetaUrl } = require('../server/betaLaunchEmail/template');

const HELP_TEXT = `Bloom Beta launch-email admin command

Dry-run the complete eligible waitlist:
  npm run beta-email:dry-run

Dry-run one explicitly supplied waitlist email:
  npm run beta-email:dry-test -- --email approved@example.com

Send one approved test email:
  npm run beta-email:test -- --email approved@example.com --confirm

Send the full production batch:
  npm run beta-email:production -- --confirm

Options:
  --mode test|production
  --email ADDRESS
  --dry-run
  --confirm
  --delay-ms NUMBER
  --help`;

function takeArgumentValue(args, index, optionName) {
  const argument = args[index];
  const prefix = `${optionName}=`;
  if (argument.startsWith(prefix)) {
    return { value: argument.slice(prefix.length), nextIndex: index };
  }
  if (argument === optionName && typeof args[index + 1] === 'string') {
    return { value: args[index + 1], nextIndex: index + 1 };
  }
  throw new Error(`${optionName} requires a value.`);
}

function parseCliArgs(args) {
  const options = {
    mode: 'production',
    email: '',
    dryRun: false,
    confirmed: false,
    delayMs: undefined,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--dry-run') {
      options.dryRun = true;
    } else if (argument === '--confirm') {
      options.confirmed = true;
    } else if (argument === '--help' || argument === '-h') {
      options.help = true;
    } else if (argument === '--mode' || argument.startsWith('--mode=')) {
      const parsed = takeArgumentValue(args, index, '--mode');
      options.mode = parsed.value;
      index = parsed.nextIndex;
    } else if (argument === '--email' || argument.startsWith('--email=')) {
      const parsed = takeArgumentValue(args, index, '--email');
      options.email = parsed.value;
      index = parsed.nextIndex;
    } else if (argument === '--delay-ms' || argument.startsWith('--delay-ms=')) {
      const parsed = takeArgumentValue(args, index, '--delay-ms');
      options.delayMs = parsed.value;
      index = parsed.nextIndex;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

function validateCliOptions(options) {
  if (!['test', 'production'].includes(options.mode)) {
    throw new Error('--mode must be test or production.');
  }

  if (options.mode === 'test') {
    const normalizedEmail = normalizeBetaEmail(options.email);
    if (!isValidBetaEmail(normalizedEmail)) {
      throw new Error('Test mode requires one valid --email address.');
    }
    options.email = normalizedEmail;
  } else if (options.email) {
    throw new Error('--email can only be used in test mode.');
  }

  if (!options.dryRun && !options.confirmed) {
    throw new Error('No email was sent. Add --confirm to authorize this send.');
  }

  if (options.delayMs !== undefined) {
    const delayMs = Number(options.delayMs);
    if (!Number.isFinite(delayMs) || delayMs < 250 || delayMs > 10000) {
      throw new Error('--delay-ms must be between 250 and 10000.');
    }
    options.delayMs = delayMs;
  }

  return options;
}

function requireEnvironmentValue(name, environment) {
  const value = environment[name];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} is required.`);
  }
  return value.trim();
}

function readSendConfiguration(environment) {
  const betaUrl = validateBetaUrl(
    requireEnvironmentValue('BLOOM_BETA_URL', environment)
  );
  return {
    betaUrl,
    apiKey: requireEnvironmentValue('EMAIL_PROVIDER_API_KEY', environment),
    fromName: requireEnvironmentValue('EMAIL_FROM_NAME', environment),
    fromAddress: requireEnvironmentValue('EMAIL_FROM_ADDRESS', environment),
  };
}

function safeCliError(error) {
  const message = typeof error?.message === 'string' ? error.message : '';
  const safeMessages = [
    /^--/,
    /^Unknown argument:/,
    /^Test mode requires/,
    /^No email was sent\./,
    /^No waitlist record matched/,
    /^[A-Z0-9_]+ is required\.$/,
    /^BLOOM_BETA_URL /,
    /^EMAIL_FROM_/,
    /^EMAIL_PROVIDER_API_KEY /,
    /^email_batch_stopped:/,
    /^firestore_(?:finalize|failure_update)_failed$/,
  ];
  if (safeMessages.some((pattern) => pattern.test(message))) return message;

  const code = typeof error?.code === 'string' ? error.code : 'unknown';
  return `Launch-email command failed (${code}).`;
}

async function main({
  argv = process.argv.slice(2),
  environment = process.env,
  logger = console,
} = {}) {
  const options = parseCliArgs(argv);
  if (options.help) {
    logger.log(HELP_TEXT);
    return { help: true };
  }
  validateCliOptions(options);

  requireEnvironmentValue('FIREBASE_PROJECT_ID', environment);

  const repository = createFirestoreBetaLaunchRepository();
  let provider;
  let betaUrl;
  if (!options.dryRun) {
    const sendConfiguration = readSendConfiguration(environment);
    betaUrl = sendConfiguration.betaUrl;
    provider = createResendEmailProvider(sendConfiguration);
  }

  let interrupted = false;
  const stop = () => {
    interrupted = true;
    logger.error('Stopping safely after the current recipient.');
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  try {
    const result = await runBetaLaunchCampaign({
      repository,
      provider,
      mode: options.mode,
      explicitEmail: options.email,
      betaUrl,
      dryRun: options.dryRun,
      confirmed: options.confirmed,
      delayMs:
        options.delayMs
        ?? Number(environment.BETA_EMAIL_BATCH_DELAY_MS)
        ?? DEFAULT_BATCH_DELAY_MS,
      logger,
      shouldStop: () => interrupted,
    });

    if (!options.dryRun) {
      logger.log(
        `Launch-email result: sent=${result.sent}, failed=${result.failed}, skipped=${result.skipped}.`
      );
    }
    if (result.interrupted) process.exitCode = 130;
    return result;
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(safeCliError(error));
    process.exitCode = 1;
  });
}

module.exports = {
  HELP_TEXT,
  takeArgumentValue,
  parseCliArgs,
  validateCliOptions,
  requireEnvironmentValue,
  readSendConfiguration,
  safeCliError,
  main,
};
