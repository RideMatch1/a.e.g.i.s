// CSP defines `script-src 'unsafe-inline'` with NO nonce / hash / strict-dynamic.
// Pre-CSP3-aware execution: this is the classic XSS-mitigation bypass vector —
// any reflected script tag inside the page executes. csp-evaluator MUST flag
// this at HIGH severity.
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline'",
          },
        ],
      },
    ];
  },
};
