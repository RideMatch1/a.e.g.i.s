// D9 canary lib — exporter-side regex-guard-then-sink.
// The v0.9.1 paramReachesSink fix drops CWE-918 from the function
// summary when every SSRF-class sink call on a param is protected
// by a regex-test-of-param guard (positive if-wrap or negated
// early-exit shape).

const TRUSTED_CAL_RE =
  /^https:\/\/(?:[a-z0-9-]+\.)?cal\.com(?:\/[^\s]*)?$/i;

export async function validateAndFetch(url: string): Promise<Response> {
  // Negated early-exit shape: if the regex test fails, return before
  // the sink. All code after this point runs only when regex passed.
  if (!TRUSTED_CAL_RE.test(url)) {
    throw new Error('invalid_target');
  }
  return fetch(url);
}
