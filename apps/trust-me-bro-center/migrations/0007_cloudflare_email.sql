DELETE FROM subprocessors
WHERE id = 'resend'
  AND name = 'Resend'
  AND purpose = 'Transactional security and trust-center update email.'
  AND location = 'United States'
  AND url = 'https://resend.com/';

UPDATE subprocessors
SET purpose = 'Edge delivery, application security, trust-center hosting, and transactional email.'
WHERE id = 'cloudflare'
  AND name = 'Cloudflare'
  AND purpose = 'Edge delivery, application security, and trust-center hosting.';
