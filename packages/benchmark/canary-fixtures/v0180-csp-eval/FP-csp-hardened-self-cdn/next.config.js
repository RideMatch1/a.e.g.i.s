// FP regression-guard: a hardened policy that pairs 'self' with one HTTPS
// CDN and explicitly disables object-src. No 'unsafe-inline', no
// 'unsafe-eval', no wildcard, no http:. csp-evaluator MUST NOT fire.
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' https://cdn.example.com; object-src 'none'; base-uri 'self'",
          },
        ],
      },
    ];
  },
};
