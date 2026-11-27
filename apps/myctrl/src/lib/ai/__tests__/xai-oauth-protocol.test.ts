import { describe, expect, it } from 'vitest';
import {
  credentialsFromTokenResponse,
  parseDeviceCode,
} from '@/lib/ai/xai-oauth-protocol';

describe('xai oauth protocol', () => {
  it('parses a device code response and keeps https verification URIs', () => {
    const device = parseDeviceCode({
      device_code: 'device-1',
      user_code: 'ABCD-EFGH',
      verification_uri: 'https://auth.x.ai/activate',
      verification_uri_complete: 'https://auth.x.ai/activate?user_code=ABCD-EFGH',
      expires_in: 900,
      interval: 5,
    });

    expect(device.userCode).toBe('ABCD-EFGH');
    expect(device.verificationUriComplete).toContain('user_code=ABCD-EFGH');
  });

  it('rejects non-https verification URIs', () => {
    expect(() => parseDeviceCode({
      device_code: 'device-1',
      user_code: 'ABCD-EFGH',
      verification_uri: 'http://evil.example/activate',
      expires_in: 900,
    })).toThrow(/Untrusted verification URI/);
  });

  it('keeps the previous refresh token when xAI omits a new one', () => {
    const tokens = credentialsFromTokenResponse({
      access_token: 'access-2',
      expires_in: 3600,
    }, 'refresh-1');

    expect(tokens.accessToken).toBe('access-2');
    expect(tokens.refreshToken).toBe('refresh-1');
    expect(tokens.expiresAt).toBeLessThan(Date.now() + 3600 * 1000);
  });
});
