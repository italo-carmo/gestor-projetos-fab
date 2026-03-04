import type { Response } from 'express';
export declare class LibraryUploadsController {
    sendPhoto(filename: string, res: Response): void;
    sendDocument(filename: string, res: Response): void;
}
