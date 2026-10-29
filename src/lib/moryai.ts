import { supabase } from './supabase'

// ---- Types ----

export interface MoryAIConversation {
  id: string
  user_id: string | null
  title: string | null
  created_at: string
  updated_at: string
  is_archived: boolean
}

export interface MoryAIMessage {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  referenced_record_ids: Record<string, string[]> | null
  created_at: string
}

export interface MoryAIResponse {
  response: string
  conversationId: string | null
  referencedRecords: Record<string, string[]> | null
  error?: string
}

// ---- Conversation management ----

export async function fetchConversations(): Promise<MoryAIConversation[]> {
  const { data, error } = await supabase
    .from('mory_ai_conversations')
    .select('*')
    .eq('is_archived', false)
    .order('updated_at', { ascending: false })
    .limit(20)
  if (error) {
    console.error('fetchConversations error:', error.message)
    return []
  }
  return (data ?? []) as MoryAIConversation[]
}

export async function fetchMessages(conversationId: string): Promise<MoryAIMessage[]> {
  const { data, error } = await supabase
    .from('mory_ai_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) {
    console.error('fetchMessages error:', error.message)
    return []
  }
  return (data ?? []) as MoryAIMessage[]
}

export async function deleteConversation(conversationId: string): Promise<boolean> {
  const { error } = await supabase
    .from('mory_ai_conversations')
    .delete()
    .eq('id', conversationId)
  if (error) {
    console.error('deleteConversation error:', error.message)
    return false
  }
  return true
}

export async function renameConversation(conversationId: string, title: string): Promise<boolean> {
  const { error } = await supabase
    .from('mory_ai_conversations')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', conversationId)
  if (error) {
    console.error('renameConversation error:', error.message)
    return false
  }
  return true
}

// ---- Send message to AI ----

export async function sendMoryAIMessage(
  message: string,
  conversationId: string | null,
  history: { role: 'user' | 'assistant'; content: string }[],
  userId?: string,
): Promise<MoryAIResponse> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const { data: session } = await supabase.auth.getSession()
  const accessToken = session?.session?.access_token

  const response = await fetch(`${supabaseUrl}/functions/v1/mory-ai`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    },
    body: JSON.stringify({
      message,
      conversationId,
      history,
      userId,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    return {
      response: 'Paumanhin, may problema sa sistema. Subukan ulit mamaya.',
      conversationId,
      referencedRecords: null,
      error: errorBody?.error ?? `Request failed (${response.status})`,
    }
  }

  const data = await response.json()
  return {
    response: data.response,
    conversationId: data.conversationId,
    referencedRecords: data.referencedRecords,
    error: data.error,
  }
}
