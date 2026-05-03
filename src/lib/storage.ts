import localforage from 'localforage'
import type { JourneyState, LanguageCode, RecentRoute } from '../types'

localforage.config({
  name: 'NammaMetroOffline',
  storeName: 'commuter_state',
})

const recentRoutesKey = 'recent-routes'
const favoritesKey = 'favorite-stations'
const languageKey = 'language'
const journeyKey = 'active-journey'

export async function getRecentRoutes() {
  return (await localforage.getItem<RecentRoute[]>(recentRoutesKey)) ?? []
}

export async function saveRecentRoute(route: Omit<RecentRoute, 'usedAt'>) {
  const existing = await getRecentRoutes()
  const next = [
    { ...route, usedAt: new Date().toISOString() },
    ...existing.filter((item) => item.originId !== route.originId || item.destinationId !== route.destinationId),
  ].slice(0, 8)
  await localforage.setItem(recentRoutesKey, next)
  return next
}

export async function getFavorites() {
  return (await localforage.getItem<string[]>(favoritesKey)) ?? []
}

export async function toggleFavorite(stationId: string) {
  const existing = await getFavorites()
  const next = existing.includes(stationId)
    ? existing.filter((item) => item !== stationId)
    : [...existing, stationId]
  await localforage.setItem(favoritesKey, next)
  return next
}

export async function getSavedLanguage() {
  return (await localforage.getItem<LanguageCode>(languageKey)) ?? 'en'
}

export async function saveLanguage(language: LanguageCode) {
  await localforage.setItem(languageKey, language)
}

export async function getActiveJourney() {
  return await localforage.getItem<JourneyState>(journeyKey)
}

export async function saveActiveJourney(journey: JourneyState | null) {
  if (!journey) {
    await localforage.removeItem(journeyKey)
    return
  }
  await localforage.setItem(journeyKey, journey)
}
