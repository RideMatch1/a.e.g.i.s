---
license: MIT (snippet)
provider: React (Open-Source)
last-checked: 2026-05-02
purpose: React useConsent Hook fuer ConsentGate-Pattern.
---

# React — useConsent Hook + ConsentGate (Pattern)

## 1. Use-Case

Tracker / Embeds / Drittanbieter sollen NUR nach User-Consent geladen werden.

## 2. Code-Pattern

```tsx
// File: src/lib/consent.ts
import { useState, useEffect } from 'react';

type ConsentCategory = 'necessary' | 'analytics' | 'marketing';

type ConsentState = Record<ConsentCategory, boolean>;

const STORAGE_KEY = 'cookie-consent';

export function useConsent() {
  const [consent, setConsent] = useState<ConsentState>({
    necessary: true,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setConsent(JSON.parse(stored));
    }
    // Listen fuer Consent-Aenderungen
    const handler = () => {
      const updated = localStorage.getItem(STORAGE_KEY);
      if (updated) setConsent(JSON.parse(updated));
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const hasConsented = (category: ConsentCategory) => consent[category];

  return { consent, hasConsented };
}
```

```tsx
// File: src/components/ConsentGate.tsx
'use client';

import { ReactNode } from 'react';
import { useConsent } from '@/lib/consent';

type Props = {
  category: 'analytics' | 'marketing';
  children: ReactNode;
  fallback?: ReactNode;
};

export default function ConsentGate({ category, children, fallback }: Props) {
  const { hasConsented } = useConsent();

  if (!hasConsented(category)) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}
```

```tsx
// Verwendung: YouTube-Embed nur nach Consent
import ConsentGate from '@/components/ConsentGate';

<ConsentGate category="marketing" fallback={
  <div className="consent-fallback">
    <p>YouTube-Video benoetigt Ihre Einwilligung.</p>
    <button onClick={() => /* Banner re-open */}>Cookies aendern</button>
  </div>
}>
  <iframe src="https://www.youtube-nocookie.com/embed/..." />
</ConsentGate>
```

## 3. Az.-Anker

- EuGH C-40/17 Fashion-ID (Mit-Verantwortlichkeit)
- LG Muenchen I 3 O 17493/20 (Google Fonts ohne Consent)

## 4. Cross-Reference

- Cookie-Banner: `cookie-banner-pattern.md`
- Audit-Pattern Phase 5: `audit-patterns.md`
