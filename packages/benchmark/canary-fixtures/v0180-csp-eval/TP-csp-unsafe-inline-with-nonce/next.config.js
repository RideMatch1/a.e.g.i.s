// `'unsafe-inline'` together with a nonce: in a CSP3-aware browser the nonce
// neutralizes unsafe-inline (per spec the browser ignores 'unsafe-inline'
// when a nonce / hash is present). But pre-CSP3 browsers / older WebViews
// still execute everything — and developers often add 'unsafe-inline' as a
// "fallback" misunderstanding. csp-evaluator SHOULD fire at MEDIUM severity
// (lower than the no-nonce case but still flagged — operator should remove
// the redundant 'unsafe-inline' once CSP3-aware browsers are the only
// supported target).
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'nonce-rGV2OWIwd2syNG5l'",
          },
        ],
      },
    ];
  },
};
