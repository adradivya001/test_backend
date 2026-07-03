import { AsyncLocalStorage } from 'async_hooks';

export const tenantContext = new AsyncLocalStorage<string>();

export function getTenantId(): string {
  const tenantId = tenantContext.getStore();
  if (!tenantId) {
    throw new Error('Tenant context is missing. Ensure the request or job is wrapped with runWithTenant.');
  }
  return tenantId;
}

export function getOptionalTenantId(): string | undefined {
  return tenantContext.getStore();
}

export function runWithTenant<T>(tenantId: string, fn: () => T): T {
  return tenantContext.run(tenantId, fn);
}
