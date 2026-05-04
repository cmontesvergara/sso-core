import { PrismaClient } from '@prisma/client';

/**
 * AdminUserUseCases
 *
 * Aggregates all user-admin operations into a single injectable service.
 * Uses PrismaClient directly because no IUserRepository port covers addresses,
 * status updates, or tenant-app lookups yet.
 *
 * This is infrastructure-layer code: it lives in src-hex/application/use-cases/admin/
 * and is injected by the Container.
 */
export class AdminUserUseCases {
  constructor(private readonly prisma: PrismaClient) {}

  // ── LIST ──────────────────────────────────────────────────────────────────

  async listUsers(query: any) {
    const page   = Math.max(1, parseInt(query.page  ?? '1',  10));
    const limit  = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10)));
    const skip   = (page - 1) * limit;
    const search = query.search as string | undefined;

    const where: any = {};
    if (search) {
      where.OR = [
        { email:     { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName:  { contains: search, mode: 'insensitive' } },
        { nuid:      { contains: search, mode: 'insensitive' } },
      ];
    }
    if (query.userStatus) where.userStatus = query.userStatus;
    if (query.status)     where.userStatus = query.status;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, firstName: true, secondName: true,
          lastName: true, secondLastName: true, phone: true, nuid: true,
          userStatus: true, createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── GET BY ID (with addresses) ────────────────────────────────────────────

  async getUserById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { addresses: true },
    });
  }

  // ── GET USER TENANTS + APPS ───────────────────────────────────────────────

  async getUserTenantsWithApps(userId: string) {
    const memberships = await this.prisma.tenantMember.findMany({
      where: { userId },
      include: {
        tenant: true,
      },
    });

    const result = await Promise.all(
      memberships.map(async (m) => {
        const userAppAccess = await this.prisma.userAppAccess.findMany({
          where: { userId, tenantId: m.tenantId },
          include: {
            application: {
              select: { appId: true, name: true, url: true, description: true, logoUrl: true, isActive: true },
            },
          },
        });

        return {
          tenantId: m.tenant.id,
          name:     m.tenant.name,
          slug:     m.tenant.slug,
          role:     m.role,
          apps: userAppAccess
            .filter((ua) => ua.application.isActive)
            .map((ua) => ({
              appId:       ua.application.appId,
              name:        ua.application.name,
              url:         ua.application.url,
              description: ua.application.description ?? '',
              logoUrl:     ua.application.logoUrl ?? null,
            })),
        };
      })
    );

    return result;
  }

  // ── UPDATE PROFILE ────────────────────────────────────────────────────────

  async updateProfile(userId: string, data: {
    firstName?: string; secondName?: string; lastName?: string; secondLastName?: string;
    phone?: string; birthDate?: Date; gender?: string; nationality?: string;
    birthPlace?: string; placeOfResidence?: string; occupation?: string; maritalStatus?: string;
  }, addresses?: Array<{ country: string; province: string; city: string; detail: string; postalCode?: string }>) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...data,
        ...(addresses !== undefined ? {
          addresses: {
            deleteMany: {},
            create: addresses,
          },
        } : {}),
      },
      include: { addresses: true },
    });
    return updated;
  }

  // ── UPDATE STATUS ─────────────────────────────────────────────────────────

  async updateStatus(userId: string, status: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { userStatus: status },
    });
  }
}
