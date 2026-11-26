export interface OutgoingEmail {
  to: string;
  subject: string;
  bodyText: string;
  template: string;
  headers?: Record<string, string>;
}

export interface StoredOutboxEmail extends OutgoingEmail {
  id: string;
  attempts: number;
}

export interface EmailSender {
  send(email: OutgoingEmail): Promise<void>;
}

export interface OutboxRepository {
  listSendableEmails(limit: number): Promise<StoredOutboxEmail[]>;
  claimEmail(id: string, expectedAttempts: number): Promise<boolean>;
  markEmailSent(id: string, at: string): Promise<void>;
  markEmailFailed(id: string, error: string, exhausted: boolean): Promise<void>;
}

export const MAX_EMAIL_ATTEMPTS = 5;

export const EMAIL_CLAIM_LEASE_MS = 10 * 60 * 1000;

export interface SendEmailBinding {
  send(message: {
    to: string | string[];
    from: string | { email: string; name?: string };
    subject: string;
    text?: string;
    html?: string;
    headers?: Record<string, string>;
    replyTo?: string | { email: string; name?: string };
  }): Promise<{ messageId: string }>;
}

export function parseFromAddress(from: string): string | { email: string; name: string } {
  const named = from.match(/^\s*(.+?)\s*<([^<>]+)>\s*$/);
  if (named?.[1] && named[2]) return { name: named[1].trim(), email: named[2].trim() };
  return from.trim();
}

export class CloudflareEmailSender implements EmailSender {
  constructor(
    private readonly binding: SendEmailBinding,
    private readonly from: string
  ) {}

  async send(email: OutgoingEmail): Promise<void> {
    const message: Parameters<SendEmailBinding['send']>[0] = {
      to: email.to,
      from: parseFromAddress(this.from),
      subject: email.subject,
      text: email.bodyText
    };
    if (email.headers && Object.keys(email.headers).length > 0) message.headers = email.headers;
    await this.binding.send(message);
  }
}

export class ConsoleEmailSender implements EmailSender {
  async send(email: OutgoingEmail): Promise<void> {
    console.log(JSON.stringify({ event: 'email.log_only', to: email.to, subject: email.subject, template: email.template }));
    console.log(email.bodyText);
  }
}

function unsubscribeFooter(unsubscribeUrl: string): string {
  return `Unsubscribe at any time: ${unsubscribeUrl}`;
}

export function subscriptionConfirmEmail(input: {
  to: string;
  companyName: string;
  confirmUrl: string;
  unsubscribeUrl: string;
}): OutgoingEmail {
  return {
    to: input.to,
    subject: `Confirm your ${input.companyName} trust center subscription`,
    template: 'subscription-confirm',
    bodyText: [
      `Someone asked to receive ${input.companyName} trust center updates at this address.`,
      'Open the link below to confirm the subscription. The link expires in 48 hours.',
      '',
      input.confirmUrl,
      '',
      'If you did not request this, ignore this email and nothing will be sent.',
      '',
      unsubscribeFooter(input.unsubscribeUrl)
    ].join('\n'),
    headers: { 'List-Unsubscribe': `<${input.unsubscribeUrl}>` }
  };
}

export function updatePublishedEmail(input: {
  to: string;
  companyName: string;
  title: string;
  body: string;
  siteUrl: string;
  unsubscribeUrl?: string | null;
}): OutgoingEmail {
  const lines = [
    input.title,
    '',
    input.body,
    '',
    `Read the trust center: ${input.siteUrl}`
  ];
  if (input.unsubscribeUrl) lines.push('', unsubscribeFooter(input.unsubscribeUrl));
  const email: OutgoingEmail = {
    to: input.to,
    subject: `${input.companyName} trust center update: ${input.title}`,
    template: 'update-published',
    bodyText: lines.join('\n')
  };
  if (input.unsubscribeUrl) email.headers = { 'List-Unsubscribe': `<${input.unsubscribeUrl}>` };
  return email;
}

export function viewerAccessEmail(input: {
  to: string;
  companyName: string;
  viewerName: string;
  accessUrl: string;
  expiresAt: string | null;
  ndaRequired: boolean;
}): OutgoingEmail {
  const greeting = input.viewerName ? `Hello ${input.viewerName},` : 'Hello,';
  const lines = [
    greeting,
    '',
    `You have been granted access to ${input.companyName} trust center resources.`,
    'Open the link below to view and download them. It is personal to this address; do not forward it.',
    '',
    input.accessUrl,
    ''
  ];
  if (input.ndaRequired) lines.push('You will be asked to accept a confidentiality agreement before downloading.', '');
  lines.push(input.expiresAt
    ? `Access expires on ${input.expiresAt.slice(0, 10)} (UTC) and can be revoked at any time.`
    : 'Access does not expire on its own and can be revoked at any time.');
  lines.push('', 'If you did not request this, ignore this email.');
  return {
    to: input.to,
    subject: `${input.companyName}: your trust center access link`,
    template: 'viewer-access',
    bodyText: lines.join('\n')
  };
}

export function accessRequestNotificationEmail(input: {
  to: string;
  companyName: string;
  /** Titles of the requested documents; empty for a full-access request. */
  documentTitles: string[];
  requesterName: string;
  requesterEmail: string;
  requesterCompany: string;
  reason: string;
  adminUrl: string;
}): OutgoingEmail {
  const scope = input.documentTitles.length
    ? input.documentTitles.map((title) => `"${title}"`).join(', ')
    : 'full access to request-only resources';
  const lines = [
    `Someone requested ${scope} from the ${input.companyName} trust center.`,
    '',
    `Name: ${input.requesterName}`,
    `Email: ${input.requesterEmail}`,
    `Company: ${input.requesterCompany}`
  ];
  if (input.reason) lines.push(`Reason: ${input.reason}`);
  lines.push('', `Review and decide in admin: ${input.adminUrl}`, '', 'Approving issues an access link and emails the requester. Denying records the decision without emailing anyone.');
  const subjectScope = input.documentTitles.length === 1 ? input.documentTitles[0] : input.documentTitles.length ? `${input.documentTitles.length} documents` : 'full access';
  return {
    to: input.to,
    subject: `[${input.companyName} trust center] Access request: ${subjectScope}`,
    template: 'access-request-notification',
    bodyText: lines.join('\n')
  };
}

export async function drainOutbox(
  repository: OutboxRepository,
  sender: EmailSender,
  limit = 25
): Promise<{ sent: number; failed: number }> {
  const pending = await repository.listSendableEmails(limit);
  let sent = 0;
  let failed = 0;
  for (const email of pending) {
    const claimed = await repository.claimEmail(email.id, email.attempts);
    if (!claimed) continue;
    try {
      await sender.send(email);
      await repository.markEmailSent(email.id, new Date().toISOString());
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown send error';
      const exhausted = email.attempts + 1 >= MAX_EMAIL_ATTEMPTS;
      await repository.markEmailFailed(email.id, message.slice(0, 500), exhausted);
      failed += 1;
    }
  }
  return { sent, failed };
}
