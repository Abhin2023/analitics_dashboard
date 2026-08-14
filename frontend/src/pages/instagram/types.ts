export interface IGAccount {
  id: number;
  ig_user_id: string;
  page_id: string;
  page_name: string;
  store_id: number | null;
  store_name: string;
  is_active: boolean;
  created_at: string | null;
}

export interface IGConversation {
  id: number;
  ig_account_id: number;
  ig_user_id: string;
  customer_name: string;
  status: string;
  assigned_to: number | null;
  assignee_name: string;
  lead_id: number | null;
  last_message_at: string | null;
  message_count: number;
  created_at: string | null;
}

export interface IGMessage {
  id: number;
  conversation_id: number;
  direction: "inbound" | "outbound";
  message_type: string;
  content: string;
  ig_message_id: string | null;
  ai_provider: string | null;
  ai_input_tokens: number | null;
  ai_output_tokens: number | null;
  created_at: string | null;
}

export interface IGCommentRule {
  id: number;
  ig_account_id: number;
  name: string;
  rule_type: string;
  trigger_words: string[];
  action: string;
  reply_template: string | null;
  ai_prompt: string | null;
  is_active: boolean;
  priority: number;
  created_at: string | null;
}

export interface AIProvider {
  id: number;
  provider: string;
  model_name: string;
  is_active: boolean;
  api_key_encrypted?: string;
  created_at: string | null;
}

export interface IGBotSettings {
  id: number;
  ig_account_id: number;
  dm_auto_reply_enabled: boolean;
  comment_auto_reply_enabled: boolean;
  comment_moderation_enabled: boolean;
  lead_qualification_enabled: boolean;
  ai_system_prompt: string;
  welcome_message: string;
  after_hours_message: string;
}

export interface IGStats {
  total_conversations: number;
  active_conversations: number;
  total_messages: number;
  messages_sent: number;
  messages_received: number;
  ai_responses: number;
  leads_generated: number;
  avg_response_time_minutes: number;
  credits_used: Record<string, { input_tokens: number; output_tokens: number; cost: number; calls: number }>;
  daily_stats: any[];
}

export interface IGFormField {
  id: number;
  field_key: string;
  label: string;
  field_type: string;
  required: boolean;
  options: { value: string; label: string }[];
  placeholder: string;
  phase: number;
  sort_order: number;
  ai_extract_hint: string;
}

export interface IGForm {
  id: number;
  name: string;
  display_name: string;
  description: string;
  form_type: string;
  ai_prompt_hint: string;
  success_message: string;
  is_active: boolean;
  fields: IGFormField[];
  submission_count: number;
  created_at: string | null;
}
