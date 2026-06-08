const fs = require('fs');
const jwt = require('jsonwebtoken');

const now = Math.floor(Date.now() / 1000);
const exp100Days = now + (100 * 24 * 60 * 60);

const payload = {
  sub: 'e54e0b6c-a861-4838-bfdc-6d299aa449a7',
  jti: 'app_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
  type: 'access',
  iat: now,
  exp: exp100Days,
  iss: 'https://auth.bigso.org',
  'https://bigso.co/tenant_id': '6615ba1e-73ee-4c6c-a689-2a8359253988',
  'https://bigso.co/app_id': 'b2d9dcb2-0589-4bb0-bd97-41f0166b8869',
  'https://bigso.co/role': 'user',
  aud: [
    'https://auth.bigso.org',
    'https://manager.bigso.org',
    'https://wa-engine.bigso.org',
    'https://event-gateway-prod.bigso.org',
    'https://wa-agents-prod.bigso.org',
    'https://manager.bigso.org',
    'https://sso-manager-middleware-prod.bigso.org',
    'http://connect-api.bigso.test'
  ]
};

const privateKey = fs.readFileSync('./keys/private.pem');
const token = jwt.sign(payload, privateKey, { algorithm: 'RS256', header: { kid: 'sso-key-2025' } });

console.log(token);
console.log('');
console.log('Payload:');
console.log(JSON.stringify(jwt.decode(token), null, 2));
console.log('');
console.log('iat:', new Date(now * 1000).toISOString());
console.log('exp:', new Date(exp100Days * 1000).toISOString());
