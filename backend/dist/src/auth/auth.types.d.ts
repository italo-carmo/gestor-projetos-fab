export type JwtPayload = {
    sub: string;
    email: string;
};
export type JwtRefreshPayload = {
    sub: string;
    jti: string;
};
export type Jwt2faPayload = {
    sub: string;
    purpose: '2fa' | '2fa_setup';
};
