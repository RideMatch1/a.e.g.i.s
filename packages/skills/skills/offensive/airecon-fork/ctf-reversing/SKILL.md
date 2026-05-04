<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: ctf-reversing
description: CTF reverse engineering — static analysis with radare2/objdump, dynamic analysis with GDB/ltrace/strace, anti-debug bypass, patching, and decompilation without GUI tools
---

# CTF Reverse Engineering

RE = understand what a binary does → find the flag check → extract or bypass it. All CLI tools, no Ghidra required.

## AIRecon Docker Constraints (Headless Only)

- Engine runs in Docker CLI context; do not rely on GUI workflows.
- Do NOT use GUI tools such as Ghidra UI, IDA UI, Binary Ninja UI, Cutter, or x64dbg.
- Use headless CLI flow only: `file`, `checksec`, `strings`, `readelf`, `objdump`, `radare2`, `gdb`, `ltrace`, `strace`.
- For decompilation in headless mode, prefer:
  - `r2 -A -q -c "pdg @ main" ./challenge`
  - batch-style extraction and save output into `output/` files for later reasoning.
- In AIRecon, always execute via tool calls (`execute`, `read_file`, `create_file`) and persist every important artifact.

**Install:**
```
sudo apt-get install -y radare2 gdb ltrace strace binutils file strings xxd patchelf
pip install pyinstxtractor --break-system-packages
sudo apt-get install -y upx-ucl
# r2ghidra (decompiler plugin for radare2):
r2pm -ci r2ghidra
# RetDec (decompiler):
pip install retdec-python --break-system-packages
```

---

## Initial Analysis

    # File type and architecture:
    file ./challenge
    # ELF 64-bit LSB executable, x86-64 / ARM / MIPS
    # PE32+ executable (Windows in Wine/Docker)

    # Security protections:
    checksec --file=./challenge

    # Strings — often reveals flag format or hints:
    strings ./challenge | grep -i "flag\|CTF\|correct\|wrong\|password\|key"
    strings -n 4 ./challenge | head -50

    # Hex dump — check structure:
    xxd ./challenge | head -30

    # Dynamic library dependencies:
    ldd ./challenge
    readelf -d ./challenge | grep NEEDED

---

## Static Analysis — objdump

    # Disassemble all functions:
    objdump -d ./challenge | less

    # Disassemble specific function:
    objdump -d ./challenge | grep -A50 "<main>:"
    objdump -d ./challenge | grep -A50 "<check_flag>:"

    # Show all symbols:
    nm ./challenge
    nm -D ./challenge    # dynamic symbols

    # Show all sections:
    readelf -S ./challenge

    # Extract .rodata (read-only data — often contains strings, flags):
    objdump -s -j .rodata ./challenge

    # Show PLT/GOT (imported functions):
    objdump -d -j .plt ./challenge

---

## Static Analysis — radare2

    r2 ./challenge       # Open (analysis not automatic)
    r2 -A ./challenge    # Open + auto-analyze (slow but thorough)

    # Inside r2 shell:
    aaa              # Analyze all (functions, xrefs, strings)
    afl              # List all functions
    afl | grep main  # Find main
    s main           # Seek to main
    pdf              # Print disassembly of current function
    pdf @ sym.check_flag    # Disassemble specific function
    px 64 @ 0x4020a0        # Hex dump 64 bytes at address
    ps @ 0x4020a0           # Print string at address
    iz               # List all strings in binary
    axt @ 0x4020a0   # Find cross-references TO address
    VV               # Visual mode (graph view — navigate with arrows)
    q                # Quit

    # Decompile with r2ghidra plugin:
    r2 -A ./challenge
    pdg @ main          # Decompile main (r2ghidra)
    pdgd @ sym.check    # Decompile check function

    # One-liner: decompile main and quit:
    r2 -A -q -c "pdg @ main" ./challenge 2>/dev/null

---

## Dynamic Analysis — ltrace / strace

    # ltrace: intercept library calls (strcmp, strcpy, strlen, etc.)
    ltrace ./challenge
    ltrace -s 200 ./challenge   # Show strings up to 200 chars

    # Very common CTF pattern — strcmp with flag:
    ltrace ./challenge <<< "test_input"
    # Output: strcmp("test_input", "CTF{real_flag_here}") = -1
    # → flag is the second argument to strcmp!

    # strace: trace system calls (read, write, open, execve)
    strace ./challenge
    strace -e trace=read,write ./challenge    # Only read/write syscalls

    # Trace file access:
    strace -e trace=open,openat,read ./challenge 2>&1 | grep -v "/lib\|/proc\|/dev"

---

## Dynamic Analysis — GDB

    gdb ./challenge

    # Set Intel syntax (cleaner):
    set disassembly-flavor intel

    # Basic flow:
    break main
    run
    next         # Next source line
    nexti        # Next instruction
    stepi        # Step into call
    continue
    finish       # Run to end of current function

    # Examine memory:
    x/s 0x<address>        # String at address
    x/10wx $rsp            # 10 words at RSP
    x/20i $rip             # 20 instructions at RIP

    # Patch return value (bypass check):
    break *0x<check_function_end>
    run
    set $rax = 1            # Force return value to 1 (true)
    continue

    # Patch byte in memory:
    set *(unsigned char*)0x<address> = 0x90   # NOP

    # Read register:
    info registers
    p $rax
    p/x $rbx

    # Set breakpoint on strcmp (catch flag comparison):
    break strcmp
    run <<< "AAAA"
    # When stopped: x/s $rdi, x/s $rsi  → see both arguments

---

## Patching Binaries

    # Patch a jump instruction to bypass check:
    # Find instruction address: objdump -d ./challenge | grep "je\|jne\|jz\|jnz"
    # Change je (0x74) to jmp (0xeb), or jne (0x75) to nop (0x90 0x90)

    # Using radare2 (write mode):
    r2 -w ./challenge
    s 0x<address_of_jump>
    wa nop nop      # Write 2 NOPs
    wa jmp 0x<target>   # Write unconditional jump
    q

    # Using python/xxd:
    python3 -c "
    data = open('./challenge', 'rb').read()
    # Change byte at offset 0x1234 from 0x75 (jne) to 0xeb (jmp)
    data = data[:0x1234] + b'\xeb' + data[0x1235:]
    open('./challenge_patched', 'wb').write(data)
    "
    chmod +x ./challenge_patched

---

## Packed / Obfuscated Binaries

    # Detect packer:
    file ./challenge       # "UPX compressed" visible
    strings ./challenge | grep -i "upx\|packer\|packed"

    # UPX unpack:
    upx -d ./challenge -o ./challenge_unpacked

    # Generic unpack via memory dump in GDB:
    # Run packed binary → let it unpack in memory → dump process memory
    gdb ./challenge
    run
    # After unpacking (usually at OEP), dump:
    generate-core-file    # Creates core dump

---

## Python / Script Binaries

    # Python compiled (.pyc):
    python3 -m dis challenge.pyc           # Disassemble bytecode
    uncompyle6 challenge.pyc               # Decompile to source
    # sudo apt-get install -y python3-uncompyle6  OR  pip install uncompyle6

    # PyInstaller frozen executable:
    python3 -m pyinstxtractor challenge   # Extract .pyc files
    # Then: uncompyle6 challenge.pyc

    # Java .class / .jar:
    javap -c challenge.class              # Disassemble
    # cfr decompiler: java -jar cfr.jar challenge.jar

---

## Common CTF RE Patterns

    # Pattern 1: strcmp flag check
    ltrace ./challenge <<< "test" 2>&1 | grep strcmp
    # → get the expected string directly

    # Pattern 2: XOR obfuscation
    python3 -c "
    encrypted = [0x42, 0x6c, 0x61, 0x68]  # from strings/radare2
    key = 0x13
    flag = ''.join(chr(b ^ key) for b in encrypted)
    print(flag)
    "

    # Pattern 3: Check character by character (timing/branch)
    # Use GDB to step through comparison loop, read expected chars one by one

    # Pattern 4: Anti-debug (ptrace check)
    strace ./challenge 2>&1 | grep ptrace   # Detects ptrace call
    # Bypass: patch the ptrace call or its check:
    # Find in objdump: call ptrace → NOP or force return 0

    # Pattern 5: Multiple flag characters combined
    # Binary builds flag character by character in loop → set breakpoints in loop

---

## Windows Binaries (PE) in Docker

    # Run with Wine:
    sudo apt-get install -y wine
    wine ./challenge.exe

    # Static analysis:
    strings ./challenge.exe | grep -i "flag\|correct\|wrong"
    # PE tools:
    python3 -m pefile challenge.exe   # OR: pip install pefile

---

## Pro Tips

1. **Always run `ltrace` first** — catches strcmp/memcmp comparisons which immediately reveal flags
2. `strings | grep -i "flag\|correct\|wrong"` — many easy RE challenges embed flag directly
3. `r2 -A -q -c "pdg @ main"` — decompile main in one command via r2ghidra
4. GDB `break strcmp; run` → `x/s $rdi` `x/s $rsi` catches every string comparison
5. UPX packed? `upx -d` immediately, then analyze the clean binary
6. Anti-debug → `strace` to find `ptrace` call → patch the check with radare2 write mode
7. Python frozen executables → `pyinstxtractor` → `uncompyle6` to get source code

## Summary

RE flow: `file` → `strings | grep flag` → `ltrace ./challenge` (catches strcmp) → `strace` (catches file/network ops) → `r2 -A` + `pdg` (decompile) → `gdb` for dynamic patching. Most CTF RE is: find the comparison, extract or satisfy the expected value. Use `ltrace` — it's the fastest path to the flag in 80% of challenges.
