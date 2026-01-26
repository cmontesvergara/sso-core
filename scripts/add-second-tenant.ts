import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function addSecondTenant() {
  try {
    // Find existing user
    const user = await prisma.user.findUnique({
      where: { email: 'test@example.com' }
    });

    if (!user) {
      console.error('User test@example.com not found!');
      process.exit(1);
    }

    console.log('✅ Found user:', user.email);

    // Create second tenant
    const tenant2Id = uuidv4();
    const tenant2 = await prisma.tenant.create({
      data: {
        id: tenant2Id,
        name: 'Acme Corporation',
        slug: 'acme-corp',
      }
    });

    console.log('✅ Created tenant:', tenant2.name, `(${tenant2.id})`);

    // Add user as admin of second tenant
    await prisma.tenantMember.create({
      data: {
        tenantId: tenant2.id,
        userId: user.id,
        role: 'admin',
      }
    });

    console.log('✅ Added user as admin of', tenant2.name);

    console.log('\n🎉 Second tenant setup complete!');
    console.log(`\nUser ${user.email} now has access to:`);
    console.log('  - Empire Corp (existing tenant)');
    console.log('  - Acme Corporation (new tenant)');
    console.log('\nNOTE: Apps are not stored per tenant. The backend dynamically checks');
    console.log('tenant memberships when authorizing app access.');
    console.log('\nTest the selector by logging in with app-initiated flow:');
    console.log('http://localhost:4201/auth/sign-in?app_id=admin&redirect_uri=http://localhost:4200/callback');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

addSecondTenant();
