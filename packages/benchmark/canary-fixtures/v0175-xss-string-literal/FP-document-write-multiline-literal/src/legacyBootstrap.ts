// FP — document.write with a multi-line literal HTML string is
// vintage-but-not-XSS. Often appears in legacy bootstrappers.
export function legacyBootstrap(): void {
  document.write(
    '<noscript>This page requires JavaScript to be enabled.</noscript>',
  );
}
