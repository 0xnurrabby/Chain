
import React, { useEffect, useMemo, useState } from 'react';
import { getAccount, importWallet, createWallet } from '../lib/api';

type Props = {
  address: string | null;
  privatePem: string | null;
  onImported: (newAddress: string, pem: string) => void;
  };

function normalizeToPem(input: string): string {
  const s = (input || '').trim();
  if (/BEGIN (EC )?PRIVATE KEY/.test(s)) return s;
  const b64 = s.replace(/[\r\n\s]/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/=]+$/.test(b64)) throw new Error('Key must be PEM or base64');
  const lines = b64.match(/.{1,64}/g)?.join('\n') ?? b64;
  return `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----`;
}

export default function WalletCard({ address, privatePem, onImported , onLogout}: Props) {
  const [balance, setBalance] = useState<number>(0);
  const [nonce, setNonce] = useState<number>(0);
  const [showKey, setShowKey] = useState<boolean>(false);
  const [importMode, setImportMode] = useState<boolean>(false);
  const [importPem, setImportPem] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);

  // live refresh
  useEffect(() => {
    let stopped = false;
    async function tick() {
      if (!address) return;
      try {
        const acc = await getAccount(address);
        if (!stopped) {
          setBalance(acc.balance || 0);
          setNonce(acc.nonce || 0);
        }
      } catch {}
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => { stopped = true; clearInterval(id); };
  }, [address]);

  async function handleImport() {
    setErr(null);
    try {
      const pem = normalizeToPem(importPem);
      const res = await importWallet(pem);
      onImported(res.address, pem);
      setImportMode(false);
      setImportPem('');
      alert('Wallet imported.');
    } catch (e:any) {
      setErr(e?.message || String(e));
    }
  }

  
  async function handleCreate() {
    try {
      const res = await createWallet(); // server default curve
      onImported(res.address, res.privatePem);
      alert('New wallet created.');
    } catch (e:any) {
      alert(e?.message || String(e));
    }
  }
const oneLine = useMemo(
    () => (privatePem || '').replace(/-----.*KEY-----/g, '').replace(/\s+/g, ''),
    [privatePem]
  );

  return (
    <div className="rounded-2xl p-5 shadow-lg border border-gray-100 bg-gradient-to-br from-sky-50 via-purple-50 to-emerald-50">
      <div className="font-semibold text-lg mb-3 tracking-wide text-slate-800">Wallet</div>

      <div className="text-sm text-slate-600">Address</div>
      <div className="font-mono mono text-sm break-all mb-2">{address || '—'}</div>

      <div className="grid grid-cols-2 gap-4 mb-3 p-3 rounded-xl bg-white/60 ring-1 ring-black/5">
        <div>
          <div className="text-sm text-slate-600">Balance</div>
          <div className="font-semibold text-emerald-700">{balance.toFixed(6)} <span className="text-slate-500">NUR</span></div>
        </div>
        <div>
          <div className="text-sm text-slate-600">Nonce</div>
          <div className="font-semibold text-indigo-700">{nonce}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => { setShowKey((v)=>!v); setImportMode(false); }} className="px-3 py-2 rounded-xl bg-white/70 hover:bg-white transition-all duration-200 shadow-sm ring-1 ring-black/5">
          {showKey ? 'Hide Private Key' : 'Show Private Key'}
        </button>
        <button onClick={() => { setImportMode((v)=>!v); setShowKey(false); }} className="px-3 py-2 rounded-xl bg-white/70 hover:bg-white transition-all duration-200 shadow-sm ring-1 ring-black/5">
          {importMode ? 'Cancel Import' : 'Import Key'}
        </button>
      <button onClick={handleCreate} className="px-3 py-2 rounded-xl bg-white/70 hover:bg-white transition-all duration-200 shadow-sm ring-1 ring-black/5">
          Create New
        </button>
</div>

      {showKey && (
        <div className="mt-3">
          <div className="text-sm text-gray-600 mb-1">Private Key (PEM)</div>
          <textarea className="w-full h-36 p-2 rounded-xl bg-white/70 font-mono mono text-xs ring-1 ring-black/5" readOnly value={privatePem || ''} />
          <div className="flex gap-2 mt-2">
            <button onClick={() => navigator.clipboard?.writeText(privatePem || '')} className="px-3 py-2 rounded-xl bg-white/70 hover:bg-white transition-all duration-200 shadow-sm ring-1 ring-black/5">Copy PEM</button>
            <button onClick={() => navigator.clipboard?.writeText(oneLine)} className="px-3 py-2 rounded-xl bg-white/70 hover:bg-white transition-all duration-200 shadow-sm ring-1 ring-black/5">Copy 1‑line</button>
          </div>
        </div>
      )}

      {importMode && (
        <div className="mt-3">
          <div className="text-sm text-gray-600 mb-1">Paste Private Key (PEM or 1‑line)</div>
          <textarea className="w-full h-36 p-2 rounded-xl bg-white/90 border border-indigo-100 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 outline-none font-mono mono text-xs transition-all"
                    placeholder="PEM (BEGIN...END) or a single-line base64 key"
                    value={importPem} onChange={(e)=>setImportPem(e.target.value)} />
          {err && <div className="text-red-500 text-sm mt-1">{err}</div>}
          <div className="flex gap-2 mt-2">
            <button onClick={handleImport} className="btn-primary px-3 py-2 rounded-xl shadow-sm">Import</button>
            <button onClick={() => { setImportMode(false); setImportPem(''); }} className="px-3 py-2 rounded-xl bg-white/70 hover:bg-white transition-all duration-200 shadow-sm ring-1 ring-black/5">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
