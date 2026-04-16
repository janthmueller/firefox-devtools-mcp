import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function main() {
  const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const tempDirectory = mkdtempSync(join(tmpdir(), 'firewatch-pack-'));
  let tarballPath = '';

  try {
    const packOutput = execFileSync('npm', ['pack', '--json'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    const packResult = JSON.parse(packOutput);
    const tarballName = packResult[0]?.filename;

    if (typeof tarballName !== 'string' || tarballName.length === 0) {
      throw new Error('npm pack did not return a tarball filename');
    }

    tarballPath = join(repoRoot, tarballName);
    execFileSync('tar', ['-xzf', tarballPath, '-C', tempDirectory], {
      cwd: repoRoot,
      stdio: 'inherit',
    });

    const packageDirectory = join(tempDirectory, 'package');
    execFileSync('npm', ['install', '--omit=dev', '--ignore-scripts'], {
      cwd: packageDirectory,
      stdio: 'inherit',
    });

    const packagedEntrypoint = join(packageDirectory, 'dist', 'index.js');
    const versionOutput = execFileSync('node', [packagedEntrypoint, '--version'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();

    const packageVersion = packResult[0]?.version;
    if (versionOutput !== packageVersion) {
      throw new Error(
        `Packaged CLI reported version "${versionOutput}" instead of "${packageVersion}"`
      );
    }
  } finally {
    if (tarballPath.length > 0) {
      rmSync(tarballPath, { force: true });
    }
    rmSync(tempDirectory, { recursive: true, force: true });
  }
}

main();
