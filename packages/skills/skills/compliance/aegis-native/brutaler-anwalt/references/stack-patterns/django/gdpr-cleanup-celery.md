---
license: MIT (snippet)
provider: Django + Celery + Celery-Beat (Open-Source)
last-checked: 2026-05-05
purpose: Celery-Beat-Cron Pattern fuer DSGVO-Loeschpflichten + Anonymisierung in Django.
---

# Django + Celery — GDPR-Cleanup-Cron

## Trigger / Detection

Repo enthaelt:
- `celery` in `requirements.txt`
- `app/celery.py` mit `celery -A app worker`
- `app/tasks.py` mit `@shared_task` Decorators
- `django-celery-beat` Package mit `PeriodicTask` Models
- Optional: `flower` fuer Monitoring

## Default-Verhalten (was passiert ohne Konfiguration)

- Account-Loeschung synchron im View → Timeout-Risiko
- Soft-Deletes haeufen sich → DSGVO-Drift
- Search-Index nicht synchronisiert mit DB-Loeschung
- Celery-Logs enthalten Klartext-Task-Args mit PII
- Task-Failures unbemerkt → Cron-Reliability fragil

## Compliance-Risiken

| Risiko | Norm | Severity | Fix |
|---|---|---|---|
| Hard-Delete-Cron fehlt | Art. 5 lit. e DSGVO | KRITISCH | Celery-Beat taeglich um 3 Uhr UTC |
| Celery-Args mit User-Email leakt in Logs | Art. 5 lit. f | HOCH | Nur User-ID als Arg, Lookup im Worker |
| Search-Index ueberlebt User-Delete | Art. 17 DSGVO | KRITISCH | Worker triggert Index-Removal |
| Task-Failure unbemerkt | Art. 5 Abs. 2 | HOCH | Sentry-Integration + DLQ |
| Backup-Files ohne Rotation | Art. 5 lit. e | HOCH | Provider-Policy + Doku |

## Code-Pattern (sanitized)

```python
# File: app/celery.py
import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'app.settings')

app = Celery('app')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

app.conf.beat_schedule = {
    'gdpr-hard-delete-daily': {
        'task': 'app.tasks.gdpr_hard_delete',
        'schedule': crontab(hour=3, minute=0),  # taeglich 3 Uhr UTC
    },
    'gdpr-inactive-cleanup-weekly': {
        'task': 'app.tasks.gdpr_inactive_user_cleanup',
        'schedule': crontab(hour=4, minute=0, day_of_week=0),  # Sonntag 4 Uhr
    },
    'analytics-events-cleanup-daily': {
        'task': 'app.tasks.analytics_events_cleanup',
        'schedule': crontab(hour=5, minute=0),
    },
    'consent-log-rotation-weekly': {
        'task': 'app.tasks.consent_log_rotation',
        'schedule': crontab(hour=6, minute=0, day_of_week=0),
    },
}
```

```python
# File: app/tasks.py
import logging
from datetime import timedelta
from celery import shared_task
from django.utils import timezone
from django.db import transaction

from app.models import User, ConsentLog, AnalyticsEvent, CronRun

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=300)
def gdpr_anonymize_user(self, user_id: int, reason: str = ''):
    try:
        user = User.objects.select_for_update().get(pk=user_id)
    except User.DoesNotExist:
        logger.warning('user-not-found-for-anonymization', extra={'user_id': user_id})
        return

    with transaction.atomic():
        # 1. PII anonymisieren
        user.email = f'deleted-{user.id}@<placeholder-domain>'
        user.first_name = 'GELOESCHT'
        user.last_name = ''
        user.phone = None
        user.deleted_at = timezone.now()
        user.deletion_reason = reason or None
        user.save(update_fields=[
            'email', 'first_name', 'last_name', 'phone', 'deleted_at', 'deletion_reason'
        ])

        # 2. Search-Index removal (z.B. Algolia / Meilisearch)
        try:
            from app.search import remove_user_from_index
            remove_user_from_index(user.id)
        except Exception as e:
            logger.warning('search-index-removal-failed', extra={'user_id': user_id, 'error': str(e)})

        # 3. Cascade-Anonymisierung
        from app.models import Comment, Upload
        Comment.objects.filter(author=user).update(author_name='GELOESCHT')
        for upload in Upload.objects.filter(owner=user):
            upload.purge()

    logger.info('user-anonymized', extra={'user_id': user_id})


@shared_task(bind=True, max_retries=3)
def gdpr_hard_delete(self):
    cutoff = timezone.now() - timedelta(days=30)
    deleted_count = 0

    try:
        with transaction.atomic():
            users = User.objects.filter(deleted_at__lt=cutoff).select_for_update()
            for user in users:
                # Cascade-Loeschung
                user.useraudit_logs.all().delete()
                user.comments.all().delete()
                user.uploads.all().delete()  # mit storage-cleanup
                user.delete()  # endgueltig
                deleted_count += 1

        CronRun.objects.create(
            job_name='gdpr-hard-delete',
            finished_at=timezone.now(),
            status='success',
            metadata={'deleted_count': deleted_count},
        )
        logger.info('gdpr-hard-delete-complete', extra={'deleted_count': deleted_count})

    except Exception as exc:
        CronRun.objects.create(
            job_name='gdpr-hard-delete',
            finished_at=timezone.now(),
            status='failed',
            metadata={'error': str(exc)},
        )
        raise self.retry(exc=exc)


@shared_task
def gdpr_inactive_user_cleanup():
    cutoff = timezone.now() - timedelta(days=730)  # 2 Jahre
    warning_cutoff = timezone.now() - timedelta(days=30)

    # Stufe 1: Warning an inaktive User die noch keine Warnung erhielten
    for user in User.objects.filter(
        last_login__lt=cutoff,
        deleted_at__isnull=True,
        inactivity_warning_sent_at__isnull=True,
    )[:1000]:
        from app.mail import send_inactivity_warning
        send_inactivity_warning(user)
        user.inactivity_warning_sent_at = timezone.now()
        user.save(update_fields=['inactivity_warning_sent_at'])

    # Stufe 2: User die gewarnt + immer noch inaktiv
    for user in User.objects.filter(
        last_login__lt=cutoff,
        deleted_at__isnull=True,
        inactivity_warning_sent_at__lt=warning_cutoff,
    )[:1000]:
        gdpr_anonymize_user.delay(user.id, reason='inactivity_2_years')


@shared_task
def analytics_events_cleanup():
    cutoff = timezone.now() - timedelta(days=90)
    deleted, _ = AnalyticsEvent.objects.filter(timestamp__lt=cutoff).delete()
    logger.info('analytics-events-deleted', extra={'count': deleted})


@shared_task
def consent_log_rotation():
    cutoff = timezone.now() - timedelta(days=6 * 365)  # 6 Jahre
    deleted, _ = ConsentLog.objects.filter(timestamp__lt=cutoff).delete()
    logger.info('consent-logs-rotated', extra={'count': deleted})
```

```python
# File: app/views/gdpr.py
from django.contrib.auth.decorators import login_required
from django.contrib.auth import logout
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_protect

from app.tasks import gdpr_anonymize_user


@require_POST
@login_required
@csrf_protect
def delete_account(request):
    import json
    body = json.loads(request.body or '{}')
    reason = (body.get('reason') or '')[:500]

    user_id = request.user.id

    # Synchron: nur Soft-Delete
    request.user.deleted_at = timezone.now()
    request.user.deletion_reason = reason or None
    request.user.save(update_fields=['deleted_at', 'deletion_reason'])

    # Async: Anonymisierung
    gdpr_anonymize_user.delay(user_id, reason)

    logout(request)

    return JsonResponse({
        'status': 'PENDING_HARD_DELETE',
        'soft_deleted_at': timezone.now().isoformat(),
        'hard_delete_scheduled': '30 Tage',
    }, status=202)
```

```python
# File: app/models/cron_run.py
from django.db import models


class CronRun(models.Model):
    job_name = models.CharField(max_length=100, db_index=True)
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField()
    status = models.CharField(max_length=16, choices=[('success', 'success'), ('failed', 'failed')])
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        indexes = [models.Index(fields=['job_name', 'started_at'])]
```

```python
# File: app/views/health.py
from datetime import timedelta
from django.http import JsonResponse
from django.utils import timezone

from app.models import CronRun


def cron_health(request):
    last_24h = timezone.now() - timedelta(hours=24)

    expected_jobs = ['gdpr-hard-delete', 'analytics-events-cleanup']
    recent_runs = list(CronRun.objects.filter(started_at__gt=last_24h).order_by('-started_at'))
    failed = [r for r in recent_runs if r.status == 'failed']
    missing = [
        j for j in expected_jobs
        if not any(r.job_name == j and r.status == 'success' for r in recent_runs)
    ]

    return JsonResponse({
        'healthy': not failed and not missing,
        'recent_runs': len(recent_runs),
        'failed_runs': len(failed),
        'missing_jobs': missing,
    })
```

## AVV / DPA

- Datenbank — Hard-Delete-Wirksamkeit
- Celery-Broker (Redis Cloud EU / Upstash) — AVV
- Search-Provider (Algolia EU / Meilisearch self-host) — AVV
- Mailer fuer Warning-Mails — AVV
- Sentry/APM (sofern integriert) — AVV mit PII-Scrubbing

## DSE-Wording-Vorlage

```markdown
### Loeschverfahren und Inaktivitaets-Cleanup

**Bei Loesch-Antrag (manuell):**

| Stufe | Zeitpunkt | Aktion |
|---|---|---|
| 1 | sofort | Account deaktiviert, Logout |
| 2 | < 60 Sekunden (asynchron) | PII anonymisiert, Search-Index entfernt |
| 3 | nach 30 Tagen | Endgueltige DB-Loeschung |

**Bei Inaktivitaet (automatisch):**

| Stufe | Zeitpunkt | Aktion |
|---|---|---|
| 1 | nach 2 Jahren ohne Login | Warning-Mail |
| 2 | 30 Tage nach Warning | Account-Anonymisierung |
| 3 | 30 Tage nach Anonymisierung | Hard-Delete |

**Rechtsgrundlage:** Art. 5 lit. e DSGVO (Speicherbegrenzung), Art. 17 DSGVO.
```

## Verify-Commands (Live-Probe)

```bash
# 1. Cron-Health-Endpoint
curl https://<placeholder-domain>/health/cron
# Erwartung: { "healthy": true, "missing_jobs": [] }

# 2. Celery-Worker-Health (Flower)
curl https://<placeholder-domain>/flower/api/workers
# Erwartung: aktive Worker sichtbar

# 3. Anonymize-Task manuell triggern
python manage.py shell
# >>> from app.tasks import gdpr_anonymize_user
# >>> gdpr_anonymize_user.delay(<test-user-id>, 'manual-test')

# 4. Logs ohne PII
tail -100 /var/log/celery/worker.log | grep -E '[\w.+-]+@[\w-]+\.[\w-]+' | head -5
# Erwartung: 0 Treffer

# 5. Hard-Delete nach 30 Tagen
# DB: SELECT COUNT(*) FROM users WHERE deleted_at < now() - interval '30 days';
# Erwartung: 0
```

## Cross-References

- AEGIS-Scanner: `data-retention-checker.ts`, `cron-coverage-checker.ts`, `pii-anonymization-checker.ts`
- Skill-Reference: `references/dsgvo.md` Art. 17, Art. 5 lit. e
- BGH-Rechtsprechung: `references/bgh-urteile.md`
- EuGH: `references/eu-eugh-dsgvo-schadensersatz.md` (Loesch-Anspruch)
- Audit-Pattern: `references/audit-patterns.md` Phase 4 (DSE-Drift / Cron-Coverage)
