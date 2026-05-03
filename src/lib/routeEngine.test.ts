import { describe, expect, it } from 'vitest'
import { findNearestStation, isNearestStationReliable, planRoute } from './routeEngine'

describe('route engine', () => {
  it('plans same-line routes', () => {
    const route = planRoute('majestic', 'indiranagar')

    expect(route).not.toBeNull()
    expect(route?.segments).toHaveLength(1)
    expect(route?.segments[0].lineId).toBe('purple')
    expect(route?.stops).toBeGreaterThan(0)
  })

  it('plans interchange routes', () => {
    const route = planRoute('whitefield-kadugodi', 'silk-institute')

    expect(route).not.toBeNull()
    expect(route?.interchangeIds).toContain('majestic')
    expect(route?.segments.map((segment) => segment.lineId)).toEqual(['purple', 'green'])
  })

  it('plans yellow line transfers through RV Road', () => {
    const route = planRoute('jayanagar', 'electronic-city')

    expect(route).not.toBeNull()
    expect(route?.interchangeIds).toContain('rv-road')
    expect(route?.segments.map((segment) => segment.lineId)).toEqual(['green', 'yellow'])
  })

  it('handles origin equal to destination', () => {
    const route = planRoute('majestic', 'majestic')

    expect(route?.stops).toBe(0)
    expect(route?.minutes).toBe(0)
    expect(route?.fare).toBe(10)
  })

  it('supports reverse direction routes', () => {
    const route = planRoute('challaghatta', 'whitefield-kadugodi')

    expect(route).not.toBeNull()
    expect(route?.stationPath[0]).toBe('challaghatta')
    expect(route?.stationPath[route.stationPath.length - 1]).toBe('whitefield-kadugodi')
  })

  it('finds the physically nearest station from coordinates', () => {
    const nearest = findNearestStation(12.9758, 77.5729)

    expect(nearest.station.id).toBe('majestic')
    expect(nearest.distanceMeters).toBeLessThan(25)
  })

  it('only trusts nearby precise fixes for auto-selecting the current station', () => {
    expect(isNearestStationReliable(250, 30)).toBe(true)
    expect(isNearestStationReliable(4200, 30)).toBe(false)
    expect(isNearestStationReliable(250, 1800)).toBe(false)
  })
})
