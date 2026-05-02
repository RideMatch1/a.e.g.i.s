// Real-world pattern from Spa-App's next-intl request config (battle-test
// 2026-05-02): a top-level call to a host function (getRequestConfig) that
// receives an async arrow as its callback. The callback executes per-request,
// not on module load — the dynamic import inside is NOT a persistence
// pattern. The IIFE detector must NOT mark this as top-level-IIFE.
function getRequestConfig(_handler: () => Promise<unknown>) {
  return null;
}

export default getRequestConfig(async () => {
  const locale = 'de';
  const messages = (await import(`@/messages/${locale}.json`)).default;
  return { locale, messages };
});
