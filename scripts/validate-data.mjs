import { readFile } from 'node:fs/promises'

const data = JSON.parse(await readFile(new URL('../src/data/metro.json', import.meta.url), 'utf8'))
const stationIds = new Set(data.stations.map((station) => station.id))
const errors = []

function assert(condition, message) {
  if (!condition) errors.push(message)
}

assert(data.dataVersion, 'Missing dataVersion')
assert(data.lastUpdated, 'Missing lastUpdated')

for (const station of data.stations) {
  assert(station.id, 'Station without id')
  assert(station.name, `${station.id} missing name`)
  assert(Number.isFinite(station.lat) && Number.isFinite(station.lng), `${station.id} missing coordinates`)
  assert(station.lat >= 12.75 && station.lat <= 13.08, `${station.id} latitude is outside Bengaluru metro bounds`)
  assert(station.lng >= 77.42 && station.lng <= 77.8, `${station.id} longitude is outside Bengaluru metro bounds`)
}

for (const line of data.lines) {
  assert(line.stations.length >= 2, `${line.id} needs at least two stations`)
  assert(line.color, `${line.id} missing color`)
  for (const stationId of line.stations) {
    assert(stationIds.has(stationId), `${line.id} references missing station ${stationId}`)
  }
}

for (const station of data.stations) {
  const lineCount = data.lines.filter((line) => line.stations.includes(station.id)).length
  assert(lineCount > 0, `${station.id} is not on any line`)
}

const names = new Map()
for (const station of data.stations) {
  const normalized = station.name.toLowerCase()
  names.set(normalized, [...(names.get(normalized) ?? []), station.id])
}
for (const [name, ids] of names) {
  assert(ids.length === 1, `Duplicate station name "${name}": ${ids.join(', ')}`)
}

assert(data.fareByStops.length > 0, 'Missing fare bands')
assert(data.fareByStops.some((band) => band.minStops === 0), 'Fare bands must cover zero-stop journey')

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join('\n'))
  process.exit(1)
}

console.log(`Validated ${data.stations.length} stations across ${data.lines.length} lines.`)
