
import React, { useEffect, useState } from 'react';
import { ApiState, getState } from '../lib/api';
import { short } from '../lib/format';

type Props = { state: ApiState | null };

export default function LiveCounters({ state }: Props) {
  const [s, setS] = useState<ApiState | null>(state);

  useEffect(() => { setS(state); }, [state]);
  useEffect(() => {
    if (!s) getState().then(setS);
  }, []);

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
      <StatCard label="Blocks" value={s?.blocksMined ?? 0} tint="#eef5ff" />
      <StatCard label="Miners online" value={s?.minersOnline ?? 0} tint="#effaf5" />
      <StatCard label="Base fee" value={(s?.baseFee ?? 0).toFixed(6) + ' NUR'} tint="#fff7ec" />
      <StatCard label="TPS" value={s?.tps ?? 0} tint="#f7f1ff" />
      <StatCard label="Mempool" value={s?.mempoolSize ?? 0} tint="#eef5ff" />
      <StatCard label="Lucky" value={s?.lastValidator ? short(s.lastValidator) : '—'} tint="#effaf5" />
    </div>
  );
}

function StatCard({ label, value, tint }: { label: string; value: any; tint: string; }) {
  return (
    <div className="card-tint" style={{ background: tint }}>
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-semibold text-gray-800">{value}</div>
    </div>
  );
}
