import { Header } from '../components/Header'
import { SearchBox } from '../components/SearchBox'
import { QuickActions } from '../components/QuickActions'
import { CurrentLocationCard } from '../components/CurrentLocationCard'
import { SavedPlacesPreview } from '../components/SavedPlacesPreview'
import { RecentSearches } from '../components/RecentSearches'
import { LocalAlerts } from '../components/LocalAlerts'
import { LatestFareUpdates } from '../components/LatestFareUpdates'

export function HomePage() {
  return (
    <div className="app-shell">
      <Header />
      <main className="flex-1 space-y-6 px-4 py-5">
        <SearchBox />
        <QuickActions />
        <CurrentLocationCard />
        <LatestFareUpdates />
        <SavedPlacesPreview />
        <RecentSearches />
        <LocalAlerts />
      </main>
    </div>
  )
}
