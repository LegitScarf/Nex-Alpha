import React from 'react'
import dynamic from 'next/dynamic'

// Dynamically import react-plotly.js to prevent SSR issues (depends on document/window)
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false }) as any

interface PlotlyChartProps {
  spec: any
}

export default function PlotlyChart({ spec }: PlotlyChartProps) {
  if (!spec) return null

  // Extract all valid plot specs (handling single specs vs multiple nested sub-charts)
  const plots: any[] = []
  if (spec.data) {
    plots.push(spec)
  } else {
    Object.keys(spec).forEach(key => {
      if (spec[key] && typeof spec[key] === 'object' && Array.isArray(spec[key].data)) {
        plots.push({
          title: key.replace(/_/g, ' '),
          data: spec[key].data,
          layout: spec[key].layout || {}
        })
      }
    })
  }

  if (plots.length === 0) return null

  return (
    <div className="flex flex-col gap-6 w-full">
      {plots.map((plot, pIdx) => {
        const layout = {
          ...plot.layout,
          autosize: true,
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          font: {
            color: '#334155',
            family: 'JetBrains Mono, monospace',
          },
          margin: { l: 50, r: 30, t: 50, b: 50 },
        }

        const data = (plot.data || []).map((trace: any) => ({
          ...trace,
          marker: {
            ...trace.marker,
            color: trace.marker?.color || '#4f86c6',
          }
        }))

        return (
          <div key={pIdx} className="w-full h-[400px] rounded-lg overflow-hidden border border-accent-border/50 bg-black/40 p-4 flex flex-col">
            {plot.title && (
              <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mb-2 block font-bold">
                📈 {plot.title}
              </span>
            )}
            <div className="flex-1 min-h-0">
              <Plot
                data={data}
                layout={layout}
                useResizeHandler={true}
                className="w-full h-full"
                config={{ responsive: true, displayModeBar: false }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
