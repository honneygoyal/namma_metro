import rawMetroData from './metro.json'
import type { MetroData } from '../types'

export const metroData = rawMetroData as MetroData

export const stationById = new Map(metroData.stations.map((station) => [station.id, station]))
export const lineById = new Map(metroData.lines.map((line) => [line.id, line]))

export function getStationName(stationId: string) {
  return stationById.get(stationId)?.name ?? stationId
}

export function getLinesForStation(stationId: string) {
  return metroData.lines.filter((line) => line.stations.includes(stationId))
}

export function getStationSearchText(stationId: string) {
  const station = stationById.get(stationId)
  if (!station) return stationId
  return [station.name, ...station.aliases, station.id].join(' ').toLowerCase()
}
