/**
 * scripts/check-doc-links.ts
 *
 * Scans README.md, SECURITY.md, and docs/*.md for:
 * 1. Relative markdown links: [label](path)
 * 2. Backtick code paths: `src/...`, `tests/...`, `docs/...`, `evals/...`, `scripts/...`
 *
 * Validates that every referenced target file exists on disk.
 * Exits non-zero if any broken links are discovered.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

// Find markdown files to check
const filesToCheck: string[] = [];

if (fs.existsSync(path.join(ROOT_DIR, 'README.md'))) {
  filesToCheck.push('README.md');
}
if (fs.existsSync(path.join(ROOT_DIR, 'SECURITY.md'))) {
  filesToCheck.push('SECURITY.md');
}

const docsDir = path.join(ROOT_DIR, 'docs');
if (fs.existsSync(docsDir)) {
  const entries = fs.readdirSync(docsDir);
  for (const entry of entries) {
    // Only check tracked documentation files, exclude gitignored phase reports
    if (entry.endsWith('.md') && !entry.startsWith('phase')) {
      filesToCheck.push(path.join('docs', entry));
    }
  }
}

interface BrokenLink {
  sourceFile: string;
  line: number;
  rawReference: string;
  resolvedPath: string;
  reason: string;
}

const brokenLinks: BrokenLink[] = [];
let totalLinksChecked = 0;

for (const relFile of filesToCheck) {
  const absFile = path.join(ROOT_DIR, relFile);
  const content = fs.readFileSync(absFile, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((lineText, lineIdx) => {
    const lineNum = lineIdx + 1;

    // 1. Check Markdown links: [text](target)
    const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match: RegExpExecArray | null;

    while ((match = mdLinkRegex.exec(lineText)) !== null) {
      let target = match[2]?.trim() || '';

      // Ignore external or in-page anchor links
      if (
        target.startsWith('http://') ||
        target.startsWith('https://') ||
        target.startsWith('mailto:') ||
        target.startsWith('#') ||
        target.startsWith('conversation://')
      ) {
        continue;
      }

      // Handle file:// URIs (e.g. file:///Users/.../event_planner/src/foo.ts#L10)
      if (target.startsWith('file://')) {
        target = target.replace(/^file:\/\//, '');
        // Strip anchor
        target = target.split('#')[0] || '';
        totalLinksChecked++;
        if (!fs.existsSync(target)) {
          brokenLinks.push({
            sourceFile: relFile,
            line: lineNum,
            rawReference: match[0],
            resolvedPath: target,
            reason: 'File URI does not exist on disk',
          });
        }
        continue;
      }

      // Strip anchor and query strings
      target = target.split('#')[0] || '';
      target = target.split('?')[0] || '';
      if (!target) continue;

      totalLinksChecked++;
      const sourceDir = path.dirname(absFile);
      const resolved = path.isAbsolute(target)
        ? path.join(ROOT_DIR, target)
        : path.resolve(sourceDir, target);

      if (!fs.existsSync(resolved)) {
        brokenLinks.push({
          sourceFile: relFile,
          line: lineNum,
          rawReference: match[0],
          resolvedPath: path.relative(ROOT_DIR, resolved),
          reason: 'Relative link target does not exist',
        });
      }
    }

    // 2. Check Backtick paths: `src/...`, `tests/...`, `docs/...`, `evals/...`, `scripts/...`
    const codePathRegex = /`((?:src|tests|docs|evals|scripts)\/[^`]+)`/g;
    while ((match = codePathRegex.exec(lineText)) !== null) {
      let rawPath = match[1]?.trim() || '';
      // Strip anchor or trailing punctuation
      rawPath = rawPath.split('#')[0] || '';
      rawPath = rawPath.replace(/[),;.:]+$/, '');

      // Exclude wildcard expressions or command lines (e.g. `docs/*.md`)
      if (rawPath.includes('*') || rawPath.includes(' ') || rawPath.endsWith('/')) {
        continue;
      }

      totalLinksChecked++;
      const resolved = path.join(ROOT_DIR, rawPath);
      if (!fs.existsSync(resolved)) {
        brokenLinks.push({
          sourceFile: relFile,
          line: lineNum,
          rawReference: match[0],
          resolvedPath: rawPath,
          reason: 'Backtick source path does not exist',
        });
      }
    }
  });
}

console.log('================================================================');
console.log('   UTSAV PLANNER - DOCUMENTATION LINK INTEGRITY CHECKER');
console.log('================================================================\n');
console.log(`Files scanned:   ${filesToCheck.length}`);
console.log(`Links validated: ${totalLinksChecked}\n`);

if (brokenLinks.length > 0) {
  console.error(`❌ Found ${brokenLinks.length} broken documentation link(s):\n`);
  for (const b of brokenLinks) {
    console.error(`  - ${b.sourceFile}:${b.line}`);
    console.error(`    Ref:      ${b.rawReference}`);
    console.error(`    Target:   ${b.resolvedPath}`);
    console.error(`    Reason:   ${b.reason}\n`);
  }
  process.exit(1);
} else {
  console.log('✅ All documentation file links and source code references are valid.\n');
  process.exit(0);
}
