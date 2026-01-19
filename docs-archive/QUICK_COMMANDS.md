# ⚡ QUICK COMMANDS & REFERENCE

**SSO Backend v2.2.0** - Cheat sheet de comandos útiles

---

## 🚀 STARTUP

```bash
# Clone & Setup
cd /Users/cmontes/EmpireSoft/Projects/Single\\ Sign\\ On/new_sso_backend
npm install

# Start services
docker-compose up -d

# Run migrations
npm run migrate

# Start dev server
npm run dev

# Check if running
curl http://localhost:3000/health
```

---

## 🔍 VERIFICATION

```bash
# Verify TypeScript compilation
npx tsc --noEmit

# List files
ls -la src/

# Check package versions
npm list | grep -E "(express|prisma|jwt)"

# Check database connection
psql $DATABASE_URL -c "SELECT * FROM users LIMIT 1;"
```

---

## 📝 API TESTING

### Signup
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email":"user@test.com",
    "firstName":"John",
    "lastName":"Doe",
    "password":"SecurePassword123!"
  }'
```

### Signin
```bash
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email":"user@test.com",
    "password":"SecurePassword123!"
  }'

# Save token for next requests
export TOKEN="<access_token_from_response>"
```

### Create Tenant
```bash
curl -X POST http://localhost:3000/api/tenant \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: <tenant_id>" \
  -d '{
    "name":"My Company",
    "description":"Test company"
  }'
```

### Get Tenants
```bash
curl -X GET http://localhost:3000/api/tenant \
  -H "Authorization: Bearer $TOKEN"
```

### Invite Member
```bash
curl -X POST http://localhost:3000/api/tenant/<tenant_id>/members \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: <tenant_id>" \
  -d '{
    "email":"newmember@test.com",
    "role":"member"
  }'
```

---

## 🗄️ DATABASE COMMANDS

```bash
# Connect to database
psql $DATABASE_URL

# List tables
\dt

# Show users
SELECT id, email, created_at FROM users;

# Show tenants
SELECT id, name, created_at FROM tenants;

# Show tenant members
SELECT u.email, tm.role, tm.created_at 
FROM tenant_members tm
JOIN users u ON tm.user_id = u.id;

# Show roles and permissions
SELECT r.name, p.name 
FROM roles r
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id;

# Exit
\q
```

---

## 📊 MONITORING

```bash
# Watch logs
docker logs -f sso_backend

# Check running processes
docker ps

# Stop services
docker-compose down

# View database size
psql $DATABASE_URL -c "SELECT pg_size_pretty(pg_database_size('sso_db'));"

# Count records
psql $DATABASE_URL -c "
  SELECT 'users' as table_name, COUNT(*) FROM users
  UNION ALL
  SELECT 'tenants', COUNT(*) FROM tenants
  UNION ALL
  SELECT 'tenant_members', COUNT(*) FROM tenant_members
  UNION ALL
  SELECT 'roles', COUNT(*) FROM roles;
"
```

---

## 🔧 DEVELOPMENT

```bash
# Watch TypeScript
npx tsc --watch

# Format code
npx prettier --write "src/**/*.ts"

# Lint check
npx eslint src/ --ext .ts

# Run specific test (once implemented)
npm test -- auth.test.ts

# Run tests with watch
npm run test:watch

# Generate coverage
npm run test:coverage

# Debug with inspector
node --inspect-brk dist/index.js
```

---

## 🐳 DOCKER COMMANDS

```bash
# Build image
docker build -t sso-backend:latest .

# Run container
docker run -p 3000:3000 \
  --env DATABASE_URL=postgresql://... \
  --env JWT_PRIVATE_KEY=... \
  sso-backend:latest

# Push to registry
docker push your-registry/sso-backend:2.2.0

# View logs
docker logs <container_id>

# Stop container
docker stop <container_id>
```

---

## 🔒 SECURITY CHECKS

```bash
# Check for vulnerabilities
npm audit

# Show high-risk vulnerabilities
npm audit --audit-level=high

# Fix vulnerabilities
npm audit fix

# Generate security report
npm audit --json > audit.json

# Check for secrets in code
grep -r "password\|secret\|key\|token" src/ \
  --exclude-dir=node_modules \
  --exclude-dir=.git

# Check .env is in .gitignore
cat .gitignore | grep "\.env"
```

---

## 🧪 TEST COMMANDS (When tests are added)

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Watch mode
npm run test:watch

# Debug single test
npm test -- --testNamePattern="signup" --runInBand

# Debug with inspector
npm run test:debug -- auth.test.ts
```

---

## 📚 GIT COMMANDS

```bash
# Check status
git status

# Commit changes
git add .
git commit -m "chore: update documentation"

# View log
git log --oneline -10

# Create branch
git checkout -b feature/oauth

# Switch branch
git checkout main

# Merge branch
git merge feature/oauth

# Push changes
git push origin main

# Pull latest
git pull origin main
```

---

## 🌍 ENVIRONMENT VARIABLES

**Required:**
```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host:5432/db

# JWT Keys (generate with: openssl genrsa 4096)
JWT_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----...
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----...

# Email Provider (choose one)
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxx

# Or for SMTP
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=app-password

# Or for development
EMAIL_PROVIDER=ethereal
```

**Optional:**
```bash
PORT=3000
LOG_LEVEL=info
CORS_ORIGIN=http://localhost:3001
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## 📋 COMMON TROUBLESHOOTING

### "JWT signature verification failed"
```bash
# Verify keys are set correctly
echo $JWT_PRIVATE_KEY | head -c 50
echo $JWT_PUBLIC_KEY | head -c 50

# Regenerate keys if needed
openssl genrsa -out private.pem 4096
openssl rsa -in private.pem -pubout -out public.pem
```

### "Cannot connect to database"
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1"

# Check if PostgreSQL is running
docker ps | grep postgres

# Check environment variable
echo $DATABASE_URL
```

### "Email not sending"
```bash
# Check EMAIL_PROVIDER setting
echo $EMAIL_PROVIDER

# Check credentials
echo $RESEND_API_KEY | head -c 10
echo $SMTP_USER

# Check logs
docker logs sso_backend | grep -i email
```

### "Port already in use"
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <pid>

# Or use different port
PORT=3001 npm run dev
```

### "TypeScript errors"
```bash
# Check errors
npx tsc --noEmit

# Show detailed errors
npx tsc --noEmit --pretty false

# Fix automatically
npx eslint --fix src/
```

---

## 📊 PERFORMANCE CHECKS

```bash
# Measure response time
time curl http://localhost:3000/api/tenant

# Load test (install: npm install -g autocannon)
autocannon -c 10 -d 30 http://localhost:3000/health

# View database query performance
psql $DATABASE_URL -c "EXPLAIN ANALYZE SELECT * FROM users;"

# Check table sizes
psql $DATABASE_URL -c "
  SELECT schemaname, tablename, 
    pg_size_pretty(pg_total_relation_size(tablename)) 
  FROM pg_tables 
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(tablename) DESC;
"
```

---

## 🎯 USEFUL ALIASES

Add to your `.bash_profile` or `.zshrc`:

```bash
# SSO Backend shortcuts
alias sso-dev="cd /Users/cmontes/EmpireSoft/Projects/Single\ Sign\ On/new_sso_backend && npm run dev"
alias sso-db="psql $DATABASE_URL"
alias sso-logs="docker logs -f sso_backend"
alias sso-test="npm test"
alias sso-build="npm run build"
alias sso-start="docker-compose up -d"
alias sso-stop="docker-compose down"

# Reload after adding
source ~/.zshrc  # or source ~/.bash_profile
```

Then use:
```bash
sso-dev        # Start dev server
sso-db         # Connect to database
sso-logs       # Watch logs
sso-test       # Run tests
```

---

## 📱 SAMPLE REQUESTS COLLECTION

Save as `requests.http` and use with VS Code REST Client:

```http
### Signup
POST http://localhost:3000/api/auth/signup
Content-Type: application/json

{
  "email": "user@test.com",
  "firstName": "John",
  "lastName": "Doe",
  "password": "SecurePassword123!"
}

### Signin
POST http://localhost:3000/api/auth/signin
Content-Type: application/json

{
  "email": "user@test.com",
  "password": "SecurePassword123!"
}

### Create Tenant
POST http://localhost:3000/api/tenant
Content-Type: application/json
Authorization: Bearer {{access_token}}

{
  "name": "My Company",
  "description": "Test company"
}

### Get Tenants
GET http://localhost:3000/api/tenant
Authorization: Bearer {{access_token}}

### Get Tenant Members
GET http://localhost:3000/api/tenant/{{tenant_id}}/members
Authorization: Bearer {{access_token}}
X-Tenant-ID: {{tenant_id}}

### Invite Member
POST http://localhost:3000/api/tenant/{{tenant_id}}/members
Content-Type: application/json
Authorization: Bearer {{access_token}}
X-Tenant-ID: {{tenant_id}}

{
  "email": "newmember@test.com",
  "role": "member"
}
```

---

## ✅ PRE-DEPLOYMENT CHECKLIST

```bash
# Security
[ ] npx tsc --noEmit                    # No TS errors
[ ] npm audit                            # No vulnerabilities
[ ] grep -r "TODO\|FIXME" src/          # No TODOs
[ ] grep -r "console.log" src/          # No debug logs

# Database
[ ] npm run migrate                      # Migrations run
[ ] psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"  # DB works

# Environment
[ ] echo $JWT_PRIVATE_KEY | wc -c      # JWT key present (>1000 chars)
[ ] echo $DATABASE_URL | head -c 20    # DB URL present
[ ] echo $EMAIL_PROVIDER                # Email provider set

# Build
[ ] npm run build                       # Builds successfully
[ ] ls -la dist/                        # dist/ folder exists

# Docker
[ ] docker build -t sso-backend:latest . # Image builds
[ ] docker run -it sso-backend:latest npm run build  # Works in container

# Final
[ ] git status                          # Nothing uncommitted
[ ] npm test                            # Tests pass (once added)
[ ] curl http://localhost:3000/health   # Server responds
```

---

## 🚀 DEPLOYMENT CHECKLIST

```bash
# 1. Database backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# 2. Final tests
npm run test:coverage

# 3. Build
npm run build

# 4. Docker build & push
docker build -t sso-backend:2.2.0 .
docker tag sso-backend:2.2.0 your-registry/sso-backend:2.2.0
docker push your-registry/sso-backend:2.2.0

# 5. Deploy
# (Follow your deployment process)

# 6. Verify
curl https://prod-sso.company.com/health

# 7. Monitor
docker logs -f sso_backend
# or
tail -f /var/log/sso-backend.log
```

---

**Last Updated:** 2024  
**Version:** 2.2.0

🎯 **Pro Tip:** Bookmark this page for quick reference during development!
