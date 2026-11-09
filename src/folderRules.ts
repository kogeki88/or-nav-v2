/// <reference types="node" />
// Folder rules for the ports-and-adapters areas (ADR 0001).
// Checks the imports written in each file in src/contracts, src/core and src/features.
// Used only by folderRules.test.ts (it reads files with Node), never by the app.
import fs from 'node:fs';
import path from 'node:path';

export const AREAS = ['src/contracts', 'src/core', 'src/features'];

// Every .ts/.tsx file in the three areas, as paths like "src/core/x.ts".
export function listAreaFiles(root: string): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const child = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(child);
      else if (/\.tsx?$/.test(entry.name)) files.push(child);
    }
  };
  for (const area of AREAS) {
    if (fs.existsSync(path.join(root, area))) walk(area);
  }
  return files;
}

export type Violation = { file: string; importPath: string; rule: string };

type FoundImport = { importPath: string; typeOnly: boolean };

// import x from 'a' / export { x } from 'a' / import type { X } from 'a' (may span lines,
// but never runs past the start of the next import or export line).
const FROM_IMPORT =
  /(?:^|[;\n])\s*(?:import|export)\s+(type\s+)?((?:(?!\n\s*(?:import|export)\b)[^'";])*?)\s*from\s*['"]([^'"]+)['"]/g;
// import 'a' (runs the file only)
const BARE_IMPORT = /(?:^|[;\n])\s*import\s*['"]([^'"]+)['"]/g;
// require('a') and import('a')
const CALL_IMPORT = /\b(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

// True for "{ type A, type B as C }": every name is marked type.
function allNamesAreTypes(clause: string): boolean {
  const braces = clause.trim().match(/^\{([\s\S]*)\}$/);
  if (!braces) return false;
  const names = braces[1].split(',').map((n) => n.trim()).filter(Boolean);
  return names.length > 0 && names.every((n) => /^type\s/.test(n));
}

function findImports(text: string): FoundImport[] {
  const found: FoundImport[] = [];
  for (const m of text.matchAll(FROM_IMPORT)) {
    found.push({ importPath: m[3], typeOnly: Boolean(m[1]) || allNamesAreTypes(m[2]) });
  }
  for (const m of text.matchAll(BARE_IMPORT)) found.push({ importPath: m[1], typeOnly: false });
  for (const m of text.matchAll(CALL_IMPORT)) found.push({ importPath: m[1], typeOnly: false });
  return found;
}

type Area = { kind: 'contracts' } | { kind: 'core' } | { kind: 'feature'; name: string } | { kind: 'other' };

// Which area a path like "src/features/library/x.ts" belongs to.
function areaOf(repoPath: string): Area {
  const [top, area, name] = repoPath.split('/');
  if (top !== 'src') return { kind: 'other' };
  if (area === 'contracts') return { kind: 'contracts' };
  if (area === 'core') return { kind: 'core' };
  if (area === 'features') return { kind: 'feature', name: name ?? '' };
  return { kind: 'other' };
}

// Turns "./x" or "../y/z" into a path from the repo root; packages stay null.
function targetPath(file: string, importPath: string): string | null {
  if (!importPath.startsWith('.')) return null;
  const parts = file.split('/').slice(0, -1);
  for (const part of importPath.split('/')) {
    if (part === '..') parts.pop();
    else if (part !== '.' && part !== '') parts.push(part);
  }
  return parts.join('/');
}

function isReactPackage(importPath: string): boolean {
  return ['react', 'react-native'].some((name) => importPath === name || importPath.startsWith(`${name}/`));
}

function brokenRule(file: string, { importPath, typeOnly }: FoundImport): string | null {
  const from = areaOf(file);
  const target = targetPath(file, importPath);
  const to = target === null ? null : areaOf(target);
  if (from.kind === 'contracts') {
    if (!typeOnly) return 'contracts may only use type imports';
    if (to?.kind !== 'contracts') return 'contracts may only import types from other contract files';
  }
  if (from.kind === 'core') {
    if (isReactPackage(importPath)) return 'core must not import react or react-native';
    if (to?.kind === 'feature') return 'core must not import a feature';
  }
  if (from.kind === 'feature') {
    if (to?.kind === 'core') return 'a feature must not import core';
    if (to?.kind === 'feature' && to.name !== from.name) return 'a feature must not import another feature';
  }
  return null;
}

export function checkFile(file: string, text: string): Violation[] {
  const violations: Violation[] = [];
  for (const found of findImports(text)) {
    const rule = brokenRule(file, found);
    if (rule) violations.push({ file, importPath: found.importPath, rule });
  }
  return violations;
}

// One message for all violations, in words that can be pasted to Claude.
export function formatViolations(violations: Violation[]): string {
  const lines = violations.map((v) => `  ${v.file} → ${v.importPath} (${v.rule})`);
  return [`${violations.length} folder rule(s) broken. See docs/adr/0001-hexagonal-ideas-in-one-repo.md:`, ...lines].join(
    '\n',
  );
}
