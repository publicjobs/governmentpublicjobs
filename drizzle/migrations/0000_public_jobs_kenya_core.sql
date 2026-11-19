CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  id_number text,
  email text,
  phone text,
  county text,
  sub_county text,
  expected_daily_pay integer,
  expected_monthly_pay integer,
  allow_contact boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (first_name, last_name, id_number, phone, county, sub_county, expected_daily_pay, expected_monthly_pay, allow_contact, updated_at) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, id_number, email, phone, county, sub_county, expected_daily_pay, expected_monthly_pay, allow_contact)
  VALUES (
    new.id,
    left(coalesce(m->>'first_name', ''), 80),
    left(coalesce(m->>'last_name', ''), 80),
    nullif(left(coalesce(m->>'id_number', ''), 20), ''),
    new.email,
    nullif(left(coalesce(m->>'phone', ''), 20), ''),
    nullif(left(coalesce(m->>'county', ''), 60), ''),
    nullif(left(coalesce(m->>'sub_county', ''), 60), ''),
    CASE WHEN coalesce(m->>'expected_daily_pay', '') ~ '^[0-9]{1,8}$' THEN (m->>'expected_daily_pay')::integer END,
    CASE WHEN coalesce(m->>'expected_monthly_pay', '') ~ '^[0-9]{1,8}$' THEN (m->>'expected_monthly_pay')::integer END,
    coalesce(m->>'allow_contact', 'false') = 'true'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'user');
  IF lower(new.email) = 'antonykhalix@gmail.com' AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'admin');
  END IF;
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL,
  employer text NOT NULL,
  county text NOT NULL,
  sub_county text,
  job_type text NOT NULL,
  pay_amount integer NOT NULL,
  pay_period text NOT NULL,
  description text NOT NULL,
  requirements text NOT NULL,
  qualification_required boolean NOT NULL DEFAULT false,
  is_online boolean NOT NULL DEFAULT false,
  positions integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX jobs_county_idx ON public.jobs (county, sub_county);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users view active jobs" ON public.jobs FOR SELECT TO authenticated USING (is_active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert jobs" ON public.jobs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update jobs" ON public.jobs FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete jobs" ON public.jobs FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  cover_note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'shortlisted', 'accepted', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id)
);
GRANT SELECT, INSERT ON public.applications TO authenticated;
GRANT UPDATE (status, updated_at) ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own applications" ON public.applications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own pending applications" ON public.applications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'pending' AND (cover_note IS NULL OR length(cover_note) <= 1000));
CREATE POLICY "Admins view all applications" ON public.applications FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update applications" ON public.applications FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

WITH raw AS (
  SELECT 'Nairobi:Westlands,Dagoretti North,Dagoretti South,Langata,Kibra,Roysambu,Kasarani,Ruaraka,Embakasi South,Embakasi North,Embakasi Central,Embakasi East,Embakasi West,Makadara,Kamukunji,Starehe,Ngara,Mathare,Githurai;Mombasa:Changamwe,Jomvu,Kisauni,Nyali,Likoni,Mvita;Kwale:Msambweni,Lunga Lunga,Matuga,Kinango;Kilifi:Kilifi North,Kilifi South,Kaloleni,Rabai,Ganze,Malindi;Tana River:Garsen,Galole,Bura;Lamu:Lamu East,Lamu West;Taita Taveta:Taveta,Wundanyi,Mwatate,Voi;Garissa:Garissa Township,Balambala,Dadaab,Fafi,Ijara;Wajir:Wajir East,Wajir West,Wajir North,Wajir South,Eldas,Tarbaj;Mandera:Mandera East,Mandera West,Mandera North,Lafey,Banissa;Marsabit:Moyale,North Horr,Saku,Laisamis;Isiolo:Isiolo North,Isiolo South;Meru:Imenti North,Imenti South,Imenti Central,Tigania East,Igembe North,Buuri;Tharaka-Nithi:Chuka,Tharaka North,Tharaka South,Maara;Embu:Manyatta,Runyenjes,Mbeere North,Mbeere South;Kitui:Kitui Central,Kitui West,Mwingi Central,Kitui Rural,Kitui South;Machakos:Machakos Town,Mavoko,Kathiani,Mwala,Yatta,Kangundo;Makueni:Makueni,Mbooni,Kilome,Kaiti,Kibwezi East;Nyandarua:Ol Kalou,Kinangop,Kipipiri,Ndaragwa,Ol Joro Orok;Nyeri:Nyeri Town,Mathira,Othaya,Tetu,Kieni,Mukurweini;Kirinyaga:Kirinyaga Central,Mwea,Gichugu,Ndia;Murang''a:Kiharu,Kigumo,Maragwa,Gatanga,Kandara,Kangema;Kiambu:Thika Town,Ruiru,Juja,Kikuyu,Limuru,Kiambu Town;Turkana:Turkana Central,Turkana West,Loima,Turkana South,Turkana East;West Pokot:Kapenguria,Kacheliba,Sigor,Pokot South;Samburu:Samburu West,Samburu North,Samburu East;Trans Nzoia:Kiminini,Kwanza,Saboti,Cherangany,Endebess;Uasin Gishu:Eldoret East,Eldoret West,Turbo,Moiben,Soy,Kesses;Elgeyo-Marakwet:Keiyo North,Keiyo South,Marakwet East,Marakwet West;Nandi:Kapsabet,Aldai,Emgwen,Mosop,Tinderet,Chesumei;Baringo:Baringo Central,Baringo North,Eldama Ravine,Mogotio,Tiaty;Laikipia:Laikipia East,Laikipia West,Laikipia North,Nanyuki;Nakuru:Nakuru Town East,Nakuru Town West,Naivasha,Gilgil,Molo,Njoro;Narok:Narok North,Narok South,Narok East,Narok West,Emurua Dikirr;Kajiado:Kajiado North,Kajiado Central,Kajiado East,Kajiado West,Kajiado South;Kericho:Kipkelion East,Ainamoi,Belgut,Bureti,Sigowet-Soin;Bomet:Bomet Central,Bomet East,Chepalungu,Konoin,Sotik;Kakamega:Lurambi,Malava,Mumias East,Mumias West,Butere,Navakholo;Vihiga:Vihiga,Sabatia,Hamisi,Luanda,Emuhaya;Bungoma:Webuye East,Kimilili,Bumula,Kanduyi,Sirisia,Mt Elgon;Busia:Teso North,Teso South,Nambale,Matayos,Butula,Funyula;Siaya:Ugenya,Alego Usonga,Gem,Bondo,Rarieda,Ugunja;Kisumu:Kisumu Central,Kisumu East,Kisumu West,Seme,Muhoroni,Nyakach;Homa Bay:Homa Bay Town,Kasipul,Kabondo Kasipul,Karachuonyo,Rangwe,Ndhiwa;Migori:Rongo,Awendo,Suna East,Suna West,Uriri,Nyatike;Kisii:Kitutu Chache North,Kitutu Chache South,Nyaribari Masaba,Nyaribari Chache,Bobasi,Bomachoge Borabu;Nyamira:Nyamira North,Nyamira South,Borabu,Kitutu Masaba,Manga'::text AS s
),
counties AS (
  SELECT split_part(c, ':', 1) AS county, string_to_array(split_part(c, ':', 2), ',') AS arr
  FROM raw, unnest(string_to_array(raw.s, ';')) AS c
),
locs AS (
  SELECT counties.county, t.sub FROM counties, unnest(counties.arr) AS t(sub)
),
tpl(idx, category, title, employer, job_type, pmin, pmax, step, period, descr, req) AS (VALUES
  (0,'Hospitality','Waiter / Waitress','%1$s Choma Grill & Lounge','Full-time',500,800,50,'day','Serve customers, take orders and keep tables clean at a busy nyama choma joint in %1$s, %2$s County. Shifts run 10am to 10pm with one day off every week. Lunch and supper provided on duty, tips are yours to keep.','No qualifications required. Friendly attitude, basic English or Kiswahili, and neat appearance.'),
  (1,'Hospitality','Kitchen Helper','%1$s Hotel & Restaurant','Full-time',450,700,50,'day','Help the cooks with peeling, chopping, washing utensils and keeping the kitchen clean at a family restaurant in %1$s, %2$s County. Paid every Saturday via M-Pesa.','No qualifications required. Training given on the first day.'),
  (2,'Hospitality','Dishwasher','Mama Pima Eatery, %1$s','Casual',400,600,50,'day','Wash plates, cups and cooking pots during lunch and evening rush at a busy kibanda in %1$s, %2$s County. Daily payment at close of business.','No qualifications or experience required.'),
  (3,'Hospitality','Barista / Cafe Attendant','Java Point Cafe %1$s','Full-time',15000,22000,1000,'month','Make coffee and tea, serve snacks and handle the till at a modern cafe in %1$s, %2$s County. Full barista training provided in the first two weeks.','No qualifications required. KCSE certificate is a plus but not a must.'),
  (4,'Hospitality','Room Steward (Housekeeping)','%1$s Guest House','Full-time',14000,20000,1000,'month','Clean and prepare guest rooms, change bedding and restock supplies at a 24-room guest house in %1$s, %2$s County. Accommodation available for staff from far.','No qualifications required. Must be honest and hardworking.'),
  (5,'Hospitality','Chapati & Mandazi Cook','Kibanda Bites %1$s','Full-time',500,750,50,'day','Prepare chapati, mandazi, beans and tea for morning and lunch customers in %1$s, %2$s County. Work starts at 5:30am and ends at 3pm.','No certificate needed. You should know how to make soft chapati.'),
  (6,'Driving & Delivery','Personal / Family Driver','Private household in %1$s','Full-time',22000,35000,1000,'month','Drive a family car for school runs, shopping and office trips around %1$s and greater %2$s. Monday to Saturday, Sunday off.','Valid driving licence (Class B), at least 2 years driving experience and a certificate of good conduct.'),
  (7,'Driving & Delivery','Delivery Rider (Motorbike)','Haraka Deliveries - %1$s Hub','Casual',800,1500,100,'day','Deliver food and parcels to customers within %1$s, %2$s County. Company bike and helmet provided, fuel paid by the company. Earn extra for every delivery above 20 per day.','Motorbike riding licence. No education level required.'),
  (8,'Driving & Delivery','Matatu Conductor (Makanga)','%1$s Matatu Sacco','Casual',600,1000,100,'day','Collect fares, call passengers and keep the matatu clean on routes passing through %1$s, %2$s County. Paid daily after the last trip.','No qualifications required. Must be 18 years and above.'),
  (9,'Driving & Delivery','Lorry Loader (Turn-boy)','%2$s Hardware Transporters','Casual',600,900,50,'day','Load and offload cement, iron sheets and building materials for deliveries from %1$s to sites across %2$s County.','No qualifications required. Must be physically fit.'),
  (10,'Driving & Delivery','Tuk-tuk Driver','%1$s Tuk-tuk Owners Group','Casual',700,1200,100,'day','Drive a company tuk-tuk carrying passengers and goods around %1$s, %2$s County. Keep what you earn above the daily target.','Valid driving licence for three-wheelers. No education level required.'),
  (11,'Driving & Delivery','Bicycle Parcel Courier','Pesa Parcels %1$s','Part-time',400,700,50,'day','Deliver small parcels and documents to shops and offices within %1$s town on a company bicycle. Morning shift 8am to 1pm.','No qualifications required. Must know the %1$s area well.'),
  (12,'Retail & Sales','Shop Attendant','%1$s Mini Supermarket','Full-time',12000,18000,1000,'month','Arrange shelves, serve customers and receive deliveries at a neighbourhood supermarket in %1$s, %2$s County. Off day on rotation.','No qualifications required. Basic numeracy.'),
  (13,'Retail & Sales','Cashier','Tumaini Supermarket %1$s','Full-time',15000,22000,1000,'month','Handle cash and M-Pesa payments at the till, issue receipts and balance the cash at end of shift in %1$s, %2$s County.','Basic maths skills. KCSE preferred but not required. Training provided.'),
  (14,'Retail & Sales','Sales Promoter (Brand Activation)','Bidii Marketing Agency','Contract',800,1200,100,'day','Promote a new cooking oil brand at supermarkets in %1$s, %2$s County. 2-week contract, Thursday to Sunday, with lunch allowance.','No qualifications required. Confident and good with people.'),
  (15,'Retail & Sales','M-Pesa Agent Shop Attendant','Lipa Haraka Agency %1$s','Full-time',10000,15000,500,'month','Serve customers depositing and withdrawing cash, sell airtime and keep the float records at an agent shop in %1$s, %2$s County.','No qualifications required. Must have a national ID and be trustworthy.'),
  (16,'Retail & Sales','Fruit & Vegetable Stall Assistant','%1$s Open Air Market','Casual',350,550,50,'day','Help a mama mboga arrange produce, serve buyers and pack orders at %1$s market, %2$s County. Paid at the end of each day.','No qualifications or experience required.'),
  (17,'Retail & Sales','Butchery Attendant','%1$s Fresh Butchery','Full-time',500,700,50,'day','Cut and weigh meat, serve customers and keep the butchery clean in %1$s, %2$s County.','No qualifications required. Experience is an added advantage.'),
  (18,'Security & Cleaning','Security Guard (Day / Night)','Ulinzi Bora Security - %2$s Branch','Full-time',14000,20000,1000,'month','Guard residential and commercial premises in %1$s, %2$s County. 12-hour shifts, uniform provided, NSSF and SHA deductions made.','No academic papers required. Free 1-week training. Certificate of good conduct needed.'),
  (19,'Security & Cleaning','Office Cleaner','Safi Facilities Ltd','Full-time',12000,16000,500,'month','Clean offices, washrooms and common areas at a commercial building in %1$s, %2$s County. Monday to Friday 7am to 4pm.','No qualifications required.'),
  (20,'Security & Cleaning','House Help (Live-out)','Family in %1$s','Full-time',10000,15000,1000,'month','Cook, clean and do laundry for a family of four in %1$s, %2$s County. Live-out, 7am to 6pm, Sunday off.','No qualifications required. References from a previous employer are a plus.'),
  (21,'Security & Cleaning','Gardener / Compound Keeper','Residential estate, %1$s','Full-time',10000,14000,1000,'month','Maintain lawns, flowers and compound cleanliness in a gated estate in %1$s, %2$s County.','No qualifications required.'),
  (22,'Security & Cleaning','Laundry Attendant (Mama Fua)','Freshi Laundry %1$s','Casual',400,700,50,'day','Wash, iron and fold clothes for customers at a laundry shop in %1$s, %2$s County. Work 3 to 6 days a week, you choose.','No qualifications required.'),
  (23,'Security & Cleaning','Car Wash Attendant','Splash Car Wash %1$s','Casual',400,700,50,'day','Wash and vacuum cars and motorbikes at a busy car wash along the main road in %1$s, %2$s County. Daily pay plus tips.','No qualifications required.'),
  (24,'Construction & Skilled','Construction Casual (Mjengo)','%1$s Apartments Building Site','Casual',600,900,50,'day','Mix concrete, carry blocks and assist fundis on a 5-storey apartment project in %1$s, %2$s County. Paid every Friday.','No qualifications required. Must be physically fit, reflector and boots given.'),
  (25,'Construction & Skilled','Mason (Fundi wa Mawe)','Jenga Contractors','Contract',1200,1800,100,'day','Build walls and foundations on residential projects in %1$s, %2$s County. 3-month contract with possibility of renewal.','At least 1 year of masonry experience. No certificate required.'),
  (26,'Construction & Skilled','Painter','Rangi Finishes %2$s','Contract',1000,1500,100,'day','Paint new houses and repaint commercial buildings in %1$s and surrounding areas of %2$s County.','Experience in painting. No certificate required.'),
  (27,'Construction & Skilled','Mechanic Assistant','%1$s Auto Garage','Full-time',600,900,50,'day','Assist mechanics with servicing, tyre changes and car repairs at a garage in %1$s, %2$s County. Learn on the job.','No qualifications required. Interest in cars is enough.'),
  (28,'Construction & Skilled','Tailor / Machine Operator','%1$s Fashion House','Full-time',12000,18000,1000,'month','Sew school uniforms, dresses and repairs at a tailoring shop in %1$s, %2$s County.','Basic sewing skills. No certificate required.'),
  (29,'Construction & Skilled','Salon Assistant / Hairdresser','Glamour Salon %1$s','Full-time',500,900,50,'day','Wash hair, braid, plait and serve salon clients in %1$s, %2$s County. Commission on top of daily pay.','Braiding skills. No certificate required.'),
  (30,'Farming & Agriculture','Farm Hand','%1$s Farmers Group','Casual',350,550,50,'day','Plant, weed, spray and harvest maize, beans and vegetables on farms around %1$s, %2$s County. Lunch provided.','No qualifications required.'),
  (31,'Farming & Agriculture','Dairy Farm Attendant','%2$s Dairy Co-operative','Full-time',10000,15000,1000,'month','Milk cows, feed animals and clean sheds on a member farm in %1$s, %2$s County. Accommodation provided on the farm.','No qualifications required. Experience with cows is a plus.'),
  (32,'Farming & Agriculture','Greenhouse Worker','Mavuno Greenhouses %1$s','Full-time',450,650,50,'day','Tend tomatoes, capsicum and cucumbers in greenhouses in %1$s, %2$s County. Work 7am to 4pm.','No qualifications required. Training provided.'),
  (33,'Farming & Agriculture','Poultry Attendant','Kuku Bora Farm %1$s','Full-time',9000,14000,1000,'month','Feed chickens, collect eggs and keep poultry houses clean on a 3,000-bird farm in %1$s, %2$s County.','No qualifications required.')
),
ptpl(idx, title, employer, job_type, pmin, pmax, step, descr, req) AS (VALUES
  (0,'Accountant','%2$s Teachers Sacco Society','Full-time',45000,75000,5000,'Prepare monthly financial statements, reconcile member accounts and handle KRA filings for a growing Sacco with offices in %1$s, %2$s County.','CPA (K) Section 4 or above, degree in Commerce or Finance, and 2 years experience.'),
  (1,'Registered Nurse','%1$s Medical Centre','Full-time',55000,85000,5000,'Provide patient care in the outpatient and maternity wards, give medication and keep patient records at a private hospital in %1$s, %2$s County. Night shift allowance paid.','Diploma or degree in Nursing (KRCHN or BScN) and a valid Nursing Council of Kenya licence.'),
  (2,'Clinical Officer','Afya Njema Clinic %1$s','Full-time',50000,80000,5000,'Examine and treat outpatients, order lab tests and refer complex cases at a busy clinic in %1$s, %2$s County.','Diploma in Clinical Medicine and registration with the Clinical Officers Council.'),
  (3,'Secondary School Teacher (Maths & Chemistry)','%1$s Mixed Day Secondary School (BOM)','Contract',25000,40000,1000,'Teach Mathematics and Chemistry to Form 1 to Form 4 students at a public day school in %1$s, %2$s County. Board of Management contract for one year.','Bachelor of Education (Science) and a TSC number.'),
  (4,'ECDE Teacher','Little Stars Academy %1$s','Full-time',15000,22000,1000,'Teach PP1 and PP2 learners using the CBC curriculum at a private school in %1$s, %2$s County.','Certificate or diploma in Early Childhood Development Education.'),
  (5,'ICT Support Officer','%2$s Technical Training Institute','Full-time',40000,60000,5000,'Maintain computers, the network and student portal at a TVET institution based in %1$s, %2$s County.','Diploma or degree in IT or Computer Science. CCNA is an added advantage.'),
  (6,'Human Resource Assistant','Tujenge Manufacturers Ltd','Full-time',35000,50000,5000,'Handle staff records, payroll inputs and recruitment for a 150-staff factory in %1$s, %2$s County.','Diploma in Human Resource Management and IHRM membership.'),
  (7,'Procurement Officer','%2$s Water & Sanitation Company','Full-time',50000,75000,5000,'Run tenders, prepare LPOs and manage suppliers for the county water company in %1$s, %2$s County.','Degree in Procurement and Supply Chain Management and KISM membership.'),
  (8,'Civil Engineer (Site)','Imara Construction Ltd','Contract',80000,120000,10000,'Supervise road and drainage works on a county project in %1$s, %2$s County. 12-month contract with site allowance.','BSc Civil Engineering and Engineers Board of Kenya graduate registration.'),
  (9,'Pharmaceutical Technologist','Dawa Plus Pharmacy %1$s','Full-time',40000,60000,5000,'Dispense medicine, advise customers and manage stock at a retail pharmacy in %1$s, %2$s County.','Diploma in Pharmacy and Pharmacy and Poisons Board registration.'),
  (10,'Credit Officer (Microfinance)','Inua Microfinance - %1$s Branch','Full-time',35000,55000,5000,'Recruit and train chama groups, appraise loans and follow up repayments in %1$s, %2$s County. Commission paid on top of salary.','Diploma or degree in Business. Motorbike licence is an advantage.'),
  (11,'Community Social Worker','Hope for Families Kenya (NGO)','Contract',40000,60000,5000,'Visit households, run community support groups and keep case records for a family welfare program in %1$s, %2$s County.','Diploma or degree in Social Work or Community Development.')
),
online(title, employer, job_type, pay, period, descr, req, qual, pos) AS (VALUES
  ('Data Entry Clerk (Remote)','Tally Data Solutions','Remote',800,'day','Type scanned receipts and forms into spreadsheets from home. Work 5 hours a day on your own laptop or smartphone. Paid weekly via M-Pesa.','No qualifications required. Smartphone or laptop and stable internet.',false,8),
  ('Audio Transcriber (English & Kiswahili)','Sauti Transcripts','Remote',25000,'month','Listen to interviews and meetings and type them out accurately. Flexible hours, about 6 hours a day.','No certificate needed. Good listening and typing. Free short test before starting.',false,6),
  ('Social Media Assistant','Kwetu Digital Agency','Remote',18000,'month','Post content, reply to comments and DMs for small Kenyan businesses on Facebook, Instagram and TikTok.','No qualifications required. Must be active on social media and write clear English or Kiswahili.',false,4),
  ('Customer Support Chat Agent','Duka Online Kenya','Remote',30000,'month','Answer customer questions about orders and deliveries through WhatsApp and website chat. Shifts 8am to 5pm or 1pm to 10pm.','KCSE certificate. Good written English. Training provided.',false,10),
  ('Content Writer (Blogs & Product Descriptions)','Andika Media','Remote',1200,'day','Write 3 to 4 short articles or product descriptions every day for Kenyan e-commerce sites.','No degree required. Writing samples needed.',false,5),
  ('Virtual Assistant','Msaidizi VA Services','Remote',35000,'month','Manage emails, calendars and bookings for business owners in Kenya and abroad. Monday to Friday.','Diploma in any field. Good computer skills.',true,3),
  ('Online Tutor (KCSE Maths & English)','Somesha Online Academy','Remote',600,'hour','Teach Form 3 and Form 4 students live on video in evenings and weekends.','Degree or diploma in Education, or a strong KCSE grade in the subject.',true,6),
  ('Product Image Tagger','Lebo AI Data Labs','Remote',700,'day','Label pictures of products and everyday items on a simple web tool to help train computer systems. Work any time of the day.','No qualifications required. Basic smartphone skills.',false,15),
  ('English to Kiswahili Translator','Lugha Bridge Translations','Remote',1500,'day','Translate short documents, app text and adverts from English to Kiswahili.','Fluent in both languages. A short translation test is required.',false,4),
  ('Graphic Designer (Freelance)','Chora Creative Studio','Remote',45000,'month','Design posters, social media graphics and logos for clients using Canva or Adobe tools.','Portfolio of past work. Certificate or diploma in design is a plus.',false,2),
  ('Bookkeeper (Remote)','Hesabu Smart Accounting','Remote',40000,'month','Record sales and expenses for small businesses in QuickBooks and prepare monthly reports.','CPA Part 1 or diploma in accounting.',true,3),
  ('Junior Web Developer (Remote)','Mtandao Tech Ltd','Remote',70000,'month','Build and maintain websites using HTML, CSS, JavaScript and React for Kenyan clients.','Diploma or degree in IT, or a portfolio of projects you have built.',true,2),
  ('Online Community Moderator','Jukwaa Kenya Forum','Remote',20000,'month','Review posts and comments on a Kenyan discussion app, remove spam and help members.','No qualifications required. Good judgement and reliable internet.',false,5),
  ('Proofreader (English)','Safi Words Editing','Remote',1000,'day','Check documents, school notes and reports for spelling and grammar mistakes.','KCSE English grade B and above or a degree in any field.',false,3),
  ('Telesales Agent (Work from Home)','Bima Rahisi Insurance Agency','Remote',20000,'month','Call interested customers from a provided list and explain affordable medical and motorbike cover. Basic salary plus commission.','No qualifications required. Clear speaking voice.',false,8),
  ('Online Order Packer Coordinator','Haraka Mart','Part-time',600,'day','Confirm online orders by phone and WhatsApp and coordinate riders from home. 4 hours per day.','No qualifications required. Smartphone with WhatsApp.',false,6)
)
INSERT INTO public.jobs (title, category, employer, county, sub_county, job_type, pay_amount, pay_period, description, requirements, qualification_required, is_online, positions, created_at)
SELECT t.title, t.category, format(t.employer, l.sub, l.county), l.county, l.sub, t.job_type,
  (t.pmin + (abs(hashtext(l.sub || t.title)::bigint) % ((t.pmax - t.pmin) / t.step + 1)) * t.step)::integer,
  t.period, format(t.descr, l.sub, l.county), format(t.req, l.sub, l.county), false, false,
  (1 + abs(hashtext(t.title || l.sub || 'p')::bigint) % 5)::integer,
  now() - make_interval(hours => (abs(hashtext(l.sub || t.title || 'd')::bigint) % 240)::integer)
FROM locs l
CROSS JOIN LATERAL generate_series(1, CASE WHEN l.county = 'Nairobi' THEN 5 ELSE 3 END) AS k
JOIN tpl t ON t.idx = (abs(hashtext(l.county || l.sub)::bigint) + k * 7) % 34
UNION ALL
SELECT p.title, 'Professional', format(p.employer, c.arr[1 + (abs(hashtext(c.county || k::text)::bigint) % array_length(c.arr, 1))::integer], c.county),
  c.county, c.arr[1 + (abs(hashtext(c.county || k::text)::bigint) % array_length(c.arr, 1))::integer], p.job_type,
  (p.pmin + (abs(hashtext(c.county || p.title)::bigint) % ((p.pmax - p.pmin) / p.step + 1)) * p.step)::integer,
  'month', format(p.descr, c.arr[1 + (abs(hashtext(c.county || k::text)::bigint) % array_length(c.arr, 1))::integer], c.county), p.req, true, false,
  (1 + abs(hashtext(p.title || c.county)::bigint) % 3)::integer,
  now() - make_interval(hours => (abs(hashtext(c.county || p.title || 'd')::bigint) % 300)::integer)
FROM counties c
CROSS JOIN LATERAL generate_series(1, CASE WHEN c.county IN ('Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Kiambu') THEN 6 ELSE 3 END) AS k
JOIN ptpl p ON p.idx = (abs(hashtext(c.county)::bigint) + k * 5) % 12
UNION ALL
SELECT o.title, 'Online', o.employer, 'Online', NULL, o.job_type, o.pay, o.period, o.descr, o.req, o.qual, true, o.pos,
  now() - make_interval(hours => (abs(hashtext(o.title)::bigint) % 120)::integer)
FROM online o;