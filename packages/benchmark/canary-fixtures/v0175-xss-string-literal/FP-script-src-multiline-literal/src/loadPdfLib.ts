// FP — multi-line literal script.src is a CDN-load pattern, not XSS.
// Sanitized from a real 2026-04-29 dogfood-scan FP on a dental-clinic
// SaaS app's PDF-export flow.
export async function ensurePdfLib(): Promise<void> {
  if (!(window as any).PDFLib) {
    const script = document.createElement('script');
    script.src =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
}
