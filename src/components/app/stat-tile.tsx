import type { ReactNode } from 'react';
import { Card } from '@eylulg/ui/card';
import { Stat } from '@eylulg/ui/stat';

interface StatTileProps {
  label: string;
  value: number | string;
  context?: ReactNode;
  sparkline?: ReactNode;
}

/** A library Stat on a Card, with a line of context under the figure. */
export const StatTile = ({ label, value, context, sparkline }: StatTileProps) => (
  <Card className='min-w-0'>
    <Stat
      label={label}
      value={typeof value === 'number' ? value.toLocaleString('en-US') : value}
      sparkline={sparkline}
    />
    {context && <p className='text-xs text-tertiary'>{context}</p>}
  </Card>
);
