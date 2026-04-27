declare module 'nodemailer' {
  export interface SentMessageInfo {
    messageId?: string;
    accepted?: string[];
    rejected?: string[];
    [key: string]: unknown;
  }

  export interface Transporter<T = SentMessageInfo> {
    sendMail(options: unknown): Promise<T>;
  }

  export function createTransport(options: unknown): Transporter;
}
