import { parseSchema } from '../src/core.js';
export const schema = parseSchema(`DATABASE_URL:
  required: true
  type: url
  secret: true
API_KEY:
  required: true
  type: string
  secret: true
JWT_SECRET:
  required: true
  type: string
  secret: true
PORT:
  required: true
  type: number
  secret: false
DEBUG:
  required: false
  type: boolean
  secret: false
REDIS_URL:
  required: true
  type: url
  secret: false
`);
export const envs = {
  local: { DATABASE_URL: 'postgres://dev:dev@localhost:5432/app', API_KEY: 'local-demo-key', JWT_SECRET: 'local-jwt', PORT: '3000', DEBUG: 'true', REDIS_URL: 'redis://localhost:6379' },
  staging: { DATABASE_URL: 'postgres://app:stg@stg-db:5432/app', API_KEY: 'stg-demo-key', JWT_SECRET: 'shared-jwt-value', PORT: 'hello', DEBUG: 'false' },
  production: { DATABASE_URL: 'postgres://app:prd@prod-db:5432/app', JWT_SECRET: 'shared-jwt-value', PORT: '8080', DEBUG: 'false', REDIS_URL: 'redis://prod-redis:6379' },
};
