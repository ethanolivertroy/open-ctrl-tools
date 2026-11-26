DELETE FROM subprocessors
WHERE id = 'aws'
  AND name = 'Amazon Web Services'
  AND purpose = 'Primary application infrastructure and encrypted data storage.'
  AND location = 'United States'
  AND url = 'https://aws.amazon.com/';

UPDATE subprocessors
SET purpose = 'Edge delivery, application security, trust-center hosting, data storage, and transactional email.'
WHERE id = 'cloudflare'
  AND name = 'Cloudflare'
  AND purpose = 'Edge delivery, application security, trust-center hosting, and transactional email.';

UPDATE faqs
SET answer = 'Production customer data is hosted on Cloudflare in the United States. Regional commitments are documented in the applicable agreement.'
WHERE id = 'hosting'
  AND question = 'Where is customer data hosted?'
  AND answer = 'Production customer data is hosted in the United States. Regional commitments are documented in the applicable agreement.';

UPDATE faqs
SET answer = 'Yes. Data is encrypted in transit using modern TLS and encrypted at rest using Cloudflare-managed encryption controls.'
WHERE id = 'encryption'
  AND question = 'Is customer data encrypted?'
  AND answer = 'Yes. Data is encrypted in transit using modern TLS and encrypted at rest using provider-managed encryption controls.';
