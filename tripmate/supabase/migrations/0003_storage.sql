-- TripMate Storage bucket + policies
--
-- Bucket: trip-photos (private)
--   Path layout:  {trip_id}/{photo_id}.{ext}
-- Read access:   members of the trip whose id is the first path segment
-- Write access:  members of the trip; uploader's own folder only enforced via
--                 server-issued signed URL (server checks membership first)
--
begin;

insert into storage.buckets (id, name, public)
  values ('trip-photos', 'trip-photos', false)
  on conflict (id) do nothing;

-- helper: extract trip_id from a path like "<uuid>/..."
create or replace function public.path_trip_id(path text)
returns uuid language plpgsql immutable as $$
declare
  seg text;
begin
  seg := split_part(path, '/', 1);
  begin
    return seg::uuid;
  exception when others then
    return null;
  end;
end;
$$;

create policy "tripmate read own trip photos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'trip-photos'
  and public.is_trip_member(public.path_trip_id(name), auth.uid())
);

create policy "tripmate insert own trip photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'trip-photos'
  and public.is_trip_member(public.path_trip_id(name), auth.uid())
);

create policy "tripmate update own trip photos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'trip-photos'
  and public.is_trip_member(public.path_trip_id(name), auth.uid())
)
with check (
  bucket_id = 'trip-photos'
  and public.is_trip_member(public.path_trip_id(name), auth.uid())
);

create policy "tripmate delete own trip photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'trip-photos'
  and owner = auth.uid()
);

commit;
