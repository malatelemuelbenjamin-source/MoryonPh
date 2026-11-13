import { Routes, Route } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { CmsPageView } from './pages/CmsPageView'
import { AuthPage } from './pages/AuthPage'
import { ProfilePage } from './pages/ProfilePage'
import { RoutePlannerPage } from './pages/RoutePlannerPage'
import { RouteDetailPage } from './pages/RouteDetailPage'
import { FareCalculatorPage } from './pages/FareCalculatorPage'
import { FareUpdatesPage } from './pages/FareUpdatesPage'
import { FareUpdateDetailPage } from './pages/FareUpdateDetailPage'
import { FareMatrixPage } from './pages/FareMatrixPage'
import { FareMatrixDetailPage } from './pages/FareMatrixDetailPage'
import { PassengerDiscountsPage } from './pages/PassengerDiscountsPage'
import { PassengerCategoryDetailPage } from './pages/PassengerCategoryDetailPage'
import { JeepneyRoutesPage } from './pages/JeepneyRoutesPage'
import { JeepneyRouteDetailPage } from './pages/JeepneyRouteDetailPage'
import { TricycleRoutesPage } from './pages/TricycleRoutesPage'
import { TricycleServiceAreaDetailPage } from './pages/TricycleServiceAreaDetailPage'
import { PortsSeaTransportPage } from './pages/PortsSeaTransportPage'
import { PortDetailPage } from './pages/PortDetailPage'
import { TransportMapPage } from './pages/TransportMapPage'
import { SavedPlacesPage } from './pages/SavedPlacesPage'
import { SavedRoutesPage } from './pages/SavedRoutesPage'
import { MoryAIPage } from './pages/MoryAIPage'
import { CommunityReportsPage } from './pages/CommunityReportsPage'
import { ReportSubmitPage } from './pages/ReportSubmitPage'
import { CommunityReportDetailPage } from './pages/CommunityReportDetailPage'
import { AdminReviewDashboardPage } from './pages/AdminReviewDashboardPage'
import { FareConcernsPage } from './pages/FareConcernsPage'
import { FareConcernSubmitPage } from './pages/FareConcernSubmitPage'
import { FareConcernDetailPage } from './pages/FareConcernDetailPage'
import { AdminFareReviewDashboardPage } from './pages/AdminFareReviewDashboardPage'
import { WeatherPage } from './pages/WeatherPage'
import { TransportAlertsPage } from './pages/TransportAlertsPage'
import { TransportAlertDetailPage } from './pages/TransportAlertDetailPage'
import { AdminTransportAlertsPage } from './pages/AdminTransportAlertsPage'
import { AdminGeographicBoundariesPage } from './pages/AdminGeographicBoundariesPage'
import { AdminRoadNetworkPage } from './pages/AdminRoadNetworkPage'
import { AdminMunicipalitiesPage } from './pages/AdminMunicipalitiesPage'
import { ExploreMarinduquePage } from './pages/ExploreMarinduquePage'
import { DestinationDetailPage } from './pages/DestinationDetailPage'
import { ExploreMunicipalityPage } from './pages/ExploreMunicipalityPage'
import { ExploreCategoryPage } from './pages/ExploreCategoryPage'
import { CultureEventsPage } from './pages/CultureEventsPage'
import { EventDetailPage } from './pages/EventDetailPage'
import { EventsMunicipalityPage } from './pages/EventsMunicipalityPage'
import { EventsCategoryPage } from './pages/EventsCategoryPage'
import { NearbyPlacesPage } from './pages/NearbyPlacesPage'
import { NearbyPlaceDetailPage } from './pages/NearbyPlaceDetailPage'
import { EmergencySafetyPage } from './pages/EmergencySafetyPage'
import { EmergencyGuideDetailPage } from './pages/EmergencyGuideDetailPage'
import { OfflineSettingsPage } from './pages/OfflineSettingsPage'
import { AccountSettingsPage } from './pages/AccountSettingsPage'
import { TripHistoryPage } from './pages/TripHistoryPage'
import { TripHistoryDetailPage } from './pages/TripHistoryDetailPage'
import { OperatorPortalPage } from './pages/OperatorPortalPage'
import { OperatorRegistrationPage } from './pages/OperatorRegistrationPage'
import { NewServiceSubmissionPage } from './pages/NewServiceSubmissionPage'
import { OperatorSubmissionDetailPage } from './pages/OperatorSubmissionDetailPage'
import { AdminOperatorReviewPage } from './pages/AdminOperatorReviewPage'
import { AdminDashboardPage } from './pages/AdminDashboardPage'
import { AdminControlCenterPage } from './pages/AdminControlCenterPage'
import { AdminAuditLogsPage } from './pages/AdminAuditLogsPage'
import { AdminUsersPage } from './pages/AdminUsersPage'
import { DataVerificationDashboardPage } from './pages/DataVerificationDashboardPage'
import { TouristPlannerPage } from './pages/TouristPlannerPage'
import { ItineraryEditorPage } from './pages/ItineraryEditorPage'
import { ItineraryDetailPage } from './pages/ItineraryDetailPage'
import { SharedItineraryPage } from './pages/SharedItineraryPage'
import { TripCostCalculatorPage } from './pages/TripCostCalculatorPage'
import { ShareTripPage } from './pages/ShareTripPage'
import { SharedTripViewerPage } from './pages/SharedTripViewerPage'
import { ConnectionStatusBanner } from './components/ConnectionStatusBanner'
import { BottomNav } from './components/BottomNav'
import { useNativeFeatures } from './lib/native'

const PLACEHOLDERS: Record<string, { title: string; description?: string }> = {
  '/routes': { title: 'Routes', description: 'Browse jeepney routes from the Jeepney Routes screen.' },
  '/notifications': { title: 'Notifications', description: 'Alerts and updates will appear here.' },
}

export default function App() {
  useNativeFeatures()
  return (
    <div className="min-h-screen bg-sand-50">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/plan" element={<RoutePlannerPage />} />
        <Route path="/route-detail" element={<RouteDetailPage />} />
        <Route path="/fare" element={<FareCalculatorPage />} />
        <Route path="/fare-updates" element={<FareUpdatesPage />} />
        <Route path="/fare-update/:id" element={<FareUpdateDetailPage />} />
        <Route path="/fare-matrix" element={<FareMatrixPage />} />
        <Route path="/fare-matrix/:id" element={<FareMatrixDetailPage />} />
        <Route path="/discounts" element={<PassengerDiscountsPage />} />
        <Route path="/discounts/:id" element={<PassengerCategoryDetailPage />} />
        <Route path="/jeepney-routes" element={<JeepneyRoutesPage />} />
        <Route path="/jeepney-routes/:id" element={<JeepneyRouteDetailPage />} />
        <Route path="/tricycle-routes" element={<TricycleRoutesPage />} />
        <Route path="/tricycle-routes/:id" element={<TricycleServiceAreaDetailPage />} />
        <Route path="/ports" element={<PortsSeaTransportPage />} />
        <Route path="/ports/:id" element={<PortDetailPage />} />
        <Route path="/transport-map" element={<TransportMapPage />} />
        <Route path="/saved-places" element={<SavedPlacesPage />} />
        <Route path="/saved-routes" element={<SavedRoutesPage />} />
        <Route path="/mory-ai" element={<MoryAIPage />} />
        <Route path="/community-reports" element={<CommunityReportsPage />} />
        <Route path="/community-reports/new" element={<ReportSubmitPage />} />
        <Route path="/community-reports/:id" element={<CommunityReportDetailPage />} />
        <Route path="/community-reports/admin" element={<AdminReviewDashboardPage />} />
        <Route path="/community-reports/admin/:id" element={<AdminReviewDashboardPage />} />
        <Route path="/fare-concerns" element={<FareConcernsPage />} />
        <Route path="/fare-concerns/new" element={<FareConcernSubmitPage />} />
        <Route path="/fare-concerns/:id" element={<FareConcernDetailPage />} />
        <Route path="/fare-concerns/admin" element={<AdminFareReviewDashboardPage />} />
        <Route path="/fare-concerns/admin/:id" element={<AdminFareReviewDashboardPage />} />
        <Route path="/weather" element={<WeatherPage />} />
        <Route path="/transport-alerts" element={<TransportAlertsPage />} />
        <Route path="/transport-alerts/:id" element={<TransportAlertDetailPage />} />
        <Route path="/transport-alerts/admin" element={<AdminTransportAlertsPage />} />
        <Route path="/explore" element={<ExploreMarinduquePage />} />
        <Route path="/explore/municipality/:municipality" element={<ExploreMunicipalityPage />} />
        <Route path="/explore/category/:categoryId" element={<ExploreCategoryPage />} />
        <Route path="/explore/destination/:id" element={<DestinationDetailPage />} />
        <Route path="/events" element={<CultureEventsPage />} />
        <Route path="/events/:id" element={<EventDetailPage />} />
        <Route path="/events/municipality/:municipality" element={<EventsMunicipalityPage />} />
        <Route path="/events/category/:categoryId" element={<EventsCategoryPage />} />
        <Route path="/nearby-places" element={<NearbyPlacesPage />} />
        <Route path="/nearby-places/:id" element={<NearbyPlaceDetailPage />} />
        <Route path="/emergency" element={<EmergencySafetyPage />} />
        <Route path="/emergency/guide/:id" element={<EmergencyGuideDetailPage />} />
        <Route path="/offline-settings" element={<OfflineSettingsPage />} />
        <Route path="/account-settings" element={<AccountSettingsPage />} />
        <Route path="/trip-history" element={<TripHistoryPage />} />
        <Route path="/trip-history/:id" element={<TripHistoryDetailPage />} />
        <Route path="/operator-portal" element={<OperatorPortalPage />} />
        <Route path="/operator/register" element={<OperatorRegistrationPage />} />
        <Route path="/operator/new-submission" element={<NewServiceSubmissionPage />} />
        <Route path="/operator/submission/:id" element={<OperatorSubmissionDetailPage />} />
        <Route path="/operator-portal/admin" element={<AdminOperatorReviewPage />} />
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/admin/control-center" element={<AdminControlCenterPage />} />
        <Route path="/admin/audit-logs" element={<AdminAuditLogsPage />} />
        <Route path="/admin/geographic-boundaries" element={<AdminGeographicBoundariesPage />} />
        <Route path="/admin/road-network" element={<AdminRoadNetworkPage />} />
        <Route path="/admin/municipalities" element={<AdminMunicipalitiesPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/verification" element={<DataVerificationDashboardPage />} />
        <Route path="/tourist-planner" element={<TouristPlannerPage />} />
        <Route path="/tourist-planner/new" element={<ItineraryEditorPage />} />
        <Route path="/tourist-planner/:id" element={<ItineraryDetailPage />} />
        <Route path="/tourist-planner/:id/edit" element={<ItineraryEditorPage />} />
        <Route path="/tourist-planner/shared/:token" element={<SharedItineraryPage />} />
        <Route path="/trip-cost" element={<TripCostCalculatorPage />} />
        <Route path="/share" element={<ShareTripPage />} />
        <Route path="/shared/:token" element={<SharedTripViewerPage />} />
        {Object.entries(PLACEHOLDERS).map(([to, meta]) => (
          <Route
            key={to}
            path={to}
            element={<PlaceholderPage title={meta.title} description={meta.description} />}
          />
        ))}
        <Route path="/p/:slug" element={<CmsPageView />} />
        <Route path="*" element={<PlaceholderPage title="Coming Soon" />} />
      </Routes>
      <ConnectionStatusBanner />
      <BottomNav />
    </div>
  )
}
