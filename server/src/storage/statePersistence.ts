/**
 * Atomic Checksum-Verified JSON & Write-Ahead Log (WAL) State Persistence
 * Guarantees zero-corruption persistence across container restarts and read-only rootfs
 * deployments (defaults to writable /tmp/neon-chasm-state unless NEON_CHASM_STATE_DIR is set).
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

export interface PersistedEnvelope<T> {
  version: number;
  key: string;
  savedAt: number;
  sha256: string;
  payload: T;
}

export interface LoadResult<T> {
  ok: boolean;
  source: 'snapshot' | 'wal-recovery' | 'fallback';
  corrupted: boolean;
  sha256?: string;
  data: T;
}

export class AtomicStateStore {
  private readonly baseDir: string;
  private writeCounter = 0;

  constructor(baseDir?: string) {
    this.baseDir =
      baseDir ||
      process.env.DATA_DIR ||
      process.env.NEON_CHASM_STATE_DIR ||
      path.join(os.tmpdir(), 'neon-chasm-state');
  }

  public getDirectory(): string {
    return this.baseDir;
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true, mode: 0o750 });
    }
  }

  private computeChecksum(payload: unknown): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  private sanitizeKey(key: string): string {
    return key.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  private snapshotPath(key: string): string {
    return path.join(this.baseDir, `${this.sanitizeKey(key)}.json`);
  }

  private walPath(key: string): string {
    return path.join(this.baseDir, `${this.sanitizeKey(key)}.wal.jsonl`);
  }

  public saveSnapshot<T>(key: string, payload: T): PersistedEnvelope<T> {
    this.ensureDir();
    const sha256 = this.computeChecksum(payload);
    const envelope: PersistedEnvelope<T> = {
      version: 1,
      key,
      savedAt: Date.now(),
      sha256,
      payload,
    };

    const serialized = JSON.stringify(envelope, null, 2);
    const targetFile = this.snapshotPath(key);
    const walFile = this.walPath(key);

    // 1. Append compact frame to WAL journal before atomic swap
    fs.appendFileSync(walFile, `${JSON.stringify(envelope)}\n`, { encoding: 'utf8', mode: 0o600 });

    // Trim WAL if it grows beyond 200 entries to prevent unbounded disk growth
    try {
      const walContent = fs.readFileSync(walFile, 'utf8');
      const lines = walContent.trim().split('\n');
      if (lines.length > 200) {
        const trimmed = `${lines.slice(-50).join('\n')}\n`;
        fs.writeFileSync(walFile, trimmed, { encoding: 'utf8', mode: 0o600 });
      }
    } catch {
      // Non-fatal WAL compaction notice
    }

    // 2. Write temporary file -> fsync -> atomic rename
    this.writeCounter += 1;
    const tmpFile = `${targetFile}.tmp.${process.pid}.${this.writeCounter}`;
    const fd = fs.openSync(tmpFile, 'w', 0o600);
    try {
      fs.writeSync(fd, serialized, 0, 'utf8');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmpFile, targetFile);

    return envelope;
  }

  public loadSnapshot<T>(key: string, fallback: T): LoadResult<T> {
    const targetFile = this.snapshotPath(key);
    const walFile = this.walPath(key);
    let sawCorruption = false;

    if (fs.existsSync(targetFile)) {
      try {
        const raw = fs.readFileSync(targetFile, 'utf8');
        const parsed = JSON.parse(raw) as PersistedEnvelope<T>;
        const expected = this.computeChecksum(parsed.payload);
        if (parsed && typeof parsed.sha256 === 'string' && parsed.sha256 === expected) {
          return {
            ok: true,
            source: 'snapshot',
            corrupted: false,
            sha256: parsed.sha256,
            data: parsed.payload,
          };
        }
        sawCorruption = true;
      } catch {
        sawCorruption = true;
      }
    }

    // Fallback to WAL recovery (walk backwards for latest checksum-valid frame)
    if (fs.existsSync(walFile)) {
      try {
        const lines = fs
          .readFileSync(walFile, 'utf8')
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);

        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            const candidate = JSON.parse(lines[i]) as PersistedEnvelope<T>;
            if (candidate && candidate.sha256 === this.computeChecksum(candidate.payload)) {
              return {
                ok: true,
                source: 'wal-recovery',
                corrupted: sawCorruption,
                sha256: candidate.sha256,
                data: candidate.payload,
              };
            }
          } catch {
            sawCorruption = true;
          }
        }
      } catch {
        sawCorruption = true;
      }
    }

    return {
      ok: !sawCorruption,
      source: 'fallback',
      corrupted: sawCorruption,
      data: fallback,
    };
  }

  public verifySnapshotIntegrity(key: string): { valid: boolean; sha256?: string; reason?: string } {
    const targetFile = this.snapshotPath(key);
    if (!fs.existsSync(targetFile)) {
      return { valid: false, reason: 'SNAPSHOT_NOT_FOUND' };
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(targetFile, 'utf8')) as PersistedEnvelope<unknown>;
      const computed = this.computeChecksum(parsed.payload);
      if (computed !== parsed.sha256) {
        return { valid: false, sha256: parsed.sha256, reason: 'SHA256_MISMATCH' };
      }
      return { valid: true, sha256: parsed.sha256 };
    } catch {
      return { valid: false, reason: 'CORRUPT_JSON' };
    }
  }
}

export function createStateStore(dir: string): AtomicStateStore {
  return new AtomicStateStore(dir);
}

export const statePersistence = new AtomicStateStore();
