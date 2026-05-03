---
license: MIT (snippet)
provider: Next.js (Vercel) — Framework
last-checked: 2026-05-02
purpose: Pattern fuer Cron-Routes mit Bearer-Auth (Data-Retention, Cleanup, Newsletter-Send).
---

# Next.js — API-Route Bearer-Auth (Pattern)

## 1. Use-Case

Cron-getriggerte API-Routes (typisch fuer):
- Data-Retention-Cleanup (DSGVO Art. 5 lit. e)
- Newsletter-DOI-Token-Cleanup
- Audit-Log-Rotation
- Zombie-Account-Loeschung

## 2. Compliance-Risiken

| Risiko | Wirkung | Fix |
|---|---|---|
| Cron-Endpoint oeffentlich erreichbar | DDoS-Vektor / Daten-Manipulation | Bearer-Token Pflicht |
| Token in Code hardcoded | Code-Leak = Bypass | env-driven |
| Schwacher Token | Brute-Force | mind. 32 random Bytes |
| Cron-Job laeuft nicht | DSE-Drift Style 2 | Verify-Cron |

## 3. Code-Pattern

```ts
// File: src/app/api/cron/data-retention/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // Bearer-Auth (Pflicht)
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Data-Retention Logic
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);  // 90 Tage

  const result = await db.subscriber.deleteMany({
    where: { confirmedAt: null, createdAt: { lt: cutoff } },
  });

  return NextResponse.json({
    deletedCount: result.count,
    cutoffDate: cutoff.toISOString(),
  });
}
```

```yaml
# .github/workflows/data-retention.yml (oder vergleichbares CI-System)
on:
  schedule:
    - cron: '0 3 * * 0'  # Sonntag 3 Uhr UTC
jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -X POST https://example.com/api/cron/data-retention \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -f
```

## 4. Token-Generierung

```bash
# Pflicht: mind. 32 random bytes
openssl rand -hex 32 > /tmp/cron-secret
# Setze als ENV-Var in Hosting-Tool + GitHub Secret
```

## 5. Verify-Commands

```bash
# 1. Endpoint-Auth-Pruefung
curl -X POST https://example.com/api/cron/data-retention -i
# Erwartung: 401 Unauthorized

curl -X POST https://example.com/api/cron/data-retention \
  -H "Authorization: Bearer wrong-token" -i
# Erwartung: 401

curl -X POST https://example.com/api/cron/data-retention \
  -H "Authorization: Bearer $CRON_SECRET" -i
# Erwartung: 200 mit deletedCount

# 2. Cron-Job laeuft tatsaechlich (Drift-Style-2-Check)
# Bei GitHub Actions: gh workflow view data-retention --json
# Bei Dokploy: SSH + crontab -l
```

## 6. Cross-Reference

- DSGVO Art. 5 lit. e: `gesetze/DSGVO/articles.md`
- Audit-Pattern Phase 4 DSE-Drift Style 2: `audit-patterns.md`
