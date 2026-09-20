/**
 * Mints a VAPID key pair for web push.
 *
 *   npx tsx scripts/push-keys.ts
 *
 * Run once, put both values in `.env`, and never run it again against a
 * database that already has subscriptions: a push service ties every
 * subscription it issued to the public key that asked for it, so a new pair
 * silently invalidates every existing one. Nothing errors — notifications
 * simply stop arriving, and the rows are only cleared when the service
 * eventually answers 410.
 *
 * The private key is a signing key. It never leaves the server, and it does
 * not belong in the repository.
 */
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log(`
Add these to .env on each environment (they may differ per environment):

VAPID_PUBLIC_KEY="${publicKey}"
VAPID_PRIVATE_KEY="${privateKey}"
VAPID_SUBJECT="mailto:support@influencerethiopia.com"

The public key is served to browsers and is not a secret.
The private key is. Keep it out of git.
`);
