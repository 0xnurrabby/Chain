
import crypto from 'crypto';
import { SignedTx } from './types';

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function sha256Hex(buf: Buffer | string): string {
  const h = crypto.createHash('sha256');
  h.update(buf);
  return h.digest('hex');
}

export function base58Encode(buffer: Buffer): string {
  let x = BigInt('0x' + buffer.toString('hex'));
  const base = BigInt(58);
  let out = '';
  while (x > 0) {
    const mod = x % base;
    out = BASE58_ALPHABET[Number(mod)] + out;
    x = x / base;
  }
  // handle leading zeros
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
    out = '1' + out;
  }
  return out || '1';
}

export function merkleRoot(txHashes: string[]): string {
  if (txHashes.length === 0) return sha256Hex(Buffer.from(''));
  let layer = txHashes.map(h => Buffer.from(h, 'hex'));
  while (layer.length > 1) {
    const next: Buffer[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = layer[i + 1] || left;
      const combined = Buffer.concat([left, right]);
      next.push(Buffer.from(sha256Hex(combined), 'hex'));
    }
    layer = next;
  }
  return layer[0].toString('hex');
}

// Canonical tx encoding for hashing (no signature fields)
export function encodeTxForHash(tx: Omit<SignedTx, 'signatureDerBase64' | 'hash' | 'pubKeyPem'>): Buffer {
  const s = JSON.stringify({
    from: tx.from,
    to: tx.to,
    amount: tx.amount,
    tip: tx.tip,
    nonce: tx.nonce,
    timestamp: tx.timestamp
  });
  return Buffer.from(s);
}

// Short address tail like ...a1b2c3
export function shortTail(addr: string, n = 6): string {
  return '...' + addr.slice(-n);
}

