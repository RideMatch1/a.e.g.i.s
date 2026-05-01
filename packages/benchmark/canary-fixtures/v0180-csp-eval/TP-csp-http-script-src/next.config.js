// script-src lists an `http://` (plain-text TLS-stripped) origin. An
// active-network attacker who downgrades the CDN connection can inject
// arbitrary script. csp-evaluator MUST flag at HIGH severity (TLS-downgrade
// vector).
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' http://cdn.example.com",
          },
        ],
      },
    ];
  },
};
