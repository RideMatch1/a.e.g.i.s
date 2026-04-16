import { authEnforcerScanner } from './quality/auth-enforcer.js';
import { cookieCheckerScanner } from './quality/cookie-checker.js';
import { loggingCheckerScanner } from './quality/logging-checker.js';
import { jwtCheckerScanner } from './quality/jwt-checker.js';
import { depConfusionCheckerScanner } from './dependencies/dep-confusion.js';
import { ssrfCheckerScanner } from './quality/ssrf-checker.js';
import { cryptoAuditorScanner } from './quality/crypto-auditor.js';
import { configAuditorScanner } from './quality/config-auditor.js';
import { consoleCheckerScanner } from './quality/console-checker.js';
import { i18nQualityScanner } from './quality/i18n-quality.js';
import { headerCheckerScanner } from './quality/header-checker.js';
import { zodEnforcerScanner } from './quality/zod-enforcer.js';
import { rateLimitCheckerScanner } from './quality/rate-limit-checker.js';
import { entropyScanner } from './quality/entropy-scanner.js';
import { paginationCheckerScanner } from './quality/pagination-checker.js';
import { timingSafeCheckerScanner } from './quality/timing-safe-checker.js';
import { uploadValidatorScanner } from './quality/upload-validator.js';
import { errorLeakageCheckerScanner } from './quality/error-leakage-checker.js';
import { corsCheckerScanner } from './quality/cors-checker.js';
import { envValidationCheckerScanner } from './quality/env-validation-checker.js';
import { httpTimeoutCheckerScanner } from './quality/http-timeout-checker.js';
import { massAssignmentCheckerScanner } from './quality/mass-assignment-checker.js';
import { csrfCheckerScanner } from './quality/csrf-checker.js';
import { openRedirectCheckerScanner } from './quality/open-redirect-checker.js';
import { sqlConcatCheckerScanner } from './quality/sql-concat-checker.js';
import { xssCheckerScanner } from './quality/xss-checker.js';
import { tenantIsolationCheckerScanner } from './quality/tenant-isolation-checker.js';
import { pathTraversalCheckerScanner } from './quality/path-traversal-checker.js';
import { promptInjectionCheckerScanner } from './quality/prompt-injection-checker.js';
import { redosCheckerScanner } from './quality/redos-checker.js';
import { rscDataCheckerScanner } from './quality/rsc-data-checker.js';
import { rlsBypassCheckerScanner } from './quality/rls-bypass-checker.js';
import { gdprEngineScanner } from './compliance/gdpr-engine.js';
import { soc2CheckerScanner } from './compliance/soc2.js';
import { iso27001CheckerScanner } from './compliance/iso27001.js';
import { pciDssCheckerScanner } from './compliance/pci-dss.js';
import { bearerScanner } from './sast/bearer.js';
import { semgrepScanner } from './sast/semgrep.js';
import { checkovScanner } from './infrastructure/checkov.js';
import { axeLighthouseScanner } from './accessibility/axe-lighthouse.js';
import { lighthousePerformanceScanner } from './performance/lighthouse.js';
import { gitleaksScanner } from './secrets/gitleaks.js';
import { npmAuditScanner } from './dependencies/npm-audit.js';
import { osvScannerScanner } from './dependencies/osv-scanner.js';
import { licenseCheckerScanner } from './dependencies/license-checker.js';
import { reactDoctorScanner } from './react/react-doctor.js';
import { nucleiScanner } from './dast/nuclei.js';
import { zapScanner } from './dast/zap.js';
import { trufflehogScanner } from './secrets/trufflehog.js';
import { supplyChainScanner } from './dependencies/supply-chain.js';
import { trivyScanner } from './infrastructure/trivy.js';
import { hadolintScanner } from './infrastructure/hadolint.js';
import { testsslScanner } from './tls/testssl.js';
import { authProbeScanner } from './attacks/auth-probe.js';
import { headerProbeScanner } from './attacks/header-probe.js';
import { rateLimitProbeScanner } from './attacks/rate-limit-probe.js';
import { privescProbeScanner } from './attacks/privesc-probe.js';
import { raceProbeScanner } from './attacks/race-probe.js';
import { taintAnalyzerScanner } from './ast/taint-analyzer.js';
import { nextPublicLeakScanner } from './quality/next-public-leak.js';
import type { Scanner } from '@aegis-scan/core';

/**
 * Returns all standard scanners (used by scan, audit, pentest).
 * Attack scanners are NOT included — use getAttackScanners() for siege mode.
 */
export function getAllScanners(): Scanner[] {
  return [
    authEnforcerScanner,
    ssrfCheckerScanner,
    cryptoAuditorScanner,
    configAuditorScanner,
    consoleCheckerScanner,
    i18nQualityScanner,
    headerCheckerScanner,
    zodEnforcerScanner,
    rateLimitCheckerScanner,
    entropyScanner,
    paginationCheckerScanner,
    timingSafeCheckerScanner,
    uploadValidatorScanner,
    errorLeakageCheckerScanner,
    corsCheckerScanner,
    envValidationCheckerScanner,
    httpTimeoutCheckerScanner,
    massAssignmentCheckerScanner,
    csrfCheckerScanner,
    openRedirectCheckerScanner,
    sqlConcatCheckerScanner,
    xssCheckerScanner,
    tenantIsolationCheckerScanner,
    pathTraversalCheckerScanner,
    promptInjectionCheckerScanner,
    redosCheckerScanner,
    rscDataCheckerScanner,
    rlsBypassCheckerScanner,
    gdprEngineScanner,
    soc2CheckerScanner,
    iso27001CheckerScanner,
    pciDssCheckerScanner,
    semgrepScanner,
    gitleaksScanner,
    npmAuditScanner,
    osvScannerScanner,
    licenseCheckerScanner,
    reactDoctorScanner,
    nucleiScanner,
    zapScanner,
    trufflehogScanner,
    supplyChainScanner,
    trivyScanner,
    hadolintScanner,
    checkovScanner,
    testsslScanner,
    bearerScanner,
    axeLighthouseScanner,
    lighthousePerformanceScanner,
    cookieCheckerScanner,
    loggingCheckerScanner,
    jwtCheckerScanner,
    depConfusionCheckerScanner,
    taintAnalyzerScanner,
    nextPublicLeakScanner,
  ];
}

/**
 * Returns attack verification scanners (used only by siege mode).
 * These send HTTP requests to live targets — never include in regular scans.
 */
export function getAttackScanners(): Scanner[] {
  return [
    authProbeScanner,
    headerProbeScanner,
    rateLimitProbeScanner,
    privescProbeScanner,
    raceProbeScanner,
  ];
}

export {
  authProbeScanner,
  headerProbeScanner,
  rateLimitProbeScanner,
  privescProbeScanner,
  raceProbeScanner,
  ssrfCheckerScanner,
  authEnforcerScanner,
  cryptoAuditorScanner,
  configAuditorScanner,
  consoleCheckerScanner,
  i18nQualityScanner,
  headerCheckerScanner,
  zodEnforcerScanner,
  rateLimitCheckerScanner,
  entropyScanner,
  paginationCheckerScanner,
  timingSafeCheckerScanner,
  uploadValidatorScanner,
  errorLeakageCheckerScanner,
  corsCheckerScanner,
  envValidationCheckerScanner,
  httpTimeoutCheckerScanner,
  massAssignmentCheckerScanner,
  csrfCheckerScanner,
  openRedirectCheckerScanner,
  sqlConcatCheckerScanner,
  xssCheckerScanner,
  tenantIsolationCheckerScanner,
  pathTraversalCheckerScanner,
  promptInjectionCheckerScanner,
  redosCheckerScanner,
  rscDataCheckerScanner,
  rlsBypassCheckerScanner,
  gdprEngineScanner,
  soc2CheckerScanner,
  iso27001CheckerScanner,
  pciDssCheckerScanner,
  semgrepScanner,
  gitleaksScanner,
  npmAuditScanner,
  osvScannerScanner,
  licenseCheckerScanner,
  reactDoctorScanner,
  nucleiScanner,
  zapScanner,
  trufflehogScanner,
  supplyChainScanner,
  trivyScanner,
  hadolintScanner,
  checkovScanner,
  testsslScanner,
  bearerScanner,
  axeLighthouseScanner,
  lighthousePerformanceScanner,
  cookieCheckerScanner,
  loggingCheckerScanner,
  jwtCheckerScanner,
  depConfusionCheckerScanner,
  taintAnalyzerScanner,
};
