
import React, { useEffect, useState } from 'react';
import { bus } from '../lib/ws';
import { recentBlocks } from '../lib/api';
import { short, utcTime, timeAgo } from '../lib/format';

type BlockHeader = {
  height: number;
  prevHash: string;
  timestampUTC: number;
  nonce: number;
  validatorAddress: string;
  merkleRoot: string;
  txCount: number;
  gasUsed: number;
  feeApplied: number;
  rewardSplit: { validator: number; minersTotal: number };
};
type Block = { header: BlockHeader; transactions: any[]; hash: string; minerSet: string[] };

let subscribedNewBlock = false;
export default function RecentBlocks() {
  const [blocks, setBlocks] = useState<Block[]>([]);

  useEffect(() => {
    // Initial authoritative load: last 5
    recentBlocks(5).then((r) => {
      const items = (r.items || []) as Block[];
      items.sort((a, b) => b.header.height - a.header.height);
      setBlocks(items.slice(0, 5));
    });

    // Subscribe once (guards against HMR/duplicate listeners)
    if (!subscribedNewBlock) {
      subscribedNewBlock = true;
      bus.on('new_block', async () => {
        try {
          const r = await recentBlocks(5);
          const items = (r.items || []) as Block[];
          items.sort((a, b) => b.header.height - a.header.height);
          setBlocks(items.slice(0, 5));
        } catch {}
      });
    }
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-3">Recent Blocks</h2>
      <div className="space-y-3">
        {blocks.map((b, idx) => (
          <BlockItem key={b.hash} block={b} idx={idx} />
        ))}
      </div>
    </div>
  );
}

function BlockItem({ block, idx }: { block: Block; idx: number; }) {
  // Color progression: newest light → older lighter
  const tints = ['#eef5ff', '#effaf5', '#fff7ec', '#f7f1ff'];
  const tint = tints[idx % tints.length];
  return (
    <div className="rounded-2xl p-4" style={{ background: tint }}>
      <div className="flex items-center justify-between">
        <div className="font-semibold">Height #{block.header.height}</div>
        <div className="text-sm text-gray-500">{utcTime(block.header.timestampUTC)} · {timeAgo(block.header.timestampUTC)}</div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm mt-2">
        <div className="col-span-2">Hash: <span className="font-mono break-all">{block.hash}</span></div>
        <div>Txs: <b>{block.header.txCount}</b></div>
        <div>Fee: <b>{block.header.feeApplied.toFixed(6)} NUR</b></div>
      </div>
    </div>
  );
}
