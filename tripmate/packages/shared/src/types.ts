// =============================================================================
// Shared types — used by both server and mobile.
// Mirrors the database tables defined in supabase/migrations/0001_init.sql.
// =============================================================================

export type UUID = string;

export interface Profile {
  id: UUID;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Trip {
  id: UUID;
  created_by: UUID;
  title: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  cover_url: string | null;
  invite_code: string;
  currency: string;
  created_at: string;
}

export type MemberRole = 'owner' | 'member';

export interface TripMember {
  trip_id: UUID;
  user_id: UUID;
  role: MemberRole;
  weight: number;
  joined_at: string;
}

export interface TripWithMembers extends Trip {
  members: (TripMember & { profile: Profile })[];
  owner_id: UUID;
}

// ----- Bookkeeping -----

export type SplitMode = 'equal' | 'weighted';

export interface Expense {
  id: UUID;
  trip_id: UUID;
  payer_id: UUID;
  amount_cents: number;
  currency: string;
  description: string | null;
  category: string | null;
  spent_at: string;
  split_mode: SplitMode;
  created_by: UUID;
  created_at: string;
}

export interface ExpenseShare {
  expense_id: UUID;
  user_id: UUID;
  share_cents: number;
}

export interface ExpenseWithShares extends Expense {
  shares: ExpenseShare[];
}

export interface SettlementTransfer {
  from: UUID;
  to: UUID;
  amount_cents: number;
}

// ----- Album -----

export interface Photo {
  id: UUID;
  album_id: UUID;
  trip_id: UUID;
  uploader_id: UUID;
  storage_path: string;
  taken_at: string | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  created_at: string;
}

export interface PhotoWithLikes extends Photo {
  signed_url: string;
  like_count: number;
  liked_by_me: boolean;
}

// ----- Discoveries (Wizard) -----

export interface DiscoveryInputs {
  base: string;                 // 出发基地
  budget_min_cents: number;
  budget_max_cents: number;
  styles: string[];             // ['美食','深度','摄影',...]
  avoid: string[];              // 避雷
  duration_days: number;
  lodging_pref: 'hostel' | 'hotel' | 'homestay' | 'mixed';
  notes?: string;
}

export interface DiscoveryCandidate {
  id: UUID;
  discovery_id: UUID;
  rank: number;
  name: string;
  region: string | null;
  niche_level: number;          // 1..5
  risk_level: number;           // 1..5
  pitch: string;
  local_tips: string[];
  sources: { title: string; url: string }[];
  budget_hint: string | null;
}

export interface Discovery {
  id: UUID;
  trip_id: UUID | null;
  created_by: UUID;
  inputs: DiscoveryInputs;
  status: 'pending' | 'running' | 'done' | 'error';
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

// ----- AI Travelogue -----

export interface TravelogueDay {
  date: string;
  title: string;
  body: string;
  photo_ids: UUID[];
}

export interface TravelogueContent {
  intro: string;
  days: TravelogueDay[];
  outro: string;
}

export interface Travelogue {
  id: UUID;
  trip_id: UUID;
  created_by: UUID;
  status: 'pending' | 'running' | 'done' | 'error';
  error: string | null;
  content: TravelogueContent | null;
  photo_ids: UUID[];
  created_at: string;
  finished_at: string | null;
}
