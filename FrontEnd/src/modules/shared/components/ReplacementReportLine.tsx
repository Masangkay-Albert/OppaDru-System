import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';
import type { ReplacementStats } from '../../../services/replacementService';

interface ReplacementReportLineProps {
  endpoint: string;
  fetcher: (input: string, init?: RequestInit) => Promise<Response>;
  from?: string;
  to?: string;
}

const issueLabels: Record<string, string> = {
  hair_or_foreign_object: 'Hair / foreign object',
  wrong_item: 'Wrong item',
  missing_item: 'Missing item',
  spilled_or_damaged: 'Spilled / damaged',
  not_fresh: 'Not fresh',
  other: 'Other',
};

const ReplacementReportLine: React.FC<ReplacementReportLineProps> = ({ endpoint, fetcher, from, to }) => {
  const [stats, setStats] = useState<ReplacementStats | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString();
    const url = `${endpoint}${query ? `?${query}` : ''}`;
    void fetcher(url)
      .then(async (response) => {
        const payload = await response.json() as { replacements?: ReplacementStats; message?: string };
        if (!response.ok) throw new Error(payload.message || 'Replacement report could not be loaded.');
        if (active) {
          setStats(payload.replacements || { count: 0, item_count: 0, cost: 0, by_issue_type: {} });
          setError('');
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Replacement report could not be loaded.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [endpoint, fetcher, from, to]);

  return (
    <section aria-label="Replacements report" className="mb-5 rounded-2xl border border-emerald-100 bg-[var(--oppa-surface)] p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-lg font-bold text-[var(--oppa-text)]">Replacements</h2>
        {loading ? <Loader2 size={17} className="animate-spin text-[var(--oppa-green)]" aria-label="Loading replacement report" />
          : error ? <span className="inline-flex items-center gap-1 text-xs text-red-700"><AlertCircle size={14} />{error}</span>
            : stats && <p className="text-sm font-semibold text-emerald-900">{stats.count} requests · {stats.item_count} items · {formatCurrency(stats.cost)} ingredient cost</p>}
      </div>
      <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">
        {from || to ? `Request date${from ? ` from ${from}` : ''}${to ? ` through ${to}` : ''}` : 'All time · grouped by request date'}
      </p>
      {stats && !loading && !error && (
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(stats.by_issue_type).length === 0
            ? <p className="text-xs text-[var(--oppa-text-muted)]">No replacement items recorded in this period.</p>
            : Object.entries(stats.by_issue_type).map(([issue, value]) => (
              <span key={issue} className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-900">
                {issueLabels[issue] || issue.replaceAll('_', ' ')}: {value.count} · {value.item_count} items · {formatCurrency(value.cost)}
              </span>
            ))}
        </div>
      )}
    </section>
  );
};

export default ReplacementReportLine;
