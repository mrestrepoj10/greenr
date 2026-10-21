'use client'

import { cn } from '@/lib/utils'
import type { OrientationRow } from '@/lib/edge/types'
import { formatArea, formatRatio } from '@/lib/ui/format'
import { messages } from '@/lib/ui/messages'
import { WWR_RAMP, wwrColorCss } from '@/lib/viewer/color'

export interface WwrTableProps {
  rows: OrientationRow[]
  selectedKey: string | null
  onSelect: (key: string, dbIds: number[]) => void
}

export function WwrTable({ rows, selectedKey, onSelect }: WwrTableProps) {
  return (
    <table className="w-full text-sm" data-testid="wwr-table">
      <thead>
        <tr className="text-xs text-muted-foreground">
          <th scope="col" className="py-1 text-left font-normal">
            {messages.wwr.orientation}
          </th>
          <th scope="col" className="py-1 text-right font-normal">
            {messages.wwr.wall}
          </th>
          <th scope="col" className="py-1 text-right font-normal">
            {messages.wwr.glazing}
          </th>
          <th scope="col" className="py-1 pl-3 text-right font-normal">
            {messages.wwr.ratio}
          </th>
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {rows.map((row) => {
          const key = `wwr:${row.orientation}`
          const noFacade = row.wwr === null
          return (
            <tr
              key={row.orientation}
              data-testid="wwr-row"
              data-orientation={row.orientation}
              aria-selected={selectedKey === key}
              onClick={() => (noFacade ? undefined : onSelect(key, [...row.wallDbIds, ...row.glazingDbIds]))}
              className={cn(
                'h-8 border-t border-border/60',
                noFacade ? 'text-muted-foreground/70' : 'cursor-pointer hover:bg-accent/60',
                selectedKey === key && 'bg-accent',
              )}
            >
              <th scope="row" className="w-10 text-left font-medium">
                {row.orientation}
              </th>
              <td className="text-right">{noFacade ? '' : formatArea(row.wallAreaM2)}</td>
              <td className="text-right">{noFacade ? '' : formatArea(row.glazingAreaM2)}</td>
              <td className="pl-3 text-right">
                {noFacade ? (
                  <span className="text-xs">{messages.wwr.noFacade}</span>
                ) : (
                  <span className="inline-flex items-center justify-end gap-2">
                    <span className="h-1 w-12 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <span
                        className="block h-full"
                        style={{
                          width: `${Math.round(Math.min(1, row.wwr! / WWR_RAMP.to) * 100)}%`,
                          background: wwrColorCss(row.wwr!),
                        }}
                      />
                    </span>
                    <span className="w-9">{formatRatio(row.wwr!)}</span>
                  </span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
