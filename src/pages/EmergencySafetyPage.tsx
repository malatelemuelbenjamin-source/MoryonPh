import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Phone,
  Shield,
  Flame,
  HeartPulse,
  Siren,
  Sailboat,
  LifeBuoy,
  Building2,
  AlertTriangle,
  Info,
  MapPin,
  RefreshCw,
  Plus,
  X,
  ChevronRight,
  CloudSun,
  BookOpen,
} from 'lucide-react'
import {
  fetchEmergencyContacts,
  fetchEmergencyGuides,
  CONTACT_CATEGORY_LABELS,
  GUIDE_CATEGORY_LABELS,
  MUNICIPALITIES,
  submitEmergencyContactSuggestion,
  type EmergencyContactRow,
  type EmergencyGuideRow,
  type EmergencyContactCategory,
} from '../lib/emergencyInfo'

const CONTACT_ICONS: Record<EmergencyContactCategory, typeof Phone> = {
  national_emergency: Siren,
  police: Shield,
  fire_rescue: Flame,
  ambulance_medical: HeartPulse,
  municipal_emergency: Building2,
  disaster_response: AlertTriangle,
  maritime_safety: Sailboat,
  coast_guard: LifeBuoy,
  other_assistance: Phone,
}

export function EmergencySafetyPage() {
  const [contacts, setContacts] = useState<EmergencyContactRow[]>([])
  const [guides, setGuides] = useState<EmergencyGuideRow[]>([])
  const [loading, setLoading] = useState(true)
  const [muniFilter, setMuniFilter] = useState('all')
  const [showSuggest, setShowSuggest] = useState(false)
  const [activeTab, setActiveTab] = useState<'contacts' | 'guides' | 'facilities'>('contacts')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [c, g] = await Promise.all([
      fetchEmergencyContacts(muniFilter),
      fetchEmergencyGuides(muniFilter),
    ])
    setContacts(c)
    setGuides(g)
    setLoading(false)
  }, [muniFilter])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Group contacts by category
  const contactsByCategory = contacts.reduce<Record<string, EmergencyContactRow[]>>((acc, c) => {
    if (!acc[c.category]) acc[c.category] = []
    acc[c.category].push(c)
    return acc
  }, {})

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-red-700 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/" aria-label="Back to home" className="grid h-9 w-9 place-items-center rounded-full bg-red-600 hover:bg-red-500">
            <ArrowLeft size={18} />
          </Link>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-red-500">
            <Siren size={18} />
          </span>
          <h1 className="text-lg font-bold">Emergency & Safety</h1>
        </div>
      </header>

      <main className="flex-1 space-y-4 px-4 py-5">
        {/* Critical reminder */}
        <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-600" />
            <p className="text-sm font-semibold text-red-800">
              In a life-threatening emergency, call 911 (national emergency hotline) directly.
              MoryonGo provides information only — it does not dispatch emergency services.
            </p>
          </div>
        </div>

        {/* Municipality selector */}
        <section className="card space-y-2">
          <p className="text-xs font-semibold text-ocean-700">Select Municipality</p>
          <div className="flex flex-wrap gap-1.5">
            <MuniChip active={muniFilter === 'all'} onClick={() => setMuniFilter('all')} label="All" />
            {MUNICIPALITIES.map((m) => (
              <MuniChip key={m} active={muniFilter === m} onClick={() => setMuniFilter(m)} label={m} />
            ))}
          </div>
        </section>

        {/* Tabs */}
        <div className="flex gap-1.5">
          <TabButton active={activeTab === 'contacts'} onClick={() => setActiveTab('contacts')} label="Hotlines" icon={Phone} />
          <TabButton active={activeTab === 'guides'} onClick={() => setActiveTab('guides')} label="Safety Guides" icon={BookOpen} />
          <TabButton active={activeTab === 'facilities'} onClick={() => setActiveTab('facilities')} label="Facilities" icon={MapPin} />
        </div>

        {/* Loading */}
        {loading && (
          <div className="card flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ocean-400" />
            <p className="text-sm font-semibold text-ocean-700">Loading emergency information…</p>
          </div>
        )}

        {/* Contacts tab */}
        {!loading && activeTab === 'contacts' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Emergency Hotlines</h2>
              <button type="button" onClick={() => void loadData()} className="text-ocean-500 hover:text-ocean-700">
                <RefreshCw size={16} />
              </button>
            </div>

            {contacts.length === 0 ? (
              <div className="card flex flex-col items-center gap-2 text-center">
                <Info size={24} className="text-ocean-400" />
                <p className="text-sm font-bold text-ocean-900">No verified contacts yet</p>
                <p className="text-sm text-ocean-600">
                  Verified emergency contacts will appear here once reviewed by authorized administrators.
                  You can suggest a contact below.
                </p>
                <button type="button" onClick={() => setShowSuggest(true)} className="btn-primary text-xs mt-2">
                  <Plus size={14} /> Suggest a Contact
                </button>
              </div>
            ) : (
              <>
                {Object.entries(contactsByCategory).map(([cat, items]) => {
                  const Icon = CONTACT_ICONS[cat as EmergencyContactCategory] ?? Phone
                  return (
                    <div key={cat} className="space-y-2">
                      <h3 className="flex items-center gap-1.5 text-sm font-bold text-ocean-900">
                        <Icon size={16} className="text-red-600" />
                        {CONTACT_CATEGORY_LABELS[cat as EmergencyContactCategory] ?? cat}
                      </h3>
                      <div className="space-y-2">
                        {items.map((c) => (
                          <ContactCard key={c.id} contact={c} />
                        ))}
                      </div>
                    </div>
                  )
                })}
                <button type="button" onClick={() => setShowSuggest(true)} className="btn-secondary w-full text-sm">
                  <Plus size={14} /> Suggest a Contact
                </button>
              </>
            )}
          </section>
        )}

        {/* Guides tab */}
        {!loading && activeTab === 'guides' && (
          <section className="space-y-3">
            <h2 className="section-title">Safety Guides</h2>
            {guides.length === 0 ? (
              <div className="card flex flex-col items-center gap-2 text-center">
                <BookOpen size={24} className="text-ocean-400" />
                <p className="text-sm font-bold text-ocean-900">No safety guides available</p>
                <p className="text-sm text-ocean-600">
                  Verified safety and preparedness guides will appear here once published by authorized reviewers.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {guides.map((g) => (
                  <Link
                    key={g.id}
                    to={`/emergency/guide/${g.id}`}
                    className="card block hover:shadow-cardHover transition active:scale-[0.98]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-bold text-ocean-900">{g.title}</p>
                        <p className="text-xs text-ocean-600">{GUIDE_CATEGORY_LABELS[g.category] ?? g.category}</p>
                      </div>
                      <ChevronRight size={18} className="shrink-0 text-ocean-400" />
                    </div>
                    {g.source_name && (
                      <p className="mt-1 text-xs text-ocean-500">Source: {g.source_name}</p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Facilities tab */}
        {!loading && activeTab === 'facilities' && (
          <section className="space-y-3">
            <h2 className="section-title">Emergency Facilities Nearby</h2>
            <div className="grid grid-cols-2 gap-3">
              <FacilityLink to="/nearby-places" icon={HeartPulse} label="Hospitals & Clinics" tone="bg-red-100 text-red-700" />
              <FacilityLink to="/nearby-places" icon={Shield} label="Police Stations" tone="bg-ocean-100 text-ocean-800" />
              <FacilityLink to="/nearby-places" icon={Flame} label="Fire Stations" tone="bg-terra-100 text-terra-700" />
              <FacilityLink to="/nearby-places" icon={Building2} label="Govt Offices" tone="bg-ocean-100 text-ocean-800" />
              <FacilityLink to="/nearby-places" icon={LifeBuoy} label="Rescue Services" tone="bg-leaf-100 text-leaf-700" />
              <FacilityLink to="/ports" icon={Sailboat} label="Ports & Maritime" tone="bg-ocean-100 text-ocean-800" />
            </div>
            <div className="card flex items-start gap-2">
              <Info size={16} className="mt-0.5 shrink-0 text-ocean-500" />
              <p className="text-xs text-ocean-600">
                Facility listings come from verified MoryonGo place records. A listing does not guarantee
                the facility is open, staffed, or able to provide a specific service. Always call ahead when possible.
              </p>
            </div>
          </section>
        )}

        {/* Active alerts link */}
        <section className="card">
          <Link to="/transport-alerts" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-terra-100 text-terra-700">
              <AlertTriangle size={20} />
            </span>
            <div className="flex-1">
              <p className="font-bold text-ocean-900">Active Alerts & Advisories</p>
              <p className="text-xs text-ocean-600">Weather, transport, and safety alerts</p>
            </div>
            <ChevronRight size={18} className="text-ocean-400" />
          </Link>
        </section>

        <section className="card">
          <Link to="/weather" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-sand-200 text-terra-700">
              <CloudSun size={20} />
            </span>
            <div className="flex-1">
              <p className="font-bold text-ocean-900">Weather Conditions</p>
              <p className="text-xs text-ocean-600">Check for severe weather before traveling</p>
            </div>
            <ChevronRight size={18} className="text-ocean-400" />
          </Link>
        </section>

        {/* Suggest contact form */}
        {showSuggest && (
          <SuggestContactForm onClose={() => setShowSuggest(false)} municipality={muniFilter !== 'all' ? muniFilter : undefined} />
        )}

        {/* Privacy note */}
        <section className="card flex items-start gap-2">
          <Info size={16} className="mt-0.5 shrink-0 text-ocean-500" />
          <p className="text-xs text-ocean-600">
            Emergency contact information is sourced from verified official sources and reviewed by
            authorized MoryonGo administrators. Community suggestions remain unpublished until verified.
            MoryonGo is not an emergency dispatch service. For emergencies, call the appropriate
            hotline directly.
          </p>
        </section>
      </main>
    </div>
  )
}

// ---- Contact Card ----------------------------------------------------------

function ContactCard({ contact }: { contact: EmergencyContactRow }) {
  const hasPhone = contact.phone_number && contact.phone_number.trim().length > 0

  return (
    <div className="card space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="font-bold text-ocean-900">{contact.agency_name}</p>
          {contact.service_coverage && (
            <p className="text-xs text-ocean-600">{contact.service_coverage}</p>
          )}
        </div>
        <span className="pill shrink-0 text-[10px] bg-leaf-100 text-leaf-700">
          {contact.verification_status}
        </span>
      </div>

      {contact.address && (
        <p className="flex items-center gap-1 text-xs text-ocean-500">
          <MapPin size={12} /> {contact.address}
        </p>
      )}

      {contact.municipality && (
        <p className="text-xs text-ocean-500">{contact.municipality}</p>
      )}

      {contact.availability_notes && (
        <p className="text-xs text-ocean-600">{contact.availability_notes}</p>
      )}

      {/* Call action */}
      {hasPhone ? (
        <div className="flex gap-2">
          <a
            href={`tel:${contact.phone_number}`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition active:scale-95 hover:bg-red-700"
          >
            <Phone size={16} /> Call {contact.phone_number}
          </a>
          <button
            type="button"
            onClick={() => {
              if (contact.phone_number) navigator.clipboard?.writeText(contact.phone_number)
            }}
            className="rounded-xl bg-ocean-50 px-3 py-2.5 text-sm font-semibold text-ocean-700 transition active:scale-95"
            aria-label="Copy number"
          >
            Copy
          </button>
        </div>
      ) : (
        <p className="text-xs text-ocean-400 italic">Phone number not verified — no call available</p>
      )}

      {contact.official_source_url && (
        <a
          href={contact.official_source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-xs text-ocean-500 hover:text-ocean-700 underline"
        >
          Official source
        </a>
      )}
    </div>
  )
}

// ---- Suggest Contact Form --------------------------------------------------

function SuggestContactForm({
  onClose,
  municipality,
}: {
  onClose: () => void
  municipality?: string
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<EmergencyContactCategory>('police')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [muni, setMuni] = useState(municipality ?? '')
  const [coverage, setCoverage] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null)

  async function handleSubmit() {
    if (!name.trim()) return
    setSubmitting(true)
    const res = await submitEmergencyContactSuggestion({
      agency_name: name,
      category,
      phone_number: phone || undefined,
      address: address || undefined,
      municipality: muni || undefined,
      service_coverage: coverage || undefined,
      official_source_url: sourceUrl || undefined,
    })
    setSubmitting(false)
    setResult(res)
    if (res.success) {
      setName(''); setPhone(''); setAddress(''); setCoverage(''); setSourceUrl('')
    }
  }

  return (
    <div className="card space-y-3 border-ocean-200">
      <div className="flex items-center justify-between">
        <p className="font-bold text-ocean-900">Suggest a Contact</p>
        <button type="button" onClick={onClose} className="text-ocean-400 hover:text-ocean-600">
          <X size={18} />
        </button>
      </div>
      <p className="text-xs text-ocean-600">
        Your suggestion will be reviewed before it appears publicly. It won't become official until verified.
      </p>

      {result?.success && (
        <div className="rounded-lg bg-leaf-50 px-3 py-2 text-sm text-leaf-700">
          Thank you! Your suggestion has been submitted for review.
        </div>
      )}
      {result && !result.success && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {result.error || 'Submission failed. Please try again.'}
        </div>
      )}

      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Agency or service name *" className="input" />
      <select value={category} onChange={(e) => setCategory(e.target.value as EmergencyContactCategory)} className="input">
        {Object.entries(CONTACT_CATEGORY_LABELS).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
      <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number (optional)" className="input" />
      <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address (optional)" className="input" />
      <select value={muni} onChange={(e) => setMuni(e.target.value)} className="input">
        <option value="">National / All municipalities</option>
        {MUNICIPALITIES.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
      <input type="text" value={coverage} onChange={(e) => setCoverage(e.target.value)} placeholder="Service coverage (optional)" className="input" />
      <input type="text" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="Official source URL (optional)" className="input" />
      <button type="button" onClick={() => void handleSubmit()} disabled={submitting || !name.trim()} className="btn-primary w-full">
        {submitting ? 'Submitting…' : 'Submit for Review'}
      </button>
    </div>
  )
}

// ---- Small UI helpers ------------------------------------------------------

function MuniChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
        active ? 'bg-red-700 text-white' : 'bg-ocean-50 text-ocean-700 hover:bg-ocean-100'
      }`}
    >
      {label}
    </button>
  )
}

function TabButton({
  active, onClick, label, icon: Icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  icon: typeof Phone
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition active:scale-95 ${
        active ? 'bg-red-700 text-white shadow-card' : 'bg-white text-ocean-700 shadow-card hover:shadow-cardHover'
      }`}
    >
      <Icon size={16} /> {label}
    </button>
  )
}

function FacilityLink({
  to, icon: Icon, label, tone,
}: {
  to: string
  icon: typeof Phone
  label: string
  tone: string
}) {
  return (
    <Link to={to} className="card flex flex-col items-center gap-2 py-4 transition active:scale-95 hover:shadow-cardHover">
      <span className={`grid h-12 w-12 place-items-center rounded-full ${tone}`}>
        <Icon size={24} />
      </span>
      <span className="text-center text-xs font-semibold text-ocean-900">{label}</span>
    </Link>
  )
}
