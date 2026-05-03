export type LanguageCode = 'en' | 'kn' | 'hi' | 'ta' | 'te' | 'ml'

export type Facility =
  | 'accessibility'
  | 'bus'
  | 'interchange'
  | 'parking'
  | 'railway'
  | 'toilets'

export type Station = {
  id: string
  name: string
  aliases: string[]
  lat: number
  lng: number
  facilities: Facility[]
  landmarks: string[]
}

export type MetroLine = {
  id: string
  name: string
  shortName: string
  color: string
  textColor: string
  terminalA: string
  terminalB: string
  averageMinutesBetweenStations: number
  stations: string[]
}

export type FareBand = {
  minStops: number
  maxStops: number
  fare: number
}

export type MetroData = {
  dataVersion: string
  lastUpdated: string
  currency: string
  sourceNotes: string[]
  fareByStops: FareBand[]
  lines: MetroLine[]
  stations: Station[]
}

export type RouteSegment = {
  lineId: string
  stationIds: string[]
  direction: string
  minutes: number
}

export type RoutePlan = {
  originId: string
  destinationId: string
  segments: RouteSegment[]
  stationPath: string[]
  interchangeIds: string[]
  stops: number
  fare: number
  minutes: number
}

export type RecentRoute = {
  originId: string
  destinationId: string
  usedAt: string
}

export type JourneyState = {
  route: RoutePlan
  startedAt: string
  currentIndex: number
}

export type TabId = 'plan' | 'journey' | 'map' | 'stations' | 'settings'
