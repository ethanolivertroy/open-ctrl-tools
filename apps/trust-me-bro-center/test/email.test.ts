import { describe, expect, it } from 'vitest';
import {
  CloudflareEmailSender,
  drainOutbox,
  MAX_EMAIL_ATTEMPTS,
  parseFromAddress,
  type EmailSender,
  type OutboxRepository,
  type OutgoingEmail,
  type StoredOutboxEmail
} from '../src/email';
import { createEmailSender, type WorkerEnv } from '../src/worker-services';

interface OutboxRow extends StoredOutboxEmail {
  status: 'pending' | 'sending' | 'sent' | 'failed';
  lastError?: string;
}

class FakeOutbox implements OutboxRepository {
  rows: OutboxRow[] = [];

  add(email: Partial<OutgoingEmail> & { attempts?: number } = {}): OutboxRow {
    const row: OutboxRow = {
      id: `email-${this.rows.length + 1}`,
      to: 'person@example.com',
      subject: 'Subject',
      bodyText: 'Body',
      template: 'test',
      attempts: 0,
      status: 'pending',
      ...email
    };
    this.rows.push(row);
    return row;
  }

  async listSendableEmails(limit: number) {
    return this.rows
      .filter((row) => row.status === 'pending' && row.attempts < MAX_EMAIL_ATTEMPTS)
      .slice(0, limit)
      .map((row) => ({ ...row }));
  }

  async claimEmail(id: string, expectedAttempts: number) {
    const row = this.rows.find((entry) => entry.id === id);
    if (!row || row.status !== 'pending' || row.attempts !== expectedAttempts) return false;
    row.status = 'sending';
    row.attempts += 1;
    return true;
  }

  async markEmailSent(id: string) {
    const row = this.rows.find((entry) => entry.id === id);
    if (row?.status === 'sending') row.status = 'sent';
  }

  async markEmailFailed(id: string, error: string, exhausted: boolean) {
    const row = this.rows.find((entry) => entry.id === id);
    if (!row || row.status !== 'sending') return;
    row.status = exhausted ? 'failed' : 'pending';
    row.lastError = error;
  }
}

class RecordingSender implements EmailSender {
  sent: OutgoingEmail[] = [];
  failWith: Error | null = null;

  async send(email: OutgoingEmail) {
    if (this.failWith) throw this.failWith;
    this.sent.push(email);
  }
}

describe('drainOutbox', () => {
  it('sends pending emails once and marks them sent', async () => {
    const outbox = new FakeOutbox();
    outbox.add({ to: 'one@example.com' });
    outbox.add({ to: 'two@example.com' });
    const sender = new RecordingSender();

    const first = await drainOutbox(outbox, sender);
    const second = await drainOutbox(outbox, sender);

    expect(first).toEqual({ sent: 2, failed: 0 });
    expect(second).toEqual({ sent: 0, failed: 0 });
    expect(sender.sent.map((email) => email.to)).toEqual(['one@example.com', 'two@example.com']);
    expect(outbox.rows.every((row) => row.status === 'sent')).toBe(true);
  });

  it('keeps in-flight rows invisible to an overlapping drain', async () => {
    const outbox = new FakeOutbox();
    const row = outbox.add();
    const staleSnapshot = await outbox.listSendableEmails(10);

    expect(await outbox.claimEmail(row.id, 0)).toBe(true);

    expect(await outbox.listSendableEmails(10)).toHaveLength(0);
    expect(await outbox.claimEmail(staleSnapshot[0]!.id, staleSnapshot[0]!.attempts)).toBe(false);
  });

  it('never lets a late failure overwrite an email already marked sent', async () => {
    const outbox = new FakeOutbox();
    const row = outbox.add();
    await outbox.claimEmail(row.id, 0);
    await outbox.markEmailSent(row.id);

    await outbox.markEmailFailed(row.id, 'timeout surfaced after delivery', false);

    expect(outbox.rows[0]?.status).toBe('sent');
    expect(outbox.rows[0]?.lastError).toBeUndefined();
  });

  it('retries failures until the attempt cap, then marks the email failed', async () => {
    const outbox = new FakeOutbox();
    outbox.add();
    const sender = new RecordingSender();
    sender.failWith = new Error('provider unavailable');

    for (let attempt = 1; attempt < MAX_EMAIL_ATTEMPTS; attempt += 1) {
      await drainOutbox(outbox, sender);
      expect(outbox.rows[0]?.status).toBe('pending');
    }
    await drainOutbox(outbox, sender);

    expect(outbox.rows[0]?.status).toBe('failed');
    expect(outbox.rows[0]?.lastError).toBe('provider unavailable');
    expect(outbox.rows[0]?.attempts).toBe(MAX_EMAIL_ATTEMPTS);

    const afterCap = await drainOutbox(outbox, sender);
    expect(afterCap).toEqual({ sent: 0, failed: 0 });
  });
});

describe('parseFromAddress', () => {
  it('keeps a bare address', () => {
    expect(parseFromAddress('trust@example.com')).toBe('trust@example.com');
  });

  it('splits a display name from the angle address', () => {
    expect(parseFromAddress('Trust Center <trust@example.com>')).toEqual({
      name: 'Trust Center',
      email: 'trust@example.com'
    });
  });
});

describe('CloudflareEmailSender', () => {
  it('sends through the Email Service binding with custom headers', async () => {
    const sent: unknown[] = [];
    const sender = new CloudflareEmailSender(
      {
        async send(message) {
          sent.push(message);
          return { messageId: 'msg_1' };
        }
      },
      'Trust Center <trust@example.com>'
    );

    await sender.send({
      to: 'person@example.com',
      subject: 'Confirm your subscription',
      bodyText: 'Confirm here.',
      template: 'subscription-confirm',
      headers: { 'List-Unsubscribe': '<https://trust.example/unsubscribe.html?token=abc>' }
    });

    expect(sent[0]).toEqual({
      to: 'person@example.com',
      from: { name: 'Trust Center', email: 'trust@example.com' },
      subject: 'Confirm your subscription',
      text: 'Confirm here.',
      headers: { 'List-Unsubscribe': '<https://trust.example/unsubscribe.html?token=abc>' }
    });
  });

  it('throws when the binding rejects the send', async () => {
    const sender = new CloudflareEmailSender(
      {
        async send() {
          throw new Error('E_RATE_LIMIT_EXCEEDED');
        }
      },
      'trust@example.com'
    );

    await expect(sender.send({ to: 'person@example.com', subject: 'S', bodyText: 'B', template: 't' }))
      .rejects.toThrow('E_RATE_LIMIT_EXCEEDED');
  });
});

describe('createEmailSender', () => {
  const binding = { send: async () => ({ messageId: 'msg_1' }) };

  function env(partial: Partial<WorkerEnv>): WorkerEnv {
    return partial as unknown as WorkerEnv;
  }

  it('logs locally when EMAIL_LOG_ONLY is true', () => {
    const sender = createEmailSender(env({
      EMAIL_LOG_ONLY: 'true',
      EMAIL: binding,
      EMAIL_FROM: 'trust@example.com'
    }));
    expect(sender?.constructor.name).toBe('ConsoleEmailSender');
  });

  it('uses the Email Service binding when a From address is set', () => {
    const sender = createEmailSender(env({
      EMAIL: binding,
      EMAIL_FROM: 'trust@example.com'
    }));
    expect(sender?.constructor.name).toBe('CloudflareEmailSender');
  });

  it('queues only when the binding or From address is missing', () => {
    expect(createEmailSender(env({}))).toBeUndefined();
    expect(createEmailSender(env({ EMAIL: binding }))).toBeUndefined();
    expect(createEmailSender(env({ EMAIL_FROM: 'trust@example.com' }))).toBeUndefined();
  });
});
