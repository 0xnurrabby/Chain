
import crypto from 'crypto';
import { WebSocketServer } from 'ws';
import { Account, Address, Block, BlockHeader, ChainSnapshot, MinerInfo, SignedTx, TxBody } from './types';
import { sha256Hex, base58Encode, merkleRoot, encodeTxForHash } from './utils';

export class NurChain {
  static readonly COINBASE_ADDR = 'nurCOINBASE';
  public accounts = new Map<Address, Account>();
  public faucetCredited = new Set<Address>();
  public mempool: SignedTx[] = [];
  public blocks: Block[] = [];
  public miners = new Map<Address, MinerInfo>(); // online miners
  public baseFee = 0.01; // NUR
  public gasLimit = 20_000_000;
  public gasPerTx = 21_000;
  public alpha = 0.125;
  private miningTimer: NodeJS.Timeout | null = null;
  private nextHeight: number = 0;
  private wss: WebSocketServer;
  private tpsWindow: { t: number; count: number }[] = []; // last 60s

  constructor(wss: WebSocketServer) {
    this.wss = wss;
  }

  // ----- Wallet & Address -----
  addressFromPublicKeyPem(pem: string): Address {
    // Compute address = 'nur' + base58( sha256(spki DER) ).slice(0, 20 bytes)
    const spkiDer = crypto.createPublicKey(pem).export({ type: 'spki', format: 'der' }) as Buffer;
    const hash = crypto.createHash('sha256').update(spkiDer).digest();
    const twenty = hash.subarray(0, 20);
    const b58 = base58Encode(twenty);
    return 'nur' + b58;
  }

  ensureAccount(address: Address) {
    if (!this.accounts.has(address)) {
      this.accounts.set(address, { address, balance: 0, nonce: 0 });
    }
  }

  registerWallet(address: Address) {
    this.ensureAccount(address);
    if (!this.faucetCredited.has(address)) {
      // Anonymous faucet injection of 1 NUR (not a tx)
      const acc = this.accounts.get(address)!;
      acc.balance += 1;
      this.faucetCredited.add(address);
      this.broadcastState();
    }
  }

  getAccount(address: Address): Account {
    this.ensureAccount(address);
    return this.accounts.get(address)!;
  }

  // ----- Miners -----
  startMining(address: Address, power: number) {
    this.registerWallet(address);
    this.miners.set(address, { address, power: Math.max(1, Math.min(10, Math.floor(power))) });
    this.broadcastMiners();
    this.maybeStartTimer();
  }

  stopMining(address: Address) {
    this.miners.delete(address);
    this.broadcastMiners();
    if (this.miners.size === 0) this.stopTimer();
  }

  private maybeStartTimer() {
    if (!this.miningTimer) {
      this.miningTimer = setInterval(() => this.mineRound(), 10000);
    }
  }

  private stopTimer() {
    if (this.miningTimer) {
      clearInterval(this.miningTimer);
      this.miningTimer = null;
    }
  }

  // ----- Transactions -----
  submitTx(tx: SignedTx) {
    // Admission checks: signature, nonce, fee >= current baseFee
    const ok = this.verifySignature(tx);
    if (!ok) throw new Error('Invalid signature');
    const fromAcc = this.getAccount(tx.from);
    if (tx.nonce !== fromAcc.nonce + 1) {
      throw new Error(`Invalid nonce. Expected ${fromAcc.nonce + 1}`);
    }
    // Fee check against current baseFee
    if ((this.baseFee) > (tx.tip + this.baseFee)) {
      // Always false, but we keep to match structure
    }
    // Check balance sufficient for amount + baseFee (worst case)
    if (fromAcc.balance < (tx.amount + this.baseFee)) {
      throw new Error('Insufficient balance for amount + fee');
    }
    // Add to mempool
    this.mempool.push(tx);
    // Sort by tip descending for better UX (optional)
    this.mempool.sort((a, b) => b.tip - a.tip);
    this.broadcastMempool();
  }

  signTx(privateKeyPem: string, body: TxBody, pubKeyPem: string): SignedTx {
    // Compute hash
    const pre: Omit<SignedTx, 'signatureDerBase64' | 'hash' | 'pubKeyPem'> = {
      from: body.from,
      to: body.to,
      amount: body.amount,
      tip: body.tip,
      nonce: body.nonce,
      timestamp: body.timestamp
    };
    const toHash = encodeTxForHash(pre);
    const hashHex = sha256Hex(toHash);
    const signer = crypto.createSign('sha256');
    signer.update(Buffer.from(hashHex, 'hex'));
    signer.end();
    const sig = signer.sign(privateKeyPem); // DER format
    const signatureDerBase64 = sig.toString('base64');
    const signed: SignedTx = { ...pre, pubKeyPem, signatureDerBase64, hash: hashHex };
    return signed;
  }

  verifySignature(tx: SignedTx): boolean {
    const verifier = crypto.createVerify('sha256');
    verifier.update(Buffer.from(tx.hash, 'hex'));
    verifier.end();
    const ok = verifier.verify(tx.pubKeyPem, Buffer.from(tx.signatureDerBase64, 'base64'));
    // Check that 'from' matches pubKey
    const addr = this.addressFromPublicKeyPem(tx.pubKeyPem);
    return ok && addr === tx.from;
  }

  // ----- Mining Round (every 10s) -----
  private mineRound() {
    if (this.miners.size === 0) return;

    // Determine eligible miners (must have >= next base fee)
    const nextBaseFee = this.computeNextBaseFee();
    const eligible = Array.from(this.miners.values()).filter(m => {
      const acc = this.getAccount(m.address);
      return acc.balance >= nextBaseFee;
    });
    if (eligible.length === 0) {
      // No one can pay fee -> skip
      return;
    }

    // Weighted selection by power for validator
    const validator = this.weightedPick(eligible);
    // Lucky 30 miners set (excluding validator), unique
    const others = eligible.filter(m => m.address !== validator.address);
    const luckyCount = Math.min(30, others.length);
    const lucky: string[] = [];
    const pool = [...others];
    // Weighted unique picks
    while (lucky.length < luckyCount && pool.length > 0) {
      const pick = this.weightedPick(pool);
      lucky.push(pick.address);
      const idx = pool.findIndex(p => p.address === pick.address);
      if (idx >= 0) pool.splice(idx, 1);
    }

    // Build block from mempool up to gas limit
    const selectedTxs: any[] = [];
    let gasUsed = 0;
    const maxTx = Math.floor(this.gasLimit / this.gasPerTx);
    for (const tx of this.mempool) {
      if (selectedTxs.length >= maxTx) break;
      // fee check at submission already, here we assume ok
      selectedTxs.push(tx);
      gasUsed += this.gasPerTx;
    }

    // Apply transactions: move balances, burn baseFee, give priority fee to validator
    for (const tx of selectedTxs) {
      const from = this.getAccount(tx.from);
      const to = this.getAccount(tx.to);
      const total = tx.amount + this.baseFee + tx.tip; // worst-case
      if (from.balance < total) continue; // skip if no longer sufficient
      // Deduct baseFee (burn) & tip (to validator), transfer amount
      from.balance -= (tx.amount + this.baseFee + tx.tip);
      to.balance += tx.amount;
      const vAcc = this.getAccount(validator.address);
      vAcc.balance += tx.tip; // priority fees to validator
      from.nonce += 1;
    }
    // Remove applied txs from mempool
    this.mempool = this.mempool.slice(selectedTxs.length);

    // Deduct mining fee from validator + lucky miners (burn)
    const payers = [validator.address, ...lucky];
    for (const addr of payers) {
      const acc = this.getAccount(addr);
      if (acc.balance >= nextBaseFee) {
        acc.balance -= nextBaseFee;
      }
    }

    // Rewards
    const reward = 10; // NUR
    const rewardTxs: any[] = [];
    const tsNow = Date.now();
    if (eligible.length <= 1) {
      // Single miner gets 100%
      const sole = this.getAccount(validator.address);
      sole.balance += reward;
      const body = { from: NurChain.COINBASE_ADDR, to: validator.address, amount: reward, tip: 0, nonce: 0, timestamp: tsNow };
      const hash = sha256Hex(encodeTxForHash(body));
      rewardTxs.push({ ...body, pubKeyPem: 'SYSTEM', signatureDerBase64: '', hash, type: 'mining_reward' });
    } else {
      const validatorReward = reward * 0.7;
      const minerTotal = reward * 0.3;
      const each = lucky.length > 0 ? minerTotal / lucky.length : 0;
      const vAcc = this.getAccount(validator.address);
      vAcc.balance += validatorReward;
      const vBody = { from: NurChain.COINBASE_ADDR, to: validator.address, amount: validatorReward, tip: 0, nonce: 0, timestamp: tsNow };
      rewardTxs.push({ ...vBody, pubKeyPem: 'SYSTEM', signatureDerBase64: '', hash: sha256Hex(encodeTxForHash(vBody)), type: 'mining_reward' });
      for (const addr of lucky) {
        const mAcc = this.getAccount(addr);
        mAcc.balance += each;
        const b = { from: NurChain.COINBASE_ADDR, to: addr, amount: each, tip: 0, nonce: 0, timestamp: tsNow };
        rewardTxs.push({ ...b, pubKeyPem: 'SYSTEM', signatureDerBase64: '', hash: sha256Hex(encodeTxForHash(b)), type: 'mining_reward' });
      }
    }

    // Compose block
    const prevHash = this.blocks.length ? this.blocks[this.blocks.length - 1].hash : '0'.repeat(64);
    const allTxs = [...selectedTxs, ...rewardTxs];
    const header: BlockHeader = {
      height: (this.nextHeight += 1),
      prevHash,
      timestampUTC: Date.now(),
      nonce: Math.floor(Math.random() * 1e9),
      validatorAddress: validator.address,
      merkleRoot: merkleRoot(allTxs.map(t => t.hash)),
      txCount: allTxs.length,
      gasUsed,
      feeApplied: nextBaseFee,
      rewardSplit: {
        validator: eligible.length <= 1 ? 10 : 7,
        minersTotal: eligible.length <= 1 ? 0 : 3
      }
    };
    const headerStr = JSON.stringify(header);
    const hash = sha256Hex(Buffer.from(prevHash + headerStr));
    const block: Block = { header, transactions: allTxs, hash, minerSet: lucky };
    this.blocks.push(block);

    // Update base fee for next block
    this.baseFee = nextBaseFee;

    // Update TPS window
    const now = Date.now();
    this.tpsWindow.push({ t: now, count: selectedTxs.length });
    // keep last 60s
    while (this.tpsWindow.length && now - this.tpsWindow[0].t > 60_000) {
      this.tpsWindow.shift();
    }

    // Broadcast updates
    this.broadcastBlock(block);
    this.broadcastMempool();
    this.broadcastState();
  }

  private computeNextBaseFee(): number {
    const last = this.blocks[this.blocks.length - 1];
    const Un = last ? last.header.gasUsed : 0;
    const T = this.gasLimit / 2;
    const n1 = this.baseFee * (1 + ((Un - T) / T) * this.alpha);
    // Clamp to >= 0.000001 NUR
    return Math.max(0.000001, Number(n1.toFixed(6)));
  }

  private weightedPick(list: MinerInfo[]): MinerInfo {
    const total = list.reduce((s, m) => s + m.power, 0);
    let r = Math.random() * total;
    for (const m of list) {
      if ((r -= m.power) <= 0) return m;
    }
    return list[list.length - 1];
  }

  // ----- Snapshots & Broadcasts -----
  snapshot(): ChainSnapshot {
    const now = Date.now();
    const countInWindow = this.tpsWindow.reduce((s, x) => s + x.count, 0);
    const secs = Math.max(1, Math.min(60, (this.tpsWindow.length ? (now - this.tpsWindow[0].t) / 1000 : 1)));
    const tps = Number((countInWindow / secs).toFixed(2));
    const lastValidator = this.blocks.length ? this.blocks[this.blocks.length - 1].header.validatorAddress : undefined;
    return {
      height: this.blocks.length,
      baseFee: this.baseFee,
      gasLimit: this.gasLimit,
      gasTarget: this.gasLimit / 2,
      alpha: this.alpha,
      blocksMined: this.blocks.length,
      minersOnline: this.miners.size,
      mempoolSize: this.mempool.length,
      tps,
      lastValidator
    };
  }

  broadcast(event: string, data: any) {
    const payload = JSON.stringify({ event, data });
    this.wss.clients.forEach((ws: any) => {
      try { ws.send(payload); } catch {}
    });
  }

  broadcastState() { this.broadcast('state', this.snapshot()); }
  broadcastMempool() { this.broadcast('mempool', { size: this.mempool.length }); }
  broadcastMiners() { this.broadcast('miners', Array.from(this.miners.values())); }
  broadcastBlock(block: Block) { this.broadcast('new_block', block); }

  // ----- Explorer -----
  listAddressTx(address: Address): any[] {
    const ret: any[] = [];
    for (const b of this.blocks) {
      for (const tx of b.transactions) {
        if (tx.from === address || tx.to === address) {
          ret.push({
            hash: tx.hash,
            type: (tx as any).type || 'send',
            direction: tx.to === address ? 'received' : (tx.from === address ? 'sent' : ''),
            from: tx.from,
            to: tx.to,
            amount: tx.amount,
            fee: b.header.feeApplied + tx.tip, // fee at block time (stable)
            status: 'confirmed',
            blockHeight: b.header.height,
            timestampUTC: tx.timestamp
          });
        }
      }
    }
    // Pending from mempool
    for (const tx of this.mempool) {
      if (tx.from === address || tx.to === address) {
        ret.push({
          hash: tx.hash,
          type: (tx as any).type || 'send',
          from: tx.from,
          to: tx.to,
          amount: tx.amount,
          fee: this.baseFee + tx.tip,
          status: 'pending',
          timestampUTC: tx.timestamp
        });
      }
    }
    // Newest first
    ret.sort((a, b) => b.timestampUTC - a.timestampUTC);
    return ret;
  }

  findByTxHash(hash: string): { block?: Block; tx?: SignedTx } {
    for (const b of this.blocks) {
      for (const tx of b.transactions) {
        if (tx.hash === hash) return { block: b, tx };
      }
    }
    for (const tx of this.mempool) {
      if (tx.hash === hash) return { tx };
    }
    return {};
  }

  findBlockByHash(hash: string): Block | undefined {
    return this.blocks.find(b => b.hash === hash);
  }

  getBlocksChrono(): Block[] {
    return [...this.blocks].sort((a,b)=>{
      const ta = Date.parse((a.header as any).timestampUTC || (a.header as any).timestamp || '1970-01-01');
      const tb = Date.parse((b.header as any).timestampUTC || (b.header as any).timestamp || '1970-01-01');
      return ta - tb;
    });
  }
}
