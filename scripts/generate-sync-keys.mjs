// Prints a new Ed25519 key pair for PowerSync tokens as .env lines. Append them to .env:
//   node scripts/generate-sync-keys.mjs >> .env
// The app signs with the private key; PowerSync verifies with the public half (PS_ variables,
// read by powersync/service.yaml). A new kid lets old and new keys be told apart on rotation.
import { generateKeyPairSync, randomBytes } from 'node:crypto'

const { privateKey, publicKey } = generateKeyPairSync('ed25519')
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' })
const { x } = publicKey.export({ format: 'jwk' })
const kid = `oriel-${new Date().toISOString().slice(0, 10)}-${randomBytes(3).toString('hex')}`

console.log(`
# PowerSync tokens (scripts/generate-sync-keys.mjs)
SYNC_JWT_PRIVATE_KEY=${Buffer.from(pem).toString('base64')}
PS_JWT_KID=${kid}
PS_JWT_PUBLIC_X=${x}`)
