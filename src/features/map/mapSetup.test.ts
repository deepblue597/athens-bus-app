import { describe, expect, it, vi } from 'vitest'

// mapSetup imports MapLibre's worker URL and CSS, which only exist in a Vite build
vi.mock('maplibre-gl', () => ({ setWorkerUrl: vi.fn() }))
vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?url', () => ({ default: '/worker.mjs' }))
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

const { flattenBuildings } = await import('./mapSetup')

function fakeMap() {
  const layers: Record<string, { minzoom: number; maxzoom: number; visibility?: string }> = {
    building: { minzoom: 13, maxzoom: 14 },
    'building-3d': { minzoom: 14, maxzoom: 24 },
  }
  return {
    layers,
    getLayer: (id: string) => layers[id],
    getLayoutProperty: (id: string) => layers[id]?.visibility,
    setLayoutProperty: vi.fn((id: string, _: string, value: string) => (layers[id].visibility = value)),
    setLayerZoomRange: vi.fn((id: string, min: number, max: number) => Object.assign(layers[id], { minzoom: min, maxzoom: max })),
  }
}

describe('flattenBuildings', () => {
  it('hides the 3D buildings and keeps the flat ones at every zoom', () => {
    const map = fakeMap()
    flattenBuildings(map as never)
    expect(map.layers['building-3d'].visibility).toBe('none')
    expect(map.layers.building).toEqual({ minzoom: 13, maxzoom: 24 })
  })

  it('changes nothing the second time (it runs on every style event)', () => {
    const map = fakeMap()
    flattenBuildings(map as never)
    flattenBuildings(map as never)
    expect(map.setLayoutProperty).toHaveBeenCalledTimes(1)
    expect(map.setLayerZoomRange).toHaveBeenCalledTimes(1)
  })

  it('does nothing before the style has loaded', () => {
    const empty = { getLayer: () => undefined, setLayoutProperty: vi.fn(), setLayerZoomRange: vi.fn() }
    flattenBuildings(empty as never)
    expect(empty.setLayoutProperty).not.toHaveBeenCalled()
  })
})
