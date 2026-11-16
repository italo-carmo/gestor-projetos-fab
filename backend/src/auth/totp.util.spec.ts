import * as OTPAuth from 'otpauth';
import { verifyTotpCode } from './totp.util';

const SECRET_BASE32 = 'JBSWY3DPEHPK3PXP';
const BASE_TIME = Date.UTC(2026, 0, 1, 12, 0, 0);

function generateCodeAt(timestamp: number) {
  const totp = new OTPAuth.TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(SECRET_BASE32),
  });
  return totp.generate({ timestamp });
}

describe('verifyTotpCode', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('accepts the code for the current interval', () => {
    jest.useFakeTimers().setSystemTime(BASE_TIME);

    expect(verifyTotpCode(SECRET_BASE32, generateCodeAt(BASE_TIME))).toBe(true);
  });

  it('accepts the code from one adjacent interval', () => {
    jest.useFakeTimers().setSystemTime(BASE_TIME + 30_000);

    expect(verifyTotpCode(SECRET_BASE32, generateCodeAt(BASE_TIME))).toBe(true);
  });

  it('rejects codes older than one adjacent interval', () => {
    jest.useFakeTimers().setSystemTime(BASE_TIME + 60_000);

    expect(verifyTotpCode(SECRET_BASE32, generateCodeAt(BASE_TIME))).toBe(
      false,
    );
  });

  it('rejects codes more than one interval ahead of server time', () => {
    jest.useFakeTimers().setSystemTime(BASE_TIME);

    expect(
      verifyTotpCode(SECRET_BASE32, generateCodeAt(BASE_TIME + 60_000)),
    ).toBe(false);
  });
});
