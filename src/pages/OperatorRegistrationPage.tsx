import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Building2, Loader2, Save, AlertCircle } from 'lucide-react'
import { useAuth } from '../lib/auth'
import {
  fetchMyOperator,
  fetchTransportModesForForms,
  createOperatorApplication,
  updateMyOperator,
  OPERATOR_STATUS_LABELS,
  operatorStatusColor,
} from '../lib/operatorPortal'
import type { TransportOperatorWithMode } from '../lib/types'

const MUNICIPALITIES = [
  'Boac', 'Gasan', 'Mogpog', 'Santa Cruz', 'Torrijos',
  'Buenavista', 'Mompog', 'Santa Cruz',
]

const SERVICE_CATEGORIES = [
  'Jeepney Operator',
  'Tricycle Operator',
  'Bus Line',
  'Ferry / RORO Service',
  'Van / Shuttle Service',
  'Habal-habal',
  'Other',
]

export function OperatorRegistrationPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [existing, setExisting] = useState<TransportOperatorWithMode | null | undefined>(undefined)
  const [modes, setModes] = useState<Array<{ id: string; name: string; code: string }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [organizationName, setOrganizationName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [municipality, setMunicipality] = useState('')
  const [transportModeId, setTransportModeId] = useState('')
  const [serviceCategory, setServiceCategory] = useState('')
  const [supportingInfo, setSupportingInfo] = useState('')

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    void (async () => {
      const [op, modeList] = await Promise.all([fetchMyOperator(), fetchTransportModesForForms()])
      setExisting(op)
      setModes(modeList)
      if (op) {
        setOrganizationName(op.organization_name || '')
        setContactName(op.contact_name || '')
        setContactEmail(op.contact_email || '')
        setContactPhone(op.contact_phone || '')
        setMunicipality(op.municipality || '')
        setTransportModeId(op.transport_mode_id || '')
        setServiceCategory(op.service_category || '')
        setSupportingInfo(op.supporting_info || '')
      } else if (user.email) {
        setContactEmail(user.email)
      }
      setLoading(false)
    })()
  }, [user])

  if (!user) {
    return (
      <div className="app-shell">
        <Header />
        <main className="flex-1 px-4 py-6">
          <div className="card flex flex-col items-center gap-4 text-center">
            <Building2 size={32} className="text-ocean-400" />
            <p className="text-sm font-semibold text-ocean-900">Sign in to register as a transport partner.</p>
            <Link to="/auth" className="btn-primary w-full">Sign In</Link>
          </div>
        </main>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="app-shell">
        <Header />
        <main className="flex-1 px-4 py-6">
          <div className="card flex items-center gap-3">
            <Loader2 size={20} className="animate-spin text-ocean-600" />
            <p className="text-sm text-ocean-700">Loading…</p>
          </div>
        </main>
      </div>
    )
  }

  const isEdit = !!existing
  const canEdit = !existing || existing.verification_status === 'pending_review' || existing.verification_status === 'needs_more_information' || existing.verification_status === 'rejected'

  const handleSubmit = async () => {
    setError(null)
    setSaving(true)

    if (!organizationName.trim() || !contactName.trim() || !contactEmail.trim() || !serviceCategory.trim()) {
      setError('Please fill in organization name, contact name, contact email, and service category.')
      setSaving(false)
      return
    }

    if (isEdit && existing) {
      const result = await updateMyOperator(existing.id, {
        organization_name: organizationName,
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        municipality: municipality || undefined,
        transport_mode_id: transportModeId || undefined,
        service_category: serviceCategory,
        supporting_info: supportingInfo,
      })
      if (!result.success) {
        setError(result.error || 'Failed to update application.')
        setSaving(false)
        return
      }
    } else {
      const result = await createOperatorApplication({
        organization_name: organizationName,
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        municipality: municipality || undefined,
        transport_mode_id: transportModeId || undefined,
        service_category: serviceCategory,
        supporting_info: supportingInfo,
      })
      if (!result.success) {
        setError(result.error || 'Failed to submit application.')
        setSaving(false)
        return
      }
    }

    setSaving(false)
    navigate('/operator-portal')
  }

  return (
    <div className="app-shell">
      <Header />
      <main className="flex-1 space-y-4 px-4 py-5">
        {isEdit && existing && (
          <div className="card flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-ocean-600">Application Status</p>
              <span className={`pill text-xs ${operatorStatusColor(existing.verification_status)}`}>
                {OPERATOR_STATUS_LABELS[existing.verification_status]}
              </span>
            </div>
            {existing.reviewer_notes && (
              <p className="text-right text-xs text-terra-700 max-w-[60%]">{existing.reviewer_notes}</p>
            )}
          </div>
        )}

        {!canEdit && (
          <div className="card flex items-start gap-2 bg-leaf-50">
            <AlertCircle size={16} className="mt-0.5 text-leaf-600" />
            <p className="text-xs text-leaf-800">
              Your application has been {existing?.verification_status}. Contact an administrator if you need to make changes.
            </p>
          </div>
        )}

        <div className="card space-y-4">
          <div>
            <label className="form-label">Organization Name *</label>
            <input
              type="text"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              disabled={!canEdit}
              maxLength={200}
              className="input-field"
              placeholder="e.g. Marinduque Transport Cooperative"
            />
          </div>

          <div>
            <label className="form-label">Contact Person *</label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              disabled={!canEdit}
              maxLength={200}
              className="input-field"
              placeholder="Your full name"
            />
          </div>

          <div>
            <label className="form-label">Contact Email *</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              disabled={!canEdit}
              className="input-field"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="form-label">Contact Phone</label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              disabled={!canEdit}
              className="input-field"
              placeholder="09XX XXX XXXX"
            />
          </div>

          <div>
            <label className="form-label">Municipality</label>
            <select
              value={municipality}
              onChange={(e) => setMunicipality(e.target.value)}
              disabled={!canEdit}
              className="input-field"
            >
              <option value="">Select municipality…</option>
              {[...new Set(MUNICIPALITIES)].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Transport Mode</label>
            <select
              value={transportModeId}
              onChange={(e) => setTransportModeId(e.target.value)}
              disabled={!canEdit}
              className="input-field"
            >
              <option value="">Select transport mode…</option>
              {modes.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Service Category *</label>
            <select
              value={serviceCategory}
              onChange={(e) => setServiceCategory(e.target.value)}
              disabled={!canEdit}
              className="input-field"
            >
              <option value="">Select category…</option>
              {SERVICE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Supporting Information</label>
            <textarea
              value={supportingInfo}
              onChange={(e) => setSupportingInfo(e.target.value)}
              disabled={!canEdit}
              maxLength={2000}
              rows={4}
              className="input-field"
              placeholder="Briefly describe your operation, fleet size, routes served, or any relevant details."
            />
            <p className="mt-1 text-[10px] text-ocean-400">{supportingInfo.length}/2000</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="btn-primary w-full"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {isEdit ? 'Update Application' : 'Submit Application'}
            </button>
          )}
        </div>
      </main>
    </div>
  )
}

function Header() {
  return (
    <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
      <div className="flex items-center gap-3 px-4 py-4">
        <Link to="/operator-portal" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold">Operator Registration</h1>
      </div>
    </header>
  )
}
