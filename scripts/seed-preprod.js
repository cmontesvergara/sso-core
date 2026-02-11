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
    // 2. CREATE SSO APPLICATION (Required for Tenant Creation)
    // ============================================================
    console.log('\n📱 Creating SSO Application...');

    const ssoAppData = {
        appId: 'sso',
        name: 'Single Sign-On',
        url: process.env.SSO_PORTAL_URL || 'http://localhost:4200',
        description: 'Sistema de autenticación y gestión de usuarios',
        logoUrl: 'https://cdn.example.com/icons/sso.svg',
    };

    const ssoApp = await prisma.application.upsert({
        where: { appId: ssoAppData.appId },
        update: {},
        create: ssoAppData,
    });
    console.log(`✅ Created ${ssoApp.name} (${ssoApp.appId})`);

    // ============================================================
    // 2.1 CREATE SSO RESOURCES
    // ============================================================
    console.log('\n🔐 Creating SSO Resources Catalog...');

    const ssoResources = [
        // User Management
        { resource: 'users', action: 'create', description: 'Crear usuarios', category: 'user_management' },
        { resource: 'users', action: 'read', description: 'Ver usuarios', category: 'user_management' },
        { resource: 'users', action: 'update', description: 'Editar usuarios', category: 'user_management' },
        { resource: 'users', action: 'delete', description: 'Eliminar usuarios', category: 'user_management' },
        // Application Management
        { resource: 'applications', action: 'create', description: 'Registrar aplicaciones', category: 'app_management' },
        { resource: 'applications', action: 'read', description: 'Ver aplicaciones', category: 'app_management' },
        { resource: 'applications', action: 'update', description: 'Editar aplicaciones', category: 'app_management' },
        { resource: 'applications', action: 'delete', description: 'Eliminar aplicaciones', category: 'app_management' },
        // Role Management
        { resource: 'roles', action: 'create', description: 'Crear roles personalizados', category: 'access_control' },
        { resource: 'roles', action: 'read', description: 'Ver roles', category: 'access_control' },
        { resource: 'roles', action: 'update', description: 'Editar roles', category: 'access_control' },
        { resource: 'roles', action: 'delete', description: 'Eliminar roles', category: 'access_control' },
        // Permission Management
        { resource: 'permissions', action: 'grant_access', description: 'Otorgar permisos a roles', category: 'access_control' },
        { resource: 'permissions', action: 'revoke_access', description: 'Revocar permisos de roles', category: 'access_control' },
        // Tenant Management
        { resource: 'tenants', action: 'create', description: 'Crear organizaciones', category: 'tenant_management' },
        { resource: 'tenants', action: 'read', description: 'Ver organizaciones', category: 'tenant_management' },
        { resource: 'tenants', action: 'update', description: 'Editar organizaciones', category: 'tenant_management' },
        { resource: 'tenants', action: 'invite_members', description: 'Invitar miembros', category: 'tenant_management' },
    ];

    for (const resource of ssoResources) {
        await prisma.appResource.upsert({
            where: {
                applicationId_resource_action: {
                    applicationId: ssoApp.id,
                    resource: resource.resource,
                    action: resource.action,
                },
            },
            update: {},
            create: {
                applicationId: ssoApp.id,
                ...resource,
            },
        });
    }

    console.log(`✅ Created ${ssoResources.length} SSO resources`);

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
