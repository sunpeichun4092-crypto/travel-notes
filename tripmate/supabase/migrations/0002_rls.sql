-- TripMate RLS policies
--
-- Authorization model: a row is visible/writable iff auth.uid() is a member
-- of the trip referenced by the row. profiles is readable by anyone who
-- shares a trip with the profile owner.
--
begin;

alter table public.profiles            enable row level security;
alter table public.trips               enable row level security;
alter table public.trip_members        enable row level security;
alter table public.expenses            enable row level security;
alter table public.expense_shares      enable row level security;
alter table public.albums              enable row level security;
alter table public.photos              enable row level security;
alter table public.photo_likes         enable row level security;
alter table public.discoveries         enable row level security;
alter table public.discovery_candidates enable row level security;
alter table public.travelogues         enable row level security;

-- =============================================================================
-- profiles
-- =============================================================================
create policy profiles_self_select on public.profiles
  for select using (
    id = auth.uid() or
    exists (select 1
            from public.trip_members tm1
            join public.trip_members tm2 on tm1.trip_id = tm2.trip_id
            where tm1.user_id = auth.uid() and tm2.user_id = profiles.id)
  );

create policy profiles_self_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- =============================================================================
-- trips
-- =============================================================================
create policy trips_member_select on public.trips
  for select using (public.is_trip_member(id, auth.uid()));

create policy trips_creator_insert on public.trips
  for insert with check (created_by = auth.uid());

create policy trips_member_update on public.trips
  for update using (public.is_trip_member(id, auth.uid()))
              with check (public.is_trip_member(id, auth.uid()));

create policy trips_owner_delete on public.trips
  for delete using (
    exists (select 1 from public.trip_members
            where trip_id = id and user_id = auth.uid() and role = 'owner')
  );

-- =============================================================================
-- trip_members
-- =============================================================================
create policy trip_members_select on public.trip_members
  for select using (
    user_id = auth.uid() or public.is_trip_member(trip_id, auth.uid())
  );

-- Self-insert is allowed (used on join-via-invite-code).
-- Server validates the invite code BEFORE inserting, so we just check
-- that the row inserted is for the calling user.
create policy trip_members_self_insert on public.trip_members
  for insert with check (user_id = auth.uid());

-- Owners can remove members; users can remove themselves.
create policy trip_members_delete on public.trip_members
  for delete using (
    user_id = auth.uid() or
    exists (select 1 from public.trip_members tm
            where tm.trip_id = trip_members.trip_id
              and tm.user_id = auth.uid() and tm.role = 'owner')
  );

create policy trip_members_update_self on public.trip_members
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =============================================================================
-- expenses + expense_shares
-- =============================================================================
create policy expenses_member_select on public.expenses
  for select using (public.is_trip_member(trip_id, auth.uid()));

create policy expenses_member_insert on public.expenses
  for insert with check (public.is_trip_member(trip_id, auth.uid())
                         and created_by = auth.uid());

create policy expenses_payer_or_creator_update on public.expenses
  for update using (public.is_trip_member(trip_id, auth.uid())
                    and (payer_id = auth.uid() or created_by = auth.uid()))
              with check (public.is_trip_member(trip_id, auth.uid()));

create policy expenses_payer_or_creator_delete on public.expenses
  for delete using (public.is_trip_member(trip_id, auth.uid())
                    and (payer_id = auth.uid() or created_by = auth.uid()));

create policy expense_shares_select on public.expense_shares
  for select using (
    exists (select 1 from public.expenses e
            where e.id = expense_id and public.is_trip_member(e.trip_id, auth.uid()))
  );

create policy expense_shares_write on public.expense_shares
  for all using (
    exists (select 1 from public.expenses e
            where e.id = expense_id
              and public.is_trip_member(e.trip_id, auth.uid())
              and (e.payer_id = auth.uid() or e.created_by = auth.uid()))
  ) with check (
    exists (select 1 from public.expenses e
            where e.id = expense_id and public.is_trip_member(e.trip_id, auth.uid()))
  );

-- =============================================================================
-- albums / photos / photo_likes
-- =============================================================================
create policy albums_member_all on public.albums
  for all using (public.is_trip_member(trip_id, auth.uid()))
            with check (public.is_trip_member(trip_id, auth.uid()));

create policy photos_member_select on public.photos
  for select using (public.is_trip_member(trip_id, auth.uid()));

create policy photos_member_insert on public.photos
  for insert with check (public.is_trip_member(trip_id, auth.uid())
                         and uploader_id = auth.uid());

create policy photos_uploader_delete on public.photos
  for delete using (uploader_id = auth.uid());

create policy photos_uploader_update on public.photos
  for update using (uploader_id = auth.uid())
              with check (uploader_id = auth.uid());

create policy likes_select on public.photo_likes
  for select using (
    exists (select 1 from public.photos p
            where p.id = photo_id and public.is_trip_member(p.trip_id, auth.uid()))
  );

create policy likes_self_write on public.photo_likes
  for all using (user_id = auth.uid())
            with check (user_id = auth.uid()
              and exists (select 1 from public.photos p
                          where p.id = photo_id
                            and public.is_trip_member(p.trip_id, auth.uid())));

-- =============================================================================
-- discoveries / candidates  (a wizard run is private to its creator,
-- unless it's been linked to a trip — then visible to all trip members)
-- =============================================================================
create policy discoveries_owner_or_member on public.discoveries
  for select using (
    created_by = auth.uid() or
    (trip_id is not null and public.is_trip_member(trip_id, auth.uid()))
  );

create policy discoveries_self_insert on public.discoveries
  for insert with check (created_by = auth.uid());

create policy discoveries_self_update on public.discoveries
  for update using (created_by = auth.uid())
              with check (created_by = auth.uid());

create policy discoveries_self_delete on public.discoveries
  for delete using (created_by = auth.uid());

create policy candidates_through_discovery on public.discovery_candidates
  for select using (
    exists (select 1 from public.discoveries d
            where d.id = discovery_id
              and (d.created_by = auth.uid()
                   or (d.trip_id is not null and public.is_trip_member(d.trip_id, auth.uid()))))
  );

-- =============================================================================
-- travelogues
-- =============================================================================
create policy travelogues_member_select on public.travelogues
  for select using (public.is_trip_member(trip_id, auth.uid()));

create policy travelogues_member_insert on public.travelogues
  for insert with check (public.is_trip_member(trip_id, auth.uid())
                         and created_by = auth.uid());

create policy travelogues_creator_update on public.travelogues
  for update using (created_by = auth.uid())
              with check (created_by = auth.uid());

create policy travelogues_creator_delete on public.travelogues
  for delete using (created_by = auth.uid());

commit;
