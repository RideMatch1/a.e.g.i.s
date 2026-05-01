// FP regression-guard: 'strict-dynamic' + nonce is the modern hardened
// pattern. Per CSP3 spec, when 'strict-dynamic' is present alongside a
// nonce / hash, the URL-allowlist (and 'unsafe-inline', and the bare host
// sources) are EXPLICITLY IGNORED by the browser — the nonce is the sole
// trust anchor. Common reinvention-trap: a naive scanner sees 'unsafe-inline'
// or `https:` and flags HIGH; correct scanner detects strict-dynamic + nonce
// and short-circuits. csp-evaluator MUST NOT fire on this policy.
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'strict-dynamic' 'nonce-rGV2OWIwd2syNG5l' 'unsafe-inline' https:",
          },
        ],
      },
    ];
  },
};
