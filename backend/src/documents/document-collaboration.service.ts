import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server } from '@hocuspocus/server';
import { TiptapTransformer } from '@hocuspocus/transformer';
import * as Y from 'yjs';
import type { JwtPayload } from '../auth/auth.types';
import { RbacService } from '../rbac/rbac.service';
import type { RbacUser } from '../rbac/rbac.types';
import { DocumentsService } from './documents.service';
import { documentEditorExtensions } from './document-editor.extensions';

type CollaborationContext = {
  user: RbacUser;
  documentId: string;
  canEdit: boolean;
};

const DOCUMENT_NAME_PREFIX = 'online-document.';
const DEFAULT_COLLABORATION_PORT = 3011;

@Injectable()
export class DocumentCollaborationService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DocumentCollaborationService.name);
  private server: Server | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly rbac: RbacService,
    private readonly documents: DocumentsService,
  ) {}

  async onModuleInit() {
    if (this.config.get<string>('DOCUMENT_COLLAB_ENABLED') === 'false') {
      this.logger.log('Servidor de colaboracao de documentos desativado.');
      return;
    }

    const port = this.resolvePort();
    const address = this.config.get<string>('DOCUMENT_COLLAB_HOST') ?? '0.0.0.0';

    this.server = new Server({
      port,
      address,
      quiet: true,
      debounce: 1_500,
      maxDebounce: 8_000,
      timeout: 30_000,
      onConnect: async (payload) => {
        this.logger.log(
          `Conexao colaborativa recebida socket=${payload.socketId} documento=${payload.documentName} rota=${payload.request.url ?? ''}`,
        );
      },
      onAuthenticate: async (payload) => {
        try {
          const documentId = this.parseDocumentId(payload.documentName);
          const user = await this.authenticateUser(
            payload.token,
            payload.requestParameters.get('activeRoleId') ?? undefined,
          );
          const state = await this.documents.getOnlineDocumentCollaborationState(
            documentId,
            user,
          );
          payload.connectionConfig.readOnly = !state.canEdit;
          this.logger.log(
            `Conexao colaborativa autenticada socket=${payload.socketId} documento=${documentId} usuario=${user.id} edicao=${state.canEdit ? 'sim' : 'nao'}`,
          );
          return { user, documentId, canEdit: state.canEdit };
        } catch (error) {
          this.logger.warn(
            `Falha na autenticacao colaborativa socket=${payload.socketId} documento=${payload.documentName}: ${this.formatError(error)}`,
          );
          throw error;
        }
      },
      onLoadDocument: async (payload) => {
        const context = this.getContext(payload.context, payload.documentName);
        const state = await this.documents.getOnlineDocumentCollaborationState(
          context.documentId,
          context.user,
        );
        const ydoc = new Y.Doc();
        const persistedState = state.content?.ydocState;

        if (persistedState && this.canUsePersistedYDocState(state.content)) {
          Y.applyUpdate(ydoc, new Uint8Array(persistedState));
          return ydoc;
        }

        const seeded = TiptapTransformer.toYdoc(
          state.content?.contentJson ?? {
            type: 'doc',
            content: [{ type: 'paragraph' }],
          },
          'default',
          documentEditorExtensions as any,
        );
        await this.documents.persistOnlineDocumentYDocState(
          context.documentId,
          Y.encodeStateAsUpdate(seeded),
          context.user,
        );
        this.logger.log(
          `Estado Yjs regenerado a partir do conteudo salvo documento=${context.documentId}`,
        );
        return seeded;
      },
      onStoreDocument: async (payload) => {
        const context = this.getContext(payload.context, payload.documentName);
        if (!context.canEdit) return;
        const contentJson = TiptapTransformer.fromYdoc(
          payload.document,
          'default',
        );
        await this.documents.storeOnlineDocumentCollaborationSnapshot(
          context.documentId,
          {
            ydocState: Y.encodeStateAsUpdate(payload.document),
            contentJson,
            user: context.user,
          },
        );
      },
      onDisconnect: async (payload) => {
        this.logger.log(
          `Conexao colaborativa encerrada socket=${payload.socketId} documento=${payload.documentName} clientes=${payload.clientsCount}`,
        );
      },
    });

    await this.server.listen(port);
    this.logger.log(`Servidor de colaboracao de documentos em ws://${address}:${port}`);
  }

  async onModuleDestroy() {
    if (!this.server) return;
    await this.server.destroy();
    this.server = null;
  }

  private resolvePort() {
    const value = Number(this.config.get<string>('DOCUMENT_COLLAB_PORT'));
    if (!Number.isFinite(value) || value <= 0) {
      return DEFAULT_COLLABORATION_PORT;
    }
    return Math.floor(value);
  }

  private parseDocumentId(documentName: string) {
    if (!documentName.startsWith(DOCUMENT_NAME_PREFIX)) {
      throw new Error('documento-colaborativo-invalido');
    }
    const id = documentName.slice(DOCUMENT_NAME_PREFIX.length).trim();
    if (!id) {
      throw new Error('documento-colaborativo-invalido');
    }
    return id;
  }

  private async authenticateUser(token: string, activeRoleId?: string) {
    if (!token) {
      throw new Error('token-ausente');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw new Error('token-invalido');
    }

    return this.rbac.getUserAccess(payload.sub, activeRoleId || undefined);
  }

  private getContext(context: unknown, documentName: string) {
    const candidate = context as Partial<CollaborationContext> | undefined;
    if (!candidate?.user || !candidate.documentId) {
      throw new Error(`contexto-colaborativo-invalido:${documentName}`);
    }
    return candidate as CollaborationContext;
  }

  private formatError(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  private canUsePersistedYDocState(content: {
    ydocStateUpdatedAt?: Date | string | null;
    updatedAt?: Date | string | null;
  }) {
    const ydocStateUpdatedAt = this.toTimestamp(content.ydocStateUpdatedAt);
    if (!ydocStateUpdatedAt) return false;
    const contentUpdatedAt = this.toTimestamp(content.updatedAt);
    if (!contentUpdatedAt) return true;
    return ydocStateUpdatedAt + 2_000 >= contentUpdatedAt;
  }

  private toTimestamp(value: Date | string | null | undefined) {
    if (!value) return null;
    const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }
}
