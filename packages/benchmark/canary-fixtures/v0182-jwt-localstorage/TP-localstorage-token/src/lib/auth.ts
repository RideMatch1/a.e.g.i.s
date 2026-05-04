// Canonical anti-pattern: store JWT access-token in localStorage.
// Source-pattern from real-world nanoedge.pro audit 2026-05-04.

export async function loginUser(email: string, password: string): Promise<void> {
  const res = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  // ANTI-PATTERN: token in localStorage = XSS-readable
  localStorage.setItem('ne_token', data.access_token);
  localStorage.setItem('ne_refresh', data.refresh_token);
}
