export declare const MISSION_CHECKLIST_CLASSIFICATIONS: readonly ["FORTE_CONSOLIDADA", "OPORTUNIDADE_MELHORIA", "NECESSITA_ANALISE", "POSSIVEL_RISCO"];
export type MissionChecklistClassification = (typeof MISSION_CHECKLIST_CLASSIFICATIONS)[number];
export declare const DEFAULT_MISSION_CHECKLIST_CLASSIFICATION: MissionChecklistClassification;
export declare const MISSION_CHECKLIST_SECTION_IDS: readonly ["lideranca", "acompanhamento_recrutas", "analise_riscos"];
export type MissionChecklistSectionId = (typeof MISSION_CHECKLIST_SECTION_IDS)[number];
export declare const MISSION_CHECKLIST_SECTION_TITLE_BY_ID: Record<MissionChecklistSectionId, string>;
export declare const MISSION_CHECKLIST_CLASSIFICATION_DEFAULT_META: Record<MissionChecklistClassification, {
    label: string;
    colorHex: string | null;
    sortOrder: number;
}>;
export type MissionChecklistItemTemplate = {
    id: string;
    title: string;
    prompt?: string;
};
export type MissionChecklistSectionTemplate = {
    id: MissionChecklistSectionId;
    title: string;
    items: MissionChecklistItemTemplate[];
};
export declare const MISSION_CHECKLIST_DEFAULT_SECTIONS: MissionChecklistSectionTemplate[];
