import {
  copyFile as fsCopyFile,
  mkdir,
  readFile,
  readdir,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { FileOperationError } from "./errors.js";

const SymlinkType = {
  File: "file",
  Dir: "dir",
  Junction: "junction",
} as const;
type SymlinkType = (typeof SymlinkType)[keyof typeof SymlinkType];

const Platform = {
  Win32: "win32",
  Darwin: "darwin",
  Linux: "linux",
} as const;
type Platform = (typeof Platform)[keyof typeof Platform];

const ErrorCode = {
  Enoent: "ENOENT",
  Eacces: "EACCES",
  Eperm: "EPERM",
  Eexist: "EEXIST",
} as const;
type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export async function copyFile(
  src: string,
  dest: string,
  overwrite: boolean,
): Promise<{ created: boolean; updated: boolean }> {
  const exists = await pathExists(dest);

  if (exists && !overwrite) {
    return { created: false, updated: false };
  }

  if (exists && overwrite) {
    const srcContent = await readFile(src);
    const destContent = await readFile(dest);

    if (srcContent.equals(destContent)) {
      return { created: false, updated: false };
    }
  }

  await ensureDirectoryExists(dirname(dest));

  await fsCopyFile(src, dest);

  if (exists && overwrite) {
    return { created: false, updated: true };
  }
  return { created: true, updated: false };
}

export async function copyDirectory(
  srcDir: string,
  destDir: string,
  overwrite: boolean,
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  await ensureDirectoryExists(destDir);

  const entries = await readdir(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);

    if (entry.isDirectory()) {
      const result = await copyDirectory(srcPath, destPath, overwrite);
      created += result.created;
      skipped += result.skipped;
    } else if (entry.isFile()) {
      const result = await copyFile(srcPath, destPath, overwrite);
      if (result.created || result.updated) {
        created++;
      } else {
        skipped++;
      }
    }
  }

  return { created, skipped };
}

export async function symlinkOrCopy(
  src: string,
  dest: string,
  overwrite: boolean,
  isDir: boolean,
): Promise<{ created: boolean; updated: boolean; usedSymlink: boolean }> {
  const exists = await pathExists(dest);

  if (exists && !overwrite) {
    return { created: false, updated: false, usedSymlink: false };
  }

  await ensureDirectoryExists(dirname(dest));

  try {
    const symlinkType = isDir
      ? process.platform === Platform.Win32
        ? SymlinkType.Junction
        : SymlinkType.Dir
      : SymlinkType.File;

    const relativeSrc = relative(dirname(dest), src);

    await symlink(relativeSrc, dest, symlinkType);

    if (exists && overwrite) {
      return { created: false, updated: true, usedSymlink: true };
    }
    return { created: true, updated: false, usedSymlink: true };
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    console.warn(
      `Symlink failed (${nodeError.code}), falling back to copy: ${dest}`,
    );

    try {
      if (isDir) {
        const result = await copyDirectory(src, dest, overwrite);
        return {
          created: result.created > 0 && !exists,
          updated: result.created > 0 && exists,
          usedSymlink: false,
        };
      }

      const result = await copyFile(src, dest, overwrite);
      return {
        created: result.created,
        updated: result.updated,
        usedSymlink: false,
      };
    } catch (fallbackError) {
      throw new FileOperationError(
        `Both symlink and copy operations failed for: ${dest}`,
        dest,
        "symlink or copy",
      );
    }
  }
}

export async function writeTextFile(
  dest: string,
  content: string,
  overwrite: boolean,
): Promise<{ created: boolean; updated: boolean }> {
  const exists = await pathExists(dest);

  if (exists && !overwrite) {
    return { created: false, updated: false };
  }

  if (exists && overwrite) {
    try {
      const existingContent = await readFile(dest, "utf8");
      if (existingContent === content) {
        return { created: false, updated: false };
      }
    } catch {}
  }

  await ensureDirectoryExists(dirname(dest));

  await writeFile(dest, content, "utf8");

  if (exists && overwrite) {
    return { created: false, updated: true };
  }
  return { created: true, updated: false };
}

async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await mkdir(dirPath, { recursive: true });
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== ErrorCode.Eexist) {
      throw new FileOperationError(
        `Failed to create directory: ${dirPath}`,
        dirPath,
        "create directory",
      );
    }
  }
}

export async function isDirectory(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
