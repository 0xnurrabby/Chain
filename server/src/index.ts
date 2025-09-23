
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import { WebSocketServer } from 'ws';
import { NurChain } from './blockchain';
import { Address, TxBody } from './types';


function normalizePemServer(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const s = input.trim();
  if (/BEGIN (EC )?PRIVATE KEY/.test(s)) return s;
  const b64 = s.replace(/[\r\n\s]/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/=]+$/.test(b64)) return null;
  const lines = b64.match(/.{1,64}/g)?.join('\n') ?? b64;
  return `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----`;
}
const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '2mb' }));

const server = app.listen(3001, () => {
  console.log('NurChain server listening on http://localhost:3001');
});

const wss = new WebSocketServer({ server });
const chain = new NurChain(wss);

class Mutex {
  private p: Promise<void> = Promise.resolve();
  runExclusive<T>(fn: () => Promise<T> | T): Promise<T> {
    const res = this.p.then(fn, fn);
    this.p = res.then(() => {}, () => {});
    return res;
  }
}
const txMutex = new Mutex();

function isValidNurAddress(addr: string): boolean {
  // nur + base58 (no 0 O I l), len ~ 30-64
  return /^nur[1-9A-HJ-NP-Za-km-z]{25,70}$/.test(addr);
}

// Periodic state broadcast (keeps UI live even when no new blocks occur)
setInterval(() => {
  try { 
    // push a lightweight state snapshot to all clients
    wss.clients.forEach((ws: any) => {
      try { ws.send(JSON.stringify({ event: 'state', data: chain.snapshot() })); } catch {}
    });
  } catch {}
}, 1000);


// ---- Wallet APIs ----
app.post('/api/wallet/create', (req, res) => {
  try {
    const { curve } = req.body || {};
    const namedCurve = curve || 'P-256'; // browser-friendly
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve });
    const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const address: Address = chain.addressFromPublicKeyPem(publicPem);
    chain.registerWallet(address);
    res.json({ address, privatePem, publicPem });
  } catch (e: any) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

app.post('/api/wallet/import', (req, res) => {
  try {
    const { privatePem } = req.body;
    const pem = normalizePemServer(privatePem);
    if (!pem) return res.status(400).json({ error: 'Invalid PEM' });
    const priv = crypto.createPrivateKey(pem);
    const publicPem = crypto.createPublicKey(priv).export({ type: 'spki', format: 'pem' }).toString();
    const address: Address = chain.addressFromPublicKeyPem(publicPem);
    chain.registerWallet(address);
    res.json({ address, publicPem });
  } catch (e: any) {
    res.status(400).json({ error: 'Invalid PEM' });
  }
});

app.get('/api/wallet/:address', (req, res) => {
  try {
    const acc = chain.getAccount(req.params.address);
    res.json(acc);
  } catch (e: any) {
    res.status(400).json({ error: String(e) });
  }
});

// ---- Miner APIs ----
app.post('/api/miner/start', (req, res) => {
  try {
    const { address, power } = req.body;
    chain.startMining(address, Number(power || 1));
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: String(e) });
  }
});

app.post('/api/miner/stop', (req, res) => {
  try {
    const { address } = req.body;
    chain.stopMining(address);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: String(e) });
  }
});

// ---- TX APIs ----
app.post('/api/tx/send', (req, res) => {
  try {
    const { privatePem, body } = req.body as { privatePem: string; body: TxBody };
    const pem = normalizePemServer(privatePem);
    if (!pem) throw new Error('Missing private key');
    // Build & sign
    const priv = crypto.createPrivateKey(pem);
    const pubPem = crypto.createPublicKey(priv).export({ type: 'spki', format: 'pem' }).toString();
    const signed = chain.signTx(pem, body, pubPem);
    // Verify & accept
    chain.submitTx(signed);
    res.json(signed);
  } catch (e: any) {
    res.status(400).json({ error: e.message || String(e) });
  }
});

// ---- Explorer APIs ----
app.get('/api/explorer/address/:address', (req, res) => {
  try {
    const list = chain.listAddressTx(req.params.address);
    res.json({ items: list });
  } catch (e: any) {
    res.status(400).json({ error: String(e) });
  }
});

app.get('/api/explorer/tx/:hash', (req, res) => {
  try {
    const found = chain.findByTxHash(req.params.hash);
    res.json(found);
  } catch (e: any) {
    res.status(400).json({ error: String(e) });
  }
});

app.get('/api/explorer/block/:hash', (req, res) => {
  try {
    const block = chain.findBlockByHash(req.params.hash);
    if (!block) return res.status(404).json({ error: 'Not found' });
    res.json(block);
  } catch (e: any) {
    res.status(400).json({ error: String(e) });
  }
});

// ---- Chain State ----
app.get('/api/state', (req, res) => {
  res.json(chain.snapshot());
});


// ---- Recent Blocks API ----
app.get('/api/blocks/recent', (req, res) => {
  const limit = Math.max(1, Math.min(100, Number(req.query.limit ?? 50)));
  const list = chain.blocks.slice(-limit).reverse(); // newest first
  res.json({ items: list });
});

// ---- WebSocket ----
wss.on('connection', (ws: any) => {
  try {
    ws.send(JSON.stringify({ event: 'state', data: chain.snapshot() }));
  } catch {}
});


// Address overview: balance, nonce, first funded by, sent latest/first (robust)
app.get('/api/address/overview', (req, res) => {
  try {
    const address = String(req.query.address || '');
    if (!address) throw new Error('address required');
    const acc = chain.getAccount(address);
    const balance = acc ? acc.balance : 0;
    const nonce = acc ? acc.nonce : 0;

    let fundedBy: any = null;
    let firstSent: any = null;
    let latestSent: any = null;

    const blocks = (chain as any).getBlocksChrono ? (chain as any).getBlocksChrono() : (chain as any).blocks;
    for (const b of blocks) {
      for (const tx of b.transactions) {
        if (!fundedBy && tx.to === address) {
          fundedBy = { from: tx.from, hash: tx.hash, block: b.header.height, timeUTC: tx.timestampUTC || tx.timestamp };
        }
        if (tx.from === address) {
          if (!firstSent) firstSent = { hash: tx.hash, block: b.header.height, timeUTC: tx.timestampUTC || tx.timestamp };
          latestSent = { hash: tx.hash, block: b.header.height, timeUTC: tx.timestampUTC || tx.timestamp };
        }
      }
    }

    res.json({
      address, balance, nonce,
      sent: { latest: latestSent, first: firstSent },
      fundedBy
    });
  } catch (e:any) {
    res.status(400).json({ error: e?.message || String(e) });
  }
});