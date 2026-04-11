"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptSecret = encryptSecret;
exports.decryptSecret = decryptSecret;
exports.generateTotpSecret = generateTotpSecret;
exports.buildTotpUri = buildTotpUri;
exports.generateQrCodeDataUrl = generateQrCodeDataUrl;
exports.formatManualKey = formatManualKey;
exports.verifyTotpCode = verifyTotpCode;
exports.generateBackupCodes = generateBackupCodes;
exports.hashBackupCodes = hashBackupCodes;
exports.verifyBackupCode = verifyBackupCode;
const crypto_1 = require("crypto");
const OTPAuth = __importStar(require("otpauth"));
const QRCode = __importStar(require("qrcode"));
const bcrypt = __importStar(require("bcrypt"));
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const BACKUP_CODE_COUNT = 8;
const BCRYPT_ROUNDS = 10;
const TOTP_ISSUER = 'Gestor CIPAVD';
const TOTP_PERIOD = 30;
const TOTP_DIGITS = 6;
function deriveKey(secret) {
    return (0, crypto_1.createHash)('sha256').update(secret).digest();
}
function encryptSecret(plaintext, encryptionKey) {
    const key = deriveKey(encryptionKey);
    const iv = (0, crypto_1.randomBytes)(IV_LENGTH);
    const cipher = (0, crypto_1.createCipheriv)(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}
function decryptSecret(ciphertext, encryptionKey) {
    const key = deriveKey(encryptionKey);
    const data = Buffer.from(ciphertext, 'base64');
    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = (0, crypto_1.createDecipheriv)(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
}
function generateTotpSecret() {
    const secret = new OTPAuth.Secret({ size: 20 });
    return secret.base32;
}
function buildTotpUri(secretBase32, accountName) {
    const totp = new OTPAuth.TOTP({
        issuer: TOTP_ISSUER,
        label: accountName,
        algorithm: 'SHA1',
        digits: TOTP_DIGITS,
        period: TOTP_PERIOD,
        secret: OTPAuth.Secret.fromBase32(secretBase32),
    });
    return totp.toString();
}
async function generateQrCodeDataUrl(uri) {
    return QRCode.toDataURL(uri, { width: 280, margin: 2 });
}
function formatManualKey(base32) {
    return base32.replace(/(.{4})/g, '$1 ').trim();
}
function verifyTotpCode(secretBase32, code) {
    const totp = new OTPAuth.TOTP({
        issuer: TOTP_ISSUER,
        algorithm: 'SHA1',
        digits: TOTP_DIGITS,
        period: TOTP_PERIOD,
        secret: OTPAuth.Secret.fromBase32(secretBase32),
    });
    const delta = totp.validate({ token: code.trim(), window: 3 });
    return delta !== null;
}
function generateBackupCodes() {
    const codes = [];
    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
        const raw = (0, crypto_1.randomBytes)(4).toString('hex').toUpperCase();
        codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
    }
    return codes;
}
async function hashBackupCodes(codes) {
    return Promise.all(codes.map((code) => bcrypt.hash(code.replace('-', '').toLowerCase(), BCRYPT_ROUNDS)));
}
async function verifyBackupCode(candidate, hashes) {
    const normalized = candidate.replace(/[-\s]/g, '').toLowerCase();
    for (let i = 0; i < hashes.length; i++) {
        const match = await bcrypt.compare(normalized, hashes[i]);
        if (match)
            return i;
    }
    return -1;
}
//# sourceMappingURL=totp.util.js.map