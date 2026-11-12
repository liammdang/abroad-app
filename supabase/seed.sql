-- Optional starter content so the community board isn't empty on day one.
-- These are example events posted as "Abroad team". Delete them any time:
--   delete from public.meetups where host_id is null;
--   delete from public.trips where host_id is null;

insert into public.meetups (city_id, category, title, date, time, place) values
  ('berlin', 'Language Exchange', 'Language Exchange Tandem Night', '2026-11-19', '19:00', 'Café Central'),
  ('berlin', 'Coffee & Study', 'Silent Study Session', '2026-11-24', '15:00', 'University Library, 3rd floor'),
  ('berlin', 'Food Markets', 'Sunday Food Market Walk', '2026-11-29', '11:00', 'Markthalle Neun'),
  ('madrid', 'Language Exchange', 'Intercambio Night', '2026-11-19', '20:00', 'Café Comercial'),
  ('madrid', 'Food Markets', 'Sunday Rastro Market Walk', '2026-11-22', '10:30', 'Plaza de Cascorro'),
  ('lisbon', 'Language Exchange', 'Tandem Night: Português & English', '2026-11-19', '19:00', 'Café Tati'),
  ('lisbon', 'Food Markets', 'Sunday LX Factory Market Walk', '2026-11-22', '11:00', 'LX Factory');

insert into public.trips (city_id, destination, start_date, end_date, cost, capacity, description) values
  ('berlin', 'Dresden & Saxon Switzerland', '2026-12-04', '2026-12-06', 90, 6, 'Hiking + photography weekend. Bring good shoes!'),
  ('madrid', 'Segovia & the Aqueduct', '2026-12-05', '2026-12-05', 30, 8, 'Morning bus, roast lunch, castle in the afternoon.'),
  ('lisbon', 'Sintra, Portugal', '2026-12-05', '2026-12-05', 25, 8, 'Early train, Pena Palace and Quinta da Regaleira.');
