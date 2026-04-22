declare module 'pdf-parse' {
  type PdfParseResult = {
    text?: string;
    numpages?: number;
    numrender?: number;
    info?: Record<string, unknown>;
    metadata?: unknown;
    version?: string;
  };

  type PdfParseOptions = Record<string, unknown>;

  export default function pdfParse(
    dataBuffer: Buffer,
    options?: PdfParseOptions,
  ): Promise<PdfParseResult>;
}
