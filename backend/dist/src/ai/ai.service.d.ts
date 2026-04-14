import { LitellmService, ChatMessage } from '../llm/litellm.service';
import { SettingsService } from '../settings/settings.service';
import { StrategicService } from '../strategic/strategic.service';
export type AnalysisType = 'executive' | 'situational' | 'aggressor' | 'text' | 'geo';
export declare const ANALYSIS_CATALOG: {
    type: AnalysisType;
    title: string;
    description: string;
    icon: string;
}[];
export declare class AiService {
    private readonly litellm;
    private readonly settings;
    private readonly strategic;
    private readonly logger;
    private readonly streamIdleTimeoutMs;
    constructor(litellm: LitellmService, settings: SettingsService, strategic: StrategicService);
    getAnalysesCatalog(): {
        type: AnalysisType;
        title: string;
        description: string;
        icon: string;
    }[];
    analysisPdf(type: AnalysisType, options?: {
        narrative?: string;
        model?: string;
        generatedAt?: string;
    }): Promise<Buffer>;
    analyzeStream(type: AnalysisType): AsyncGenerator<string>;
    chatStream(message: string, history: ChatMessage[]): AsyncGenerator<string>;
    private renderAnalysisPdf;
    private parseNarrativeBlocksForPdf;
    private isMarkdownTableSeparator;
    private parseMarkdownTableRow;
    private normalizeInlineMarkdown;
    private formatDateTimePtBr;
    private sseEvent;
    private gatherDataForType;
    private buildUserPrompt;
    private appendTraceabilityReferences;
    private normalizeReferenceLinks;
    private stripQueryParam;
    private compactText;
    private compactGeo;
}
