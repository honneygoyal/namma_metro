import { lineById, metroData, stationById } from '../data/metro'
import type { MetroLine, RoutePlan, RouteSegment } from '../types'

type StateKey = `${string}::${string}`

type Edge = {
  to: StateKey
  minutes: number
}

type Previous = {
  key: StateKey
}

const transferMinutes = 6
export const maxReliableLocationAccuracyMeters = 500
export const maxAutoSelectStationDistanceMeters = 2500

function keyOf(stationId: string, lineId: string): StateKey {
  return `${stationId}::${lineId}`
}

function parseKey(key: StateKey) {
  const [stationId, lineId] = key.split('::')
  return { stationId, lineId }
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items))
}

function buildGraph() {
  const graph = new Map<StateKey, Edge[]>()
  const stationLines = new Map<string, string[]>()

  metroData.lines.forEach((line) => {
    line.stations.forEach((stationId, index) => {
      const key = keyOf(stationId, line.id)
      graph.set(key, graph.get(key) ?? [])
      stationLines.set(stationId, [...(stationLines.get(stationId) ?? []), line.id])

      const nextStationId = line.stations[index + 1]
      if (nextStationId) {
        const nextKey = keyOf(nextStationId, line.id)
        graph.get(key)?.push({ to: nextKey, minutes: line.averageMinutesBetweenStations })
        graph.set(nextKey, graph.get(nextKey) ?? [])
        graph.get(nextKey)?.push({ to: key, minutes: line.averageMinutesBetweenStations })
      }
    })
  })

  stationLines.forEach((lineIds, stationId) => {
    lineIds.forEach((fromLine) => {
      lineIds
        .filter((toLine) => toLine !== fromLine)
        .forEach((toLine) => {
          graph.get(keyOf(stationId, fromLine))?.push({
            to: keyOf(stationId, toLine),
            minutes: transferMinutes,
          })
        })
    })
  })

  return graph
}

const graph = buildGraph()

function findDirection(line: MetroLine, fromStationId: string, toStationId: string) {
  const fromIndex = line.stations.indexOf(fromStationId)
  const toIndex = line.stations.indexOf(toStationId)
  const terminalId = toIndex > fromIndex ? line.stations[line.stations.length - 1] : line.stations[0]
  return stationById.get(terminalId ?? toStationId)?.name ?? line.terminalB
}

function getFare(stops: number) {
  return metroData.fareByStops.find((band) => stops >= band.minStops && stops <= band.maxStops)?.fare ?? 90
}

function toSegments(keys: StateKey[]): RouteSegment[] {
  const rawSegments: RouteSegment[] = []
  let currentLine = parseKey(keys[0]).lineId
  let currentStations: string[] = [parseKey(keys[0]).stationId]

  keys.slice(1).forEach((key) => {
    const { stationId, lineId } = parseKey(key)
    const lastStation = currentStations[currentStations.length - 1]
    if (lineId !== currentLine) {
      rawSegments.push(makeSegment(currentLine, currentStations))
      currentLine = lineId
      currentStations = [stationId]
      return
    }

    if (stationId !== lastStation) {
      currentStations.push(stationId)
    }
  })

  rawSegments.push(makeSegment(currentLine, currentStations))
  return rawSegments.filter((segment) => segment.stationIds.length > 1)
}

function makeSegment(lineId: string, stationIds: string[]): RouteSegment {
  const line = lineById.get(lineId)
  const firstStation = stationIds[0]
  const lastStation = stationIds[stationIds.length - 1] ?? firstStation
  const stops = Math.max(stationIds.length - 1, 0)

  return {
    lineId,
    stationIds,
    direction: line ? findDirection(line, firstStation, lastStation) : lastStation,
    minutes: Math.round(stops * (line?.averageMinutesBetweenStations ?? 2.3)),
  }
}

export function planRoute(originId: string, destinationId: string): RoutePlan | null {
  if (originId === destinationId) {
    return {
      originId,
      destinationId,
      segments: [],
      stationPath: [originId],
      interchangeIds: [],
      stops: 0,
      fare: getFare(0),
      minutes: 0,
    }
  }

  const originLines = metroData.lines.filter((line) => line.stations.includes(originId))
  const destinationKeys = new Set(
    metroData.lines.filter((line) => line.stations.includes(destinationId)).map((line) => keyOf(destinationId, line.id)),
  )

  const distances = new Map<StateKey, number>()
  const previous = new Map<StateKey, Previous>()
  const queue = originLines.map((line) => {
    const key = keyOf(originId, line.id)
    distances.set(key, 0)
    return key
  })

  let finalKey: StateKey | null = null

  while (queue.length > 0) {
    queue.sort((a, b) => (distances.get(a) ?? Infinity) - (distances.get(b) ?? Infinity))
    const current = queue.shift()
    if (!current) break
    const currentDistance = distances.get(current) ?? Infinity

    if (destinationKeys.has(current)) {
      finalKey = current
      break
    }

    graph.get(current)?.forEach((edge) => {
      const candidateDistance = currentDistance + edge.minutes
      if (candidateDistance < (distances.get(edge.to) ?? Infinity)) {
        distances.set(edge.to, candidateDistance)
        previous.set(edge.to, { key: current })
        if (!queue.includes(edge.to)) queue.push(edge.to)
      }
    })
  }

  if (!finalKey) return null

  const keys: StateKey[] = [finalKey]
  while (previous.has(keys[0])) {
    keys.unshift(previous.get(keys[0])!.key)
  }

  const segments = toSegments(keys)
  const stationPath = unique(keys.map((key) => parseKey(key).stationId))
  const interchangeIds = stationPath.filter((stationId) => segments.filter((segment) => segment.stationIds.includes(stationId)).length > 1)
  const stops = Math.max(stationPath.length - 1, 0)
  const transferCount = Math.max(segments.length - 1, 0)
  const minutes = Math.round(segments.reduce((total, segment) => total + segment.minutes, 0) + transferCount * transferMinutes)

  return {
    originId,
    destinationId,
    segments,
    stationPath,
    interchangeIds,
    stops,
    fare: getFare(stops),
    minutes,
  }
}

export function findNearestStation(lat: number, lng: number) {
  return metroData.stations
    .map((station) => ({
      station,
      distanceMeters: haversineMeters(lat, lng, station.lat, station.lng),
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters)[0]
}

export function isNearestStationReliable(distanceMeters: number, accuracyMeters: number) {
  return (
    Number.isFinite(distanceMeters) &&
    Number.isFinite(accuracyMeters) &&
    accuracyMeters <= maxReliableLocationAccuracyMeters &&
    distanceMeters <= maxAutoSelectStationDistanceMeters
  )
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const radius = 6371000
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
