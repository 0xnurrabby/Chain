
import React, { useEffect, useRef, useState } from 'react';
import { ApiState, startMiner, stopMiner } from '../lib/api';
import { short } from '../lib/format';

type Props = {
  state: ApiState | null;
  address: string | null;
  onChanged: () => void;
};

export default function MiningPanel({ state, address, onChanged }: Props) {
  const [running, setRunning] = useState(false);
  const [power, setPower] = useState(5);

  useEffect(() => {
    // No persistent running flag; depends on server. UI only.
  }, []);

  async function handleStart() {
    if (!address) return;
    await startMiner(address, power);
    setRunning(true);
  }
  async function handleStop() {
    if (!address) return;
    await stopMiner(address);
    setRunning(false);
  }

  return (
    <div className="space-y-4 rounded-2xl bg-gradient-to-br from-sky-50 to-slate-50 p-5 ring-1 ring-black/5 shadow-sm">
      <h2 className="text-xl font-semibold tracking-tight text-slate-800">Mining</h2>
      <div className="text-sm text-slate-500">Control your local miner. Blocks every 10s while miners are online.</div>
      <div className="flex items-center gap-3">
        <input type="range" min={1} max={10} value={power} onChange={(e) => setPower(parseInt(e.target.value))} className="w-full accent-sky-600" />
        <div className="text-sm">Device power: <b>{power}</b></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={handleStart} className="h-10 rounded-xl px-4 bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow hover:to-indigo-700 active:scale-[.99] transition">{running ? 'Mining…' : 'Start'}</button>
        <button onClick={handleStop} className="h-10 rounded-xl px-4 bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 active:scale-[.99] transition">Stop</button>
      </div>
      <div className="text-sm text-slate-500">
        Validator pays fee; Rewards: 10 NUR Coin per block (70% for validator, 30% shared by up to 30 miners; 100% to single miner if only one online).
      </div>
      <div className="text-sm text-slate-500">
        Last validator: <b>{state?.lastValidator ? short(state.lastValidator) : '—'}</b>
      </div>
    </div>
  );
}
