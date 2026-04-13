import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: string;
  delta?: string;
  tone?: 'emerald' | 'amber' | 'slate' | 'cyan';
}

const toneClasses: Record<NonNullable<MetricCardProps['tone']>, string> = {
  emerald: 'from-emerald-500/15 to-emerald-500/5 text-emerald-700',
  amber: 'from-amber-500/15 to-amber-500/5 text-amber-700',
  slate: 'from-slate-500/15 to-slate-500/5 text-slate-700',
  cyan: 'from-cyan-500/15 to-cyan-500/5 text-cyan-700',
};

export function MetricCard({ label, value, delta, tone = 'slate' }: MetricCardProps) {
  return (
    <Card className={cn('border-white/70 bg-gradient-to-br shadow-soft', toneClasses[tone])}>
      <CardContent className="p-5">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className="mt-3 flex items-end justify-between gap-4">
          <div className="text-3xl font-bold tracking-tight text-slate-950">{value}</div>
          {delta ? <div className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600">{delta}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}
