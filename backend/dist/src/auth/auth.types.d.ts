export type JwtPayload = {
    sub: string;
    email: string;
};
export type JwtRefreshPayload = {
    sub: string;
    jti: string;
};
