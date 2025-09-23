import React, { useEffect, useMemo, useState } from 'react';
import { bus } from '../lib/ws';
import { ApiState, createWallet, getAccount, importWallet } from '../lib/api';
import WalletCard from './WalletCard';
import LiveCounters from './LiveCounters';
import SendForm from './SendForm';
import MiningPanel from './MiningPanel';
import RecentBlocks from './RecentBlocks';
import InfoPanel from './InfoPanel';
import Explorer from './Explorer';
import CatBadge from './CatBadge'; // <-- added

export default function App() {
  const [state, setState] = useState<ApiState | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [privatePem, setPrivatePem] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [nonce, setNonce] = useState<number>(0);

  useEffect(() => {
    bus.connect();
    const off = bus.on('state', (s) => setState(s));
    const saved = localStorage.getItem('nur_wallet');
    if (saved) {
      const obj = JSON.parse(saved);
      setAddress(obj.address);
      setPrivatePem(obj.privatePem);
      refresh(obj.address);
    }
    return () => { off && off(); };
  }, []);

  async function refresh(addr: string) {
    const acc = await getAccount(addr);
    setBalance(acc.balance);
    setNonce(acc.nonce);
  }

  async function handleCreate() {
    const w = await createWallet();
    localStorage.setItem('nur_wallet', JSON.stringify({ address: w.address, privatePem: w.privatePem }));
    setAddress(w.address);
    setPrivatePem(w.privatePem);
    await refresh(w.address);
  }

  async function handleImport(pem: string) {
    const w = await importWallet(pem);
    localStorage.setItem('nur_wallet', JSON.stringify({ address: w.address, privatePem: pem }));
    setAddress(w.address);
    setPrivatePem(pem);
    await refresh(w.address);
  }

  return (
    <div className="min-h-screen p-6 relative">
      <div className="w-full mx-auto space-y-6 px-4 sm:px-6 lg:px-8 max-w-none">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold text-gray-800">NurChain</h1>
          <div className="text-sm text-gray-500"></div>
        </header>

        <LiveCounters state={state} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-6">
            <div className="card">
              <WalletCard address={address} privatePem={privatePem} onImported={(addr,pem)=>{ localStorage.setItem('nur_wallet', JSON.stringify({ address: addr, privatePem: pem })); setAddress(addr); setPrivatePem(pem); refresh(addr); }} />
            </div>
            <div className="card">
              <MiningPanel state={state} address={address} onChanged={() => address && refresh(address)} />
            </div>
            <InfoPanel />
          </div>
          <div className="md:col-span-2 space-y-6">
            <div className="card">
              <Explorer address={address} privatePem={privatePem} nonce={nonce} onSent={() => address && refresh(address)} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card-tint" style={{ background: '#eef5ff' }}>
                <RecentBlocks />
              </div>
              <div className="card-tint" style={{ background: '#effaf5' }}>
                <SendForm address={address} privatePem={privatePem} nonce={nonce} onSent={() => address && refresh(address)} />
              </div>
            </div>
          </div>
        </div>

      </div>
      <CatBadge /> {/* <-- added */}
    </div>
  );
}
