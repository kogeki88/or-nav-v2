/// <reference types="node" />
import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AREAS, checkFile, formatViolations, listAreaFiles } from './folderRules';

describe('the OR-Nav source tree', () => {
  const root = path.resolve(__dirname, '..');

  it('has the contracts, core and features areas', () => {
    expect(AREAS.filter((area) => !fs.existsSync(path.join(root, area)))).toEqual([]);
  });

  it('follows the folder rules in every contracts, core and features file', () => {
    const violations = listAreaFiles(root).flatMap((file) =>
      checkFile(file, fs.readFileSync(path.join(root, file), 'utf8')),
    );
    if (violations.length > 0) throw new Error(formatViolations(violations));
  });
});

describe('formatViolations', () => {
  it('lists every violation on its own line as "file → import (rule broken)"', () => {
    const message = formatViolations([
      { file: 'src/core/a.ts', importPath: 'react', rule: 'core must not import react or react-native' },
      { file: 'src/features/x/b.tsx', importPath: '../../core/c', rule: 'a feature must not import core' },
    ]);
    expect(message.split('\n').slice(1)).toEqual([
      '  src/core/a.ts → react (core must not import react or react-native)',
      '  src/features/x/b.tsx → ../../core/c (a feature must not import core)',
    ]);
  });
});

describe('listAreaFiles', () => {
  it('finds every source file in the three areas, and nothing outside them', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'folder-rules-'));
    const files = [
      'src/contracts/library.ts',
      'src/core/library/demoSource.ts',
      'src/features/library/LibraryScreen.tsx',
      'src/features/library/sheets/DepartmentSheet.tsx',
      'src/features/library/notes.md',
      'src/views/MeScreen.tsx',
      'App.tsx',
    ];
    for (const file of files) {
      fs.mkdirSync(path.join(root, path.dirname(file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), '');
    }
    try {
      expect(listAreaFiles(root).sort()).toEqual([
        'src/contracts/library.ts',
        'src/core/library/demoSource.ts',
        'src/features/library/LibraryScreen.tsx',
        'src/features/library/sheets/DepartmentSheet.tsx',
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('checkFile', () => {
  it('rejects a runtime import in contracts', () => {
    const text = "import { supabase } from '../auth/supabase';\n";
    expect(checkFile('src/contracts/library.ts', text)).toEqual([
      { file: 'src/contracts/library.ts', importPath: '../auth/supabase', rule: 'contracts may only use type imports' },
    ]);
  });

  it('allows a type import from another contract file', () => {
    const text = "import type { Item } from './items';\nexport type { Card } from '../contracts/cards';\n";
    expect(checkFile('src/contracts/library.ts', text)).toEqual([]);
  });

  it('rejects a type import in contracts from outside contracts', () => {
    const text = "import type { Profile } from '../profile/profile';\n";
    expect(checkFile('src/contracts/library.ts', text)).toEqual([
      {
        file: 'src/contracts/library.ts',
        importPath: '../profile/profile',
        rule: 'contracts may only import types from other contract files',
      },
    ]);
  });

  it('rejects react and react-native in core', () => {
    const text = [
      "import { useState } from 'react';",
      "import { View } from 'react-native';",
      "import { SafeAreaView } from 'react-native-safe-area-context';",
    ].join('\n');
    expect(checkFile('src/core/library/supabaseSource.ts', text)).toEqual([
      { file: 'src/core/library/supabaseSource.ts', importPath: 'react', rule: 'core must not import react or react-native' },
      {
        file: 'src/core/library/supabaseSource.ts',
        importPath: 'react-native',
        rule: 'core must not import react or react-native',
      },
    ]);
  });

  it('rejects a feature import in core', () => {
    const text = "import { LibraryScreen } from '../../features/library/LibraryScreen';\n";
    expect(checkFile('src/core/library/demoSource.ts', text)).toEqual([
      {
        file: 'src/core/library/demoSource.ts',
        importPath: '../../features/library/LibraryScreen',
        rule: 'core must not import a feature',
      },
    ]);
  });

  it('allows core to import contracts, other core files and old folders', () => {
    const text = [
      "import type { LibrarySource } from '../../contracts/library';",
      "import { serial } from '../../db/libraryStore';",
      "import { logFault } from '../../diag/faultLog';",
      "import { demoLibrary } from './demoSource';",
      "import { createClient } from '@supabase/supabase-js';",
    ].join('\n');
    expect(checkFile('src/core/library/supabaseSource.ts', text)).toEqual([]);
  });

  it('rejects a core import in a feature', () => {
    const text = "import { supabaseSource } from '../../core/library/supabaseSource';\n";
    expect(checkFile('src/features/library/useLibrary.ts', text)).toEqual([
      {
        file: 'src/features/library/useLibrary.ts',
        importPath: '../../core/library/supabaseSource',
        rule: 'a feature must not import core',
      },
    ]);
  });

  it('rejects an import of another feature', () => {
    const text = "import { OmniBar } from '../omnibar/OmniBar';\n";
    expect(checkFile('src/features/library/LibraryScreen.tsx', text)).toEqual([
      {
        file: 'src/features/library/LibraryScreen.tsx',
        importPath: '../omnibar/OmniBar',
        rule: 'a feature must not import another feature',
      },
    ]);
  });

  it('allows a feature to import contracts, its own folder, shared UI and theme', () => {
    const text = [
      "import React, { useState } from 'react';",
      "import { View } from 'react-native';",
      "import type { LibrarySource } from '../../contracts/library';",
      "import { searchItems } from './logic';",
      "import { BottomSheet } from '../../ui/BottomSheet';",
      "import { colors } from '../../theme';",
    ].join('\n');
    expect(checkFile('src/features/library/LibraryScreen.tsx', text)).toEqual([]);
  });

  it('catches every way of writing an import', () => {
    const text = [
      "import '../../features/library/register';",
      "const RN = require('react-native');",
      "const later = await import('react');",
      'import {',
      '  supabaseSource,',
      '  demoSource,',
      "} from '../../features/library/useLibrary';",
    ].join('\n');
    expect(checkFile('src/core/search/engine.ts', text).map((v) => v.importPath)).toEqual([
      '../../features/library/useLibrary',
      '../../features/library/register',
      'react-native',
      'react',
    ]);
  });

  it('still sees a runtime import after a type line when the file has no semicolons', () => {
    const text = "export type A = string\nimport { b } from './b'\n";
    expect(checkFile('src/contracts/library.ts', text).map((v) => v.importPath)).toEqual(['./b']);
  });

  it('treats an import whose names are all marked type as a type import', () => {
    const text = "import { type Item, type Card } from './items';\nimport { type Item as I, Card } from './cards';\n";
    expect(checkFile('src/contracts/library.ts', text).map((v) => v.importPath)).toEqual(['./cards']);
  });
});
