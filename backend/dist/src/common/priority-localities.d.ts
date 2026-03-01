export declare const TARGET_LOCALITY_NAME_KEYS: Set<string>;
type TargetLocalityCandidate = {
    id?: string | number | null;
    code?: string | null;
    name?: string | null;
    recruitsFemaleCountCurrent?: number | null;
    updatedAt?: Date | string | null;
};
export declare function normalizeLocalityName(name: string | null | undefined): string;
export declare function getTargetLocalityKey(name: string | null | undefined): string | null;
export declare function isTargetLocalityName(name: string | null | undefined): boolean;
export declare function groupTargetLocalities<T extends TargetLocalityCandidate>(localities: T[]): {
    key: string;
    canonical: T;
    members: T[];
}[];
export declare function selectTargetLocalities<T extends TargetLocalityCandidate>(localities: T[]): T[];
export declare function createTargetLocalityAliasMap<T extends TargetLocalityCandidate>(groups: Array<{
    key: string;
    canonical: T;
    members: T[];
}>): {
    aliasByLocalityId: Map<string, string>;
    aliasIdsByCanonicalId: Map<string, string[]>;
};
export {};
