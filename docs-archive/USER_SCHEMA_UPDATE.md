# 📝 USER SCHEMA UPDATE - Extended Fields from user.interface.ts

**Date:** 2026-01-17  
**Migration:** `003_add_extended_user_fields.js`  
**Status:** ✅ Schema updated in Prisma  

---

## 🔍 ANALYSIS

### Fields Present in `user.interface.ts` but Missing in Prisma

#### From `basic_information` interface:
```
❌ second_name        → ✅ ADDED
❌ second_last_name   → ✅ ADDED
❌ nit                → ✅ ADDED (unique)
❌ birth_date         → ✅ ADDED
❌ gender             → ✅ ADDED
❌ nationality        → ✅ ADDED
❌ place_of_birth     → ✅ ADDED
❌ place_of_residence → ✅ ADDED
❌ occupation         → ✅ ADDED
❌ marital_status     → ✅ ADDED
❌ user_status        → ✅ ADDED (default: 'active')
❌ addresses          → ✅ ADDED (new table)
❌ scope              → ✅ ADDED (in other_information)
```

#### From `secure_information` interface:
```
❌ recovery_phone     → ✅ ADDED
❌ recovery_email     → ✅ ADDED
```

#### New Models Created:
1. **Address** (1-to-Many with User)
   - Stores multiple addresses per user
   - Fields: country, state, city, street, postal_code
   
2. **OtherInformation** (1-to-1 with User)
   - Stores flexible data as JSON
   - Stores scope array
   - Supports arbitrary additional information

---

## 📊 UPDATED SCHEMA

### User Model (Extended)
```prisma
model User {
  // Identifiers
  id                    String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email                 String     @unique
  nit                   String?    @unique // National ID
  
  // Basic Information
  firstName             String?    @map("first_name")
  secondName            String?    @map("second_name")
  lastName              String?    @map("last_name")
  secondLastName        String?    @map("second_last_name")
  phone                 String?
  
  // Personal Details
  birthDate             DateTime?  @map("birth_date") @db.Date
  gender                String?
  nationality           String?
  placeOfBirth          String?    @map("place_of_birth")
  placeOfResidence      String?    @map("place_of_residence")
  occupation            String?
  maritalStatus         String?    @map("marital_status")
  userStatus            String?    @map("user_status") @default("active")
  
  // Security
  passwordHash          String     @map("password_hash")
  recoveryPhone         String?    @map("recovery_phone")
  recoveryEmail         String?    @map("recovery_email")
  
  // Metadata
  createdAt             DateTime   @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt             DateTime   @updatedAt @map("updated_at") @db.Timestamptz(6)
  
  // Relations
  refreshTokens         RefreshToken[]
  tenantMembers         TenantMember[]
  otpSecret             OTPSecret?
  emailVerifications    EmailVerification[]
  addresses             Address[]
  otherInformation      OtherInformation?

  @@map("users")
}

model Address {
  id                    String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId                String     @map("user_id") @db.Uuid
  country               String
  state                 String
  city                  String
  street                String?
  postalCode            String?    @map("postal_code")
  createdAt             DateTime   @default(now()) @map("created_at") @db.Timestamptz(6)
  
  user                  User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@map("addresses")
}

model OtherInformation {
  id                    String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId                String     @unique @map("user_id") @db.Uuid
  data                  Json?
  scope                 String[]   @default([])
  createdAt             DateTime   @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt             DateTime   @updatedAt @map("updated_at") @db.Timestamptz(6)
  
  user                  User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("other_information")
}
```

---

## 🔄 MAPPING: user.interface.ts → Prisma

### basic_information → User + Address + OtherInformation
```typescript
// user.interface.ts              → Prisma Model
first_name                        → User.firstName
second_name                       → User.secondName ✨ NEW
last_name                         → User.lastName
second_last_name                  → User.secondLastName ✨ NEW
phone                             → User.phone
email                             → User.email
birth_date                        → User.birthDate ✨ NEW
nit                               → User.nit ✨ NEW
gender                            → User.gender ✨ NEW
nationality                       → User.nationality ✨ NEW
place_of_birth                    → User.placeOfBirth ✨ NEW
occupation                        → User.occupation ✨ NEW
marital_status                    → User.maritalStatus ✨ NEW
user_status                       → User.userStatus ✨ NEW
addresses: address[]              → User.addresses[] (Address table) ✨ NEW
place_of_residence                → User.placeOfResidence ✨ NEW
scope: string[]                   → OtherInformation.scope ✨ NEW
```

### secure_information → User
```typescript
password                          → User.passwordHash
recovery_phone                    → User.recoveryPhone ✨ NEW
recovery_email                    → User.recoveryEmail ✨ NEW
verification_code_email           → (handled in EmailVerification table)
verification_code_phone           → (handled separately if needed)
```

### other_information → OtherInformation
```typescript
data?: any                        → OtherInformation.data (JSON)
```

### related_applications → TenantMember
```typescript
related_applications: related_applications[]  → TenantMember[] (existing)
```

---

## 💾 DATABASE MIGRATION

### New Migration File
**Location:** `migrations/003_add_extended_user_fields.js`

**Changes:**
1. ✅ Add 14 columns to `users` table
2. ✅ Create `addresses` table (1-to-Many with users)
3. ✅ Create `other_information` table (1-to-1 with users)
4. ✅ Add unique constraint on `nit`
5. ✅ Add indexes for foreign keys

**SQL Generated:**
```sql
-- Add columns to users
ALTER TABLE users
ADD COLUMN second_name VARCHAR(255),
ADD COLUMN second_last_name VARCHAR(255),
ADD COLUMN nit VARCHAR(50) UNIQUE,
ADD COLUMN birth_date DATE,
ADD COLUMN gender VARCHAR(50),
ADD COLUMN nationality VARCHAR(255),
ADD COLUMN place_of_birth VARCHAR(255),
ADD COLUMN place_of_residence VARCHAR(255),
ADD COLUMN occupation VARCHAR(255),
ADD COLUMN marital_status VARCHAR(50),
ADD COLUMN user_status VARCHAR(50) DEFAULT 'active',
ADD COLUMN recovery_phone VARCHAR(20),
ADD COLUMN recovery_email VARCHAR(255),
ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create addresses table
CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  country VARCHAR(255) NOT NULL,
  state VARCHAR(255) NOT NULL,
  city VARCHAR(255) NOT NULL,
  street TEXT,
  postal_code VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_addresses_user_id ON addresses(user_id);

-- Create other_information table
CREATE TABLE other_information (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  data JSONB,
  scope TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_other_information_user_id ON other_information(user_id);
```

---

## 🚀 HOW TO RUN MIGRATION

```bash
# Option 1: Using node-pg-migrate
npm run migrate

# Option 2: Prisma (after fixing schema)
npx prisma migrate deploy

# Option 3: Manual PostgreSQL
psql $DATABASE_URL < migrations/003_add_extended_user_fields.js
```

---

## 📋 CHECKLIST

- [x] Analyzed `user.interface.ts` fields
- [x] Identified missing Prisma fields
- [x] Updated Prisma schema
- [x] Created new tables (Address, OtherInformation)
- [x] Created migration file
- [x] Schema formatted and validated
- [ ] Migration tested (pending database execution)
- [ ] Update service layers to use new fields
- [ ] Update repository to handle new relations
- [ ] Create API endpoints for addresses
- [ ] Update validation schemas (Joi)

---

## 🔗 RELATED FILES TO UPDATE

### Services
- `src/services/user.ts` - Add methods for managing addresses, other_information
- `src/services/auth.ts` - Update signup to populate extended fields

### Repositories
- `src/repositories/userRepo.prisma.ts` - Add address and other_information queries
- Create `src/repositories/addressRepo.prisma.ts` - Manage addresses

### Routes
- `src/routes/user.ts` - Add GET/POST/PUT/DELETE for addresses
- `src/routes/user.ts` - Add GET/POST for other_information

### Validation
- `src/routes/user.ts` - Add Joi schemas for Address, OtherInformation

### Models/Types
- `src/types/index.ts` - Add UserWithRelations type

---

## ✨ NOTES

1. **NIT Field:** Set as unique but nullable to allow users without NIT initially
2. **Addresses:** Can have multiple addresses per user (1-to-Many)
3. **OtherInformation:** 1-to-1 relationship for flexible additional data
4. **Scope:** Stored as string array for permissions/capabilities
5. **Backward Compatibility:** All new fields are nullable (optional)

---

## 📚 MIGRATION STATUS

| Item | Status |
|------|--------|
| Schema updated | ✅ Complete |
| Migration created | ✅ Complete |
| Database changes | ⏳ Ready to execute |
| Service updates | 🟡 TODO |
| Repository updates | 🟡 TODO |
| Route endpoints | 🟡 TODO |
| Validation | 🟡 TODO |
| Tests | 🟡 TODO |

---

**Generated:** 2026-01-17  
**Prisma Version:** 5.22.0  
**Database:** PostgreSQL 14+
