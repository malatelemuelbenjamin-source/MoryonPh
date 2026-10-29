// Database types for MoryonGo. Hand-authored from the 0001 migration.

export type LocationType =
  | 'municipality'
  | 'barangay'
  | 'terminal'
  | 'port'
  | 'tourist_destination'
  | 'landmark'
  | 'hospital'
  | 'school'
  | 'market'
  | 'business'
  | 'other'

export type VerificationStatus =
  | 'official'
  | 'verified'
  | 'community'
  | 'estimated'
  | 'rejected'
  | 'archived'

export type AlertCategory =
  | 'transport'
  | 'ferry'
  | 'road'
  | 'weather'
  | 'tourism'
  | 'emergency'
  | 'government'
  | 'other'

export type AlertPriority = 'critical' | 'high' | 'medium' | 'low' | 'information'

export type SavedPlaceCategory =
  | 'home'
  | 'school'
  | 'work'
  | 'favorite'
  | 'custom'
  | 'terminal'
  | 'port'
  | 'shopping'
  | 'landmark'
  | 'family'
  | 'other'
  | 'uncategorized'

export type PreferredLanguage = 'filipino' | 'english'

export interface LocationRow {
  id: string
  name: string
  normalized_name: string
  type: LocationType
  municipality: string | null
  barangay: string | null
  province: string
  latitude: number | null
  longitude: number | null
  address: string | null
  description: string | null
  is_searchable: boolean
  verification_status: VerificationStatus
  source: string | null
  last_verified_at: string | null
  created_at: string
  updated_at: string
}

export interface SavedPlaceRow {
  id: string
  user_id: string
  location_id: string | null
  custom_name: string | null
  category: SavedPlaceCategory
  notes: string | null
  custom_address: string | null
  latitude: number | null
  longitude: number | null
  is_favorite: boolean
  created_at: string
  updated_at: string
}

export interface SavedPlaceWithLocation extends SavedPlaceRow {
  location: Pick<LocationRow, 'id' | 'name' | 'municipality' | 'barangay'> | null
}

export interface RecentSearchRow {
  id: string
  user_id: string
  location_id: string | null
  search_text: string | null
  searched_at: string
}

export interface RecentSearchWithLocation extends RecentSearchRow {
  location: Pick<LocationRow, 'id' | 'name' | 'municipality'> | null
}

export interface LocalAlertRow {
  id: string
  title: string
  description: string | null
  category: AlertCategory
  affected_location_id: string | null
  source: string | null
  source_reference: string | null
  verification_status: VerificationStatus
  priority: AlertPriority
  start_at: string | null
  end_at: string | null
  last_verified_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface LocalAlertWithLocation extends LocalAlertRow {
  affected_location: Pick<LocationRow, 'id' | 'name' | 'municipality'> | null
}

export interface UserProfile {
  id: string
  name: string | null
  email: string | null
  profile_photo: string | null
  preferred_language: PreferredLanguage
  home_municipality: string | null
  preferred_passenger_category_id: string | null
  username: string | null
  commuter_preferences: Record<string, unknown> | null
  notification_preferences: {
    transport_alerts?: boolean
    fare_updates?: boolean
    weather_advisories?: boolean
    saved_route_updates?: boolean
    event_reminders?: boolean
  } | null
  created_at: string
  updated_at: string
}

// ---- Feature #2: Route Planner -------------------------------------------

export type RouteStatus = 'active' | 'inactive' | 'suspended' | 'archived'
export type StopType = 'origin' | 'stop' | 'transfer' | 'destination' | 'terminal' | 'port'
export type TransportModeCode =
  | 'walking'
  | 'jeepney'
  | 'tricycle'
  | 'e_tricycle'
  | 'bus'
  | 'van'
  | 'ferry'
  | 'roro'
  | 'boat'
  | 'other'

export interface TransportModeRow {
  id: string
  name: string
  code: string
  description: string | null
  icon: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface RouteRow {
  id: string
  route_name: string
  route_code: string | null
  description: string | null
  origin_location_id: string
  destination_location_id: string
  transport_mode_id: string | null
  operator_name: string | null
  direction: string | null
  estimated_duration_minutes: number | null
  route_status: RouteStatus
  verification_status: VerificationStatus
  source: string | null
  source_reference: string | null
  last_verified_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface RouteWithDetails extends RouteRow {
  origin_location: Pick<LocationRow, 'id' | 'name' | 'municipality' | 'barangay'> | null
  destination_location: Pick<LocationRow, 'id' | 'name' | 'municipality' | 'barangay'> | null
  transport_mode: Pick<TransportModeRow, 'id' | 'name' | 'code' | 'icon'> | null
}

export interface RouteStopRow {
  id: string
  route_id: string
  location_id: string
  stop_sequence: number
  stop_type: StopType
  pickup_allowed: boolean
  dropoff_allowed: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface RouteStopWithLocation extends RouteStopRow {
  location: Pick<LocationRow, 'id' | 'name' | 'municipality' | 'barangay' | 'latitude' | 'longitude'> | null
}

export interface RouteConnectionRow {
  id: string
  from_route_id: string
  to_route_id: string
  transfer_location_id: string
  minimum_transfer_minutes: number | null
  walking_distance_meters: number | null
  transfer_notes: string | null
  verification_status: VerificationStatus
  last_verified_at: string | null
  created_at: string
  updated_at: string
}

// A planned journey: one or more route legs joined at verified transfer points.
export interface PlannedRouteLeg {
  route: RouteWithDetails
  stops: RouteStopWithLocation[]
}

export interface PlannedRoute {
  id: string
  legs: PlannedRouteLeg[]
  transfers: number
  estimatedDurationMinutes: number | null
  walkingMinutes: number | null
  verificationStatus: VerificationStatus
}

// ---- Feature #3: Fare Calculator ------------------------------------------

export type FareType =
  | 'fixed'
  | 'distance_based'
  | 'zone_based'
  | 'stage_based'
  | 'range'
  | 'other'

export type FareRuleType =
  | 'fixed_amount'
  | 'percentage_discount'
  | 'additional_charge'
  | 'distance_rate'
  | 'stage_rate'
  | 'minimum_fare'
  | 'maximum_fare'
  | 'other'

export type PassengerType = 'regular' | 'student' | 'senior' | 'pwd'
export type DiscountType = 'percentage' | 'fixed_amount' | 'none'

export interface FareRow {
  id: string
  route_id: string
  transport_mode_id: string | null
  fare_type: FareType
  base_fare: number
  minimum_fare: number | null
  maximum_fare: number | null
  distance_from_km: number | null
  distance_to_km: number | null
  currency: string
  effective_from: string
  effective_until: string | null
  verification_status: VerificationStatus
  source: string | null
  source_reference: string | null
  last_verified_at: string | null
  created_by: string | null
  fare_category: string | null
  created_at: string
  updated_at: string
}

export interface FareRuleRow {
  id: string
  fare_id: string
  rule_type: FareRuleType
  rule_value: number
  passenger_type: PassengerType | null
  description: string | null
  verification_status: VerificationStatus
  source: string | null
  source_reference: string | null
  effective_from: string | null
  effective_until: string | null
  created_at: string
  updated_at: string
}

export interface FareDiscountRow {
  id: string
  fare_id: string
  passenger_type: PassengerType
  discount_type: DiscountType
  discount_value: number
  eligibility_notes: string | null
  required_document: string | null
  verification_status: VerificationStatus
  source: string | null
  source_reference: string | null
  effective_from: string | null
  effective_until: string | null
  created_at: string
  updated_at: string
}

export interface FareWithDetails extends FareRow {
  route: Pick<RouteRow, 'id' | 'route_name' | 'transport_mode_id' | 'operator_name'> | null
  transport_mode: Pick<TransportModeRow, 'id' | 'name' | 'code' | 'icon'> | null
}

export interface FareBreakdownItem {
  label: string
  amount: number
}

export interface FareCalculationResult {
  fare: FareWithDetails | null
  rules: FareRuleRow[]
  discount: FareDiscountRow | null
  baseAmount: number
  discountAmount: number
  totalAmount: number
  breakdown: FareBreakdownItem[]
  passengerType: PassengerType
  hasFare: boolean
  expired: boolean
  error: string | null
}

// ---- Feature #4: Live Fare Tracker ----------------------------------------

export type FareUpdateType =
  | 'increase'
  | 'decrease'
  | 'unchanged_verified'
  | 'new_fare'
  | 'correction'
  | 'expiration'
  | 'other'

export type FareUpdateStatus =
  | 'pending'
  | 'official'
  | 'verified'
  | 'community'
  | 'estimated'
  | 'rejected'
  | 'archived'

export type FareNotificationType = 'fare_change' | 'fare_verification' | 'upcoming_fare' | 'all'

export type FareAuditAction =
  | 'created'
  | 'submitted'
  | 'reviewed'
  | 'verified'
  | 'rejected'
  | 'corrected'
  | 'archived'

export interface FareUpdateRow {
  id: string
  fare_id: string
  route_id: string
  previous_fare_id: string | null
  update_type: FareUpdateType
  previous_amount: number | null
  new_amount: number
  change_amount: number
  change_percentage: number | null
  announcement_title: string | null
  announcement_description: string | null
  effective_from: string
  source: string | null
  source_reference: string | null
  verification_status: FareUpdateStatus
  verified_by: string | null
  verified_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface FareUpdateWithDetails extends FareUpdateRow {
  route: (Pick<RouteRow, 'id' | 'route_name' | 'route_code' | 'origin_location_id' | 'destination_location_id' | 'transport_mode_id'> & {
    origin_location: Pick<LocationRow, 'id' | 'name' | 'municipality'> | null
    destination_location: Pick<LocationRow, 'id' | 'name' | 'municipality'> | null
    transport_mode: Pick<TransportModeRow, 'id' | 'name' | 'code' | 'icon'> | null
  }) | null
}

export interface FareUpdateSubscriptionRow {
  id: string
  user_id: string
  route_id: string | null
  transport_mode_id: string | null
  location_id: string | null
  notification_type: FareNotificationType
  is_enabled: boolean
  created_at: string
  updated_at: string
}

export interface FareAuditLogRow {
  id: string
  fare_update_id: string
  action: FareAuditAction
  previous_status: FareUpdateStatus | null
  new_status: FareUpdateStatus | null
  performed_by: string | null
  reason: string | null
  created_at: string
}

// ---- Feature #6: Passenger Discount System --------------------------------

export interface PassengerCategoryRow {
  id: string
  code: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PassengerDiscountRequirementRow {
  id: string
  passenger_category_id: string
  transport_mode_id: string | null
  route_id: string | null
  requirement_title: string
  requirement_description: string | null
  required_document: string | null
  source: string | null
  source_reference: string | null
  verification_status: VerificationStatus
  effective_from: string | null
  effective_until: string | null
  last_verified_at: string | null
  created_at: string
  updated_at: string
}

export interface PassengerDiscountRequirementWithDetails extends PassengerDiscountRequirementRow {
  transport_mode: Pick<TransportModeRow, 'id' | 'name' | 'code' | 'icon'> | null
  route: Pick<RouteRow, 'id' | 'route_name' | 'route_code'> | null
}

export type FareMatrixType = 'fixed' | 'stage_based' | 'distance_based' | 'zone_based' | 'other'
export type FareMatrixPublicationStatus = 'draft' | 'published' | 'archived'
export type FareMatrixPassengerType = 'regular' | 'student' | 'senior' | 'pwd' | 'other'
export type FareMatrixAuditAction = 'created' | 'published' | 'corrected' | 'verified' | 'rejected' | 'archived'

export interface FareMatrixRow {
  id: string
  title: string
  description: string | null
  transport_mode_id: string | null
  route_id: string | null
  matrix_type: FareMatrixType
  publication_status: FareMatrixPublicationStatus
  verification_status: VerificationStatus
  source: string | null
  source_reference: string | null
  effective_from: string
  effective_until: string | null
  last_verified_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface FareMatrixWithDetails extends FareMatrixRow {
  transport_mode: Pick<TransportModeRow, 'id' | 'name' | 'code' | 'icon'> | null
  route: (Pick<RouteRow, 'id' | 'route_name' | 'route_code' | 'origin_location_id' | 'destination_location_id' | 'transport_mode_id'> & {
    origin_location: Pick<LocationRow, 'id' | 'name' | 'municipality'> | null
    destination_location: Pick<LocationRow, 'id' | 'name' | 'municipality'> | null
  }) | null
}

export interface FareMatrixEntryRow {
  id: string
  fare_matrix_id: string
  fare_id: string | null
  origin_location_id: string
  destination_location_id: string
  origin_stop_sequence: number | null
  destination_stop_sequence: number | null
  fare_amount: number | null
  passenger_type: FareMatrixPassengerType
  currency: string
  verification_status: VerificationStatus
  source: string | null
  source_reference: string | null
  created_at: string
  updated_at: string
}

export interface FareMatrixEntryWithDetails extends FareMatrixEntryRow {
  origin_location: Pick<LocationRow, 'id' | 'name' | 'municipality' | 'barangay'> | null
  destination_location: Pick<LocationRow, 'id' | 'name' | 'municipality' | 'barangay'> | null
  fare: Pick<FareRow, 'id' | 'base_fare' | 'fare_type' | 'verification_status'> | null
}

export interface FareMatrixAuditLogRow {
  id: string
  fare_matrix_id: string
  action: FareMatrixAuditAction
  previous_status: FareMatrixPublicationStatus | null
  new_status: FareMatrixPublicationStatus | null
  performed_by: string | null
  reason: string | null
  created_at: string
}

// ---- Feature #7: Jeepney Routes System -------------------------------------

export interface RouteServiceDetailsRow {
  id: string
  route_id: string
  service_direction: string | null
  service_notes: string | null
  operating_days: string | null
  first_trip_time: string | null
  last_trip_time: string | null
  service_frequency_minutes: number | null
  boarding_instructions: string | null
  accessibility_notes: string | null
  verification_status: VerificationStatus
  source: string | null
  source_reference: string | null
  last_verified_at: string | null
  created_at: string
  updated_at: string
}

export interface RouteGeometryRow {
  id: string
  route_id: string
  geometry_format: string
  geometry_data: unknown
  verification_status: VerificationStatus
  source: string | null
  source_reference: string | null
  last_verified_at: string | null
  created_at: string
  updated_at: string
}

export type SavedRouteCategory = 'commute' | 'school' | 'work' | 'family' | 'tourism' | 'other'

export interface SavedRouteRow {
  id: string
  user_id: string
  route_id: string | null
  custom_name: string | null
  origin_location_id: string | null
  destination_location_id: string | null
  journey_snapshot: Record<string, unknown> | null
  preferred_transport_mode_id: string | null
  category: SavedRouteCategory
  is_favorite: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface SavedRouteWithDetails extends SavedRouteRow {
  origin_location: Pick<LocationRow, 'id' | 'name' | 'municipality'> | null
  destination_location: Pick<LocationRow, 'id' | 'name' | 'municipality'> | null
  preferred_transport_mode: Pick<TransportModeRow, 'id' | 'name' | 'code' | 'icon'> | null
  route: Pick<RouteRow, 'id' | 'route_name' | 'route_code' | 'transport_mode_id'> | null
  saved_route_segments: SavedRouteSegmentWithLocation[]
}

export interface SavedRouteSegmentRow {
  id: string
  saved_route_id: string
  sequence_number: number
  route_id: string | null
  transport_mode_id: string | null
  origin_location_id: string | null
  destination_location_id: string | null
  transfer_notes: string | null
  created_at: string
}

export interface SavedRouteSegmentWithLocation extends SavedRouteSegmentRow {
  route: Pick<RouteRow, 'id' | 'route_name' | 'route_code'> | null
  transport_mode: Pick<TransportModeRow, 'id' | 'name' | 'code' | 'icon'> | null
  origin_location: Pick<LocationRow, 'id' | 'name' | 'municipality'> | null
  destination_location: Pick<LocationRow, 'id' | 'name' | 'municipality'> | null
}

export interface JeepneyRouteWithDetails extends RouteWithDetails {
  stop_count: number
  route_service_details: RouteServiceDetailsRow | null
  is_saved: boolean
}

// ---- Feature #8: Tricycle Routes and Fare Zones --------------------------

export type TricycleCoverageType = 'barangay' | 'terminal' | 'zone' | 'landmark' | 'custom_area'
export type TricycleServiceType = 'shared' | 'special' | 'unspecified'

export interface TricycleServiceAreaRow {
  id: string
  name: string
  municipality_id: string
  description: string | null
  coverage_type: TricycleCoverageType
  coverage_geojson: unknown
  centroid_latitude: number | null
  centroid_longitude: number | null
  verification_status: VerificationStatus
  source_name: string | null
  source_url: string | null
  verified_by: string | null
  verified_at: string | null
  created_at: string
  updated_at: string
}

export interface TricycleServiceAreaWithMunicipality extends TricycleServiceAreaRow {
  municipality: Pick<LocationRow, 'id' | 'name' | 'municipality'> | null
}

export interface TricycleFareZoneRow {
  id: string
  name: string
  municipality_id: string
  service_area_id: string | null
  description: string | null
  boundary_geojson: unknown
  verification_status: VerificationStatus
  source_name: string | null
  verified_by: string | null
  verified_at: string | null
  created_at: string
  updated_at: string
}

export interface TricycleFareZoneWithDetails extends TricycleFareZoneRow {
  municipality: Pick<LocationRow, 'id' | 'name' | 'municipality'> | null
  service_area: Pick<TricycleServiceAreaRow, 'id' | 'name'> | null
}

export interface TricycleZoneConnectionRow {
  id: string
  origin_zone_id: string
  destination_zone_id: string
  route_id: string | null
  fare_id: string | null
  service_type: TricycleServiceType
  availability_notes: string | null
  verification_status: VerificationStatus
  source_name: string | null
  verified_by: string | null
  verified_at: string | null
  created_at: string
  updated_at: string
}

export interface TricycleZoneConnectionWithDetails extends TricycleZoneConnectionRow {
  origin_zone: Pick<TricycleFareZoneRow, 'id' | 'name'> | null
  destination_zone: Pick<TricycleFareZoneRow, 'id' | 'name'> | null
  route: Pick<RouteRow, 'id' | 'route_name' | 'route_code'> | null
  fare: Pick<FareRow, 'id' | 'base_fare' | 'fare_type' | 'effective_from' | 'effective_until' | 'verification_status' | 'currency'> | null
}

// ---- Feature #9: Ports and Sea Transport ---------------------------------

export type PortType = 'passenger' | 'roro' | 'cargo' | 'mixed' | 'unknown'
export type PortOperatingStatus = 'operational' | 'temporarily_closed' | 'unknown'
export type ScheduleType = 'regular' | 'special' | 'one_time'
export type ScheduleStatus = 'scheduled' | 'delayed' | 'cancelled' | 'completed' | 'unknown'

export interface PortRow {
  id: string
  location_id: string
  port_name: string
  port_type: PortType
  description: string | null
  contact_number: string | null
  official_website: string | null
  latitude: number | null
  longitude: number | null
  operating_status: PortOperatingStatus
  verification_status: VerificationStatus
  source_name: string | null
  source_url: string | null
  verified_by: string | null
  verified_at: string | null
  created_at: string
  updated_at: string
}

export interface PortWithLocation extends PortRow {
  location: Pick<LocationRow, 'id' | 'name' | 'municipality' | 'barangay' | 'latitude' | 'longitude'> | null
}

export interface SeaTransportScheduleRow {
  id: string
  route_id: string
  operator_name: string | null
  departure_port_id: string | null
  arrival_port_id: string | null
  departure_datetime: string | null
  arrival_datetime: string | null
  schedule_type: ScheduleType
  effective_from: string | null
  effective_until: string | null
  status: ScheduleStatus
  verification_status: VerificationStatus
  source_name: string | null
  source_url: string | null
  verified_at: string | null
  created_at: string
  updated_at: string
}

export interface ScheduleWithDetails extends SeaTransportScheduleRow {
  route: Pick<RouteRow, 'id' | 'route_name' | 'transport_mode_id' | 'operator_name'> | null
  departure_port: Pick<PortRow, 'id' | 'port_name'> | null
  arrival_port: Pick<PortRow, 'id' | 'port_name'> | null
}

export interface SeaRouteWithDetails {
  id: string
  route_name: string
  route_code: string | null
  description: string | null
  origin_location_id: string
  destination_location_id: string
  transport_mode_id: string | null
  operator_name: string | null
  estimated_duration_minutes: number | null
  verification_status: VerificationStatus
  source: string | null
  last_verified_at: string | null
  origin_location: Pick<LocationRow, 'id' | 'name' | 'municipality'> | null
  destination_location: Pick<LocationRow, 'id' | 'name' | 'municipality'> | null
  transport_mode: Pick<TransportModeRow, 'id' | 'name' | 'code'> | null
  origin_port: Pick<PortRow, 'id' | 'port_name'> | null
  destination_port: Pick<PortRow, 'id' | 'port_name'> | null
}

// ---- Feature #15: Community Transport Reports -------------------------------

export type CommunityReportCategory =
  | 'missing_route'
  | 'missing_stop_or_terminal'
  | 'incorrect_location_info'
  | 'transport_service_issue'
  | 'missing_or_incorrect_schedule'
  | 'accessibility_concern'
  | 'passenger_info_concern'
  | 'safety_concern'
  | 'other_transport_concern'

export type CommunityReportStatus =
  | 'submitted'
  | 'under_review'
  | 'needs_more_info'
  | 'resolved'
  | 'rejected'

export type CommunityReportCommentRole = 'reporter' | 'reviewer'

export type CommunityReportAuditAction =
  | 'submitted'
  | 'marked_under_review'
  | 'requested_info'
  | 'resolved'
  | 'rejected'
  | 'forwarded_to_verification'
  | 'reporter_followed_up'

export interface CommunityTransportReportRow {
  id: string
  reporter_id: string
  category: CommunityReportCategory
  title: string
  description: string
  municipality: string
  location_id: string | null
  route_id: string | null
  transport_mode_id: string | null
  latitude: number | null
  longitude: number | null
  observed_at: string | null
  status: CommunityReportStatus
  urgency: string | null
  reporter_followup_preference: string | null
  reviewer_id: string | null
  reviewer_notes: string | null
  resolution_summary: string | null
  rejection_reason: string | null
  forwarded_to_verification: boolean
  verification_forwarded_at: string | null
  created_at: string
  updated_at: string
  reviewed_at: string | null
  resolved_at: string | null
}

export interface CommunityReportWithDetails extends CommunityTransportReportRow {
  location: Pick<LocationRow, 'id' | 'name' | 'municipality'> | null
  route: Pick<RouteRow, 'id' | 'route_name' | 'route_code'> | null
  transport_mode: Pick<TransportModeRow, 'id' | 'name' | 'code' | 'icon'> | null
  reporter: Pick<UserProfile, 'id' | 'name' | 'email'> | null
  reviewer: Pick<UserProfile, 'id' | 'name' | 'email'> | null
}

export interface CommunityReportAttachmentRow {
  id: string
  report_id: string
  uploaded_by: string
  storage_path: string
  file_name: string
  mime_type: string
  file_size: number
  created_at: string
}

export interface CommunityReportCommentRow {
  id: string
  report_id: string
  author_id: string
  author_role: CommunityReportCommentRole
  body: string
  is_visible_to_reporter: boolean
  created_at: string
}

export interface CommunityReportCommentWithAuthor extends CommunityReportCommentRow {
  author: Pick<UserProfile, 'id' | 'name'> | null
}

export interface CommunityReportAuditLogRow {
  id: string
  report_id: string
  actor_id: string | null
  action: CommunityReportAuditAction
  previous_status: CommunityReportStatus | null
  new_status: CommunityReportStatus | null
  internal_note: string | null
  created_at: string
}

export interface CommunityReportStatusTimelineRow {
  id: string
  report_id: string
  action: CommunityReportAuditAction
  previous_status: CommunityReportStatus | null
  new_status: CommunityReportStatus | null
  created_at: string
}

// ---- Feature #16: Fare Concern Reports -----------------------------------

export type FareConcernCategory =
  | 'suspected_overcharging'
  | 'fare_differs_from_matrix'
  | 'student_discount_concern'
  | 'senior_discount_concern'
  | 'pwd_discount_concern'
  | 'fare_calculation_concern'
  | 'inconsistent_fare_collection'
  | 'unclear_or_unposted_fare'
  | 'additional_fare_or_surcharge'
  | 'other_fare_concern'

export type FareConcernStatus =
  | 'submitted'
  | 'under_review'
  | 'needs_more_info'
  | 'resolved'
  | 'rejected'
  | 'closed'

export type FareConcernCommentRole = 'reporter' | 'reviewer'

export type FareConcernAuditAction =
  | 'submitted'
  | 'marked_under_review'
  | 'requested_info'
  | 'resolved'
  | 'rejected'
  | 'closed'
  | 'forwarded_to_verification'
  | 'reporter_followed_up'

export type FareConcernPassengerCategory = 'regular' | 'student' | 'senior' | 'pwd'

export interface FareConcernReportRow {
  id: string
  reporter_id: string
  report_reference: string
  category: FareConcernCategory
  title: string
  description: string
  municipality: string
  route_id: string | null
  transport_mode_id: string | null
  boarding_location_id: string | null
  destination_location_id: string | null
  incident_at: string | null
  amount_charged: number | null
  expected_fare_amount: number | null
  passenger_category: FareConcernPassengerCategory | null
  fare_record_id: string | null
  status: FareConcernStatus
  reviewer_id: string | null
  reviewer_notes: string | null
  resolution_summary: string | null
  rejection_reason: string | null
  forwarded_to_verification: boolean
  verification_forwarded_at: string | null
  created_at: string
  updated_at: string
  reviewed_at: string | null
  resolved_at: string | null
}

export interface FareConcernWithDetails extends FareConcernReportRow {
  route: Pick<RouteRow, 'id' | 'route_name' | 'route_code'> | null
  transport_mode: Pick<TransportModeRow, 'id' | 'name' | 'code' | 'icon'> | null
  boarding_location: Pick<LocationRow, 'id' | 'name' | 'municipality'> | null
  destination_location: Pick<LocationRow, 'id' | 'name' | 'municipality'> | null
  reporter: Pick<UserProfile, 'id' | 'name' | 'email'> | null
  reviewer: Pick<UserProfile, 'id' | 'name' | 'email'> | null
}

export interface FareConcernAttachmentRow {
  id: string
  report_id: string
  uploaded_by: string
  storage_path: string
  file_name: string
  mime_type: string
  file_size: number
  created_at: string
}

export interface FareConcernCommentRow {
  id: string
  report_id: string
  author_id: string
  author_role: FareConcernCommentRole
  body: string
  is_visible_to_reporter: boolean
  created_at: string
}

export interface FareConcernCommentWithAuthor extends FareConcernCommentRow {
  author: Pick<UserProfile, 'id' | 'name'> | null
}

export interface FareConcernAuditLogRow {
  id: string
  report_id: string
  actor_id: string | null
  action: FareConcernAuditAction
  previous_status: FareConcernStatus | null
  new_status: FareConcernStatus | null
  internal_note: string | null
  created_at: string
}

export interface FareConcernStatusTimelineRow {
  id: string
  report_id: string
  action: FareConcernAuditAction
  previous_status: FareConcernStatus | null
  new_status: FareConcernStatus | null
  created_at: string
}

// ---- Feature #18: Transport Alerts ---------------------------------------

export type TransportAlertCategory =
  | 'route_closure'
  | 'service_interruption'
  | 'schedule_change'
  | 'jeepney_advisory'
  | 'tricycle_advisory'
  | 'ferry_roro_advisory'
  | 'boat_island_advisory'
  | 'port_advisory'
  | 'weather_transport'
  | 'terminal_stop_advisory'
  | 'road_access_traffic'
  | 'emergency_transport'
  | 'general_announcement'

export type TransportAlertSeverity = 'info' | 'low' | 'moderate' | 'high' | 'critical'

export type TransportAlertStatus =
  | 'draft'
  | 'pending_review'
  | 'published'
  | 'updated'
  | 'resolved'
  | 'expired'
  | 'rejected'

export type TransportAlertVerification =
  | 'verified'
  | 'application_advisory'
  | 'unverified'
  | 'rejected'

export type TransportAlertAuditAction =
  | 'created'
  | 'submitted_for_review'
  | 'published'
  | 'updated'
  | 'resolved'
  | 'expired'
  | 'rejected'

export interface TransportAlertRow {
  id: string
  title: string
  description: string
  category: TransportAlertCategory
  severity: TransportAlertSeverity
  status: TransportAlertStatus
  verification: TransportAlertVerification
  municipality: string | null
  location_id: string | null
  route_id: string | null
  transport_mode_id: string | null
  source_name: string | null
  source_url: string | null
  source_reference: string | null
  recommended_actions: string | null
  source_report_id: string | null
  published_by: string | null
  reviewed_by: string | null
  starts_at: string | null
  ends_at: string | null
  published_at: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export interface TransportAlertWithDetails extends TransportAlertRow {
  location: Pick<LocationRow, 'id' | 'name' | 'municipality'> | null
  route: Pick<RouteRow, 'id' | 'route_name' | 'route_code'> | null
  transport_mode: Pick<TransportModeRow, 'id' | 'name' | 'code' | 'icon'> | null
  publisher: Pick<UserProfile, 'id' | 'name'> | null
  reviewer: Pick<UserProfile, 'id' | 'name'> | null
}

export interface TransportAlertAuditLogRow {
  id: string
  alert_id: string
  actor_id: string | null
  action: TransportAlertAuditAction
  previous_status: TransportAlertStatus | null
  new_status: TransportAlertStatus | null
  note: string | null
  created_at: string
}

export interface TransportAlertSubscriptionRow {
  id: string
  user_id: string
  municipality: string | null
  route_id: string | null
  transport_mode_id: string | null
  categories: string[]
  minimum_severity: TransportAlertSeverity
  enabled: boolean
  created_at: string
  updated_at: string
}

// ---- Feature #19: Explore Marinduque ---------------------------------------

export type DestinationVerification =
  | 'unverified'
  | 'pending_review'
  | 'verified'
  | 'rejected'
  | 'needs_update'

export type DestinationReportCategory =
  | 'incorrect_address'
  | 'incorrect_hours'
  | 'outdated_fees'
  | 'inaccurate_description'
  | 'closed_destination'
  | 'inappropriate_content'
  | 'other_concern'

export type DestinationReportStatus =
  | 'submitted'
  | 'under_review'
  | 'resolved'
  | 'rejected'

export interface ExploreCategoryRow {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  parent_id: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DestinationRow {
  id: string
  location_id: string | null
  name: string
  slug: string
  description: string | null
  category_id: string | null
  municipality: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  cover_image_path: string | null
  entrance_fee: string | null
  currency: string
  opening_hours: Record<string, unknown> | null
  contact_information: string | null
  official_website: string | null
  amenities: Record<string, unknown> | null
  accessibility_information: Record<string, unknown> | null
  verification_status: DestinationVerification
  verified_by: string | null
  verified_at: string | null
  is_featured: boolean
  is_published: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface DestinationWithDetails extends DestinationRow {
  category: Pick<ExploreCategoryRow, 'id' | 'name' | 'slug' | 'icon'> | null
  location: Pick<LocationRow, 'id' | 'name' | 'municipality'> | null
  images: DestinationImageRow[]
}

export interface DestinationImageRow {
  id: string
  destination_id: string
  storage_path: string
  caption: string | null
  alt_text: string | null
  sort_order: number
  uploaded_by: string | null
  verification_status: DestinationVerification
  created_at: string
}

export interface DestinationReportRow {
  id: string
  destination_id: string
  reporter_id: string
  category: DestinationReportCategory
  description: string
  status: DestinationReportStatus
  reviewer_id: string | null
  reviewer_notes: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

// ---- Feature #20: Culture & Events ----------------------------------------

export type EventVerification =
  | 'unverified'
  | 'pending_review'
  | 'verified'
  | 'needs_update'
  | 'rejected'

export type EventStatus =
  | 'draft'
  | 'pending_review'
  | 'published'
  | 'postponed'
  | 'cancelled'
  | 'completed'
  | 'archived'

export type EventAdmissionType = 'free' | 'paid' | 'unknown'

export type EventReportCategory =
  | 'incorrect_date'
  | 'incorrect_venue'
  | 'incorrect_fee'
  | 'inaccurate_description'
  | 'cancelled_event'
  | 'inappropriate_content'
  | 'other_concern'

export type EventReportStatus = 'submitted' | 'under_review' | 'resolved' | 'rejected'

export type EventRegistrationStatus = 'registered' | 'cancelled'

export interface EventCategoryRow {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  parent_id: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CulturalEventRow {
  id: string
  title: string
  slug: string
  description: string | null
  category_id: string | null
  municipality: string | null
  location_id: string | null
  venue_name: string | null
  venue_address: string | null
  latitude: number | null
  longitude: number | null
  start_at: string | null
  end_at: string | null
  is_all_day: boolean
  cover_image_path: string | null
  organizer_name: string | null
  official_source_url: string | null
  admission_type: EventAdmissionType
  admission_fee: string | null
  currency: string
  registration_required: boolean | null
  registration_url: string | null
  registration_deadline: string | null
  accessibility_information: Record<string, unknown> | null
  verification_status: EventVerification
  status: EventStatus
  submitted_by: string | null
  reviewed_by: string | null
  verified_at: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface CulturalEventWithDetails extends CulturalEventRow {
  category: Pick<EventCategoryRow, 'id' | 'name' | 'slug' | 'icon'> | null
  location: Pick<LocationRow, 'id' | 'name' | 'municipality'> | null
  images: EventImageRow[]
  is_saved: boolean
}

export interface EventImageRow {
  id: string
  event_id: string
  storage_path: string
  caption: string | null
  alt_text: string | null
  sort_order: number
  uploaded_by: string | null
  created_at: string
}

export interface SavedEventRow {
  id: string
  user_id: string
  event_id: string
  created_at: string
}

export interface EventReportRow {
  id: string
  event_id: string
  reporter_id: string
  category: EventReportCategory
  description: string
  status: EventReportStatus
  reviewer_id: string | null
  reviewer_notes: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export interface EventRegistrationRow {
  id: string
  event_id: string
  user_id: string
  registration_status: EventRegistrationStatus
  registered_at: string
  updated_at: string
}

// ---- Feature #21: Nearby Places & Services -------------------------------

export type NearbyPlaceCategory =
  | 'restaurant' | 'cafe_bakery' | 'grocery_market' | 'convenience_store' | 'local_shop'
  | 'public_market' | 'pharmacy' | 'hospital_clinic' | 'health_center' | 'atm_bank'
  | 'police_station' | 'fire_station' | 'government_office' | 'gas_station' | 'public_toilet'
  | 'jeepney_stop' | 'tricycle_terminal' | 'bus_terminal' | 'port' | 'ferry_terminal'
  | 'boat_service' | 'tourist_attraction' | 'beach' | 'historical_cultural' | 'accommodation'
  | 'visitor_info' | 'other'

export interface NearbyPlaceDetailRow {
  id: string
  place_id: string
  category: NearbyPlaceCategory
  phone_number: string | null
  operating_hours: Record<string, unknown> | null
  description: string | null
  data_source: string | null
  last_verified_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface NearbyPlace extends LocationRow {
  nearby_details: NearbyPlaceDetailRow | null
  distance_km: number | null
}

export interface NearbyPlaceCategoryGroup {
  id: string
  label: string
  icon: string
  categories: NearbyPlaceCategory[]
}

// ---- Feature #25: Trip History & Journey Records --------------------------

export type TripStatus = 'planned' | 'saved' | 'started' | 'completed' | 'cancelled'

export interface TripHistoryRow {
  id: string
  user_id: string
  origin_location_id: string | null
  destination_location_id: string | null
  route_id: string | null
  transport_mode_id: string | null
  trip_status: TripStatus
  planned_departure_at: string | null
  started_at: string | null
  completed_at: string | null
  estimated_fare: number | null
  actual_fare: number | null
  currency_code: string
  fare_snapshot: Record<string, unknown> | null
  passenger_category_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface TripHistorySegmentRow {
  id: string
  trip_history_id: string
  segment_order: number
  route_id: string | null
  origin_location_id: string | null
  destination_location_id: string | null
  transport_mode_id: string | null
  fare_snapshot: Record<string, unknown> | null
  created_at: string
}

export interface TripHistorySegmentWithDetails extends TripHistorySegmentRow {
  route: Pick<RouteRow, 'id' | 'route_name' | 'route_code'> | null
  transport_mode: Pick<TransportModeRow, 'id' | 'name' | 'code' | 'icon'> | null
  origin_location: Pick<LocationRow, 'id' | 'name' | 'municipality'> | null
  destination_location: Pick<LocationRow, 'id' | 'name' | 'municipality'> | null
}

export interface TripHistoryWithDetails extends TripHistoryRow {
  origin_location: Pick<LocationRow, 'id' | 'name' | 'municipality'> | null
  destination_location: Pick<LocationRow, 'id' | 'name' | 'municipality'> | null
  transport_mode: Pick<TransportModeRow, 'id' | 'name' | 'code' | 'icon'> | null
  route: Pick<RouteRow, 'id' | 'route_name' | 'route_code'> | null
  passenger_category: Pick<PassengerCategoryRow, 'id' | 'name' | 'code'> | null
  trip_history_segments: TripHistorySegmentWithDetails[]
}

// ---- Feature #29: Tourist Trip Planner & Itinerary Builder ---------------

export type ItineraryStatus = 'draft' | 'planned' | 'in_progress' | 'completed' | 'archived'
export type FareSourceStatus = 'verified' | 'estimated' | 'user_entered' | 'unavailable'
export type ItineraryExpenseCategory = 'transportation' | 'entrance_fee' | 'accommodation' | 'food' | 'other'
export type ItineraryExpenseSource = 'verified' | 'estimated' | 'user_entered'

export interface TouristItineraryRow {
  id: string
  user_id: string
  title: string
  description: string | null
  start_date: string | null
  end_date: string | null
  starting_location_id: string | null
  traveler_count: number
  budget_amount: number
  currency_code: string
  status: ItineraryStatus
  preferences: Record<string, unknown> | null
  is_shared: boolean
  share_token: string | null
  created_at: string
  updated_at: string
}

export interface TouristItineraryDayRow {
  id: string
  itinerary_id: string
  day_number: number
  trip_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface TouristItineraryStopRow {
  id: string
  itinerary_id: string
  itinerary_day_id: string | null
  destination_id: string | null
  location_id: string | null
  custom_title: string | null
  custom_location_description: string | null
  custom_latitude: number | null
  custom_longitude: number | null
  stop_order: number
  planned_arrival_time: string | null
  planned_departure_time: string | null
  estimated_duration_minutes: number | null
  is_rest_break: boolean
  user_notes: string | null
  created_at: string
  updated_at: string
}

export interface TouristItineraryLegRow {
  id: string
  itinerary_id: string
  from_stop_id: string
  to_stop_id: string
  route_id: string | null
  transport_mode_id: string | null
  leg_order: number
  estimated_fare: number | null
  currency_code: string
  fare_source_status: FareSourceStatus
  estimated_duration_minutes: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface TouristItineraryExpenseRow {
  id: string
  itinerary_id: string
  stop_id: string | null
  category: ItineraryExpenseCategory
  amount: number
  currency_code: string
  description: string | null
  source_type: ItineraryExpenseSource
  created_at: string
  updated_at: string
}

export interface ItineraryStopWithDetails extends TouristItineraryStopRow {
  destination: Pick<DestinationRow, 'id' | 'name' | 'municipality' | 'latitude' | 'longitude' | 'entrance_fee' | 'opening_hours' | 'verification_status'> | null
  location: Pick<LocationRow, 'id' | 'name' | 'municipality' | 'latitude' | 'longitude'> | null
}

export interface ItineraryLegWithDetails extends TouristItineraryLegRow {
  route: Pick<RouteRow, 'id' | 'route_name' | 'route_code' | 'estimated_duration_minutes'> | null
  transport_mode: Pick<TransportModeRow, 'id' | 'name' | 'code' | 'icon'> | null
  from_stop: Pick<TouristItineraryStopRow, 'id' | 'custom_title' | 'destination_id' | 'location_id'> | null
  to_stop: Pick<TouristItineraryStopRow, 'id' | 'custom_title' | 'destination_id' | 'location_id'> | null
}

export interface ItineraryExpenseWithStop extends TouristItineraryExpenseRow {
  stop: Pick<TouristItineraryStopRow, 'id' | 'custom_title'> | null
}

export interface TouristItineraryWithDetails extends TouristItineraryRow {
  starting_location: Pick<LocationRow, 'id' | 'name' | 'municipality'> | null
  days: (TouristItineraryDayRow & { stops: ItineraryStopWithDetails[] })[]
  legs: ItineraryLegWithDetails[]
  expenses: ItineraryExpenseWithStop[]
}

// ---- Feature #26: Driver & Transport Operator Portal -----------------------

export type TransportOperatorVerificationStatus =
  | 'not_submitted'
  | 'pending_review'
  | 'needs_more_information'
  | 'approved'
  | 'rejected'
  | 'suspended'

export type TransportSubmissionStatus =
  | 'pending_review'
  | 'under_review'
  | 'needs_more_information'
  | 'approved'
  | 'rejected'
  | 'published'

export type TransportSubmissionType =
  | 'new_route'
  | 'route_update'
  | 'fare_change'
  | 'schedule_update'
  | 'service_interruption'
  | 'contact_update'

export type TransportOperatorAuditAction =
  | 'application_submitted'
  | 'operator_verified'
  | 'operator_rejected'
  | 'operator_suspended'
  | 'service_submitted'
  | 'fare_proposed'
  | 'submission_approved'
  | 'submission_rejected'
  | 'submission_published'
  | 'info_requested'

export interface TransportOperatorRow {
  id: string
  owner_user_id: string
  organization_name: string
  contact_name: string
  contact_email: string
  contact_phone: string | null
  municipality: string | null
  transport_mode_id: string | null
  service_category: string
  verification_status: TransportOperatorVerificationStatus
  reviewer_notes: string | null
  verified_by: string | null
  verified_at: string | null
  supporting_info: string | null
  created_at: string
  updated_at: string
}

export interface TransportOperatorWithMode extends TransportOperatorRow {
  transport_mode: Pick<TransportModeRow, 'id' | 'name' | 'code' | 'icon'> | null
}

export interface TransportServiceSubmissionRow {
  id: string
  operator_id: string
  submitted_by_user_id: string
  submission_type: TransportSubmissionType
  related_route_id: string | null
  transport_mode_id: string | null
  origin_location_id: string | null
  destination_location_id: string | null
  proposed_data: Record<string, unknown>
  proposed_effective_date: string | null
  supporting_notes: string | null
  status: TransportSubmissionStatus
  reviewer_feedback: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export interface TransportServiceSubmissionWithDetails extends TransportServiceSubmissionRow {
  operator: Pick<TransportOperatorRow, 'id' | 'organization_name' | 'verification_status'> | null
  related_route: Pick<RouteRow, 'id' | 'route_name' | 'route_code'> | null
  transport_mode: Pick<TransportModeRow, 'id' | 'name' | 'code' | 'icon'> | null
  origin_location: Pick<LocationRow, 'id' | 'name' | 'municipality'> | null
  destination_location: Pick<LocationRow, 'id' | 'name' | 'municipality'> | null
  reviewer: Pick<UserProfile, 'id' | 'name' | 'email'> | null
}

export interface TransportOperatorAuditLogRow {
  id: string
  operator_id: string | null
  submission_id: string | null
  actor_id: string | null
  action: TransportOperatorAuditAction
  previous_status: string | null
  new_status: string | null
  summary: string | null
  created_at: string
}

// ---- Feature #30: Total Trip Cost Calculator ------------------------------

export type CostEstimateStatus = 'draft' | 'saved' | 'recalculated' | 'archived'
export type CostItemType = 'transport_leg' | 'additional_expense'
export type CostItemSourceType = 'verified' | 'calculated_estimate' | 'user_entered' | 'unverified' | 'unavailable'
export type CostItemCalculationType = 'per_person' | 'per_group' | 'per_item' | 'per_day' | 'manual_total'

export interface TripCostEstimateRow {
  id: string
  user_id: string
  title: string
  origin_location_id: string | null
  destination_location_id: string | null
  trip_date: string | null
  return_date: string | null
  is_round_trip: boolean
  traveler_count: number
  currency_code: string
  transportation_subtotal: number
  additional_expenses_subtotal: number
  known_total: number
  is_complete: boolean
  budget_amount: number | null
  calculation_metadata: Record<string, unknown> | null
  saved_route_id: string | null
  itinerary_id: string | null
  status: CostEstimateStatus
  created_at: string
  updated_at: string
}

export interface TripCostItemRow {
  id: string
  estimate_id: string
  item_type: CostItemType
  category: string
  description: string
  route_id: string | null
  transport_mode_id: string | null
  from_location_id: string | null
  to_location_id: string | null
  passenger_type: PassengerType | null
  passenger_count: number
  amount: number
  currency_code: string
  quantity: number
  calculation_type: CostItemCalculationType
  line_total: number
  source_type: CostItemSourceType
  source_reference: string | null
  notes: string | null
  leg_order: number
  created_at: string
  updated_at: string
}

export interface TripCostItemWithDetails extends TripCostItemRow {
  route: Pick<RouteRow, 'id' | 'route_name' | 'route_code'> | null
  transport_mode: Pick<TransportModeRow, 'id' | 'name' | 'code' | 'icon'> | null
  from_location: Pick<LocationRow, 'id' | 'name' | 'municipality'> | null
  to_location: Pick<LocationRow, 'id' | 'name' | 'municipality'> | null
}

export interface TripCostEstimateWithDetails extends TripCostEstimateRow {
  origin_location: Pick<LocationRow, 'id' | 'name' | 'municipality'> | null
  destination_location: Pick<LocationRow, 'id' | 'name' | 'municipality'> | null
  items: TripCostItemWithDetails[]
}

// ---- Feature #31: Share Trip & Journey Details ----------------------------

export type TripSourceType = 'itinerary' | 'route' | 'cost_estimate'
export type ShareTripStatus = 'ok' | 'not_found' | 'expired' | 'revoked'

export interface SharedTripRow {
  id: string
  owner_user_id: string
  trip_source_type: TripSourceType
  trip_source_id: string
  share_token: string
  title_snapshot: string
  shared_content: Record<string, unknown>
  include_costs: boolean
  include_notes: boolean
  include_stops: boolean
  include_route_details: boolean
  expires_at: string | null
  revoked_at: string | null
  view_count: number
  last_viewed_at: string | null
  created_at: string
  updated_at: string
}

export interface SharedTripLookupResult {
  status: ShareTripStatus
  title?: string
  trip_source_type?: TripSourceType
  shared_content?: Record<string, unknown>
  include_costs?: boolean
  include_notes?: boolean
  include_stops?: boolean
  include_route_details?: boolean
  created_at?: string
  expires_at?: string | null
}