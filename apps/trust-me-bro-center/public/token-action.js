const { endpoint, progress, done } = document.body.dataset;
const token = new URLSearchParams(window.location.search).get('token') ?? '';
const button = document.querySelector('#token-action');
const message = document.querySelector('#token-message');
const status = document.querySelector('#token-status');

if (!token) {
  button.disabled = true;
  status.classList.add('error');
  status.textContent = 'This page is missing its token. Open the full link from your email.';
}

button.addEventListener('click', async () => {
  button.disabled = true;
  status.classList.remove('error');
  status.textContent = progress;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error ?? `The request failed (${response.status}).`);
    message.textContent = done;
    status.textContent = body?.message ?? done;
  } catch (error) {
    status.classList.add('error');
    status.textContent = error.message;
    button.disabled = false;
  }
});
