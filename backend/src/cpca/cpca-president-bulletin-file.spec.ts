import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  deleteCpcaPresidentBulletinFile,
  persistCpcaPresidentBulletinFile,
  resolveExistingCpcaPresidentBulletinPath,
  validateCpcaPresidentBulletinUpload,
} from './cpca-president-bulletin-file';

function makeUpload(args: { name: string; mimeType: string; content: Buffer }) {
  return {
    originalname: args.name,
    mimetype: args.mimeType,
    size: args.content.length,
    buffer: args.content,
  } as Express.Multer.File;
}

describe('cpca president bulletin file validation', () => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'cpca-president-bulletin-'),
  );

  beforeEach(() => {
    process.env.CPCA_PRESIDENT_BULLETINS_DIR = tempDir;
    for (const entry of fs.readdirSync(tempDir)) {
      fs.unlinkSync(path.join(tempDir, entry));
    }
  });

  afterAll(() => {
    for (const entry of fs.readdirSync(tempDir)) {
      fs.unlinkSync(path.join(tempDir, entry));
    }
    fs.rmdirSync(tempDir);
    delete process.env.CPCA_PRESIDENT_BULLETINS_DIR;
  });

  it('accepts a real PDF and persists it in the configured directory', () => {
    const validated = validateCpcaPresidentBulletinUpload(
      makeUpload({
        name: 'boletim.pdf',
        mimeType: 'application/pdf',
        content: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n'),
      }),
    );

    const stored = persistCpcaPresidentBulletinFile(validated);
    const storedPath = resolveExistingCpcaPresidentBulletinPath(
      stored.storageKey,
    );

    expect(stored.mimeType).toBe('application/pdf');
    expect(fs.existsSync(storedPath)).toBe(true);
    expect(deleteCpcaPresidentBulletinFile(stored.storageKey)).toBe(true);
    expect(resolveExistingCpcaPresidentBulletinPath(stored.storageKey)).toBe(
      '',
    );
  });

  it('rejects a file that only fakes the extension and mime type', () => {
    expect(() =>
      validateCpcaPresidentBulletinUpload(
        makeUpload({
          name: 'boletim.pdf',
          mimeType: 'application/pdf',
          content: Buffer.from('MZ fake executable'),
        }),
      ),
    ).toThrow();
  });

  it('rejects mismatched extension and magic number', () => {
    expect(() =>
      validateCpcaPresidentBulletinUpload(
        makeUpload({
          name: 'boletim.pdf',
          mimeType: 'application/pdf',
          content: Buffer.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
          ]),
        }),
      ),
    ).toThrow();
  });
});
