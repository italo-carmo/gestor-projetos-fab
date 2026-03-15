import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'ldapts';
import { throwError } from '../common/http-error';
import { stripOmSuffixFromLdapName } from '../common/military-name';

export type FabLdapProfile = {
  uid: string;
  dn: string;
  name: string | null;
  email: string | null;
  fabom: string | null;
  numeroOrdem: string | null;
};

type LdapEntry = Record<string, unknown> & { dn?: string };

@Injectable()
export class FabLdapService {
  constructor(private readonly config: ConfigService) {}

  async authenticate(uid: string, password: string): Promise<FabLdapProfile> {
    const normalizedUid = this.normalizeUid(uid);
    if (!normalizedUid || !password) {
      throwError('AUTH_INVALID_CREDENTIALS');
    }

    const client = this.createClient();

    try {
      await client.bind(this.buildUserDn(normalizedUid), password);
      const profile = await this.searchByUid(client, normalizedUid);
      if (profile) return profile;

      return {
        uid: normalizedUid,
        dn: this.buildUserDn(normalizedUid),
        name: null,
        email: null,
        fabom: null,
        numeroOrdem: null,
      };
    } catch (error) {
      this.handleLdapError(error, { invalidCredentials: true });
    } finally {
      await client.unbind().catch(() => undefined);
    }
  }

  async lookupByUid(uid: string): Promise<FabLdapProfile | null> {
    const normalizedUid = this.normalizeUid(uid);
    if (!normalizedUid) {
      throwError('VALIDATION_ERROR', { reason: 'LDAP_UID_REQUIRED' });
    }

    const client = this.createClient();

    try {
      await this.bindForLookup(client);
      return await this.searchByUid(client, normalizedUid);
    } catch (error) {
      this.handleLdapError(error, { invalidCredentials: false });
    } finally {
      await client.unbind().catch(() => undefined);
    }
  }

  async lookupByEmail(email: string): Promise<FabLdapProfile | null> {
    const normalizedEmail = String(email ?? '')
      .trim()
      .toLowerCase();
    if (!normalizedEmail) {
      throwError('VALIDATION_ERROR', { reason: 'LDAP_EMAIL_REQUIRED' });
    }

    const client = this.createClient();

    try {
      await this.bindForLookup(client);
      const filter = `(mail=${this.escapeFilterValue(normalizedEmail)})`;
      const { searchEntries } = await client.search(this.getBaseDn(), {
        scope: 'sub',
        filter,
        attributes: [
          'uid',
          'cn',
          'displayName',
          'mail',
          'FABom',
          'fabom',
          'FABnrordem',
          'fabnrordem',
          'givenName',
          'sn',
        ],
      });
      if (!searchEntries.length) return null;
      return this.mapEntry(searchEntries[0] as LdapEntry, normalizedEmail);
    } catch (error) {
      this.handleLdapError(error, { invalidCredentials: false });
    } finally {
      await client.unbind().catch(() => undefined);
    }
  }

  private createClient() {
    return new Client({
      url: this.getLdapUrl(),
      timeout: 8000,
      connectTimeout: 8000,
    });
  }

  private async bindForLookup(client: Client) {
    const bindDn = this.config.get<string>('LDAP_FAB_BIND_DN')?.trim();
    const bindPassword = this.config
      .get<string>('LDAP_FAB_BIND_PASSWORD')
      ?.trim();

    if (bindDn && bindPassword) {
      await client.bind(bindDn, bindPassword);
    }
  }

  private async searchByUid(
    client: Client,
    uid: string,
  ): Promise<FabLdapProfile | null> {
    const filter = `(uid=${this.escapeFilterValue(uid)})`;
    const { searchEntries } = await client.search(this.getBaseDn(), {
      scope: 'sub',
      filter,
      attributes: [
        'uid',
        'cn',
        'displayName',
        'mail',
        'FABom',
        'fabom',
        'FABnrordem',
        'fabnrordem',
        'givenName',
        'sn',
      ],
    });

    if (!searchEntries.length) {
      return null;
    }

    return this.mapEntry(searchEntries[0] as LdapEntry, uid);
  }

  private mapEntry(entry: LdapEntry, fallbackUid: string): FabLdapProfile {
    const uid = this.readAttribute(entry, 'uid') ?? fallbackUid;
    const fabom = this.readFirstAvailableAttribute(entry, ['FABom', 'fabom']);
    const numeroOrdem = this.readFirstAvailableAttribute(entry, [
      'FABnrordem',
      'fabnrordem',
    ]);
    const givenName = this.readAttribute(entry, 'givenName');
    const surname = this.readAttribute(entry, 'sn');
    const composedName = [givenName, surname].filter(Boolean).join(' ').trim();
    const rawName =
      this.readAttribute(entry, 'displayName') ??
      this.readAttribute(entry, 'cn') ??
      (composedName || null);

    return {
      uid,
      dn:
        typeof entry.dn === 'string' && entry.dn.trim()
          ? entry.dn
          : this.buildUserDn(uid),
      name: stripOmSuffixFromLdapName(rawName, fabom) || null,
      email: this.readAttribute(entry, 'mail')?.toLowerCase() ?? null,
      fabom,
      numeroOrdem,
    };
  }

  private readFirstAvailableAttribute(
    entry: LdapEntry,
    attributes: string[],
  ): string | null {
    for (const attribute of attributes) {
      const value = this.readAttribute(entry, attribute);
      if (value) return value;
    }
    return null;
  }

  private readAttribute(entry: LdapEntry, attribute: string): string | null {
    const value = this.readEntryValue(entry, attribute);

    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    }

    if (Buffer.isBuffer(value)) {
      const decoded = value.toString('utf-8').trim();
      return decoded ? decoded : null;
    }

    if (Array.isArray(value) && value.length > 0) {
      const first = value[0];
      if (typeof first === 'string') {
        const trimmed = first.trim();
        return trimmed ? trimmed : null;
      }
      if (Buffer.isBuffer(first)) {
        const decoded = first.toString('utf-8').trim();
        return decoded ? decoded : null;
      }
    }

    return null;
  }

  private readEntryValue(entry: LdapEntry, attribute: string): unknown {
    if (attribute in entry) {
      return entry[attribute];
    }
    const target = attribute.toLowerCase();
    const matchingKey = Object.keys(entry).find(
      (key) => key.toLowerCase() === target,
    );
    return matchingKey ? entry[matchingKey] : undefined;
  }

  private normalizeUid(uid: string) {
    return String(uid ?? '').trim();
  }

  private buildUserDn(uid: string) {
    return `uid=${uid},${this.getBaseDn()}`;
  }

  private getLdapUrl() {
    return (
      this.config.get<string>('LDAP_FAB_URL')?.trim() ||
      'ldap://10.228.64.168:389'
    );
  }

  private getBaseDn() {
    return (
      this.config.get<string>('LDAP_FAB_BASE_DN')?.trim() ||
      'ou=contas,dc=fab,dc=intraer'
    );
  }

  private escapeFilterValue(value: string) {
    return value
      .replace(/\\/g, '\\5c')
      .replace(/\*/g, '\\2a')
      .replace(/\(/g, '\\28')
      .replace(/\)/g, '\\29')
      .replace(/\u0000/g, '\\00');
  }

  private handleLdapError(
    error: unknown,
    options: { invalidCredentials: boolean },
  ): never {
    if (this.isConnectivityError(error)) {
      throwError('VALIDATION_ERROR', {
        reason: 'LDAP_UNREACHABLE',
        host: this.getLdapUrl(),
        port: 389,
      });
    }

    if (options.invalidCredentials) {
      throwError('AUTH_INVALID_CREDENTIALS');
    }

    throwError('VALIDATION_ERROR', {
      reason: 'LDAP_QUERY_FAILED',
      message: this.stringifyError(error),
    });
  }

  private isConnectivityError(error: unknown) {
    const code = String((error as { code?: string })?.code ?? '').toUpperCase();
    return (
      code === 'ECONNREFUSED' ||
      code === 'ENOTFOUND' ||
      code === 'EHOSTUNREACH' ||
      code === 'ECONNRESET' ||
      code === 'ETIMEDOUT'
    );
  }

  private stringifyError(error: unknown) {
    if (error instanceof Error) return error.message;
    return String(error ?? 'unknown');
  }
}
