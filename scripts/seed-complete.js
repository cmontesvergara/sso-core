/**
 * Complete Seed Script
 * Seeds:
 * - Super Admin user
 * - Multiple tenants with admins and members
 * - Default applications
 * - Tenant-app associations
 * - User app access grants
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting complete seed...\n');

  // ============================================================
  // 1. CREATE SUPER ADMIN
  // ============================================================
  console.log('👤 Creating Super Admin...');

  const superAdminPassword = await bcrypt.hash('SuperAdmin2026!', 10);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@sso.local' },
    update: {},
    create: {
      email: 'superadmin@sso.local',
      passwordHash: superAdminPassword,
      firstName: 'Super',
      lastName: 'Admin',
      phone: '+1234567890',
      nuid: 'SUPER-ADMIN-001',
      userStatus: 'active',
      systemRole: 'super_admin',
    },
  });

  console.log(`✅ Super Admin created: ${superAdmin.email} (ID: ${superAdmin.id})`);

  // ============================================================
  // 2. CREATE DEFAULT APPLICATIONS
  // ============================================================
  console.log('\n📱 Creating Applications...');

  const appsData = [
    {
      appId: 'crm',
      name: 'CRM',
      url: process.env.CRM_APP_URL || 'https://crm.example.com',
      description: 'Customer Relationship Management system',
      iconUrl: 'https://cdn.example.com/icons/crm.svg',
    },
    {
      appId: 'admin',
      name: 'Admin Panel',
      url: process.env.ADMIN_APP_URL || 'https://admin.example.com',
      description: 'Administrative control panel',
      iconUrl: 'https://cdn.example.com/icons/admin.svg',
    },
    {
      appId: 'analytics',
      name: 'Analytics',
      url: process.env.ANALYTICS_APP_URL || 'https://analytics.example.com',
      description: 'Business intelligence and analytics dashboard',
      iconUrl: 'https://cdn.example.com/icons/analytics.svg',
    },
    {
      appId: 'billing',
      name: 'Billing & Payments',
      url: process.env.BILLING_APP_URL || 'https://billing.example.com',
      description: 'Invoice management and payment processing',
      iconUrl: 'https://cdn.example.com/icons/billing.svg',
    },
    {
      appId: 'support',
      name: 'Support Desk',
      url: process.env.SUPPORT_APP_URL || 'https://support.example.com',
      description: 'Customer support ticket management',
      iconUrl: 'https://cdn.example.com/icons/support.svg',
    },
    {
      appId: 'hr',
      name: 'Human Resources',
      url: process.env.HR_APP_URL || 'https://hr.example.com',
      description: 'Employee management and HR operations',
      iconUrl: 'https://cdn.example.com/icons/hr.svg',
    },
  ];

  const applications = [];
  for (const appData of appsData) {
    const app = await prisma.application.upsert({
      where: { appId: appData.appId },
      update: {},
      create: appData,
    });
    applications.push(app);
    console.log(`  ✅ Created ${app.name} (${app.appId})`);
  }

  // ============================================================
  // 3. CREATE TENANTS WITH USERS
  // ============================================================
  console.log('\n🏢 Creating Tenants with Users...');

  const tenantsData = [
    {
      name: 'Acme Corporation',
      admin: {
        email: 'admin@acme.example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1111111111',
        nuid: 'ACME-ADMIN-001',
      },
      members: [
        {
          email: 'sarah@acme.example.com',
          firstName: 'Sarah',
          lastName: 'Johnson',
          phone: '+1111111112',
          nuid: 'ACME-USER-001',
        },
        {
          email: 'mike@acme.example.com',
          firstName: 'Mike',
          lastName: 'Wilson',
          phone: '+1111111113',
          nuid: 'ACME-USER-002',
        },
      ],
      apps: ['crm', 'admin', 'analytics', 'billing'], // AppIds to enable
    },
    {
      name: 'TechStart Inc',
      admin: {
        email: 'admin@techstart.example.com',
        firstName: 'Maria',
        lastName: 'Garcia',
        phone: '+2222222221',
        nuid: 'TECH-ADMIN-001',
      },
      members: [
        {
          email: 'carlos@techstart.example.com',
          firstName: 'Carlos',
          lastName: 'Rodriguez',
          phone: '+2222222222',
          nuid: 'TECH-USER-001',
        },
      ],
      apps: ['crm', 'support', 'analytics'],
    },
    {
      name: 'Global Retail Co',
      admin: {
        email: 'admin@globalretail.example.com',
        firstName: 'Emily',
        lastName: 'Chen',
        phone: '+3333333331',
        nuid: 'RETAIL-ADMIN-001',
      },
      members: [
        {
          email: 'david@globalretail.example.com',
          firstName: 'David',
          lastName: 'Lee',
          phone: '+3333333332',
          nuid: 'RETAIL-USER-001',
        },
        {
          email: 'lisa@globalretail.example.com',
          firstName: 'Lisa',
          lastName: 'Brown',
          phone: '+3333333333',
          nuid: 'RETAIL-USER-002',
        },
        {
          email: 'james@globalretail.example.com',
          firstName: 'James',
          lastName: 'Taylor',
          phone: '+3333333334',
          nuid: 'RETAIL-USER-003',
        },
      ],
      apps: ['crm', 'billing', 'support', 'hr'],
    },
  ];

  const defaultPassword = await bcrypt.hash('Password2026!', 10);

  for (const tenantData of tenantsData) {
    console.log(`\n  🏢 Creating tenant: ${tenantData.name}...`);

    // Create tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: tenantData.name,
        slug: tenantData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      },
    });
    console.log(`    ✅ Tenant created (ID: ${tenant.id})`);

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        email: tenantData.admin.email,
        passwordHash: defaultPassword,
        firstName: tenantData.admin.firstName,
        lastName: tenantData.admin.lastName,
        phone: tenantData.admin.phone,
        nuid: tenantData.admin.nuid,
        userStatus: 'active',
        systemRole: 'user', // Regular user at system level
      },
    });
    console.log(`    ✅ Admin user: ${adminUser.email}`);

    // Add admin to tenant
    await prisma.tenantMember.create({
      data: {
        userId: adminUser.id,
        tenantId: tenant.id,
        role: 'admin',
      },
    });
    console.log(`    ✅ Admin role assigned`);

    // Create member users
    for (const memberData of tenantData.members) {
      const memberUser = await prisma.user.create({
        data: {
          email: memberData.email,
          passwordHash: defaultPassword,
          firstName: memberData.firstName,
          lastName: memberData.lastName,
          phone: memberData.phone,
          nuid: memberData.nuid,
          userStatus: 'active',
          systemRole: 'user',
        },
      });

      await prisma.tenantMember.create({
        data: {
          userId: memberUser.id,
          tenantId: tenant.id,
          role: 'member',
        },
      });
      console.log(`    ✅ Member: ${memberUser.email}`);
    }

    // Enable apps for tenant
    console.log(`    📱 Enabling apps for tenant...`);
    for (const appId of tenantData.apps) {
      const app = applications.find((a) => a.appId === appId);
      if (app) {
        await prisma.tenantApp.create({
          data: {
            tenantId: tenant.id,
            applicationId: app.id,
            isEnabled: true,
          },
        });
        console.log(`      ✅ Enabled: ${app.name}`);
      }
    }

    // Grant app access to all members (admin included)
    const tenantMembers = await prisma.tenantMember.findMany({
      where: { tenantId: tenant.id },
    });

    console.log(`    🔐 Granting app access...`);
    for (const member of tenantMembers) {
      for (const appId of tenantData.apps) {
        const app = applications.find((a) => a.appId === appId);
        if (app) {
          await prisma.userAppAccess.create({
            data: {
              userId: member.userId,
              tenantId: tenant.id,
              applicationId: app.id,
              grantedBy: adminUser.id,
            },
          });
        }
      }
      console.log(`      ✅ Access granted to user ${member.userId}`);
    }
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('✅ SEED COMPLETED SUCCESSFULLY!');
  console.log('='.repeat(60));
  console.log('\n📊 Summary:');
  console.log(`  - Super Admin: 1`);
  console.log(`  - Applications: ${applications.length}`);
  console.log(`  - Tenants: ${tenantsData.length}`);
  console.log(`  - Total Users: ${tenantsData.reduce((sum, t) => sum + 1 + t.members.length, 1)}`);

  console.log('\n🔐 Credentials:');
  console.log(`  Super Admin:`);
  console.log(`    Email: superadmin@sso.local`);
  console.log(`    Password: SuperAdmin2026!`);
  console.log(`\n  All other users:`);
  console.log(`    Password: Password2026!`);

  console.log('\n📱 Applications:');
  applications.forEach((app) => {
    console.log(`  - ${app.name} (${app.appId})`);
  });

  console.log('\n🏢 Tenants:');
  tenantsData.forEach((t) => {
    console.log(`  - ${t.name}`);
    console.log(`    Admin: ${t.admin.email}`);
    console.log(`    Members: ${t.members.length}`);
    console.log(`    Apps: ${t.apps.join(', ')}`);
  });

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
