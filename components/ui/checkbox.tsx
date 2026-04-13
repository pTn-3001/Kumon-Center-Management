import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({ className, checked, onCheckedChange, ...props }, ref) => {
  return (
    <label className="inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded border border-input bg-background text-primary shadow-sm transition hover:border-kumon-500">
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={(event) => onCheckedChange?.(event.target.checked)}
        className="sr-only"
        {...props}
      />
      <span className={cn('flex h-4 w-4 items-center justify-center rounded-sm', checked ? 'bg-kumon-500 text-white' : 'bg-transparent', className)}>
        {checked ? <Check className="h-3.5 w-3.5" /> : null}
      </span>
    </label>
  );
});
Checkbox.displayName = 'Checkbox';

export { Checkbox };
