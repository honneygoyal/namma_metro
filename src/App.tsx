import { Geolocation } from '@capacitor/geolocation'
import {
  ArrowRightLeft,
  Clock3,
  Languages,
  LocateFixed,
  Map,
  Minus,
  Navigation,
  Plus,
  Route,
  Settings,
  Star,
  TrainFront,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './App.css'
import { getLinesForStation, getStationName, getStationSearchText, lineById, metroData, stationById } from './data/metro'
import { languages } from './i18n'
import { findNearestStation, isNearestStationReliable, planRoute } from './lib/routeEngine'
import {
  getActiveJourney,
  getFavorites,
  getRecentRoutes,
  getSavedLanguage,
  saveActiveJourney,
  saveLanguage,
  saveRecentRoute,
  toggleFavorite,
} from './lib/storage'
import type { JourneyState, LanguageCode, RecentRoute, RoutePlan, Station, TabId } from './types'

type UserLocation = {
  lat: number
  lng: number
  accuracy: number
  distanceToNearestMeters: number
  isReliable: boolean
}

const tabs: { id: TabId; icon: typeof Route; labelKey: string }[] = [
  { id: 'plan', icon: Route, labelKey: 'plan' },
  { id: 'journey', icon: Navigation, labelKey: 'journey' },
  { id: 'map', icon: Map, labelKey: 'map' },
  { id: 'stations', icon: TrainFront, labelKey: 'stations' },
  { id: 'settings', icon: Settings, labelKey: 'settings' },
]

function WelcomePanel({
  locationTracking,
  onEnableLocation,
  onSkip,
}: {
  locationTracking: boolean
  onEnableLocation: () => void
  onSkip: () => void
}) {
  const { t } = useTranslation()

  return (
    <section className="welcome-panel">
      <div>
        <p className="eyebrow">{t('welcomeEyebrow')}</p>
        <h2>{t('welcomeTitle')}</h2>
        <p>{t('welcomeCopy')}</p>
      </div>
      <div className="welcome-line-preview" aria-label={t('lines')}>
        {metroData.lines.map((line) => (
          <span key={line.id} style={{ background: line.color, color: line.textColor }}>
            {line.shortName}
          </span>
        ))}
      </div>
      <div className="welcome-actions">
        <button className="primary-button" type="button" onClick={onEnableLocation}>
          <LocateFixed size={20} />
          {locationTracking ? t('liveLocationOn') : t('enableLocation')}
        </button>
        <button className="ghost-button" type="button" onClick={onSkip}>
          {t('chooseManually')}
        </button>
      </div>
    </section>
  )
}

function App() {
  const { t, i18n } = useTranslation()
  const locationWatchId = useRef<string | null>(null)
  const startupLocationAttempted = useRef(false)
  const [tab, setTab] = useState<TabId>('plan')
  const [originId, setOriginId] = useState('')
  const [destinationId, setDestinationId] = useState('whitefield-kadugodi')
  const [route, setRoute] = useState<RoutePlan | null>(null)
  const [recentRoutes, setRecentRoutes] = useState<RecentRoute[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [journey, setJourney] = useState<JourneyState | null>(null)
  const [selectedStationId, setSelectedStationId] = useState('majestic')
  const [nearestStationId, setNearestStationId] = useState<string | null>(null)
  const [currentLocation, setCurrentLocation] = useState<UserLocation | null>(null)
  const [locationTracking, setLocationTracking] = useState(false)
  const [showWelcome, setShowWelcome] = useState(true)
  const [openOriginPicker, setOpenOriginPicker] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    void getRecentRoutes().then(setRecentRoutes)
    void getFavorites().then(setFavorites)
    void getActiveJourney().then(setJourney)
    void getSavedLanguage().then((language) => i18n.changeLanguage(language))
  }, [i18n])

  useEffect(() => () => {
    if (locationWatchId.current) void Geolocation.clearWatch({ id: locationWatchId.current })
  }, [])

  const selectedStation = stationById.get(selectedStationId) ?? metroData.stations[0]

  function switchToManualStationSelection(message?: string) {
    setOriginId('')
    setRoute(null)
    setNearestStationId(null)
    setShowWelcome(false)
    setOpenOriginPicker(true)
    if (message) setNotice(message)
  }

  function computeRoute(nextOriginId = originId, nextDestinationId = destinationId) {
    if (!stationById.has(nextOriginId) || !stationById.has(nextDestinationId)) {
      setRoute(null)
      setNotice(t('selectStations'))
      return
    }
    const nextRoute = planRoute(nextOriginId, nextDestinationId)
    setRoute(nextRoute)
    if (nextRoute) {
      void saveRecentRoute({ originId: nextOriginId, destinationId: nextDestinationId }).then(setRecentRoutes)
    }
  }

  async function ensureLocationPermission() {
    try {
      const permissions = await Geolocation.checkPermissions()
      if (permissions.location === 'granted') return true
      const requested = await Geolocation.requestPermissions({ permissions: ['location'] })
      return requested.location === 'granted'
    } catch {
      return true
    }
  }

  function applyPosition(position: Awaited<ReturnType<typeof Geolocation.getCurrentPosition>>, applyAsOrigin: boolean) {
    const nearest = findNearestStation(position.coords.latitude, position.coords.longitude)
    const accuracy = Math.round(position.coords.accuracy)
    const locationIsReliable = isNearestStationReliable(nearest.distanceMeters, accuracy)
    setCurrentLocation({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy,
      distanceToNearestMeters: nearest.distanceMeters,
      isReliable: locationIsReliable,
    })
    if (locationIsReliable) {
      setNearestStationId(nearest.station.id)
      setSelectedStationId(nearest.station.id)
    } else {
      setNearestStationId(null)
    }
    if (applyAsOrigin && locationIsReliable) setOriginId(nearest.station.id)
    return { accuracy, locationIsReliable, nearest }
  }

  async function startLocationWatch() {
    if (locationWatchId.current) return
    try {
      locationWatchId.current = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          minimumUpdateInterval: 5000,
          timeout: 12000,
        },
        (position) => {
          if (position) applyPosition(position, false)
        },
      )
      setLocationTracking(true)
    } catch {
      setLocationTracking(false)
    }
  }

  async function requestAndUseLocation(
    applyAsOrigin = true,
    options: { fallbackToManual?: boolean; silentSuccess?: boolean } = {},
  ) {
    try {
      const hasPermission = await ensureLocationPermission()
      if (!hasPermission) {
        setLocationTracking(false)
        const message = t('locationPermissionNeeded')
        if (options.fallbackToManual) switchToManualStationSelection(message)
        else setNotice(message)
        return
      }
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      })
      const { accuracy, locationIsReliable, nearest } = applyPosition(position, applyAsOrigin)
      setShowWelcome(false)
      setOpenOriginPicker(false)
      void startLocationWatch()
      if (!locationIsReliable && options.fallbackToManual) {
        switchToManualStationSelection(
          `${t('locationUnclear')}: ${nearest.station.name} is ${formatDistance(nearest.distanceMeters)} away (GPS ±${accuracy} m). ${t('chooseStationManually')}`,
        )
        return
      }
      if (!options.silentSuccess || !locationIsReliable) {
        setNotice(
          locationIsReliable
            ? `${t('nearestFound')}: ${nearest.station.name} (${formatDistance(nearest.distanceMeters)} away, GPS ±${accuracy} m)`
            : `${t('locationUnclear')}: ${nearest.station.name} is ${formatDistance(nearest.distanceMeters)} away (GPS ±${accuracy} m). ${t('chooseStationManually')}`,
        )
      }
    } catch {
      setLocationTracking(false)
      if (options.fallbackToManual) switchToManualStationSelection(t('locationBlocked'))
      else setNotice(t('locationBlocked'))
    }
  }

  async function useNearestStation() {
    await requestAndUseLocation(true)
  }

  // Run once on app launch; language changes should not reopen the location prompt.
  useEffect(() => {
    if (startupLocationAttempted.current) return
    startupLocationAttempted.current = true
    void requestAndUseLocation(true, { fallbackToManual: true, silentSuccess: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function startJourney() {
    if (!route) return
    const nextJourney = {
      route,
      startedAt: new Date().toISOString(),
      currentIndex: 0,
    }
    setJourney(nextJourney)
    await saveActiveJourney(nextJourney)
    setTab('journey')
  }

  async function updateJourneyIndex(delta: number) {
    if (!journey) return
    const next: JourneyState = {
      ...journey,
      currentIndex: Math.min(Math.max(journey.currentIndex + delta, 0), journey.route.stationPath.length - 1),
    }
    setJourney(next)
    await saveActiveJourney(next)
  }

  async function clearJourney() {
    setJourney(null)
    await saveActiveJourney(null)
  }

  async function changeLanguage(language: LanguageCode) {
    await i18n.changeLanguage(language)
    await saveLanguage(language)
  }

  async function onToggleFavorite(stationId: string) {
    const nextFavorites = await toggleFavorite(stationId)
    setFavorites(nextFavorites)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">{t('offline')}</p>
          <h1>{t('appName')}</h1>
        </div>
        <button className="language-pill" type="button" onClick={() => setTab('settings')}>
          <Languages size={18} />
          {languages.find((language) => language.code === i18n.language)?.nativeLabel ?? 'English'}
        </button>
      </header>

      {notice && (
        <button className="notice" type="button" onClick={() => setNotice('')}>
          {notice}
        </button>
      )}

      <main>
        {showWelcome && tab === 'plan' && (
          <WelcomePanel
            locationTracking={locationTracking}
            onEnableLocation={() => requestAndUseLocation(true)}
            onSkip={() => switchToManualStationSelection()}
          />
        )}
        {tab === 'plan' && (
          <PlanScreen
            currentLocation={currentLocation}
            destinationId={destinationId}
            locationTracking={locationTracking}
            onCompute={computeRoute}
            onDestinationClear={() => setDestinationId('')}
            onDestinationChange={setDestinationId}
            onNearest={useNearestStation}
            onOriginClear={() => setOriginId('')}
            onOriginChange={(stationId) => {
              setOriginId(stationId)
              setOpenOriginPicker(false)
            }}
            onSelectRecent={(recent) => {
              setOriginId(recent.originId)
              setDestinationId(recent.destinationId)
              setOpenOriginPicker(false)
              computeRoute(recent.originId, recent.destinationId)
            }}
            onShowMap={() => setTab('map')}
            onStartJourney={startJourney}
            openOriginPicker={openOriginPicker}
            originId={originId}
            recentRoutes={recentRoutes}
            route={route}
            swap={() => {
              setOriginId(destinationId)
              setDestinationId(originId)
            }}
          />
        )}
        {tab === 'journey' && (
          <JourneyScreen journey={journey} onClear={clearJourney} onMove={updateJourneyIndex} />
        )}
        {tab === 'map' && (
          <MapScreen
            currentLocation={currentLocation}
            currentStationId={journey ? journey.route.stationPath[journey.currentIndex] : nearestStationId}
            nearestStationId={nearestStationId}
            onNearest={useNearestStation}
            onPlanFrom={(stationId) => {
              setOriginId(stationId)
              setSelectedStationId(stationId)
              setTab('plan')
            }}
            onPlanTo={(stationId) => {
              setDestinationId(stationId)
              setSelectedStationId(stationId)
              setTab('plan')
            }}
            onSelectStation={setSelectedStationId}
            selectedRoute={route ?? journey?.route ?? null}
            selectedStationId={selectedStationId}
          />
        )}
        {tab === 'stations' && (
          <StationsScreen
            favorites={favorites}
            onDestination={(stationId) => {
              setDestinationId(stationId)
              setTab('plan')
            }}
            onOrigin={(stationId) => {
              setOriginId(stationId)
              setTab('plan')
            }}
            onSelect={setSelectedStationId}
            onToggleFavorite={onToggleFavorite}
            selectedStation={selectedStation}
          />
        )}
        {tab === 'settings' && <SettingsScreen onLanguage={changeLanguage} />}
      </main>

      <nav className="bottom-nav" aria-label="Primary">
        {tabs.map((item) => {
          const Icon = item.icon
          return (
            <button className={tab === item.id ? 'active' : ''} key={item.id} type="button" onClick={() => setTab(item.id)}>
              <Icon size={20} />
              <span>{t(item.labelKey)}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

function PlanScreen({
  currentLocation,
  destinationId,
  locationTracking,
  onCompute,
  onDestinationClear,
  onDestinationChange,
  onNearest,
  onOriginClear,
  onOriginChange,
  onSelectRecent,
  onShowMap,
  onStartJourney,
  openOriginPicker,
  originId,
  recentRoutes,
  route,
  swap,
}: {
  currentLocation: UserLocation | null
  destinationId: string
  locationTracking: boolean
  onCompute: () => void
  onDestinationClear: () => void
  onDestinationChange: (stationId: string) => void
  onNearest: () => void
  onOriginClear: () => void
  onOriginChange: (stationId: string) => void
  onSelectRecent: (route: RecentRoute) => void
  onShowMap: () => void
  onStartJourney: () => void
  openOriginPicker: boolean
  originId: string
  recentRoutes: RecentRoute[]
  route: RoutePlan | null
  swap: () => void
}) {
  const { t } = useTranslation()

  return (
    <section className="screen plan-screen">
      <div className="planner-card">
        <StationPicker
          autoOpen={openOriginPicker}
          key={`from-${originId}-${openOriginPicker ? 'open' : 'closed'}`}
          label={t('from')}
          value={originId}
          onChange={onOriginChange}
          onClear={onOriginClear}
        />
        <div className="planner-actions">
          <button className="icon-button" type="button" onClick={swap} aria-label={t('swap')}>
            <ArrowRightLeft size={20} />
          </button>
          <button className="ghost-button" type="button" onClick={onNearest}>
            <LocateFixed size={18} />
            {t('useCurrent')}
          </button>
        </div>
        <StationPicker key={`to-${destinationId}`} label={t('to')} value={destinationId} onChange={onDestinationChange} onClear={onDestinationClear} />
        <button className="primary-button" type="button" onClick={() => onCompute()}>
          <Route size={20} />
          {t('findRoute')}
        </button>
      </div>

      {route ? (
        <RouteResult route={route} onShowMap={onShowMap} onStartJourney={onStartJourney} />
      ) : (
        <div className="commuter-card">
          <p className="eyebrow">{t('commuterReady')}</p>
          <h2>{t('selectStations')}</h2>
          <div className="line-status-grid">
            {metroData.lines.map((line) => (
              <div key={line.id}>
                <span style={{ background: line.color }} />
                <strong>{line.shortName}</strong>
                <small>{line.stations.length} {t('stations').toLowerCase()}</small>
              </div>
            ))}
          </div>
          <p className={locationTracking ? 'live-pill active' : 'live-pill'}>
            {locationTracking ? t('liveTrackingActive') : t('liveTrackingOff')}
            {currentLocation ? ` · ±${Math.round(currentLocation.accuracy)} m` : ''}
          </p>
          <p className="fineprint">{t('liveLocationDisclaimer')}</p>
        </div>
      )}

      <section className="section-block">
        <h2>{t('recentRoutes')}</h2>
        {recentRoutes.length === 0 ? (
          <p className="muted">{t('noRecent')}</p>
        ) : (
          <div className="recent-list">
            {recentRoutes.map((recent) => (
              <button
                className="recent-route"
                key={`${recent.originId}-${recent.destinationId}`}
                type="button"
                onClick={() => onSelectRecent(recent)}
              >
                <span>{getStationName(recent.originId)}</span>
                <ArrowRightLeft size={16} />
                <span>{getStationName(recent.destinationId)}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}

function StationPicker({
  autoOpen = false,
  label,
  onChange,
  onClear,
  value,
}: {
  autoOpen?: boolean
  label: string
  onChange: (stationId: string) => void
  onClear?: () => void
  value: string
}) {
  const selected = stationById.get(value)
  const [inputValue, setInputValue] = useState(selected?.name ?? '')
  const [isOpen, setIsOpen] = useState(autoOpen)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!autoOpen) return
    inputRef.current?.focus()
  }, [autoOpen])

  const matches = useMemo(() => {
    const normalized = inputValue.trim().toLowerCase()
    if (!normalized) return metroData.stations.slice(0, 8)
    return metroData.stations.filter((station) => getStationSearchText(station.id).includes(normalized)).slice(0, 8)
  }, [inputValue])

  return (
    <label className="station-picker">
      <span>{label}</span>
      <div className="station-input-wrap">
        <input
          ref={inputRef}
          value={inputValue}
          onBlur={() => setIsOpen(false)}
          onChange={(event) => {
            const nextValue = event.target.value
            setInputValue(nextValue)
            setIsOpen(true)
            if (nextValue.trim() === '') onClear?.()
          }}
          onFocus={(event) => {
            setIsOpen(true)
            event.currentTarget.select()
          }}
          placeholder="Search station"
        />
        {inputValue && (
          <button
            aria-label="Clear station search"
            className="clear-station"
            type="button"
            onMouseDown={(event) => {
              event.preventDefault()
              setInputValue('')
              setIsOpen(true)
              onClear?.()
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>
      {isOpen && (
        <div className="suggestions" onMouseDown={(event) => event.preventDefault()}>
          {matches.map((station) => (
            <button
              key={station.id}
              type="button"
              onClick={() => {
                onChange(station.id)
                setInputValue(station.name)
                setIsOpen(false)
              }}
            >
              <LineDots station={station} />
              {station.name}
            </button>
          ))}
          {matches.length === 0 && <p className="no-suggestions">No station found</p>}
        </div>
      )}
    </label>
  )
}

function RouteResult({
  onShowMap,
  onStartJourney,
  route,
}: {
  onShowMap: () => void
  onStartJourney: () => void
  route: RoutePlan
}) {
  const { t } = useTranslation()

  return (
    <section className="route-card">
      <div className="metric-grid">
        <Metric icon={<Clock3 size={18} />} label={t('time')} value={`${route.minutes} min`} />
        <Metric label={t('fare')} value={`₹${route.fare}`} />
        <Metric label={t('stops')} value={`${route.stops}`} />
      </div>
      <div className="route-timeline">
        {route.segments.length === 0 ? (
          <p>{t('getOffAt')} {getStationName(route.destinationId)}</p>
        ) : (
          route.segments.map((segment, index) => {
            const line = lineById.get(segment.lineId)
            const first = segment.stationIds[0]
            const last = segment.stationIds[segment.stationIds.length - 1] ?? first
            return (
              <article className="segment" key={`${segment.lineId}-${index}`}>
                <div className="line-rail" style={{ background: line?.color }} />
                <div>
                  <p className="segment-label" style={{ color: line?.color }}>
                    {line?.name}
                  </p>
                  <h3>
                    {getStationName(first)} <span>to</span> {getStationName(last)}
                  </h3>
                  <p>
                    {t('boardToward')} <strong>{segment.direction}</strong>
                  </p>
                  {index < route.segments.length - 1 && (
                    <p className="interchange-note">
                      {t('changeAt')} <strong>{getStationName(last)}</strong>
                    </p>
                  )}
                </div>
              </article>
            )
          })
        )}
      </div>
      <div className="route-actions">
        <button className="ghost-button" type="button" onClick={onShowMap}>
          <Map size={20} />
          {t('viewMap')}
        </button>
        <button className="primary-button" type="button" onClick={onStartJourney}>
          <Navigation size={20} />
          {t('startJourney')}
        </button>
      </div>
      <p className="fineprint">{t('fare')} and {t('time').toLowerCase()} are {t('approximate')}.</p>
    </section>
  )
}

function JourneyScreen({
  journey,
  onClear,
  onMove,
}: {
  journey: JourneyState | null
  onClear: () => void
  onMove: (delta: number) => void
}) {
  const { t } = useTranslation()
  if (!journey) return <section className="screen"><div className="empty-card">{t('noJourney')}</div></section>

  const stationPath = journey.route.stationPath
  const currentId = stationPath[journey.currentIndex]
  const nextId = stationPath[journey.currentIndex + 1]
  const remaining = Math.max(stationPath.length - journey.currentIndex - 1, 0)

  return (
    <section className="screen">
      <div className="journey-hero">
        <p className="eyebrow">{t('currentStation')} · {t('approximate')}</p>
        <h2>{getStationName(currentId)}</h2>
        <p>{nextId ? `${t('nextStation')}: ${getStationName(nextId)}` : t('getOffAt')}</p>
        <div className="progress-track">
          <span style={{ width: `${(journey.currentIndex / Math.max(stationPath.length - 1, 1)) * 100}%` }} />
        </div>
        <p>{remaining} {t('stops')} {t('remaining')}</p>
      </div>
      <div className="control-row">
        <button className="ghost-button" type="button" onClick={() => onMove(-1)}>{t('previous')}</button>
        <button className="ghost-button" type="button" onClick={() => onMove(1)}>{t('next')}</button>
      </div>
      <div className="station-strip">
        {stationPath.map((stationId, index) => (
          <div className={index === journey.currentIndex ? 'current' : ''} key={stationId}>
            <span>{index + 1}</span>
            {getStationName(stationId)}
          </div>
        ))}
      </div>
      <button className="danger-button" type="button" onClick={onClear}>{t('endJourney')}</button>
    </section>
  )
}

const mapWidth = 1000
const mapHeight = 760
const mapPadding = 46

function formatDistance(meters: number) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`
  return `${Math.round(meters)} m`
}

function makeMapProjection(currentLocation: UserLocation | null) {
  const locationIsNearNetwork = currentLocation?.isReliable ?? false
  const points = [
    ...metroData.stations.map((station) => ({ lat: station.lat, lng: station.lng })),
    ...(currentLocation && locationIsNearNetwork ? [{ lat: currentLocation.lat, lng: currentLocation.lng }] : []),
  ]
  const lats = points.map((point) => point.lat)
  const lngs = points.map((point) => point.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const latSpan = Math.max(maxLat - minLat, 0.01)
  const lngSpan = Math.max(maxLng - minLng, 0.01)

  function projectRaw(lat: number, lng: number) {
    return {
      x: mapPadding + ((lng - minLng) / lngSpan) * (mapWidth - mapPadding * 2),
      y: mapPadding + ((maxLat - lat) / latSpan) * (mapHeight - mapPadding * 2),
    }
  }

  return {
    isCurrentLocationVisible: locationIsNearNetwork,
    pointString: (station: Station) => {
      const point = projectRaw(station.lat, station.lng)
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`
    },
    project: (station: Station) => projectRaw(station.lat, station.lng),
    projectRaw,
  }
}

function getZoomViewBox(center: { x: number; y: number }, zoom: number) {
  const width = mapWidth / zoom
  const height = mapHeight / zoom
  const x = Math.min(Math.max(center.x - width / 2, 0), mapWidth - width)
  const y = Math.min(Math.max(center.y - height / 2, 0), mapHeight - height)
  return `${x} ${y} ${width} ${height}`
}

function clampZoom(value: number) {
  return Math.min(Math.max(value, 1), 3.2)
}

function getTouchDistance(touches: React.TouchList) {
  const first = touches[0]
  const second = touches[1]
  return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY)
}

function MapScreen({
  currentLocation,
  currentStationId,
  nearestStationId,
  onNearest,
  onPlanFrom,
  onPlanTo,
  onSelectStation,
  selectedRoute,
  selectedStationId,
}: {
  currentLocation: UserLocation | null
  currentStationId: string | null
  nearestStationId: string | null
  onNearest: () => void
  onPlanFrom: (stationId: string) => void
  onPlanTo: (stationId: string) => void
  onSelectStation: (stationId: string) => void
  selectedRoute: RoutePlan | null
  selectedStationId: string
}) {
  const { t } = useTranslation()
  const touchDistance = useRef<number | null>(null)
  const [zoom, setZoom] = useState(1)
  const [labelMode, setLabelMode] = useState<'key' | 'route' | 'all'>('key')
  const routeStationSet = new Set(selectedRoute?.stationPath ?? [])
  const selectedStation = stationById.get(selectedStationId) ?? metroData.stations[0]
  const currentStation = currentStationId ? stationById.get(currentStationId) : null
  const projection = useMemo(() => makeMapProjection(currentLocation), [currentLocation])
  const selectedPoint = projection.project(selectedStation)
  const centerPoint = currentStation ? projection.project(currentStation) : selectedPoint
  const viewBox = getZoomViewBox(centerPoint, zoom)

  return (
    <section className="screen map-screen">
      <div className="map-heading">
        <div>
          <h2>{t('metroMap')}</h2>
          <p>{t('mapHint')}</p>
        </div>
        <button className="ghost-button" type="button" onClick={onNearest}>
          <LocateFixed size={18} />
          {t('useCurrent')}
        </button>
      </div>

      <div className="interactive-map-shell">
        <div className="map-toolbar">
          <StationPicker key={`map-${selectedStation.id}`} label={t('searchStation')} value={selectedStation.id} onChange={onSelectStation} />
          <div className="zoom-controls" aria-label={t('zoomControls')}>
            <button className="icon-button" type="button" onClick={() => setZoom((value) => clampZoom(value + 0.35))} aria-label={t('zoomIn')}>
              <Plus size={18} />
            </button>
            <button className="icon-button" type="button" onClick={() => setZoom((value) => clampZoom(value - 0.35))} aria-label={t('zoomOut')}>
              <Minus size={18} />
            </button>
          </div>
          <div className="label-controls" aria-label={t('labelMode')}>
            {(['key', 'route', 'all'] as const).map((mode) => (
              <button
                className={labelMode === mode ? 'active' : ''}
                key={mode}
                type="button"
                onClick={() => setLabelMode(mode)}
              >
                {t(mode === 'key' ? 'keyLabels' : mode === 'route' ? 'routeLabels' : 'allLabels')}
              </button>
            ))}
          </div>
        </div>

        <svg
          className="network-map"
          role="img"
          aria-label={t('metroMap')}
          viewBox={viewBox}
          onTouchEnd={() => {
            touchDistance.current = null
          }}
          onTouchMove={(event) => {
            if (event.touches.length !== 2 || !touchDistance.current) return
            event.preventDefault()
            const nextDistance = getTouchDistance(event.touches)
            const ratio = nextDistance / touchDistance.current
            setZoom((value) => clampZoom(value * ratio))
            touchDistance.current = nextDistance
          }}
          onTouchStart={(event) => {
            if (event.touches.length === 2) touchDistance.current = getTouchDistance(event.touches)
          }}
          onWheel={(event) => {
            event.preventDefault()
            setZoom((value) => clampZoom(value + (event.deltaY < 0 ? 0.16 : -0.16)))
          }}
        >
          <defs>
            <linearGradient id="map-sky" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#ecfeff" />
              <stop offset="48%" stopColor="#f8fafc" />
              <stop offset="100%" stopColor="#fff7ed" />
            </linearGradient>
            <pattern height="44" id="map-grid" patternUnits="userSpaceOnUse" width="44">
              <path d="M 44 0 L 0 0 0 44" fill="none" stroke="#dbeafe" strokeWidth="1" />
            </pattern>
          </defs>
          <rect className="map-bg" height="760" width="1000" x="0" y="0" />
          <rect className="map-grid-bg" height="760" width="1000" x="0" y="0" />
          <g className="line-layer">
            {metroData.lines.map((line) => (
              <polyline
                fill="none"
                key={line.id}
                points={line.stations.map((stationId) => projection.pointString(stationById.get(stationId)!)).join(' ')}
                stroke={line.color}
              />
            ))}
          </g>
          {selectedRoute && (
            <g className="route-layer">
              {selectedRoute.segments.map((segment, index) => {
                const line = lineById.get(segment.lineId)
                return (
                  <polyline
                    fill="none"
                    key={`${segment.lineId}-${index}`}
                    points={segment.stationIds.map((stationId) => projection.pointString(stationById.get(stationId)!)).join(' ')}
                    stroke={line?.color ?? '#111827'}
                  />
                )
              })}
            </g>
          )}
          <g className="station-layer">
            {metroData.stations.map((station) => {
              const point = projection.project(station)
              const isSelected = station.id === selectedStation.id
              const isRoute = routeStationSet.has(station.id)
              const isCurrent = station.id === currentStationId
              const isNearest = station.id === nearestStationId
              const isRouteEndpoint = station.id === selectedRoute?.originId || station.id === selectedRoute?.destinationId
              const isInterchange = selectedRoute?.interchangeIds.includes(station.id) || getLinesForStation(station.id).length > 1
              const showLabel =
                labelMode === 'all' ||
                isSelected ||
                isCurrent ||
                isNearest ||
                isRouteEndpoint ||
                (labelMode !== 'route' && isInterchange) ||
                (labelMode !== 'key' && isRoute)
              return (
                <g
                  aria-label={station.name}
                  className={[
                    'station-marker',
                    isSelected ? 'selected' : '',
                    isRoute ? 'on-route' : '',
                    isCurrent ? 'current' : '',
                    isNearest ? 'nearest' : '',
                  ].filter(Boolean).join(' ')}
                  key={station.id}
                  onClick={() => onSelectStation(station.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') onSelectStation(station.id)
                  }}
                  role="button"
                  tabIndex={0}
                  transform={`translate(${point.x} ${point.y})`}
                >
                  <circle className="station-hit" r="14" />
                  <circle className="station-dot" r={getLinesForStation(station.id).length > 1 ? 7 : 5} />
                  {showLabel && <text dy="-14">{station.name}</text>}
                </g>
              )
            })}
            {currentLocation && projection.isCurrentLocationVisible && (
              <g className="user-location-marker" transform={`translate(${projection.projectRaw(currentLocation.lat, currentLocation.lng).x} ${projection.projectRaw(currentLocation.lat, currentLocation.lng).y})`}>
                <circle className="accuracy-ring" r={Math.min(Math.max(currentLocation.accuracy / 18, 10), 46)} />
                <circle r="6" />
              </g>
            )}
          </g>
        </svg>

        <div className="map-detail">
          <article className="selected-station-card">
            <p className="eyebrow">{t('selectedStation')}</p>
            <h3>{selectedStation.name}</h3>
            <div className="line-chip-row">
              {getLinesForStation(selectedStation.id).map((line) => (
                <span key={line.id} style={{ background: line.color, color: line.textColor }}>
                  {line.shortName}
                </span>
              ))}
            </div>
            <div className="control-row">
              <button className="ghost-button" type="button" onClick={() => onPlanFrom(selectedStation.id)}>{t('planFromHere')}</button>
              <button className="ghost-button" type="button" onClick={() => onPlanTo(selectedStation.id)}>{t('planToHere')}</button>
            </div>
            {selectedRoute && routeStationSet.has(selectedStation.id) && <p className="fineprint">{t('stationOnRoute')}</p>}
          </article>

          <article className="selected-station-card">
            <p className="eyebrow">{t('currentStation')}</p>
            <h3>{currentStation ? currentStation.name : t('notSet')}</h3>
            {currentLocation && (
              <p className="fineprint">
                {t('gpsAccuracy')}: ±{Math.round(currentLocation.accuracy)} m · {t('nearest')}: {formatDistance(currentLocation.distanceToNearestMeters)}
              </p>
            )}
            <p className="fineprint">{t('liveLocationDisclaimer')}</p>
            {currentLocation && !currentLocation.isReliable && <p className="location-warning">{t('gpsUnreliable')}</p>}
          </article>
        </div>

        {selectedRoute && (
          <div className="route-strip-map" aria-label={t('routeMap')}>
            {selectedRoute.stationPath.map((stationId, index) => (
              <button
                className={stationId === selectedStation.id ? 'active' : ''}
                key={`${stationId}-${index}`}
                type="button"
                onClick={() => onSelectStation(stationId)}
              >
                <span>{index + 1}</span>
                {getStationName(stationId)}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function StationsScreen({
  favorites,
  onDestination,
  onOrigin,
  onSelect,
  onToggleFavorite,
  selectedStation,
}: {
  favorites: string[]
  onDestination: (stationId: string) => void
  onOrigin: (stationId: string) => void
  onSelect: (stationId: string) => void
  onToggleFavorite: (stationId: string) => void
  selectedStation: Station
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const stations = metroData.stations.filter((station) => getStationSearchText(station.id).includes(query.toLowerCase()))

  return (
    <section className="screen stations-layout">
      <div className="station-list-panel">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('searchStation')} />
        <div className="station-list">
          {stations.map((station) => (
            <button key={station.id} type="button" onClick={() => onSelect(station.id)}>
              <LineDots station={station} />
              {station.name}
            </button>
          ))}
        </div>
      </div>
      <StationDetail
        favorites={favorites}
        onDestination={onDestination}
        onOrigin={onOrigin}
        onToggleFavorite={onToggleFavorite}
        station={selectedStation}
      />
    </section>
  )
}

function StationDetail({
  favorites,
  onDestination,
  onOrigin,
  onToggleFavorite,
  station,
}: {
  favorites: string[]
  onDestination: (stationId: string) => void
  onOrigin: (stationId: string) => void
  onToggleFavorite: (stationId: string) => void
  station: Station
}) {
  const { t } = useTranslation()
  const lines = getLinesForStation(station.id)

  return (
    <article className="station-detail">
      <div className="station-title">
        <div>
          <p className="eyebrow">{t('stationInfo')}</p>
          <h2>{station.name}</h2>
        </div>
        <button className={favorites.includes(station.id) ? 'star active' : 'star'} type="button" onClick={() => onToggleFavorite(station.id)}>
          <Star size={20} fill="currentColor" />
        </button>
      </div>
      <div className="line-chip-row">
        {lines.map((line) => (
          <span key={line.id} style={{ background: line.color, color: line.textColor }}>
            {line.shortName}
          </span>
        ))}
      </div>
      <div className="control-row">
        <button className="ghost-button" type="button" onClick={() => onOrigin(station.id)}>{t('planFromHere')}</button>
        <button className="ghost-button" type="button" onClick={() => onDestination(station.id)}>{t('planToHere')}</button>
      </div>
      <InfoList title={t('facilities')} items={station.facilities} />
      <InfoList title={t('landmarks')} items={station.landmarks} />
    </article>
  )
}

function SettingsScreen({ onLanguage }: { onLanguage: (language: LanguageCode) => void }) {
  const { t, i18n } = useTranslation()

  return (
    <section className="screen">
      <div className="settings-card">
        <h2>{t('language')}</h2>
        <div className="language-grid">
          {languages.map((language) => (
            <button
              className={i18n.language === language.code ? 'active' : ''}
              key={language.code}
              type="button"
              onClick={() => onLanguage(language.code)}
            >
              <span>{language.nativeLabel}</span>
              <small>{language.label}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="settings-card">
        <h2>{t('dataVersion')}</h2>
        <p>{metroData.dataVersion}</p>
        <p>{t('lastUpdated')}: {metroData.lastUpdated}</p>
        {metroData.sourceNotes.map((note) => (
          <p className="fineprint" key={note}>{note}</p>
        ))}
      </div>
    </section>
  )
}

function Metric({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      <span>{icon}</span>
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  )
}

function LineDots({ station }: { station: Station }) {
  return (
    <span className="line-dots">
      {getLinesForStation(station.id).map((line) => (
        <i key={line.id} style={{ background: line.color }} />
      ))}
    </span>
  )
}

function InfoList({ items, title }: { items: string[]; title: string }) {
  if (items.length === 0) return null
  return (
    <div className="info-list">
      <h3>{title}</h3>
      <div>
        {items.map((item) => (
          <span key={item}>{item.split('-').join(' ')}</span>
        ))}
      </div>
    </div>
  )
}

export default App
