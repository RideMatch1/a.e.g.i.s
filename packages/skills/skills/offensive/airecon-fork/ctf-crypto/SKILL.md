<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: ctf-crypto
description: CTF cryptography challenges — RSA attacks, AES weaknesses, padding oracle, hash cracking, XOR, elliptic curves, and classical ciphers with Python pycryptodome and CLI tools
---

# CTF Cryptography

Crypto challenges = find the mathematical weakness, not brute force. Identify the cipher → find the specific attack → implement in Python.

**Install:**
```
pip install pycryptodome --break-system-packages
pip install gmpy2 --break-system-packages
pip install sympy --break-system-packages
sudo apt-get install -y python3-pwntools
```

---

## RSA Attacks

### Small Public Exponent (e=3) — Cube Root Attack

    # If e=3 and m^3 < n, ciphertext is just m^3 with no modular reduction:
    python3 -c "
    import gmpy2
    n = <n>
    e = 3
    c = <ciphertext>
    m, exact = gmpy2.iroot(c, e)
    if exact:
        print(bytes.fromhex(hex(m)[2:]))
    "

### Fermat Factorization (p and q close together)

    python3 -c "
    import gmpy2, math
    n = <n>
    a = gmpy2.isqrt(n) + 1
    while True:
        b2 = a*a - n
        b, exact = gmpy2.isqrt_rem(b2)
        if exact == 0:
            p, q = a - b, a + b
            print(f'p={p}\nq={q}')
            break
        a += 1
    "

### Common Modulus Attack (same n, different e, same plaintext)

    # Two ciphertexts: c1=m^e1 mod n, c2=m^e2 mod n — recover m with extended gcd:
    python3 -c "
    from math import gcd
    def egcd(a, b):
        if a == 0: return b, 0, 1
        g, x, y = egcd(b % a, a)
        return g, y - (b // a) * x, x
    n, e1, e2, c1, c2 = <n>, <e1>, <e2>, <c1>, <c2>
    g, s, t = egcd(e1, e2)
    if s < 0: c1 = pow(c1, -1, n); s = -s
    if t < 0: c2 = pow(c2, -1, n); t = -t
    m = (pow(c1, s, n) * pow(c2, t, n)) % n
    print(bytes.fromhex(hex(m)[2:]))
    "

### RSA-CTFTool (automated)

    # Install: git clone https://github.com/RsaCtfTool/RsaCtfTool /home/pentester/tools/RsaCtfTool
    #          pip install -r /home/pentester/tools/RsaCtfTool/requirements.txt --break-system-packages
    python3 /home/pentester/tools/RsaCtfTool/RsaCtfTool.py --publickey key.pem --uncipherfile cipher.txt
    python3 /home/pentester/tools/RsaCtfTool/RsaCtfTool.py -n <n> -e <e> --uncipher <c> --attack all

### Wiener's Attack (large d, small d)

    python3 /home/pentester/tools/RsaCtfTool/RsaCtfTool.py -n <n> -e <e> --uncipher <c> --attack wiener

### Low Public Exponent Broadcast (Hastad) — same e, different n

    # 3 ciphertexts with e=3, different n: use CRT to recover m^3, then cube root
    python3 -c "
    from sympy.ntheory.modular import crt
    ns = [<n1>, <n2>, <n3>]
    cs = [<c1>, <c2>, <c3>]
    import gmpy2
    N = 1
    for n in ns: N *= n
    x = 0
    for ni, ci in zip(ns, cs):
        Ni = N // ni
        x += ci * Ni * pow(Ni, -1, ni)
    m, _ = gmpy2.iroot(x % N, 3)
    print(bytes.fromhex(hex(m)[2:]))
    "

---

## AES Attacks

### ECB Mode — Block Duplication / Chosen Plaintext

    # ECB encrypts each 16-byte block independently — same plaintext = same ciphertext
    # Attack: send controlled input, observe identical blocks → detect ECB
    python3 -c "
    # If you can encrypt arbitrary data:
    # Send: 'A'*32 → if blocks 1 and 2 are identical → ECB mode confirmed
    # Then: use block alignment to reveal one byte at a time
    payload = b'A' * 48   # 3 full blocks, causes alignment
    print(payload.hex())
    "

### Padding Oracle Attack (CBC)

    # Requires: oracle that distinguishes valid vs invalid padding
    # Tool: padbuster or python3 script
    # Install: sudo apt-get install -y padbuster
    padbuster http://target.com/decrypt <ciphertext_hex> 8 -encoding 0 -cookies "session=<session>"

    # Python — manual padding oracle:
    # See scripting.md for padding oracle template

### CBC Bit Flipping

    # Flip bit in ciphertext block i → flips corresponding bit in plaintext block i+1
    # Requires: known plaintext position, target plaintext position
    python3 -c "
    ct = bytearray(bytes.fromhex('<ciphertext>'))
    offset = <block_offset * 16 + byte_offset>
    current_byte = ord('<current_plaintext_char>')
    target_byte = ord('<desired_plaintext_char>')
    ct[offset] ^= current_byte ^ target_byte
    print(ct.hex())
    "

---

## Hash Attacks

### Hash Identification

    hash-identifier '<hash>'
    hashid '<hash>'
    python3 -c "
    h = '<hash>'
    lens = {32:'MD5',40:'SHA1',56:'SHA224',64:'SHA256',96:'SHA384',128:'SHA512'}
    print(lens.get(len(h), 'unknown'))
    "

### Hash Length Extension Attack

    # SHA1/MD2/SHA256/SHA512 with secret-prefix MACs are vulnerable
    # hashpump: sudo apt-get install -y hashpump
    hashpump -s '<known_signature>' -d '<known_data>' -a '<data_to_append>' -k <key_length>

    # hash_extender: git clone https://github.com/iagox86/hash_extender /home/pentester/tools/hash_extender
    /home/pentester/tools/hash_extender/hash_extender -d '<data>' -s '<signature>' -a '<append>' -l <keylen> --format sha256

---

## XOR Cipher

    # Single-byte XOR — brute force all 256 keys:
    python3 -c "
    ct = bytes.fromhex('<ciphertext>')
    for k in range(256):
        pt = bytes(b ^ k for b in ct)
        if all(32 <= c < 127 for c in pt):
            print(f'Key {k}: {pt}')
    "

    # Repeating key XOR — find key length via index of coincidence:
    python3 -c "
    import itertools
    ct = bytes.fromhex('<ciphertext>')
    def ic(data):
        freq = {}
        for b in data: freq[b] = freq.get(b, 0) + 1
        n = len(data)
        return sum(f*(f-1) for f in freq.values()) / (n*(n-1)) if n > 1 else 0

    for klen in range(1, 40):
        blocks = [ct[i::klen] for i in range(klen)]
        score = sum(ic(b) for b in blocks) / klen
        print(f'KeyLen {klen}: IC={score:.4f}')  # English IC ~0.065
    "

---

## Classical Ciphers

    # Caesar / ROT:
    python3 -c "
    ct = '<ciphertext>'
    for shift in range(26):
        pt = ''.join(chr((ord(c)-ord('A')+shift)%26+ord('A')) if c.isupper()
                     else chr((ord(c)-ord('a')+shift)%26+ord('a')) if c.islower()
                     else c for c in ct)
        print(f'{shift}: {pt}')
    "

    # Online tools via web_search:
    web_search("quipqiup substitution cipher solver")
    web_search("dcode.fr vigenere decoder")

    # CyberChef via web_search: search "cyberchef magic" for auto-detect

---

## Base Encoding Detection

    # Auto-detect encoding:
    python3 -c "
    import base64, binascii
    s = '<string>'
    try: print('base64:', base64.b64decode(s))
    except: pass
    try: print('base32:', base64.b32decode(s))
    except: pass
    try: print('hex:', bytes.fromhex(s))
    except: pass
    try: print('base58:', ...)  # pip install base58
    except: pass
    "

    # CyberChef magic (finds encoding automatically) → use via web_search or local install

---

## Elliptic Curve (EC) Attacks

    # Invalid curve attack, small subgroup attack — check curve parameters vs standards
    # SageMath for ECDLP: sudo apt-get install -y sagemath
    sage -c "
    p = <prime>
    a, b = <a>, <b>
    E = EllipticCurve(GF(p), [a, b])
    G = E(<Gx>, <Gy>)
    Q = E(<Qx>, <Qy>)
    print(discrete_log(Q, G, operation='+'))
    "

---

## Pro Tips

1. Always check RSA: n, e, c values — run RsaCtfTool `--attack all` first
2. ECB mode confirmed by sending 48 bytes of 'A' — if 2 blocks identical = ECB
3. Hash length extension: any `HMAC(secret || message)` with SHA family is vulnerable
4. XOR key length: IC closest to 0.065 = English key length
5. `hashid` or `hash-identifier` before any cracking — don't guess hash type
6. CyberChef "magic" function auto-detects and decodes most CTF encoding chains

## Summary

CTF crypto = identify algorithm → find mathematical weakness → implement targeted attack.
RSA: try RsaCtfTool --attack all first. AES-ECB: block duplication. AES-CBC: padding oracle or bit flip.
XOR: index of coincidence for key length. Hash: length extension for secret-prefix MACs.
