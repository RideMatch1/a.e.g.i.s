// script-src `*` allows ANY host to serve script — fully neuters CSP's
// origin-restriction. csp-evaluator MUST flag at HIGH severity.
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src *",
          },
        ],
      },
    ];
  },
};
