import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

const ROLE_HIERARCHY: Record<Role, Role[]> = {
  SUPER_ADMIN: [Role.SUPER_ADMIN, Role.HOSPITAL_ADMIN, Role.RECEPTIONIST, Role.DOCTOR, Role.LAB_STAFF, Role.SUPPORT_AGENT],
  HOSPITAL_ADMIN: [Role.HOSPITAL_ADMIN, Role.RECEPTIONIST, Role.DOCTOR, Role.LAB_STAFF, Role.SUPPORT_AGENT],
  RECEPTIONIST: [Role.RECEPTIONIST],
  DOCTOR: [Role.DOCTOR],
  LAB_STAFF: [Role.LAB_STAFF],
  SUPPORT_AGENT: [Role.SUPPORT_AGENT],
};

const ROLE_PERMISSIONS: Record<Role, string[]> = {
  SUPER_ADMIN: [
    'manage:users', 'view:patients', 'update:patients', 'view:reports', 'delete:reports',
    'create:prescriptions', 'update:consultation', 'manage:hospital'
  ],
  HOSPITAL_ADMIN: [
    'view:patients', 'update:patients', 'view:reports', 'create:prescriptions',
    'update:consultation', 'manage:hospital'
  ],
  RECEPTIONIST: [
    'view:patients', 'update:patients', 'view:reports'
  ],
  DOCTOR: [
    'view:patients', 'view:reports', 'create:prescriptions', 'update:consultation'
  ],
  LAB_STAFF: [
    'view:patients', 'view:reports'
  ],
  SUPPORT_AGENT: [
    'view:patients', 'view:reports'
  ],
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const { user } = request;
    
    // 1. Roles Verification
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRoles) {
      if (!user || !user.role) {
        throw new ForbiddenException('Access denied: no authenticated user details found');
      }
      const userInheritedRoles = ROLE_HIERARCHY[user.role as Role] || [user.role];
      const hasRole = requiredRoles.some(role => userInheritedRoles.includes(role));
      if (!hasRole) {
        throw new ForbiddenException(`Access denied: required roles: [${requiredRoles.join(', ')}]`);
      }
    }

    // 2. Fine-grained Permissions Verification (Permission Matrix)
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredPermissions) {
      if (!user || !user.role) {
        throw new ForbiddenException('Access denied: no authenticated user details found');
      }
      const allowedPermissions = ROLE_PERMISSIONS[user.role as Role] || [];
      const hasAllPermissions = requiredPermissions.every((perm) => allowedPermissions.includes(perm));
      if (!hasAllPermissions) {
        throw new ForbiddenException(
          `Access denied: missing permissions. Required: [${requiredPermissions.join(', ')}]`
        );
      }
    }

    return true;
  }
}
