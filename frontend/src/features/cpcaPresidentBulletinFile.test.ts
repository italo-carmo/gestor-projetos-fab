import { describe, expect, it } from "vitest";
import {
  formatCpcaPresidentBulletinFileSize,
  getCpcaPresidentBulletinPreviewKind,
  validateCpcaPresidentBulletinFile,
} from "./cpcaPresidentBulletinFile";

function makeFile(bytes: number[], name: string, type: string) {
  if (typeof File !== "undefined") {
    return new File([new Uint8Array(bytes)], name, { type });
  }
  return Object.assign(new Blob([new Uint8Array(bytes)], { type }), {
    name,
    lastModified: Date.now(),
  }) as File;
}

describe("cpcaPresidentBulletinFile helpers", () => {
  it("accepts a real PDF file", async () => {
    const file = makeFile(
      [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34],
      "boletim.pdf",
      "application/pdf",
    );

    await expect(
      validateCpcaPresidentBulletinFile(file),
    ).resolves.toMatchObject({
      ok: true,
      kind: "pdf",
      mimeType: "application/pdf",
    });
  });

  it("rejects a disguised file with renamed extension", async () => {
    const file = makeFile(
      [0x4d, 0x5a, 0x00, 0x01],
      "boletim.pdf",
      "application/pdf",
    );

    await expect(
      validateCpcaPresidentBulletinFile(file),
    ).resolves.toMatchObject({
      ok: false,
      reason: "MAGIC_INVALID",
    });
  });

  it("rejects extension mismatch against the real file signature", async () => {
    const file = makeFile(
      [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10],
      "boletim.pdf",
      "application/pdf",
    );

    await expect(
      validateCpcaPresidentBulletinFile(file),
    ).resolves.toMatchObject({
      ok: false,
      reason: "EXTENSION_MISMATCH",
    });
  });

  it("formats size labels and preview kinds", () => {
    expect(formatCpcaPresidentBulletinFileSize(1200)).toBe("1 KB");
    expect(formatCpcaPresidentBulletinFileSize(3 * 1024 * 1024)).toBe("3.0 MB");
    expect(getCpcaPresidentBulletinPreviewKind("application/pdf")).toBe("pdf");
    expect(getCpcaPresidentBulletinPreviewKind("image/jpeg")).toBe("image");
    expect(getCpcaPresidentBulletinPreviewKind("text/plain")).toBe("unknown");
  });
});
