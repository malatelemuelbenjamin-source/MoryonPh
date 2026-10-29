import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Send,
  Sparkles,
  Trash2,
  Plus,
  History,
  X,
  AlertCircle,
  Bus,
  Wallet,
  Map as MapIcon,
  Sailboat,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import {
  fetchConversations,
  fetchMessages,
  deleteConversation,
  sendMoryAIMessage,
  type MoryAIConversation,
} from '../lib/moryai'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTED_QUESTIONS = [
  'Paano ako makakarating mula Boac papuntang Santa Cruz?',
  'Magkano ang pamasahe sa rutang ito?',
  'Saan ang pinakamalapit na verified boarding point?',
  'May available bang ferry schedule sa araw na ito?',
  'Paano ako lilipat mula jeepney papuntang tricycle?',
  'Ipakita ang mga route options papunta sa destination ko.',
]

const QUICK_LINKS = [
  { label: 'View Route', to: '/jeepney-routes', icon: Bus },
  { label: 'Calculate Fare', to: '/fare', icon: Wallet },
  { label: 'Open Map', to: '/transport-map', icon: MapIcon },
  { label: 'View Ports', to: '/ports', icon: Sailboat },
  { label: 'View Alerts', to: '/fare-updates', icon: AlertTriangle },
]

export function MoryAIPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const scrollRef = useRef<HTMLDivElement>(null)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [conversations, setConversations] = useState<MoryAIConversation[]>([])
  const [showQuickLinks, setShowQuickLinks] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      void (async () => {
        const convs = await fetchConversations()
        setConversations(convs)
      })()
    }
  }, [user])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  async function handleSend(text?: string) {
    const message = (text ?? input).trim()
    if (!message || loading) return

    setInput('')
    setError(null)
    setShowQuickLinks(false)
    setMessages((prev) => [...prev, { role: 'user', content: message }])
    setLoading(true)

    const history = messages.map((m) => ({ role: m.role, content: m.content }))

    const result = await sendMoryAIMessage(message, conversationId, history, user?.id)

    setMessages((prev) => [...prev, { role: 'assistant', content: result.response }])
    if (result.conversationId) setConversationId(result.conversationId)
    if (result.error) setError(result.error)
    setLoading(false)
    setShowQuickLinks(true)

    if (user) {
      const convs = await fetchConversations()
      setConversations(convs)
    }
  }

  function startNewConversation() {
    setMessages([])
    setConversationId(null)
    setError(null)
    setShowQuickLinks(false)
  }

  async function loadConversation(convId: string) {
    const msgs = await fetchMessages(convId)
    setMessages(
      msgs
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    )
    setConversationId(convId)
    setShowHistory(false)
    setError(null)
    setShowQuickLinks(true)
  }

  async function handleDeleteConversation(convId: string) {
    await deleteConversation(convId)
    if (user) {
      const convs = await fetchConversations()
      setConversations(convs)
    }
    if (convId === conversationId) startNewConversation()
  }

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-ocean-800 text-white shadow-card">
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/" aria-label="Back to home" className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-leaf-400" />
            <h1 className="text-lg font-bold">Mory AI</h1>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={startNewConversation}
              aria-label="New conversation"
              className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600"
            >
              <Plus size={18} />
            </button>
            {user && (
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                aria-label="Conversation history"
                className="grid h-9 w-9 place-items-center rounded-full bg-ocean-700 hover:bg-ocean-600"
              >
                <History size={18} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* History drawer */}
      {showHistory && user && (
        <div className="fixed inset-0 z-40 flex">
          <div className="w-72 max-w-[80%] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-sand-200 px-4 py-3">
              <p className="font-bold text-ocean-900">Conversations</p>
              <button type="button" onClick={() => setShowHistory(false)} className="text-ocean-500 hover:text-ocean-800">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 60px)' }}>
              {conversations.length === 0 ? (
                <p className="px-4 py-3 text-sm text-ocean-500">No previous conversations.</p>
              ) : (
                conversations.map((c) => (
                  <div
                    key={c.id}
                    className={`flex items-center gap-2 border-b border-sand-100 px-4 py-3 transition hover:bg-sand-50 ${
                      c.id === conversationId ? 'bg-ocean-50' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => loadConversation(c.id)}
                      className="flex-1 text-left"
                    >
                      <p className="text-sm font-semibold text-ocean-900 truncate">
                        {c.title ?? 'Untitled conversation'}
                      </p>
                      <p className="text-xs text-ocean-500">
                        {new Date(c.updated_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteConversation(c.id)}
                      aria-label="Delete conversation"
                      className="text-ocean-400 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="flex-1 bg-black/30" onClick={() => setShowHistory(false)} />
        </div>
      )}

      <main className="flex-1 space-y-4 px-4 py-5">
        {/* Chat messages */}
        <div ref={scrollRef} className="space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-ocean-100 text-ocean-700">
                <Sparkles size={32} />
              </span>
              <div>
                <p className="text-lg font-bold text-ocean-900">Mory AI</p>
                <p className="mt-1 text-sm text-ocean-700">
                  Your commuter assistant for Marinduque. Ask about routes, fares, and schedules in Filipino, English, or Taglish.
                </p>
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  m.role === 'user'
                    ? 'bg-ocean-700 text-white'
                    : 'bg-white text-ocean-900 shadow-card'
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-white px-4 py-3 shadow-card">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-ocean-400" />
                  <span className="h-2 w-2 animate-pulse rounded-full bg-ocean-400" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 animate-pulse rounded-full bg-ocean-400" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle size={16} />
              <span>Something went wrong. Please try again.</span>
              <button type="button" onClick={() => handleSend()} className="ml-auto text-red-600 hover:text-red-800">
                <RefreshCw size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Quick action links after AI response */}
        {showQuickLinks && messages.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {QUICK_LINKS.map((link) => (
              <button
                key={link.to}
                type="button"
                onClick={() => navigate(link.to)}
                className="flex items-center gap-1.5 rounded-full bg-ocean-50 px-3 py-1.5 text-xs font-semibold text-ocean-700 transition hover:bg-ocean-100 active:scale-95"
              >
                <link.icon size={12} /> {link.label}
              </button>
            ))}
          </div>
        )}

        {/* Suggested questions */}
        {messages.length === 0 && !loading && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-ocean-600">Suggested questions</p>
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleSend(q)}
                className="w-full rounded-xl bg-white px-3 py-2.5 text-left text-sm text-ocean-800 shadow-card transition hover:shadow-cardHover active:scale-[0.98]"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="sticky bottom-0 -mx-4 border-t border-sand-200 bg-sand-50 px-4 py-3">
          <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-card">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Magtanong tungkol sa transportasyon..."
              disabled={loading}
              maxLength={1000}
              className="w-full bg-transparent text-sm text-ocean-900 placeholder:text-ocean-400 focus:outline-none disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ocean-700 text-white transition hover:bg-ocean-800 active:scale-95 disabled:opacity-50"
            >
              <Send size={18} />
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-ocean-400">
            Mory AI uses verified MoryonGo data. Information may be incomplete.
          </p>
        </div>
      </main>
    </div>
  )
}
