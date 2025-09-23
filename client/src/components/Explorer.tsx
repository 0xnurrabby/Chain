import React, { useEffect, useRef, useState } from 'react';
import { explorerByAddress, explorerByTx, explorerBlock, addressOverview } from '../lib/api';

function fmtTime(t?: number | string) {
  if (t == null as any) return '—' as any;
  const n = typeof t === 'string' ? Number(t) : t;
  if (!Number.isFinite(n)) return String(t);
  const ms = n > 1e12 ? n : n * 1000; // seconds or ms
  try { return new Date(ms).toLocaleString(); } catch { return String(t); }
}


type TxItem = {
  hash: string;
  from: string;
  to: string;
  amount: number | string;
  fee?: number | string;
  status?: string;
  blockHeight?: number;
  block?: number; // sometimes backend uses 'block'
  timestampUTC?: string;
  type?: string; // mining_reward / send / received etc.
  direction?: 'sent' | 'received';
};

type AddressPage = {
  items: TxItem[];
  total?: number;
  page?: number;
  pageSize?: number;
};

type BlockView = {
  header: {
    height: number;
    hash: string;
    prevHash: string;
    merkle: string;
    validator: string;
    timestampUTC: string;
    txCount: number;
    feeUsed: number | string;
  };
  txs: TxItem[];
};

type Overview = {
  address: string;
  balance: number | string;
  nonce?: number;
  fundedBy?: {
    from: string;
    hash: string;
    block: number;
    timeUTC: string;
  } | null;
  // sent removed from UI – we keep type for compatibility
  sent?: {
    latest?: { hash: string; block: number; timeUTC: string } | null;
    first?: { hash: string; block: number; timeUTC: string } | null;
  };
};

const modes = [
  { label: 'By Address', value: 'address' },
  { label: 'By Tx Hash / Block Hash', value: 'hash' },
] as const;

type Mode = typeof modes[number]['value'];

export default function Explorer() {
  // ---------- helpers ----------
  const fmtNUR = (v: any) => {
    const n = typeof v === 'number' && isFinite(v) ? v : Number(v) || 0;
    return n.toFixed(6);
  };

  // ---------- state ----------
  const [mode, setMode] = useState<Mode>('address');
  const inputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<TxItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(5);

  const [blockView, setBlockView] = useState<BlockView | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // ---------- actions ----------
  async function handleSearch() {
    const q = (inputRef.current?.value || '').trim();
    if (!q) {
      setItems([]);
      setTotal(0);
      setBlockView(null);
      setOverview(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (mode === 'address') {
        // fetch overview + list concurrently
        const [ov, list] = await Promise.all([
          addressOverview(q),
          explorerByAddress(q, 1, pageSize) as Promise<AddressPage>,
        ]);
        setOverview(ov as Overview);
        setItems(list.items || []);
        setTotal(Number(list.total || (list.items ? list.items.length : 0)));
        setPage(1);
        setBlockView(null);
      } else {
        // hash mode – try tx, then block
        // hash mode – try tx first; if not found, try block (robust, no crash)
        setOverview(null);
        try {
          const res: any = await explorerByTx(q);
          if (res && (res.tx || (res.items && res.items.length))) {
            const it = res.items ? res.items[0] : res.tx;
            const blk = res.block;
            const txItem = {
              hash: it?.hash || q,
              
              from: it?.from || '',
              to: it?.to || '',
              amount: it?.amount ?? 0,
              fee: (blk ? (blk.header?.feeApplied ?? 0) : 0) + ((it?.tip as any) ?? 0),
              status: blk ? 'confirmed' : 'pending',
              blockHeight: blk ? blk.header?.height : undefined,
              timestampUTC: (it as any)?.timestamp,
              type: (it as any).type || 'send',
            } as any;
            setItems([txItem]);
            setTotal(1);
            setBlockView(null);
          } else {
            throw new Error('notx');
          }
        } catch (_) {
          // Not a tx; try block. If that fails too, show empty state gracefully.
          try {
            const b = await explorerBlock(q);
            setBlockView(b as any);
            setItems([]);
            setTotal(0);
          } catch (e) {
            setBlockView(null);
            setItems([]);
            setTotal(0);
          }
        }
      }
    } catch (e:any) {
      setError(e?.message || 'Failed to fetch.');
      setOverview(null);
      setBlockView(null);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }
  async function changePage(next: number) {
    if (mode !== 'address' || !overview?.address) return;
    if (next < 1) return;
    const maxPage = Math.max(1, Math.ceil((total || 0) / pageSize));
    if (next > maxPage) return;

    setLoading(true);
    try {
      const list = (await explorerByAddress(
        overview.address,
        next,
        pageSize,
      )) as AddressPage;
      setItems(list.items || []);
      setTotal(Number(list.total || (list.items ? list.items.length : 0)));
      setPage(next);
    } finally {
      setLoading(false);
    }
  }

  function onRowsChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const s = Number(e.target.value) || 5;
    setPageSize(s);
    // re-search with the new pageSize
    setTimeout(() => handleSearch(), 0);
  }

  // Enter pressed → search
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const h = (ev: KeyboardEvent) => {
      if (ev.key === 'Enter') handleSearch();
    };
    el.addEventListener('keydown', h);
    return () => el.removeEventListener('keydown', h);
  }, []);

  // ---------- render ----------
  return (
    <div className="rounded-2xl p-5 bg-gradient-to-br from-sky-50 to-slate-50 ring-1 ring-black/5 shadow-sm">
      {/* Search controls */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <select
          className="px-3 py-2 rounded-xl ring-1 ring-slate-200 bg-white focus:ring-2 focus:ring-sky-400 outline-none transition"
          value={mode}
          onChange={(e) => {
            setMode(e.target.value as Mode);
            setOverview(null);
            setBlockView(null);
            setItems([]);
            setTotal(0);
          }}
        >
          {modes.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

        <input className="h-10 flex-1 min-w-[280px] rounded-xl border border-slate-300/70 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
          ref={inputRef}
          placeholder={mode === 'address' ? 'nur...' : 'tx or block hash'}
          className="flex-1 px-3 py-2 rounded-xl ring-1 ring-black/10 bg-white"
        />

        <button className="h-10 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-4 text-sm font-semibold text-white shadow-sm hover:shadow-md hover:from-sky-700 hover:to-indigo-700 active:scale-[.99] transition"
          onClick={handleSearch}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow"
          disabled={loading}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-slate-500">Show rows:</span>
          <select
            className="px-2 py-1 rounded-lg ring-1 ring-black/10 bg-white"
            value={pageSize}
            onChange={onRowsChange}
          >
            {[5, 10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Overview (Address mode only) */}
      {error && (
        <div className="mt-3 text-red-600 text-sm">{error}</div>
      )}
      {mode === 'address' && (
        <>
          {overview ? (
            <div className="mt-3 rounded-2xl p-4 bg-white/70 ring-1 ring-black/5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Balance */}
                <div>
                  <div className="text-sm text-slate-500 mb-1">Balance</div>
                  <div className="font-semibold">
                    {fmtNUR((overview as any)?.balance ?? 0)} NUR
                  </div>
                  <div className="mt-2 text-xs text-slate-500">Nonce</div>
                  <div className="text-xs">{(overview as any)?.nonce ?? 0}</div>
                </div>

                {/* Funded By */}
                <div>
                  <div className="text-sm text-slate-500 mb-1">Funded By</div>
                  {overview.fundedBy ? (
                    <div className="font-mono break-all leading-5">
                      <div className="text-[13px]">
                        {(overview as any)?.fundedBy?.from || '—'}
                      </div>
                      <div className="text-[12px]">
                        Hash: {(overview as any)?.fundedBy?.hash || '—'}
                      </div>
                      <div className="text-[12px]">
                        Block: {(overview as any)?.fundedBy?.block ?? '—'}
                      </div>
                      <div className="text-[12px]">
                        Time {fmtTime(fmtTime(overview?.fundedBy?.timeUTC as any) as any)}
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-500 text-[13px]">—</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3 text-slate-500 text-sm">No overview data</div>
          )}
        </>
      )}

      {/* Results */}
      <div className="mt-4" />

      {/* Tx list (address mode) */}
      {mode === 'address' && items.length > 0 && (
        <>
          <div className="text-sm text-slate-600 mb-2">
            Showing {(page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, total)} of {total} transactions
          </div>

          <div className="space-y-3">
            {(items || []).slice((page - 1) * pageSize, page * pageSize).map((tx) => {
              const blk = tx.blockHeight ?? tx.block;
              return (
                <div
                  key={tx.hash}
                  className="rounded-2xl p-4 bg-white ring-1 ring-black/5"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">HASH</div>
                      <div className="font-mono break-all">{tx.hash}</div>
                      <div className="mt-2 text-xs text-slate-500">TO</div>
                      <div className="font-mono break-all">{tx.to}</div>
                      <div className="mt-2 text-xs text-slate-500">
                        Direction
                      </div>
                      <div className="capitalize">
                        {tx.direction || (tx.from === overview?.address ? 'sent' : 'received')}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">Amount</div>
                      <div>{fmtNUR(tx.amount)} NUR</div>
                      <div className="mt-2 text-xs text-slate-500">Block</div>
                      <div>Block {blk ?? '—'}</div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500 mb-1">FROM</div>
                      <div className="font-mono break-all">{tx.from}</div>
                      <div className="mt-2 text-xs text-slate-500">Type</div>
                      <div>{(tx as any).type || ((tx as any).from === 'nurCOINBASE' ? 'mining_reward' : 'send')}</div>
                      <div className="mt-2 text-xs text-slate-500">Fee</div>
                      <div>{tx.fee != null ? `${fmtNUR(tx.fee)} NUR` : '—'}</div>
                      <div className="mt-2 text-xs text-slate-500">Status</div>
                      <div>{tx.status || '—'}</div>
                      <div className="mt-2 text-xs text-slate-500">Time</div>
                      <div>{fmtTime(((tx as any).timestamp ?? (tx as any).timestampUTC ?? (blockView as any)?.header?.timestampUTC) as any)}</div>
                    </div>

                    {/* spacer / future actions */}
                    <div />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="mt-4 flex items-center gap-2">
            <button className="h-10 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-4 text-sm font-semibold text-white shadow-sm hover:shadow-md hover:from-sky-700 hover:to-indigo-700 active:scale-[.99] transition"
              className="h-10 rounded-xl px-4 bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow hover:to-indigo-700 active:scale-[.99] transition"
              onClick={() => changePage(page - 1)}
              disabled={page <= 1}
            >
              Prev
            </button>
            <div className="text-sm text-slate-600">
              Page {page} / {Math.max(1, Math.ceil((total || 0) / pageSize))}
            </div>
            <button className="h-10 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-4 text-sm font-semibold text-white shadow-sm hover:shadow-md hover:from-sky-700 hover:to-indigo-700 active:scale-[.99] transition"
              className="h-10 rounded-xl px-4 bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow hover:to-indigo-700 active:scale-[.99] transition"
              onClick={() => changePage(page + 1)}
              disabled={page >= Math.max(1, Math.ceil((total || 0) / pageSize))}
            >
              Next
            </button>
          </div>
        </>
      )}

      {/* Block view (hash mode when hash is a block) */}
      {mode === 'hash' && blockView && (
        <div className="rounded-2xl p-4 bg-white ring-1 ring-black/5">
          <div className="text-lg font-semibold mb-2">
            Block #{(blockView as any)?.header?.height ?? '—'}
          </div>
          <div className="font-mono text-[13px] break-all">
            Hash: {blockView.hash}
            <br />
            Prev: {blockView.header.prevHash}
            <br />
            Merkle: {(blockView.header as any)?.merkleRoot || '—'}
            <br />
            Validator: {(blockView.header as any)?.validatorAddress || '—'}
            <br />
            Timestamp: {fmtTime((blockView.header as any)?.timestampUTC as any)}
            <br />
            Tx count: {(blockView as any)?.header?.txCount ?? 0}
            <br />
            Fee used: {fmtNUR(((blockView as any)?.header?.feeApplied) ?? 0)} NUR
          </div>

          <div className="mt-4 text-sm text-slate-600">Transactions</div>
          <div className="space-y-3 mt-2">
            {((blockView as any)?.transactions || []).map((tx:any) => (
              <div
                key={tx.hash}
                className="rounded-xl p-3 bg-white/70 ring-1 ring-black/5"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">HASH</div>
                    <div className="font-mono break-all">{tx.hash}</div>
                    <div className="mt-2 text-xs text-slate-500">TO</div>
                    <div className="font-mono break-all">{tx.to}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">FROM</div>
                    <div className="font-mono break-all">{tx.from}</div>
                    <div className="mt-2 text-xs text-slate-500">Amount</div>
                    <div>{fmtNUR(tx.amount)} NUR</div>
                    <div className="mt-2 text-xs text-slate-500">Type</div>
                    <div>{(tx as any).type || ((tx as any).from === 'nurCOINBASE' ? 'mining_reward' : 'send')}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Fee</div>
                  <div>{(() => { const val = (tx as any).fee ?? (tx as any).tip ?? 0; return `${fmtNUR(val)} NUR`; })()}</div>
                  <div className="mt-2 text-xs text-slate-500">Status</div>
                  <div>{'confirmed'}</div>
                  <div className="mt-2 text-xs text-slate-500">Time</div>
                  <div>{fmtTime(((tx as any).timestampUTC ?? (tx as any).timestamp) as any)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hash mode – only tx (not a block) */}
      {mode === 'hash' && !blockView && items.length > 0 && (
        <div className="space-y-3">
          {items.map((tx) => (
            <div key={tx.hash} className="rounded-2xl p-4 bg-white ring-1 ring-black/5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <div className="text-xs text-slate-500 mb-1">HASH</div>
                  <div className="font-mono break-all">{tx.hash}</div>
                  <div className="mt-2 text-xs text-slate-500">TO</div>
                  <div className="font-mono break-all">{tx.to}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">FROM</div>
                  <div className="font-mono break-all">{tx.from}</div>
                  <div className="mt-2 text-xs text-slate-500">Amount</div>
                  <div>{fmtNUR(tx.amount)} NUR</div>
                  <div className="mt-2 text-xs text-slate-500">Type</div>
                  <div>{(tx as any).type || ((tx as any).from === 'nurCOINBASE' ? 'mining_reward' : 'send')}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Fee</div>
                  <div>{(() => { const val = (tx as any).fee ?? (tx as any).tip ?? 0; return `${fmtNUR(val)} NUR`; })()}</div>
                  <div className="mt-2 text-xs text-slate-500">Status</div>
                  <div>{'confirmed'}</div>
                  <div className="mt-2 text-xs text-slate-500">Time</div>
                  <div>{fmtTime(((tx as any).timestampUTC ?? (tx as any).timestamp) as any)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty states */}
      {items.length === 0 && !blockView && (
        <div className="mt-4 text-slate-500 text-sm">No transactions found.</div>
      )}
    </div>
  );
}