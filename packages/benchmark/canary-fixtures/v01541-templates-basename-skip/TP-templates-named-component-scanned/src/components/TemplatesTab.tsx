// Component-named file with a hardcoded JWT — must fire jwt-detector
// despite the basename starting with "Templates".
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

export function TemplatesTab(): string {
  return token;
}
