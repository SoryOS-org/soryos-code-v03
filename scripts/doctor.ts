
/**
 * @fileOverview SoryOS Code Project Doctor (Catalase)
 * Scans the monorepo for configuration issues, version mismatches, and architectural violations.
 * Provides a clear list of problems by file and path.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT_DIR = process.cwd();
const ISSUES: { path: string; message: string; severity: 'critical' | 'warning' }[] = [];

function report(filePath: string, message: string, severity: 'critical' | 'warning' = 'critical') {
  ISSUES.push({ path: filePath, message, severity });
}

function checkPackageJson(pkgPath: string) {
  try {
    const content = fs.readFileSync(pkgPath, 'utf8');
    const pkg = JSON.parse(content);

    // Verify Next.js version - Must be 15.1.0
    if (pkg.dependencies?.next && pkg.dependencies.next !== '15.1.0') {
      report(pkgPath, `Next.js version mismatch: "${pkg.dependencies.next}". Expected stable "15.1.0".`);
    }

    // Disallow server-side firebase-admin in client/shared packages
    if (pkg.dependencies?.['firebase-admin'] || pkg.devDependencies?.['firebase-admin']) {
      report(pkgPath, 'Disallowed dependency: "firebase-admin". SoryOS-Code uses the client-side "firebase" SDK for portability.');
    }
    
    // Check for turbo in root scripts without npx
    if (pkg.name === 'soryos-code' && pkg.scripts) {
      for (const [name, script] of Object.entries(pkg.scripts)) {
        if (typeof script === 'string' && script.includes('turbo') && !script.includes('npx turbo')) {
          report(pkgPath, `Script "${name}" uses turbo directly. Use "npx turbo" to ensure execution in all environments.`, 'warning');
        }
      }
    }
  } catch (e) {
    report(pkgPath, `Failed to parse package.json: ${String(e)}`);
  }
}

function checkSourceCode(filePath: string) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Rule: Non-blocking Firestore mutations
    const blockingPattern = /await\s+(setDoc|addDoc|updateDoc|deleteDoc)/;
    if (blockingPattern.test(content)) {
      report(filePath, "Forbidden blocking 'await' detected on Firestore mutation. Use non-blocking .catch() patterns to maintain agent responsiveness.", 'warning');
    }

    // Rule: Use central errorEmitter for permission diagnostics
    if (content.includes('console.error') && (content.includes('permission') || content.includes('FirestorePermissionError'))) {
      report(filePath, "Direct console.error used for permissions. Use the central errorEmitter in @soryos/database to surface diagnostics to the UI.", 'warning');
    }
  } catch (e) {
    // skip
  }
}

function scan(dir: string) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', '.next', 'dist'].includes(entry.name)) continue;
      scan(fullPath);
    } else {
      if (entry.name === 'package.json') {
        checkPackageJson(fullPath);
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        checkSourceCode(fullPath);
      }
    }
  }
}

console.log('\n=============================================');
console.log('   SORYOS-CODE SYSTEM DIAGNOSTIC (DOCTOR)   ');
console.log('=============================================\n');

scan(ROOT_DIR);

if (ISSUES.length === 0) {
  console.log('✅ PASS: No project health issues detected.');
} else {
  const critical = ISSUES.filter(i => i.severity === 'critical');
  const warnings = ISSUES.filter(i => i.severity === 'warning');

  if (critical.length > 0) {
    console.log(`❌ FAILED: Found ${critical.length} CRITICAL ISSUES:\n`);
    critical.forEach((issue, idx) => {
      console.log(`${idx + 1}. [${path.relative(ROOT_DIR, issue.path)}]`);
      console.log(`   Issue: ${issue.message}\n`);
    });
  }

  if (warnings.length > 0) {
    console.log(`⚠️ WARNING: Found ${warnings.length} ARCHITECTURAL ADVISORIES:\n`);
    warnings.forEach((issue, idx) => {
      console.log(`${idx + 1}. [${path.relative(ROOT_DIR, issue.path)}]`);
      console.log(`   Advisory: ${issue.message}\n`);
    });
  }
}

if (ISSUES.some(i => i.severity === 'critical')) {
  process.exit(1);
} else {
  console.log('\nSystem integrity verified.');
}
