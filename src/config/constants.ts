/**
 * Configuration constants for Firewatch MCP server
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SERVER_NAME = 'firewatch';
const PACKAGE_NAME = 'firewatch-mcp';

type PackageMetadata = {
  name: string;
  version: string;
};

function readPackageMetadata(): PackageMetadata {
  let currentDirectory: string = dirname(fileURLToPath(import.meta.url));

  while (currentDirectory.length > 0) {
    const packageJsonPath: string = resolve(currentDirectory, 'package.json');

    if (existsSync(packageJsonPath)) {
      const packageMetadata = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageMetadata;

      if (packageMetadata.name === PACKAGE_NAME && packageMetadata.version.length > 0) {
        return packageMetadata;
      }
    }

    const parentDirectory: string = dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      throw new Error(`Could not locate package.json for ${PACKAGE_NAME}`);
    }

    currentDirectory = parentDirectory;
  }

  throw new Error(`Could not locate package.json for ${PACKAGE_NAME}`);
}

const packageMetadata = readPackageMetadata();

export const SERVER_VERSION = packageMetadata.version;
