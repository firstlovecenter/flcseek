import { NextResponse } from 'next/server';
import { query } from '@/lib/neon';

export async function POST() {
  try {
    console.log('Starting database population...');

    // The members data
    const members = [
      // January Department
      { name: 'Kwame Mensah', phone: '+233244123001', gender: 'Male', home: 'Achimota, Accra', work: 'Osu, Accra', dept: 'January' },
      { name: 'Akosua Owusu', phone: '+233244123002', gender: 'Female', home: 'Dansoman, Accra', work: 'Makola, Accra', dept: 'January' },
      { name: 'Kofi Asante', phone: '+233244123003', gender: 'Male', home: 'Tema Community 1', work: 'Harbour Area, Tema', dept: 'January' },
      { name: 'Ama Boateng', phone: '+233244123004', gender: 'Female', home: 'East Legon, Accra', work: 'Airport City, Accra', dept: 'January' },
      { name: 'Yaw Appiah', phone: '+233244123005', gender: 'Male', home: 'Madina, Accra', work: 'Ridge, Accra', dept: 'January' },
      { name: 'Abena Sarpong', phone: '+233244123006', gender: 'Female', home: 'Kasoa', work: 'Circle, Accra', dept: 'January' },
      { name: 'Kwabena Osei', phone: '+233244123007', gender: 'Male', home: 'Ablekuma, Accra', work: 'Kaneshie, Accra', dept: 'January' },
      { name: 'Efua Agyeman', phone: '+233244123008', gender: 'Female', home: 'Lapaz, Accra', work: 'Kwame Nkrumah Circle', dept: 'January' },
      { name: 'Kwesi Asamoah', phone: '+233244123009', gender: 'Male', home: 'Adenta, Accra', work: 'Spintex, Accra', dept: 'January' },
      { name: 'Adjoa Frimpong', phone: '+233244123010', gender: 'Female', home: 'Haatso, Accra', work: 'Legon, Accra', dept: 'January' },

      // February Department
      { name: 'Nana Addo', phone: '+233244123011', gender: 'Male', home: 'Adum, Kumasi', work: 'Kejetia, Kumasi', dept: 'February' },
      { name: 'Afua Nyarko', phone: '+233244123012', gender: 'Female', home: 'Bantama, Kumasi', work: 'Tech Junction, Kumasi', dept: 'February' },
      { name: 'Osei Tutu', phone: '+233244123013', gender: 'Male', home: 'Asokwa, Kumasi', work: 'Adum, Kumasi', dept: 'February' },
      { name: 'Adwoa Mensah', phone: '+233244123014', gender: 'Female', home: 'Tafo, Kumasi', work: 'Kejetia Market', dept: 'February' },
      { name: 'Kojo Bonsu', phone: '+233244123015', gender: 'Male', home: 'Ayigya, Kumasi', work: 'KNUST Campus', dept: 'February' },
      { name: 'Maame Serwaa', phone: '+233244123016', gender: 'Female', home: 'Suame, Kumasi', work: 'Magazine, Kumasi', dept: 'February' },
      { name: 'Opoku Ware', phone: '+233244123017', gender: 'Male', home: 'Asafo, Kumasi', work: 'Adum, Kumasi', dept: 'February' },
      { name: 'Yaa Asantewaa', phone: '+233244123018', gender: 'Female', home: 'Ahodwo, Kumasi', work: 'Harper Road', dept: 'February' },
      { name: 'Boakye Yiadom', phone: '+233244123019', gender: 'Male', home: 'Anloga, Kumasi', work: 'Roman Hill', dept: 'February' },
      { name: 'Akua Donkor', phone: '+233244123020', gender: 'Female', home: 'Abrepo, Kumasi', work: 'Manhyia Palace', dept: 'February' },

      // March Department  
      { name: 'Emmanuel Aboagye', phone: '+233244123021', gender: 'Male', home: 'Takoradi Market Circle', work: 'Sekondi Harbour', dept: 'March' },
      { name: 'Elizabeth Mensah', phone: '+233244123022', gender: 'Female', home: 'Kojokrom, Takoradi', work: 'Takoradi Mall', dept: 'March' },
      { name: 'Isaac Baidoo', phone: '+233244123023', gender: 'Male', home: 'Effiakuma, Takoradi', work: 'Sekondi', dept: 'March' },
      { name: 'Grace Attah', phone: '+233244123024', gender: 'Female', home: 'New Takoradi', work: 'Harbour Area', dept: 'March' },
      { name: 'Samuel Inkoom', phone: '+233244123025', gender: 'Male', home: 'Anaji, Takoradi', work: 'Market Circle', dept: 'March' },
      { name: 'Janet Quansah', phone: '+233244123026', gender: 'Female', home: 'Fijai, Takoradi', work: 'Chapel Hill', dept: 'March' },
      { name: 'Benjamin Tetteh', phone: '+233244123027', gender: 'Male', home: 'Kansaworado', work: 'Takoradi Port', dept: 'March' },
      { name: 'Mary Ansah', phone: '+233244123028', gender: 'Female', home: 'Tanokrom, Takoradi', work: 'Paa Grant Roundabout', dept: 'March' },
      { name: 'Joseph Essien', phone: '+233244123029', gender: 'Male', home: 'Assakae, Takoradi', work: 'Takoradi CBD', dept: 'March' },
      { name: 'Comfort Agyei', phone: '+233244123030', gender: 'Female', home: 'Adakope, Takoradi', work: 'Market Circle', dept: 'March' },

      // April Department
      { name: 'Francis Addai', phone: '+233244123031', gender: 'Male', home: 'Aboabo, Tamale', work: 'Central Market', dept: 'April' },
      { name: 'Hannah Alhassan', phone: '+233244123032', gender: 'Female', home: 'Kalpohin, Tamale', work: 'Tamale Teaching Hospital', dept: 'April' },
      { name: 'Abdul Rahman', phone: '+233244123033', gender: 'Male', home: 'Lamashegu, Tamale', work: 'UDS Campus', dept: 'April' },
      { name: 'Fatima Mohammed', phone: '+233244123034', gender: 'Female', home: 'Sagnarigu', work: 'Tamale Metropolis', dept: 'April' },
      { name: 'Ibrahim Mahama', phone: '+233244123035', gender: 'Male', home: 'Changli, Tamale', work: 'Tamale Airport', dept: 'April' },
      { name: 'Amina Bawa', phone: '+233244123036', gender: 'Female', home: 'Vittin, Tamale', work: 'Central Mosque Area', dept: 'April' },
      { name: 'Sulemana Iddrisu', phone: '+233244123037', gender: 'Male', home: 'Gumani, Tamale', work: 'Tamale Market', dept: 'April' },
      { name: 'Zainab Musah', phone: '+233244123038', gender: 'Female', home: 'Nyohini, Tamale', work: 'Regional Hospital', dept: 'April' },
      { name: 'Mohammed Saani', phone: '+233244123039', gender: 'Male', home: 'Dungu, Tamale', work: 'Tamale CBD', dept: 'April' },
      { name: 'Mariam Zakari', phone: '+233244123040', gender: 'Female', home: 'Gurugu, Tamale', work: 'Tamale Market', dept: 'April' },

      // May Department
      { name: 'Peter Gyamfi', phone: '+233244123041', gender: 'Male', home: 'UCC Campus, Cape Coast', work: 'Cape Coast Castle', dept: 'May' },
      { name: 'Rebecca Buckman', phone: '+233244123042', gender: 'Female', home: 'Pedu, Cape Coast', work: 'Kotokuraba Market', dept: 'May' },
      { name: 'Daniel Essilfie', phone: '+233244123043', gender: 'Male', home: 'Amamoma, Cape Coast', work: 'Metro Mass Area', dept: 'May' },
      { name: 'Patience Baidoo', phone: '+233244123044', gender: 'Female', home: 'Ewim, Cape Coast', work: 'Coconut Grove', dept: 'May' },
      { name: 'Michael Brew', phone: '+233244123045', gender: 'Male', home: 'Adisadel, Cape Coast', work: 'Cape Coast Stadium', dept: 'May' },
      { name: 'Sarah Donkoh', phone: '+233244123046', gender: 'Female', home: 'Aboom, Cape Coast', work: 'University of Cape Coast', dept: 'May' },
      { name: 'Augustine Aidoo', phone: '+233244123047', gender: 'Male', home: 'Akotokyir, Cape Coast', work: 'Cape Coast Harbour', dept: 'May' },
      { name: 'Victoria Egyir', phone: '+233244123048', gender: 'Female', home: 'Siwdu, Cape Coast', work: 'Kotokuraba', dept: 'May' },
      { name: 'Charles Koomson', phone: '+233244123049', gender: 'Male', home: 'Ola, Cape Coast', work: 'Central Region Police HQ', dept: 'May' },
      { name: 'Ernestina Baiden', phone: '+233244123050', gender: 'Female', home: 'Efutu, Cape Coast', work: 'Cape Coast CBD', dept: 'May' },

      // June Department
      { name: 'Richard Ofori', phone: '+233244123051', gender: 'Male', home: 'Abesim, Sunyani', work: 'Sunyani Market', dept: 'June' },
      { name: 'Linda Owusu-Ansah', phone: '+233244123052', gender: 'Female', home: 'Fiapre, Sunyani', work: 'Coronation Park', dept: 'June' },
      { name: 'Patrick Boakye', phone: '+233244123053', gender: 'Male', home: 'Odumase, Sunyani', work: 'Sunyani Technical University', dept: 'June' },
      { name: 'Felicia Amponsah', phone: '+233244123054', gender: 'Female', home: 'New Town, Sunyani', work: 'Sunyani Polyclinic', dept: 'June' },
      { name: 'Stephen Akwasi', phone: '+233244123055', gender: 'Male', home: 'Penkwase, Sunyani', work: 'Sunyani Market Square', dept: 'June' },
      { name: 'Angela Okyere', phone: '+233244123056', gender: 'Female', home: 'Tanoso, Sunyani', work: 'Regional Hospital', dept: 'June' },
      { name: 'Emmanuel Yeboah', phone: '+233244123057', gender: 'Male', home: 'Atronie, Sunyani', work: 'Sunyani CBD', dept: 'June' },
      { name: 'Beatrice Asare', phone: '+233244123058', gender: 'Female', home: 'Abesim Junction', work: 'Sunyani Market', dept: 'June' },
      { name: 'Francis Owusu', phone: '+233244123059', gender: 'Male', home: 'Magazine, Sunyani', work: 'Sunyani Stadium', dept: 'June' },
      { name: 'Christine Adu', phone: '+233244123060', gender: 'Female', home: 'Dumasua, Sunyani', work: 'Sunyani Central', dept: 'June' },

      // July Department
      { name: 'Thomas Addo', phone: '+233244123061', gender: 'Male', home: 'Abutia, Ho', work: 'Ho Market', dept: 'July' },
      { name: 'Priscilla Gadzekpo', phone: '+233244123062', gender: 'Female', home: 'Bankoe, Ho', work: 'Ho Technical University', dept: 'July' },
      { name: 'George Agbeli', phone: '+233244123063', gender: 'Male', home: 'Ahoe, Ho', work: 'Volta Regional Hospital', dept: 'July' },
      { name: 'Rosemary Amegah', phone: '+233244123064', gender: 'Female', home: 'Dome, Ho', work: 'Ho Central Market', dept: 'July' },
      { name: 'Eric Kwaku', phone: '+233244123065', gender: 'Male', home: 'Kpedze, Ho', work: 'Ho Municipal Assembly', dept: 'July' },
      { name: 'Gladys Tsigbe', phone: '+233244123066', gender: 'Female', home: 'Takla, Ho', work: 'Ho Polyclinic', dept: 'July' },
      { name: 'Maxwell Dzide', phone: '+233244123067', gender: 'Male', home: 'Sokode, Ho', work: 'Ho CBD', dept: 'July' },
      { name: 'Juliana Ahiable', phone: '+233244123068', gender: 'Female', home: 'Heve, Ho', work: 'Ho Market', dept: 'July' },
      { name: 'Solomon Afaglo', phone: '+233244123069', gender: 'Male', home: 'Matse, Ho', work: 'Ho Township', dept: 'July' },
      { name: 'Esther Adade', phone: '+233244123070', gender: 'Female', home: 'Klefe, Ho', work: 'Ho Central', dept: 'July' },

      // August Department
      { name: 'William Oppong', phone: '+233244123071', gender: 'Male', home: 'Asokore, Koforidua', work: 'Koforidua Market', dept: 'August' },
      { name: 'Josephine Ofosuhene', phone: '+233244123072', gender: 'Female', home: 'Betom, Koforidua', work: 'Regional Hospital', dept: 'August' },
      { name: 'Robert Addo', phone: '+233244123073', gender: 'Male', home: 'Adweso, Koforidua', work: 'Koforidua Technical University', dept: 'August' },
      { name: 'Vivian Amoako', phone: '+233244123074', gender: 'Female', home: 'Effiduase, Koforidua', work: 'Koforidua Central Market', dept: 'August' },
      { name: 'James Amponsah', phone: '+233244123075', gender: 'Male', home: 'Oyoko, Koforidua', work: 'Koforidua CBD', dept: 'August' },
      { name: 'Margaret Tetteh', phone: '+233244123076', gender: 'Female', home: 'Suhum Road, Koforidua', work: 'Koforidua Polyclinic', dept: 'August' },
      { name: 'Frederick Boateng', phone: '+233244123077', gender: 'Male', home: 'Zongo, Koforidua', work: 'Market Square', dept: 'August' },
      { name: 'Cecilia Okyere', phone: '+233244123078', gender: 'Female', home: 'Akwadum, Koforidua', work: 'Koforidua Township', dept: 'August' },
      { name: 'Philip Asare', phone: '+233244123079', gender: 'Male', home: 'Ahenease, Koforidua', work: 'Koforidua Market', dept: 'August' },
      { name: 'Deborah Acheampong', phone: '+233244123080', gender: 'Female', home: 'Galloway, Koforidua', work: 'Koforidua Central', dept: 'August' },

      // September Department
      { name: 'Christopher Owusu', phone: '+233244123081', gender: 'Male', home: 'New Town, Techiman', work: 'Techiman Market', dept: 'September' },
      { name: 'Florence Antwi', phone: '+233244123082', gender: 'Female', home: 'Kenten, Techiman', work: 'Techiman Holy Family Hospital', dept: 'September' },
      { name: 'Kenneth Mensah', phone: '+233244123083', gender: 'Male', home: 'Tanoboase, Techiman', work: 'Techiman Market Square', dept: 'September' },
      { name: 'Alice Gyamfi', phone: '+233244123084', gender: 'Female', home: 'Tuobodom Road, Techiman', work: 'Techiman Central', dept: 'September' },
      { name: 'Andrews Boakye', phone: '+233244123085', gender: 'Male', home: 'Krobo, Techiman', work: 'Techiman Municipal Assembly', dept: 'September' },
      { name: 'Patience Amoah', phone: '+233244123086', gender: 'Female', home: 'Aworowa, Techiman', work: 'Techiman Market', dept: 'September' },
      { name: 'Nicholas Asare', phone: '+233244123087', gender: 'Male', home: 'Nsuta Road, Techiman', work: 'Techiman CBD', dept: 'September' },
      { name: 'Charity Owusu', phone: '+233244123088', gender: 'Female', home: 'Kronom, Techiman', work: 'Techiman Township', dept: 'September' },
      { name: 'Lawrence Osei', phone: '+233244123089', gender: 'Male', home: 'Akrofrom, Techiman', work: 'Techiman Central Market', dept: 'September' },
      { name: 'Rita Yeboah', phone: '+233244123090', gender: 'Female', home: 'Bamiri, Techiman', work: 'Techiman Market', dept: 'September' },

      // October Department
      { name: 'Henry Boateng', phone: '+233244123091', gender: 'Male', home: 'Tarkwa Town', work: 'Tarkwa Mining Area', dept: 'October' },
      { name: 'Bridget Amankwah', phone: '+233244123092', gender: 'Female', home: 'Huniso, Tarkwa', work: 'Tarkwa Market', dept: 'October' },
      { name: 'Albert Mensah', phone: '+233244123093', gender: 'Male', home: 'Bonsaso, Tarkwa', work: 'Goldfields Ghana', dept: 'October' },
      { name: 'Cynthia Asare', phone: '+233244123094', gender: 'Female', home: 'Akoon, Tarkwa', work: 'Tarkwa Central', dept: 'October' },
      { name: 'Felix Owusu', phone: '+233244123095', gender: 'Male', home: 'Tamso, Tarkwa', work: 'Tarkwa Mining Site', dept: 'October' },
      { name: 'Dorothy Agyei', phone: '+233244123096', gender: 'Female', home: 'Aboso, Tarkwa', work: 'Tarkwa Government Hospital', dept: 'October' },
      { name: 'Godwin Amoah', phone: '+233244123097', gender: 'Male', home: 'Nsuta, Tarkwa', work: 'Tarkwa Township', dept: 'October' },
      { name: 'Evelyn Boakye', phone: '+233244123098', gender: 'Female', home: 'Nsuaem, Tarkwa', work: 'Tarkwa Market Square', dept: 'October' },
      { name: 'Vincent Asante', phone: '+233244123099', gender: 'Male', home: 'Himan, Tarkwa', work: 'Tarkwa CBD', dept: 'October' },
      { name: 'Mercy Osei', phone: '+233244123100', gender: 'Female', home: 'Wassa Dunkwa', work: 'Tarkwa Central', dept: 'October' },

      // November Department
      { name: 'David Ansah', phone: '+233244123101', gender: 'Male', home: 'Kpongu, Wa', work: 'Wa Central Market', dept: 'November' },
      { name: 'Lydia Seidu', phone: '+233244123102', gender: 'Female', home: 'Dobile, Wa', work: 'Wa Regional Hospital', dept: 'November' },
      { name: 'Alhassan Salifu', phone: '+233244123103', gender: 'Male', home: 'Busa, Wa', work: 'Wa Municipal Assembly', dept: 'November' },
      { name: 'Salamatu Ibrahim', phone: '+233244123104', gender: 'Female', home: 'Kperisi, Wa', work: 'Wa Central', dept: 'November' },
      { name: 'Mustapha Abdul', phone: '+233244123105', gender: 'Male', home: 'Bamahu, Wa', work: 'Wa Market', dept: 'November' },
      { name: 'Fati Issahaku', phone: '+233244123106', gender: 'Female', home: 'Nakore, Wa', work: 'Wa Township', dept: 'November' },
      { name: 'Yakubu Seidu', phone: '+233244123107', gender: 'Male', home: 'Piisi, Wa', work: 'Wa CBD', dept: 'November' },
      { name: 'Rahinatu Mohammed', phone: '+233244123108', gender: 'Female', home: 'Zinindo, Wa', work: 'Wa Central Market', dept: 'November' },
      { name: 'Issah Umar', phone: '+233244123109', gender: 'Male', home: 'Sokpayiri, Wa', work: 'Wa Market Square', dept: 'November' },
      { name: 'Aishatu Seidu', phone: '+233244123110', gender: 'Female', home: 'Limanyiri, Wa', work: 'Wa Regional Office', dept: 'November' },

      // December Department
      { name: 'Anthony Forson', phone: '+233244123111', gender: 'Male', home: 'Atulbabisi, Bolgatanga', work: 'Bolga Market', dept: 'December' },
      { name: 'Diana Ayambire', phone: '+233244123112', gender: 'Female', home: 'Zuarungu, Bolga', work: 'Bolgatanga Regional Hospital', dept: 'December' },
      { name: 'Jonathan Awuni', phone: '+233244123113', gender: 'Male', home: 'Sumbrungu, Bolga', work: 'Bolga Central', dept: 'December' },
      { name: 'Paulina Aduko', phone: '+233244123114', gender: 'Female', home: 'Soe, Bolga', work: 'Bolgatanga Market', dept: 'December' },
      { name: 'Martin Anaba', phone: '+233244123115', gender: 'Male', home: 'Zaare, Bolga', work: 'Bolga Municipal Assembly', dept: 'December' },
      { name: 'Cecilia Akaziya', phone: '+233244123116', gender: 'Female', home: 'Gambibgo, Bolga', work: 'Bolga Township', dept: 'December' },
      { name: 'Gabriel Azoka', phone: '+233244123117', gender: 'Male', home: 'Sherigu, Bolga', work: 'Bolga CBD', dept: 'December' },
      { name: 'Agnes Akolbire', phone: '+233244123118', gender: 'Female', home: 'Tindonmoligo, Bolga', work: 'Bolga Central Market', dept: 'December' },
      { name: 'Philip Akurugu', phone: '+233244123119', gender: 'Male', home: 'Kalbeo, Bolga', work: 'Bolga Market Square', dept: 'December' },
      { name: 'Grace Amoak', phone: '+233244123120', gender: 'Female', home: 'Bukere, Bolga', work: 'Bolga Regional Office', dept: 'December' },
    ];

    // Get a super admin user to use as registered_by
    const adminResult = await query(
      'SELECT id FROM users WHERE role = $1 LIMIT 1',
      ['super_admin']
    );
    
    if (adminResult.rows.length === 0) {
      return NextResponse.json({ 
        error: 'No super admin user found. Please create a super admin first.' 
      }, { status: 400 });
    }

    const adminId = adminResult.rows[0].id;
    let successCount = 0;
    let skipCount = 0;

    // Insert each member
    for (const member of members) {
      try {
        await query(
          `INSERT INTO registered_people 
           (full_name, phone_number, gender, home_location, work_location, department_name, registered_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [member.name, member.phone, member.gender, member.home, member.work, member.dept, adminId]
        );
        successCount++;
      } catch (error: any) {
        // Skip if already exists
        if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
          skipCount++;
        } else {
          console.error(`Error inserting ${member.name}:`, error.message);
        }
      }
    }

    // Get count by department
    const result = await query(
      `SELECT department_name, COUNT(*) as member_count 
       FROM registered_people 
       GROUP BY department_name 
       ORDER BY department_name`
    );

    return NextResponse.json({ 
      success: true,
      message: `Successfully populated database with ${successCount} members (${skipCount} skipped as duplicates)`,
      departments: result.rows
    });

  } catch (error: any) {
    console.error('Population error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to populate database' 
    }, { status: 500 });
  }
}
