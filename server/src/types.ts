
export type Address = string; // 'nur' + base58(pubkeyHash)

export interface Account {
  address: Address;
  balance: number; // NUR
  nonce: number;
}

export interface TxBody {
  from: Address;
  to: Address;
  amount: number; // NUR
  tip: number; // NUR priority fee
  nonce: number;
  timestamp: number; // ms since epoch (UTC)
}

export interface SignedTx extends TxBody {
  pubKeyPem: string; // PEM for verification
  signatureDerBase64: string;
  hash: string; // sha256 of canonical tx encoding
}

export interface BlockHeader {
  height: number;
  prevHash: string;
  timestampUTC: number; // ms since epoch
  nonce: number; // showcase only
  validatorAddress: Address;
  merkleRoot: string;
  txCount: number;
  gasUsed: number;
  feeApplied: number; // baseFee used (NUR) for this block
  rewardSplit: {
    validator: number;
    minersTotal: number;
  }
}

export interface Block {
  header: BlockHeader;
  transactions: SignedTx[];
  hash: string;
  minerSet: Address[]; // lucky 30
}

export interface MinerInfo {
  address: Address;
  power: number; // 1..10
}

export interface ChainSnapshot {
  height: number;
  baseFee: number;
  gasLimit: number;
  gasTarget: number;
  alpha: number;
  blocksMined: number;
  minersOnline: number;
  mempoolSize: number;
  tps: number;
  lastValidator?: string;
}

export interface ExplorerTx {
  hash: string;
  from: Address;
  to: Address;
  amount: number;
  fee: number;
  status: 'confirmed' | 'pending';
  blockHeight?: number;
  timestampUTC: number;
  type?: 'send' | 'mining_reward' | 'received';
}

