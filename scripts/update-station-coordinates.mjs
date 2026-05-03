import { readFile, writeFile } from 'node:fs/promises'

const dataUrl = new URL('../src/data/metro.json', import.meta.url)
const data = JSON.parse(await readFile(dataUrl, 'utf8'))

const bengaluruMetroBBox = '12.75,77.42,13.08,77.80'
const overpassQuery = `[out:json][timeout:60];
(
  node["railway"="station"]["station"="subway"](${bengaluruMetroBBox});
  way["railway"="station"]["station"="subway"](${bengaluruMetroBBox});
  relation["railway"="station"]["station"="subway"](${bengaluruMetroBBox});
  node["public_transport"="station"]["subway"="yes"](${bengaluruMetroBBox});
  way["public_transport"="station"]["subway"="yes"](${bengaluruMetroBBox});
  relation["public_transport"="station"]["subway"="yes"](${bengaluruMetroBBox});
);
out center tags;`

const osmNameByStationId = {
  'city-railway-station': 'Krantivira Sangolli Rayanna Railway Station',
  nayandahalli: 'Pantharapalya - Nayandahalli',
}

function normalize(value) {
  return value
    .toLowerCase()
    .replace(/\bstn\b/g, 'station')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stationKeys(station) {
  return [
    station.id,
    station.name,
    ...station.aliases,
    station.name.replace('Mysuru', 'Mysore'),
    station.name.replace('Yeshwanthpur', 'Yeshwantpur'),
    station.name.replace('Nallurhalli', 'Nallurahalli'),
    station.name.replace('Manjunathanagar', 'Manjunathanagara'),
    station.name.replace('Chickpet', 'Chickpete'),
    station.name.replace('Seetharamapalya', 'Seetharampalya'),
    station.name.replace('Garudacharapalya', 'Garudacharpalya'),
  ].map(normalize)
}

const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`, {
  headers: {
    'User-Agent': 'namma-metro-offline-coordinate-refresh/1.0',
  },
})

if (!response.ok) {
  throw new Error(`Overpass request failed: ${response.status} ${response.statusText}`)
}

const osm = await response.json()
const stationPoints = osm.elements
  .map((element) => ({
    name: element.tags?.name ?? element.tags?.['name:en'] ?? '',
    lat: element.lat ?? element.center?.lat,
    lng: element.lon ?? element.center?.lon,
    osmId: `${element.type}/${element.id}`,
  }))
  .filter((station) => station.name && Number.isFinite(station.lat) && Number.isFinite(station.lng))

const pointsByName = new Map()
for (const point of stationPoints) {
  const key = normalize(point.name)
  pointsByName.set(key, [...(pointsByName.get(key) ?? []), point])
}

const missing = []
const ambiguous = []
const updates = new Map()

for (const station of data.stations) {
  const preferredName = osmNameByStationId[station.id]
  const keys = preferredName ? [normalize(preferredName)] : stationKeys(station)
  const matches = keys.flatMap((key) => pointsByName.get(key) ?? [])
  const uniqueMatches = Array.from(new Map(matches.map((match) => [match.osmId, match])).values())

  if (uniqueMatches.length === 0) {
    missing.push(`${station.id} (${station.name})`)
    continue
  }

  if (uniqueMatches.length > 1) {
    ambiguous.push(`${station.id}: ${uniqueMatches.map((match) => `${match.name} ${match.osmId}`).join(', ')}`)
    continue
  }

  updates.set(station.id, uniqueMatches[0])
}

if (missing.length > 0 || ambiguous.length > 0) {
  throw new Error(
    [
      missing.length > 0 ? `Missing OSM coordinates:\n${missing.map((item) => `- ${item}`).join('\n')}` : '',
      ambiguous.length > 0 ? `Ambiguous OSM coordinates:\n${ambiguous.map((item) => `- ${item}`).join('\n')}` : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
  )
}

data.stations = data.stations.map((station) => {
  const point = updates.get(station.id)
  return {
    ...station,
    lat: Number(point.lat.toFixed(7)),
    lng: Number(point.lng.toFixed(7)),
  }
})

data.dataVersion = '2026.05-osm-coordinates'
data.sourceNotes = data.sourceNotes.map((note) =>
  note.includes('Station coordinates')
    ? 'Station coordinates were refreshed from OpenStreetMap subway station points via Overpass API on 2026-05-03 for offline nearest-station calculation.'
    : note,
)

await writeFile(dataUrl, `${JSON.stringify(data, null, 2)}\n`)

console.log(`Updated ${updates.size} station coordinates from OpenStreetMap.`)
