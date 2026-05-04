/**
 * Manifest integrity tests.
 *
 * Pins the current skill-count and per-category source-namespaces, and
 * verifies that every loaded skill has a well-formed id, category, source,
 * and relativePath. If a future commit drops a skill or renames a
 * directory, the mismatch surfaces here before the tag-push.
 */
import { describe, it, expect } from 'vitest';
import { loadAllSkills, resolveSkillsRoot } from '../src/skills-loader.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const EXPECTED_TOTAL = 203;

const EXPECTED_CATEGORIES = ['offensive', 'defensive', 'mitre-mapped', 'ops', 'compliance', 'foundation', 'osint'];

const EXPECTED_SOURCES_BY_CATEGORY: Record<string, string[]> = {
  offensive: ['snailsploit-fork', 'matty-fork', 'airecon-fork'],
  defensive: ['aegis-native'],
  'mitre-mapped': ['aegis-native'],
  ops: ['aegis-native'],
  compliance: ['aegis-native'],
  foundation: ['aegis-native'],
  osint: ['elementalsouls-fork'],
};

const EXPECTED_NAMES_BY_CATEGORY: Record<string, string[]> = {
  offensive: [
    'advanced-redteam',
    'ai-security',
    'basic-exploitation',
    'bug-identification',
    'cicd-redteam',
    'cloud-security',
    'container-escape',
    'crash-analysis',
    'deserialization',
    'edr-evasion',
    'exploit-dev-course',
    'exploit-development',
    'fast-checking',
    'file-upload',
    'fuzzing',
    'fuzzing-course',
    'graphql',
    'idor',
    'initial-access',
    'jwt',
    'keylogger-arch',
    'mitigations',
    'mobile-pentester',
    'oauth',
    'open-redirect',
    'osint',
    'osint-methodology',
    'parameter-pollution',
    'race-condition',
    'rce',
    'request-smuggling',
    'shellcode',
    'sqli',
    'ssrf',
    'ssti',
    'subdomain-takeover',
    'vuln-classes',
    'waf-bypass',
    'windows-boundaries',
    'windows-mitigations',
    'xss',
    'xxe',
    // airecon-fork (141 skills, F-AIRECON-FORK-1, 2026-05-04, pikpikcu/airecon@9a21453)
    'ctf-crypto',
    'ctf-crypto-modern-ciphers',
    'ctf-forensics',
    'ctf-forensics-network',
    'ctf-heap-advanced',
    'ctf-pwn',
    'ctf-pwn-rop-and-shellcode',
    'ctf-reversing',
    'frameworks-django',
    'frameworks-dotnet',
    'frameworks-express',
    'frameworks-fastapi',
    'frameworks-flask',
    'frameworks-laravel',
    'frameworks-nextjs',
    'frameworks-php',
    'frameworks-rails',
    'frameworks-spring',
    'frameworks-wordpress',
    'payloads-command-injection',
    'payloads-http-parameter-pollution',
    'payloads-ldap-injection',
    'payloads-lfi',
    'payloads-sqli',
    'payloads-ssrf',
    'payloads-ssti',
    'payloads-xss',
    'payloads-xxe',
    'postexploit-ad-credential-attacks',
    'postexploit-container-escape',
    'postexploit-credential-dumping',
    'postexploit-lateral-movement',
    'postexploit-linux-privesc',
    'postexploit-netexec-workflow',
    'postexploit-pivoting',
    'postexploit-windows-privesc',
    'protocols-active-directory',
    'protocols-dns',
    'protocols-ftp',
    'protocols-graphql',
    'protocols-kerberos',
    'protocols-ldap',
    'protocols-rdp',
    'protocols-smb',
    'protocols-smtp-imap',
    'protocols-snmp',
    'protocols-ssh',
    'reconnaissance-asn-whois-osint',
    'reconnaissance-ctf-methodology',
    'reconnaissance-dorking',
    'reconnaissance-exposed-devtools-detection',
    'reconnaissance-full-recon',
    'reconnaissance-internal-pentest',
    'reconnaissance-javascript-analysis',
    'reconnaissance-js-internal-hostname-intelligence',
    'reconnaissance-monitoring-secrets-exposure',
    'reconnaissance-shodan-censys',
    'reconnaissance-subdomain-enum',
    'technologies-cicd-attacks',
    'technologies-cloud-security',
    'technologies-docker-container',
    'technologies-elasticsearch',
    'technologies-firebase-firestore',
    'technologies-frida-hooking',
    'technologies-gitlab-github',
    'technologies-jenkins',
    'technologies-kubernetes-pentest',
    'technologies-memcached',
    'technologies-mobile-app-pentesting',
    'technologies-mongodb',
    'technologies-nginx-apache',
    'technologies-observability-stack-attacks',
    'technologies-redis',
    'technologies-supabase',
    'technologies-tomcat',
    'tools-advanced-fuzzing',
    'tools-browser-automation',
    'tools-caido',
    'tools-code-review',
    'tools-dalfox',
    'tools-hashcat-john',
    'tools-impacket',
    'tools-install',
    'tools-metasploit',
    'tools-nmap',
    'tools-nuclei',
    'tools-reporting',
    'tools-scripting',
    'tools-semgrep',
    'tools-source-audit',
    'tools-sqlmap',
    'tools-tool-catalog',
    'tools-wapiti',
    'vulnerabilities-2fa-bypass',
    'vulnerabilities-account-takeover',
    'vulnerabilities-api-schema-exposure',
    'vulnerabilities-api-testing',
    'vulnerabilities-auth-workflow',
    'vulnerabilities-authentication-jwt',
    'vulnerabilities-bfla',
    'vulnerabilities-blind-xss',
    'vulnerabilities-business-logic',
    'vulnerabilities-cors',
    'vulnerabilities-crlf-injection',
    'vulnerabilities-csrf',
    'vulnerabilities-csrf-advanced-bypass',
    'vulnerabilities-deserialization',
    'vulnerabilities-dom-based-vulnerabilities',
    'vulnerabilities-exploitation',
    'vulnerabilities-grpc',
    'vulnerabilities-host-header-injection',
    'vulnerabilities-http-smuggling',
    'vulnerabilities-idor',
    'vulnerabilities-information-disclosure',
    'vulnerabilities-insecure-file-uploads',
    'vulnerabilities-jwt-attacks',
    'vulnerabilities-kubernetes',
    'vulnerabilities-mass-assignment',
    'vulnerabilities-nosql-injection',
    'vulnerabilities-oauth-misconfig',
    'vulnerabilities-oauth-saml',
    'vulnerabilities-open-redirect',
    'vulnerabilities-password-reset-poisoning',
    'vulnerabilities-path-traversal',
    'vulnerabilities-privilege-escalation',
    'vulnerabilities-prototype-pollution',
    'vulnerabilities-race-conditions',
    'vulnerabilities-rce',
    'vulnerabilities-sensitive-file-pii-exposure',
    'vulnerabilities-spring4shell',
    'vulnerabilities-sql-injection',
    'vulnerabilities-ssrf',
    'vulnerabilities-ssti',
    'vulnerabilities-subdomain-takeover',
    'vulnerabilities-supply-chain',
    'vulnerabilities-unhandled-exception-differential',
    'vulnerabilities-waf-detection',
    'vulnerabilities-web-cache-poisoning',
    'vulnerabilities-websocket',
    'vulnerabilities-xss',
    'vulnerabilities-xxe',
  ],
  defensive: ['rls-defense', 'ssrf-defense', 'tenant-isolation-defense'],
  'mitre-mapped': ['mapping-overview', 't1078-valid-accounts', 't1190-exploit-public-app'],
  ops: ['escalation-runbook', 'suppress-correctly', 'triage-finding'],
  compliance: ['brutaler-anwalt'],
  foundation: [
    'aegis-audit',
    'aegis-customer-build',
    'aegis-handover-writer',
    'aegis-module-builder',
    'aegis-orchestrator',
    'aegis-quality-gates',
    'aegis-skill-creator',
    'dsgvo-compliance',
  ],
  osint: ['offensive-osint', 'osint-methodology'],
};

describe('manifest — current shape', () => {
  it('resolves skills root to an existing directory', () => {
    const root = resolveSkillsRoot();
    expect(existsSync(root)).toBe(true);
  });

  it(`loads exactly ${EXPECTED_TOTAL} skills`, () => {
    const skills = loadAllSkills();
    expect(skills.length).toBe(EXPECTED_TOTAL);
  });

  it('every skill has a non-empty id', () => {
    for (const skill of loadAllSkills()) {
      expect(skill.id.length).toBeGreaterThan(0);
    }
  });

  it('every skill id is unique', () => {
    const skills = loadAllSkills();
    const ids = skills.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every skill has a recognized category', () => {
    for (const skill of loadAllSkills()) {
      expect(EXPECTED_CATEGORIES).toContain(skill.category);
    }
  });

  it('every skill has a recognized source for its category', () => {
    for (const skill of loadAllSkills()) {
      const allowedSources = EXPECTED_SOURCES_BY_CATEGORY[skill.category];
      expect(allowedSources).toBeDefined();
      expect(allowedSources).toContain(skill.source);
    }
  });

  it('every skill name matches kebab-case pattern', () => {
    for (const skill of loadAllSkills()) {
      expect(skill.name).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it('every skill absolutePath exists on disk', () => {
    for (const skill of loadAllSkills()) {
      expect(existsSync(skill.absolutePath)).toBe(true);
    }
  });

  it('every skill relativePath is under the resolved skills root', () => {
    const root = resolveSkillsRoot();
    for (const skill of loadAllSkills()) {
      expect(existsSync(join(root, skill.relativePath))).toBe(true);
    }
  });

  it('every skill id prefixes with category-source-', () => {
    for (const skill of loadAllSkills()) {
      expect(skill.id.startsWith(`${skill.category}-${skill.source}-`)).toBe(true);
    }
  });
});

describe('manifest — per-category skill-name coverage', () => {
  for (const category of EXPECTED_CATEGORIES) {
    it(`${category} catalog contains every expected skill name`, () => {
      const actual = loadAllSkills()
        .filter((s) => s.category === category)
        .map((s) => s.name)
        .sort();
      const expected = [...EXPECTED_NAMES_BY_CATEGORY[category]].sort();
      expect(actual).toEqual(expected);
    });
  }

  it('does not contain a patch-diffing skill (upstream README-only, absent on disk)', () => {
    const names = loadAllSkills().map((s) => s.name);
    expect(names).not.toContain('patch-diffing');
  });
});
