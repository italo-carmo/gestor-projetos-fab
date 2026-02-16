export declare const PERMISSION_METADATA_KEY = "rbac:permission";
export declare function RequirePermission(resource: string, action: string, scope?: string): import("@nestjs/common").CustomDecorator<string>;
