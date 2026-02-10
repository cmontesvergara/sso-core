/**
 * Preprod Seed Script
 * Seeds:
 * - Super Admin user only
 */

const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting preprod seed...\n');

    // ============================================================
    // 1. CREATE SUPER ADMIN
    // ============================================================
    console.log('👤 Creating Super Admin...');

    const superAdminPassword = await argon2.hash('@Password21');

    const superAdmin = await prisma.user.upsert({
        where: { email: 'krlosbergara@gmail.com' },
        update: {},
        create: {
            email: 'krlosbergara@gmail.com',
            passwordHash: superAdminPassword,
            firstName: 'Carlos',
            lastName: 'Montes',
            phone: '3008578561',
            nuid: '1067961864',
            userStatus: 'active',
            systemRole: 'super_admin',
        },
    });

    console.log(`✅ Super Admin created: ${superAdmin.email} (ID: ${superAdmin.id})`);

    // ============================================================
    // SUMMARY
    // ============================================================
    console.log('\n' + '='.repeat(60));
    console.log('✅ PREPROD SEED COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('\n📊 Summary:');
    console.log(`  - Super Admin: 1`);

    console.log('\n🔐 Credentials:');
    console.log(`  Super Admin:`);
    console.log(`    Email: krlosbergara@gmail.com`);
    console.log(`    Password: @Password21`);

    console.log('\n');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
