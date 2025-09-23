
import React, { useEffect, useRef, useState } from 'react';
import { sendTx, getAccount, getState } from '../lib/api';

type Props = {
  address: string | null;
  privatePem: string | null;
  nonce: number;
  onSent: () => void;
};

export default function SendForm({ address, privatePem, nonce, onSent }: Props) {
  const nurAddrRe = /^nur[1-9A-HJ-NP-Za-km-z]{25,70}$/;
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toRef = useRef<HTMLInputElement>(null);
  const amtRef = useRef<HTMLInputElement>(null);
  const tipRef = useRef<HTMLInputElement>(null);
  const [baseFee, setBaseFee] = useState(0);

  useEffect(() => { getState().then(s => setBaseFee(s.baseFee)); }, []);

  async function handleSend() {
    if (sending) return;
    setErr(null);
    setSending(true);
    if (!privatePem || privatePem.length < 30) { setErr('No private key in wallet. Create/import wallet first.'); setSending(false); return; }

    try {
      const to = toRef.current?.value.trim() || '';
      if (!nurAddrRe.test(to)) { setErr('Invalid recipient address'); return; }
      const amount = Number(amtRef.current?.value || '0');
      const tip = Number(tipRef.current?.value || '0');

      // Always use authoritative nonce
      const acc = await getAccount(address);
      const nextNonce = (acc?.nonce ?? nonce) + 1;

      const body = { from: address, to, amount, tip, nonce: nextNonce, timestamp: Date.now() };

      const controller = new AbortController();
      const toTimer = setTimeout(() => controller.abort(), 7000);
      try {
        await sendTx(privatePem, body, controller.signal);
        onSent();
        if (toRef.current) toRef.current.value = '';
        if (amtRef.current) amtRef.current.value = '';
        if (tipRef.current) tipRef.current.value = '0.001';
        alert('Transaction submitted to mempool.');
      } finally {
        clearTimeout(toTimer);
      }
    } catch (e: any) {
      const msg = e?.name === 'AbortError' ? 'Network timeout' : (e?.message || String(e));
      setErr(msg);
      alert(msg);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Send NUR</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="text-sm text-gray-500">Recipient (nur...)</div>
          <input ref={toRef} className="w-full p-3 rounded-xl bg-gray-50" placeholder="nur..." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-sm text-gray-500">Amount</div>
            <input ref={amtRef} type="number" step="0.000001" className="w-full p-3 rounded-xl bg-gray-50" placeholder="0.1" />
          </div>
          <div>
            <div className="text-sm text-gray-500">Priority tip</div>
            <input ref={tipRef} type="number" step="0.000001" className="w-full p-3 rounded-xl bg-gray-50" placeholder="0.001" />
          </div>
        </div>
      </div>
      <div className="text-sm text-gray-500">Estimated base fee (dynamic): <b>{baseFee.toFixed(6)} NUR</b></div>
      {err && <div className="text-sm text-red-600">{err}</div>}
      <div className="flex">
        <button onClick={handleSend} disabled={sending} className="btn-primary opacity-100 disabled:opacity-50">{sending ? "Submitting..." : "Submit"}</button>
      </div>
    </div>
  );
}
