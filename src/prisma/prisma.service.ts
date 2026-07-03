import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { getOptionalTenantId } from '../common/tenant/tenant.context';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();
    // Return a Proxy to delegate calls to the extended client so we don't break types
    const modelsToIsolate = [
      'User',
      'Patient',
      'Department',
      'Doctor',
      'Appointment',
      'Report',
      'FAQ',
      'KnowledgeBase',
      'SupportTicket',
      'ChatMessage',
      'NotificationTemplate',
      'NotificationLog',
      'HolidayCalendar',
      'HospitalClosure',
    ];

    const extendedClient = this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            // Only apply multi-tenant isolation to models that have the hospitalId field
            if (!modelsToIsolate.includes(model)) {
              return query(args);
            }

            const tenantId = getOptionalTenantId();
            if (!tenantId) {
              return query(args);
            }

            const argsWithTenant = { ...args } as any;

            if (['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'update', 'updateMany', 'delete', 'deleteMany', 'aggregate', 'groupBy'].includes(operation)) {
              argsWithTenant.where = { ...argsWithTenant.where, hospitalId: tenantId };
            }
            
            if (['create', 'createMany'].includes(operation)) {
              if (Array.isArray(argsWithTenant.data)) {
                argsWithTenant.data = argsWithTenant.data.map((d: any) => ({ ...d, hospitalId: tenantId }));
              } else if (argsWithTenant.data) {
                argsWithTenant.data = { ...argsWithTenant.data, hospitalId: tenantId };
              }
            }

            if (operation === 'upsert') {
              argsWithTenant.where = { ...argsWithTenant.where, hospitalId: tenantId };
              argsWithTenant.create = { ...argsWithTenant.create, hospitalId: tenantId };
            }

            return query(argsWithTenant);
          },
        },
      },
    });

    return new Proxy(this, {
      get: (target, prop) => {
        if (prop in extendedClient) {
          return (extendedClient as any)[prop];
        }
        return (target as any)[prop];
      }
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
    } catch (error: any) {
      console.warn('Warning: Database connection failed. Running in offline/detached mode.', error.message);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
