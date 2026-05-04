<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: ctf-forensics
description: CTF forensics — file carving, steganography, pcap/network analysis, memory forensics, disk forensics, and metadata extraction using CLI tools in Kali Linux
---

# CTF Forensics

Forensics = extract hidden data from files, network captures, memory dumps, and disk images.

**Install:**
```
sudo apt-get install -y binwalk foremost exiftool steghide stegseek outguess file strings xxd hexdump tshark wireshark-common volatility3 pngcheck
pip install stegoveritas --break-system-packages
pip install oletools --break-system-packages
sudo apt-get install -y zsteg
# stegseek: wget https://github.com/RickdeJager/stegseek/releases/latest/download/stegseek_0.6-1.deb && dpkg -i stegseek*.deb
```

---

## File Analysis — First Steps

    # Always start here for any unknown file:
    file challenge.xxx           # True file type (ignore extension)
    xxd challenge.xxx | head -20 # Hex dump — check magic bytes
    strings -n 6 challenge.xxx  # Printable strings, min length 6
    exiftool challenge.xxx       # All metadata

    # Common magic bytes:
    # PNG:  89 50 4E 47 0D 0A 1A 0A
    # JPEG: FF D8 FF
    # ZIP:  50 4B 03 04
    # PDF:  25 50 44 46
    # ELF:  7F 45 4C 46
    # GIF:  47 49 46 38
    # RAR:  52 61 72 21
    # 7z:   37 7A BC AF

    # Check for embedded files:
    binwalk challenge.xxx                    # Show embedded files
    binwalk -e challenge.xxx                 # Extract all embedded files
    binwalk -D 'png image:png' challenge.xxx # Extract specific type only
    foremost -i challenge.xxx -o output/     # Alternative file carver

---

## Steganography

### Image Steganography

    # Check LSB steganography (most common):
    zsteg challenge.png           # PNG: check all LSB channels
    zsteg -a challenge.png        # All possible bitplanes

    # steghide — extract hidden data (JPEG/BMP):
    steghide info challenge.jpg            # Check if data embedded
    steghide extract -sf challenge.jpg     # Extract (will ask passphrase)
    steghide extract -sf challenge.jpg -p ""        # Try empty passphrase
    steghide extract -sf challenge.jpg -p "password" # Try password

    # stegseek — bruteforce steghide passphrase:
    stegseek challenge.jpg /usr/share/wordlists/rockyou.txt

    # outguess:
    outguess -r challenge.jpg output.txt

    # stegoveritas — comprehensive image steg analysis:
    stegoveritas challenge.png
    stegoveritas challenge.png -steghide -wordlist /usr/share/wordlists/rockyou.txt

    # pngcheck — PNG chunk analysis:
    pngcheck -v challenge.png

    # Check image pixels (Python):
    python3 -c "
    from PIL import Image
    img = Image.open('challenge.png')
    pixels = list(img.getdata())
    # Extract LSB of each pixel
    bits = [p[0] & 1 for p in pixels[:100]]
    print(bits)
    "

### Audio Steganography

    # Spectrogram analysis:
    sox challenge.wav -n spectrogram -o spec.png
    # Or: python3 -c "import scipy.io.wavfile as wav; import matplotlib.pyplot as plt; import numpy as np; r,d=wav.read('challenge.wav'); plt.specgram(d,Fs=r); plt.savefig('spec.png')"

    # LSB in WAV:
    python3 -c "
    import wave, struct
    f = wave.open('challenge.wav', 'r')
    frames = f.readframes(-1)
    samples = struct.unpack(f'<{len(frames)//2}h', frames)
    bits = [s & 1 for s in samples[:200]]
    chars = [chr(int(''.join(map(str, bits[i:i+8])), 2)) for i in range(0, len(bits)-8, 8)]
    print(''.join(chars))
    "

    # mp3stego: mp3stego-decode -X -P password challenge.mp3 output.txt

### Text Steganography

    # Check for whitespace encoding (SNOW):
    cat -A challenge.txt | grep '  '     # trailing spaces/tabs
    # stegsnow: sudo apt-get install -y stegsnow
    stegsnow -C challenge.txt

    # Unicode zero-width characters:
    python3 -c "
    text = open('challenge.txt', 'rb').read()
    hidden = [hex(b) for b in text if b in [0xe2, 0x80, 0x8b, 0x8c, 0x8d, 0xad]]
    print(hidden[:20])
    "

---

## Network / PCAP Analysis

    # Open PCAP:
    tshark -r challenge.pcap -V | head -50      # Verbose first packet
    tshark -r challenge.pcap -Y "http"          # Filter HTTP
    tshark -r challenge.pcap -Y "dns"           # Filter DNS

    # Extract HTTP objects (images, files):
    tshark -r challenge.pcap --export-objects http,output/http_files/
    tshark -r challenge.pcap --export-objects smb,output/smb_files/

    # Follow TCP stream (conversation):
    tshark -r challenge.pcap -Y "tcp.stream==0" -T fields -e data | xxd

    # Extract credentials from PCAP:
    tshark -r challenge.pcap -Y "http.request.method==POST" -T fields \
      -e http.host -e http.request.uri -e http.request.body

    # Find all DNS queries:
    tshark -r challenge.pcap -Y "dns.qry.name" -T fields -e dns.qry.name | sort -u

    # FTP/SMTP/Telnet credentials (cleartext):
    tshark -r challenge.pcap -Y "ftp" -T fields -e ftp.request.command -e ftp.request.arg
    strings challenge.pcap | grep -i "PASS\|USER\|AUTH\|login"

    # Extract all data from UDP streams (DNS tunneling):
    tshark -r challenge.pcap -Y "dns" -T fields -e dns.qry.name | sort -u

---

## Memory Forensics (Volatility 3)

    # Install: sudo apt-get install -y volatility3
    # OR: pip install volatility3 --break-system-packages

    # Identify OS profile first:
    vol -f memory.dmp windows.info          # Windows
    vol -f memory.dmp linux.bash            # Linux

    # Windows processes:
    vol -f memory.dmp windows.pslist        # Running processes
    vol -f memory.dmp windows.pstree        # Process tree
    vol -f memory.dmp windows.cmdline       # Command line per process
    vol -f memory.dmp windows.netscan       # Network connections

    # Dump process memory:
    vol -f memory.dmp windows.dumpfiles --pid <PID>
    vol -f memory.dmp windows.memmap --pid <PID> --dump

    # Extract credentials:
    vol -f memory.dmp windows.hashdump      # NTLM hashes from SAM
    vol -f memory.dmp windows.lsadump       # LSA secrets

    # Find files:
    vol -f memory.dmp windows.filescan | grep -i "flag\|secret\|password"

    # Registry hives:
    vol -f memory.dmp windows.registry.hivelist
    vol -f memory.dmp windows.registry.printkey --key "SOFTWARE\Microsoft\Windows\CurrentVersion\Run"

    # Strings in memory:
    strings memory.dmp | grep -i "flag{\|CTF{\|password\|secret" | head -30

---

## Disk Image Forensics

    # Mount disk image:
    file disk.img
    fdisk -l disk.img                        # Show partitions
    sudo mount -o loop,offset=$((512*2048)) disk.img /mnt/disk

    # Extract partition from image:
    dd if=disk.img of=partition.img bs=512 skip=2048 count=<sectors>

    # Recover deleted files:
    sudo apt-get install -y testdisk photorec
    photorec disk.img                        # GUI-less recovery
    testdisk disk.img                        # Partition/MBR recovery

    # Search for strings in raw image:
    strings disk.img | grep -i "flag\|pass\|secret\|CTF"
    grep -boa 'flag{' disk.img              # Binary search for flag pattern

---

## Archive / ZIP Analysis

    # Test ZIP password:
    zip2john challenge.zip > zip.hash
    john zip.hash --wordlist=/usr/share/wordlists/rockyou.txt

    # hashcat:
    zip2john challenge.zip | tee zip.hash
    hashcat -m 13600 zip.hash /usr/share/wordlists/rockyou.txt

    # Check ZIP structure:
    unzip -l challenge.zip             # List contents
    unzip -t challenge.zip             # Test integrity

    # Extract without password (known plaintext attack):
    # If you know one file in the ZIP → pkcrack
    sudo apt-get install -y pkcrack

---

## Office Document Forensics

    # Extract macros and embedded objects:
    # oletools: pip install oletools --break-system-packages
    oleid challenge.docx              # Check for macros, encryption
    olevba challenge.docx             # Extract VBA macros
    oleobj challenge.docx             # Extract embedded objects
    rtfobj challenge.rtf              # Extract from RTF

    # strings on office docs:
    strings challenge.docx | grep -i "flag\|pass\|http"

---

## Pro Tips

1. Always run `file` + `xxd | head` + `strings` + `exiftool` on every challenge file first
2. PNG → `zsteg -a` first; JPEG → `steghide` + `stegseek` brute force
3. PCAP → `--export-objects http` to get all transferred files; check DNS for tunneling
4. Memory dump → `windows.pslist` + `windows.cmdline` → suspicious processes first
5. ZIP with password → `zip2john` + john/hashcat with rockyou
6. Office docs → `olevba` to extract macros (often contains flag or dropper)
7. Look for "appended data" after EOF: `binwalk` or `cat file.jpg file2.zip`

## Summary

Forensics checklist: `file` → `binwalk -e` → `strings` → `exiftool` → steg tools (`zsteg`/`steghide`/`stegseek`) → PCAP (`tshark --export-objects`) → memory (`vol windows.pslist` + `hashdump`) → archives (`zip2john` + crack). Every file type has a specific toolchain — apply systematically.
