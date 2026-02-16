import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacService } from './rbac.service';
export declare class RbacGuard implements CanActivate {
    private readonly reflector;
    private readonly rbac;
    constructor(reflector: Reflector, rbac: RbacService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
