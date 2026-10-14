const form = document.getElementById('login-form');
const errorBox = document.getElementById('error');
const noOwnerBox = document.getElementById('no-owner');
const submit = document.getElementById('submit');

function show(box, message) {
  box.textContent = message;
  box.classList.remove('hidden');
}

async function checkOwner() {
  try {
    const response = await fetch('/api/auth/status');
    const data = await response.json();
    if (data.authenticated) {
      window.location.assign('/');
      return;
    }
    if (!data.hasOwner) {
      show(
        noOwnerBox,
        'No owner account exists on this PC yet. Start the admin once while connected to the internet so it can download your account from TiDB.',
      );
      submit.disabled = true;
    }
  } catch {
    /* server unreachable - the form submit will surface a clearer error */
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.classList.add('hidden');

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  submit.disabled = true;
  const original = submit.textContent;
  submit.innerHTML = '<span class="spinner"></span> Signing in';

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();

    if (!response.ok) {
      show(errorBox, data.error || 'Sign in failed.');
      return;
    }
    window.location.assign('/');
  } catch {
    show(errorBox, 'Could not reach the local server. Is it still running?');
  } finally {
    submit.disabled = false;
    submit.textContent = original;
  }
});

checkOwner();
