-- Populate Database with Sample Members
-- This script adds realistic members across all 12 departments

-- First, ensure we have a super_admin user to use as registered_by
-- (Skip if you already have users)
INSERT INTO users (username, password, phone_number, role)
VALUES ('admin', '$2b$10$YourHashedPasswordHere', '+233244000000', 'super_admin')
ON CONFLICT (username) DO NOTHING;

-- Get the admin user ID (we'll use this for registered_by)
-- In practice, replace this with your actual user ID

-- January Department Members
INSERT INTO registered_people (full_name, phone_number, gender, home_location, work_location, department_name, registered_by)
SELECT 
  full_name, phone_number, gender, home_location, work_location, department_name,
  (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)
FROM (VALUES
  ('Kwame Mensah', '+233244123001', 'Male', 'Achimota, Accra', 'Osu, Accra', 'January'),
  ('Akosua Owusu', '+233244123002', 'Female', 'Dansoman, Accra', 'Makola, Accra', 'January'),
  ('Kofi Asante', '+233244123003', 'Male', 'Tema Community 1', 'Harbour Area, Tema', 'January'),
  ('Ama Boateng', '+233244123004', 'Female', 'East Legon, Accra', 'Airport City, Accra', 'January'),
  ('Yaw Appiah', '+233244123005', 'Male', 'Madina, Accra', 'Ridge, Accra', 'January'),
  ('Abena Sarpong', '+233244123006', 'Female', 'Kasoa', 'Circle, Accra', 'January'),
  ('Kwabena Osei', '+233244123007', 'Male', 'Ablekuma, Accra', 'Kaneshie, Accra', 'January'),
  ('Efua Agyeman', '+233244123008', 'Female', 'Lapaz, Accra', 'Kwame Nkrumah Circle', 'January'),
  ('Kwesi Asamoah', '+233244123009', 'Male', 'Adenta, Accra', 'Spintex, Accra', 'January'),
  ('Adjoa Frimpong', '+233244123010', 'Female', 'Haatso, Accra', 'Legon, Accra', 'January')
) AS members(full_name, phone_number, gender, home_location, work_location, department_name);

-- February Department Members
INSERT INTO registered_people (full_name, phone_number, gender, home_location, work_location, department_name, registered_by)
SELECT 
  full_name, phone_number, gender, home_location, work_location, department_name,
  (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)
FROM (VALUES
  ('Nana Addo', '+233244123011', 'Male', 'Kumasi, Adum', 'Kejetia, Kumasi', 'February'),
  ('Afua Nyarko', '+233244123012', 'Female', 'Bantama, Kumasi', 'Tech Junction, Kumasi', 'February'),
  ('Osei Tutu', '+233244123013', 'Male', 'Asokwa, Kumasi', 'KNUST, Kumasi', 'February'),
  ('Akua Duodu', '+233244123014', 'Female', 'Tafo, Kumasi', 'Adum, Kumasi', 'February'),
  ('Kofi Boakye', '+233244123015', 'Male', 'Santasi, Kumasi', 'Anloga Junction, Kumasi', 'February'),
  ('Esi Mensah', '+233244123016', 'Female', 'Ayigya, Kumasi', 'Maxmart, Kumasi', 'February'),
  ('Kwadwo Amoah', '+233244123017', 'Male', 'Ejisu, Kumasi', 'KMA, Kumasi', 'February'),
  ('Mercy Owusu', '+233244123018', 'Female', 'Oforikrom, Kumasi', 'Komfo Anokye Hospital', 'February'),
  ('Samuel Yeboah', '+233244123019', 'Male', 'Suame, Kumasi', 'Magazine, Suame', 'February'),
  ('Grace Ansah', '+233244123020', 'Female', 'Asafo, Kumasi', 'City Mall, Kumasi', 'February')
) AS members(full_name, phone_number, gender, home_location, work_location, department_name);

-- March Department Members
INSERT INTO registered_people (full_name, phone_number, gender, home_location, work_location, department_name, registered_by)
SELECT 
  full_name, phone_number, gender, home_location, work_location, department_name,
  (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)
FROM (VALUES
  ('Emmanuel Aboagye', '+233244123021', 'Male', 'Takoradi, Market Circle', 'Sekondi Harbour', 'March'),
  ('Elizabeth Mensah', '+233244123022', 'Female', 'Sekondi, Essikado', 'Takoradi Mall', 'March'),
  ('Joseph Annan', '+233244123023', 'Male', 'Kojokrom, Takoradi', 'Western Regional Office', 'March'),
  ('Patience Atta', '+233244123024', 'Female', 'Effiakuma', 'Market Circle, Takoradi', 'March'),
  ('Isaac Quartey', '+233244123025', 'Male', 'New Takoradi', 'Harbour, Takoradi', 'March'),
  ('Janet Quansah', '+233244123026', 'Female', 'Fijai, Takoradi', 'Melcom, Takoradi', 'March'),
  ('Daniel Tetteh', '+233244123027', 'Male', 'Ketan, Takoradi', 'Airport Ridge, Takoradi', 'March'),
  ('Felicia Sackey', '+233244123028', 'Female', 'Nkroful', 'Market Circle, Sekondi', 'March'),
  ('Stephen Koomson', '+233244123029', 'Male', 'Windy Ridge, Takoradi', 'GPHA, Takoradi', 'March'),
  ('Victoria Yankey', '+233244123030', 'Female', 'Anaji, Takoradi', 'Palace Mall, Takoradi', 'March')
) AS members(full_name, phone_number, gender, home_location, work_location, department_name);

-- April Department Members
INSERT INTO registered_people (full_name, phone_number, gender, home_location, work_location, department_name, registered_by)
SELECT 
  full_name, phone_number, gender, home_location, work_location, department_name,
  (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)
FROM (VALUES
  ('Francis Addai', '+233244123031', 'Male', 'Tamale, Aboabo', 'Central Market, Tamale', 'April'),
  ('Hannah Alhassan', '+233244123032', 'Female', 'Kalpohin, Tamale', 'Tamale Teaching Hospital', 'April'),
  ('Abdul Rahman', '+233244123033', 'Male', 'Lamashegu, Tamale', 'UDS, Tamale', 'April'),
  ('Fatima Mohammed', '+233244123034', 'Female', 'Sagnarigu', 'Tamale Metropolis', 'April'),
  ('Mohammed Iddrisu', '+233244123035', 'Male', 'Gumani, Tamale', 'Northern Regional Office', 'April'),
  ('Aisha Abdul', '+233244123036', 'Female', 'Vittin, Tamale', 'West Hospital, Tamale', 'April'),
  ('Ibrahim Musah', '+233244123037', 'Male', 'Choggu, Tamale', 'Tamale Airport', 'April'),
  ('Mariama Issah', '+233244123038', 'Female', 'Jisonayili', 'Maxmall, Tamale', 'April'),
  ('Sulemana Abukari', '+233244123039', 'Male', 'Nyohini, Tamale', 'Tamale Sports Stadium', 'April'),
  ('Rakiya Seidu', '+233244123040', 'Female', 'Zogbeli, Tamale', 'Central Hospital, Tamale', 'April')
) AS members(full_name, phone_number, gender, home_location, work_location, department_name);

-- May Department Members
INSERT INTO registered_people (full_name, phone_number, gender, home_location, work_location, department_name, registered_by)
SELECT 
  full_name, phone_number, gender, home_location, work_location, department_name,
  (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)
FROM (VALUES
  ('Peter Gyamfi', '+233244123041', 'Male', 'Cape Coast, Abura', 'UCC Campus, Cape Coast', 'May'),
  ('Rebecca Buckman', '+233244123042', 'Female', 'Pedu, Cape Coast', 'Central Regional Office', 'May'),
  ('George Eshun', '+233244123043', 'Male', 'Amamoma, Cape Coast', 'Kotokuraba Market', 'May'),
  ('Mary Egyir', '+233244123044', 'Female', 'Ewim, Cape Coast', 'Cape Coast Teaching Hospital', 'May'),
  ('Charles Aggrey', '+233244123045', 'Male', 'Adisadel, Cape Coast', 'GES Office, Cape Coast', 'May'),
  ('Lydia Essien', '+233244123046', 'Female', 'Apewosika, Cape Coast', 'SSNIT Hospital, Cape Coast', 'May'),
  ('Benjamin Arthur', '+233244123047', 'Male', 'Tantri, Cape Coast', 'Cape Coast Castle', 'May'),
  ('Esther Donkor', '+233244123048', 'Female', 'Nkanfoa, Cape Coast', 'College of Education', 'May'),
  ('Michael Essel', '+233244123049', 'Male', 'Bakado, Cape Coast', 'Melcom, Cape Coast', 'May'),
  ('Sarah Cobbinah', '+233244123050', 'Female', 'Nkanfoa Estate', 'Ministry Office, Cape Coast', 'May')
) AS members(full_name, phone_number, gender, home_location, work_location, department_name);

-- June Department Members
INSERT INTO registered_people (full_name, phone_number, gender, home_location, work_location, department_name, registered_by)
SELECT 
  full_name, phone_number, gender, home_location, work_location, department_name,
  (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)
FROM (VALUES
  ('Richard Ofori', '+233244123051', 'Male', 'Sunyani, Penkwasi', 'Municipal Office, Sunyani', 'June'),
  ('Linda Owusu-Ansah', '+233244123052', 'Female', 'Abesim, Sunyani', 'Sunyani Nursing College', 'June'),
  ('Patrick Gyasi', '+233244123053', 'Male', 'Fiapre', 'Regional Hospital, Sunyani', 'June'),
  ('Jennifer Asiedu', '+233244123054', 'Female', 'Magazine, Sunyani', 'Holy Family Hospital', 'June'),
  ('Andrews Boateng', '+233244123055', 'Male', 'Odumase, Sunyani', 'CEPS Office, Sunyani', 'June'),
  ('Theresa Mensah', '+233244123056', 'Female', 'Newtown, Sunyani', 'GES, Sunyani', 'June'),
  ('Albert Antwi', '+233244123057', 'Male', 'Nkwabeng, Sunyani', 'Market, Sunyani', 'June'),
  ('Evelyn Afriyie', '+233244123058', 'Female', 'Penkwasi East', 'Cocoa Clinic, Sunyani', 'June'),
  ('Nicholas Frimpong', '+233244123059', 'Male', 'Baakoniaba', 'Sunyani Tech University', 'June'),
  ('Comfort Boadi', '+233244123060', 'Female', 'Chiraa Road', 'Municipal Assembly, Sunyani', 'June')
) AS members(full_name, phone_number, gender, home_location, work_location, department_name);

-- July Department Members
INSERT INTO registered_people (full_name, phone_number, gender, home_location, work_location, department_name, registered_by)
SELECT 
  full_name, phone_number, gender, home_location, work_location, department_name,
  (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)
FROM (VALUES
  ('Thomas Addo', '+233244123061', 'Male', 'Ho, Ahoe', 'Regional Office, Ho', 'July'),
  ('Priscilla Gadzekpo', '+233244123062', 'Female', 'Kpedze, Ho', 'Ho Teaching Hospital', 'July'),
  ('Solomon Amegah', '+233244123063', 'Male', 'Sokode, Ho', 'Ho Polytechnic', 'July'),
  ('Agnes Tsikata', '+233244123064', 'Female', 'Bankoe, Ho', 'Municipal Assembly, Ho', 'July'),
  ('Ernest Afenu', '+233244123065', 'Male', 'Hliha, Ho', 'GES Office, Ho', 'July'),
  ('Juliet Akoto', '+233244123066', 'Female', 'Mawuko', 'Ho Central Market', 'July'),
  ('Vincent Gbeve', '+233244123067', 'Male', 'Heve, Ho', 'VRA Office, Ho', 'July'),
  ('Rejoice Atsu', '+233244123068', 'Female', 'Takla', 'Ho Technical University', 'July'),
  ('Maxwell Agbogah', '+233244123069', 'Male', 'Kpenoe, Ho', 'Electricity Company, Ho', 'July'),
  ('Christiana Doe', '+233244123070', 'Female', 'Dzogbefeme', 'District Hospital, Ho', 'July')
) AS members(full_name, phone_number, gender, home_location, work_location, department_name);

-- August Department Members
INSERT INTO registered_people (full_name, phone_number, gender, home_location, work_location, department_name, registered_by)
SELECT 
  full_name, phone_number, gender, home_location, work_location, department_name,
  (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)
FROM (VALUES
  ('William Oppong', '+233244123071', 'Male', 'Koforidua, Adweso', 'Jackson Park, Koforidua', 'August'),
  ('Josephine Ofosuhene', '+233244123072', 'Female', 'Asokore, Koforidua', 'Regional Hospital, Koforidua', 'August'),
  ('Augustine Donkor', '+233244123073', 'Male', 'Oyoko, Koforidua', 'ECOWAS Road, Koforidua', 'August'),
  ('Ruth Nkansah', '+233244123074', 'Female', 'Effiduase', 'Nursing Training College', 'August'),
  ('Philip Agyei', '+233244123075', 'Male', 'Srodae, Koforidua', 'Cocoa Clinic, Koforidua', 'August'),
  ('Beatrice Wiredu', '+233244123076', 'Female', 'Betom, Koforidua', 'GES Office, Koforidua', 'August'),
  ('Raymond Agyapong', '+233244123077', 'Male', 'Galloway, Koforidua', 'Koforidua Market', 'August'),
  ('Eunice Acheampong', '+233244123078', 'Female', 'New Juaben', 'St. Joseph Hospital', 'August'),
  ('Lawrence Yeboah', '+233244123079', 'Male', 'Zongo, Koforidua', 'Regional Office, Koforidua', 'August'),
  ('Doris Okyere', '+233244123080', 'Female', 'Adweso Estate', 'Municipal Assembly', 'August')
) AS members(full_name, phone_number, gender, home_location, work_location, department_name);

-- September Department Members
INSERT INTO registered_people (full_name, phone_number, gender, home_location, work_location, department_name, registered_by)
SELECT 
  full_name, phone_number, gender, home_location, work_location, department_name,
  (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)
FROM (VALUES
  ('Christopher Owusu', '+233244123081', 'Male', 'Techiman, Nsuta', 'Techiman Market', 'September'),
  ('Florence Antwi', '+233244123082', 'Female', 'Tuobodom', 'Holy Family Hospital, Techiman', 'September'),
  ('Joshua Amoako', '+233244123083', 'Male', 'Tanoso, Techiman', 'Municipal Assembly', 'September'),
  ('Veronica Adu', '+233244123084', 'Female', 'Akrofrom', 'Nursing Training, Techiman', 'September'),
  ('Felix Osei', '+233244123085', 'Male', 'Kenten, Techiman', 'GES Office, Techiman', 'September'),
  ('Paulina Mensah', '+233244123086', 'Female', 'Krobo, Techiman', 'District Hospital', 'September'),
  ('Martin Asiedu', '+233244123087', 'Male', 'Aworowa', 'Techiman Market', 'September'),
  ('Anastasia Boakye', '+233244123088', 'Female', 'Offuman', 'Cocoa Clinic, Techiman', 'September'),
  ('Jonathan Frimpong', '+233244123089', 'Male', 'Asubima', 'Regional Office', 'September'),
  ('Monica Appiah', '+233244123090', 'Female', 'Tanoboase', 'St. Theresa Hospital', 'September')
) AS members(full_name, phone_number, gender, home_location, work_location, department_name);

-- October Department Members
INSERT INTO registered_people (full_name, phone_number, gender, home_location, work_location, department_name, registered_by)
SELECT 
  full_name, phone_number, gender, home_location, work_location, department_name,
  (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)
FROM (VALUES
  ('Henry Boateng', '+233244123091', 'Male', 'Tarkwa, Benso', 'Mining Company, Tarkwa', 'October'),
  ('Bridget Amankwah', '+233244123092', 'Female', 'Nsuta, Tarkwa', 'Government Hospital, Tarkwa', 'October'),
  ('Alexander Mensah', '+233244123093', 'Male', 'Wassa Akropong', 'Tarkwa Market', 'October'),
  ('Georgina Oduro', '+233244123094', 'Female', 'Teberebie', 'Nursing Training College', 'October'),
  ('Robert Nkrumah', '+233244123095', 'Male', 'Akyempim, Tarkwa', 'District Office, Tarkwa', 'October'),
  ('Charity Asiedu', '+233244123096', 'Female', 'Aboso', 'GES Office, Tarkwa', 'October'),
  ('Samuel Appiah', '+233244123097', 'Male', 'New Atuabo', 'Mining Facility, Tarkwa', 'October'),
  ('Vivian Osei', '+233244123098', 'Female', 'Tamso, Tarkwa', 'St. Michael Hospital', 'October'),
  ('Frederick Gyasi', '+233244123099', 'Male', 'Huniso', 'Municipal Assembly', 'October'),
  ('Gifty Owusu', '+233244123100', 'Female', 'Ahafo Hiani', 'Central Market, Tarkwa', 'October')
) AS members(full_name, phone_number, gender, home_location, work_location, department_name);

-- November Department Members
INSERT INTO registered_people (full_name, phone_number, gender, home_location, work_location, department_name, registered_by)
SELECT 
  full_name, phone_number, gender, home_location, work_location, department_name,
  (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)
FROM (VALUES
  ('David Ansah', '+233244123101', 'Male', 'Wa, Kpaguri', 'Regional Hospital, Wa', 'November'),
  ('Lydia Seidu', '+233244123102', 'Female', 'Bamahu, Wa', 'Upper West Regional Office', 'November'),
  ('Eric Dery', '+233244123103', 'Male', 'Charia, Wa', 'Wa Polytechnic', 'November'),
  ('Cecilia Bayor', '+233244123104', 'Female', 'Kpongu, Wa', 'Municipal Assembly, Wa', 'November'),
  ('Gilbert Kuuder', '+233244123105', 'Male', 'Busa, Wa', 'GES Office, Wa', 'November'),
  ('Elizabeth Naah', '+233244123106', 'Female', 'Dobile, Wa', 'District Hospital, Wa', 'November'),
  ('Simon Gyan', '+233244123107', 'Male', 'Kabanye', 'Wa Central Market', 'November'),
  ('Rosemary Bonye', '+233244123108', 'Female', 'Kperisi, Wa', 'Wa Nursing College', 'November'),
  ('Edward Jawal', '+233244123109', 'Male', 'Sokpayiri', 'Agriculture Office, Wa', 'November'),
  ('Felicia Sogli', '+233244123110', 'Female', 'Boli, Wa', 'Municipal Hospital', 'November')
) AS members(full_name, phone_number, gender, home_location, work_location, department_name);

-- December Department Members
INSERT INTO registered_people (full_name, phone_number, gender, home_location, work_location, department_name, registered_by)
SELECT 
  full_name, phone_number, gender, home_location, work_location, department_name,
  (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1)
FROM (VALUES
  ('Anthony Forson', '+233244123111', 'Male', 'Bolgatanga, Sumbrungu', 'Regional Hospital, Bolga', 'December'),
  ('Diana Ayambire', '+233244123112', 'Female', 'Zuarungu', 'Upper East Regional Office', 'December'),
  ('Kenneth Abugri', '+233244123113', 'Male', 'Sherigu, Bolga', 'Bolgatanga Polytechnic', 'December'),
  ('Clara Atampure', '+233244123114', 'Female', 'Zanlerigu', 'GES Office, Bolgatanga', 'December'),
  ('Emmanuel Akudugu', '+233244123115', 'Male', 'Yorogo, Bolga', 'Municipal Assembly', 'December'),
  ('Prudence Adongo', '+233244123116', 'Female', 'Tongo', 'District Hospital, Bolga', 'December'),
  ('Gabriel Atanwanga', '+233244123117', 'Male', 'Navrongo', 'War Memorial Hospital', 'December'),
  ('Comfort Asampana', '+233244123118', 'Female', 'Bongo', 'Nursing Training College', 'December'),
  ('Richard Akanpaadgi', '+233244123119', 'Male', 'Paga', 'Immigration Office', 'December'),
  ('Joyce Akunzule', '+233244123120', 'Female', 'Sirigu', 'Bolgatanga Market', 'December')
) AS members(full_name, phone_number, gender, home_location, work_location, department_name);

-- Verify insertion
SELECT department_name, COUNT(*) as member_count 
FROM registered_people 
GROUP BY department_name 
ORDER BY department_name;
