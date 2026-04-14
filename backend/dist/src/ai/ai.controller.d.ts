import type { Response } from 'express';
import { AiService, AnalysisType } from './ai.service';
export declare class AiController {
    private readonly ai;
    constructor(ai: AiService);
    listAnalyses(): {
        type: AnalysisType;
        title: string;
        description: string;
        icon: string;
    }[];
    analyze(body: {
        type: AnalysisType;
    }, res: Response): Promise<void>;
    analyzePdf(body: {
        type: AnalysisType;
        narrative?: string;
        model?: string;
        generatedAt?: string;
    }, res: Response): Promise<void>;
    chat(body: {
        message: string;
        history?: {
            role: string;
            content: string;
        }[];
    }, res: Response): Promise<void>;
}
