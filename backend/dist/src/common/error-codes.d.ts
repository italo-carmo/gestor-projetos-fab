export type ErrorCodeEntry = {
    httpStatus: number;
    message: string;
    details?: Record<string, unknown>;
};
type ErrorCatalog = Record<string, ErrorCodeEntry>;
export declare function getErrorCatalog(): ErrorCatalog;
export declare function getErrorCode(code: string): ErrorCodeEntry;
export {};
