import type { Response } from 'express';
import { SocialCommunicationService } from './social-communication.service';
export declare class SocialCommunicationProxyController {
    private readonly socialCommunication;
    constructor(socialCommunication: SocialCommunicationService);
    content(articleId: string, exp: string, sig: string, res: Response): Promise<Response<any, Record<string, any>>>;
    cover(articleId: string, exp: string, sig: string, res: Response): Promise<Response<any, Record<string, any>>>;
    asset(url: string, exp: string, sig: string, res: Response): Promise<Response<any, Record<string, any>>>;
    page(url: string, exp: string, sig: string, res: Response): Promise<Response<any, Record<string, any>>>;
}
export declare class SocialCommunicationUploadsController {
    uploadedCover(filename: string, res: Response): Promise<void>;
}
