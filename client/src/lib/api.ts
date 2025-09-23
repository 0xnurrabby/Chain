
export type ApiState = {
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
};

export async function jsonOrThrow(r: Response) {
  let data: any = null;
  try { data = await r.json(); } catch {}
  if (!r.ok) throw new Error((data && data.error) || r.statusText || 'Request failed');
  return data;
}

// -------- Wallet --------
export async function createWallet(curve: string = 'P-256') {
  const r = await fetch('/api/wallet/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ curve }),
  });
  return jsonOrThrow(r);
}

export async function importWallet(pem: string) {
  const r = await fetch('/api/wallet/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ privatePem: pem }),
  });
  return jsonOrThrow(r);
}

export async function getAccount(address: string) {
  const r = await fetch(`/api/wallet/${address}`);
  return jsonOrThrow(r);
}

// -------- Mining --------
export async function startMiner(address: string, power: number) {
  const r = await fetch('/api/miner/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address, power }),
  });
  return jsonOrThrow(r);
}

export async function stopMiner(address: string) {
  const r = await fetch('/api/miner/stop', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address }),
  });
  return jsonOrThrow(r);
}

// -------- Transactions --------
export async function sendTx(privatePem: string, body: any, signal?: AbortSignal) {
  const r = await fetch('/api/tx/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ body, privatePem }),
    signal,
  });
  return jsonOrThrow(r);
}

// -------- Explorer --------
export async function explorerByAddress(address: string) {
  const r = await fetch(`/api/explorer/address/${address}`);
  return jsonOrThrow(r);
}
export async function explorerByTx(hash: string) {
  const r = await fetch(`/api/explorer/tx/${hash}`);
  return jsonOrThrow(r);
}
export async function explorerBlock(hash: string) {
  const r = await fetch(`/api/explorer/block/${hash}`);
  return jsonOrThrow(r);
}


// -------- Overview --------
export async function addressOverview(address: string) {
  const r = await fetch(`/api/address/overview?address=${encodeURIComponent(address)}`);
  return jsonOrThrow(r);
}
// -------- State --------
export async function getState(): Promise<ApiState> {
  const r = await fetch('/api/state');
  return jsonOrThrow(r);
}

export async function recentBlocks(limit: number = 50) {
  const r = await fetch(`/api/blocks/recent?limit=${limit}`);
  return jsonOrThrow(r);
}
