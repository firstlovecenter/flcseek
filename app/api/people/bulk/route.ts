import { NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';

interface BulkPersonData {
  first_name: string;
  last_name: string;
  phone_number: string;
  date_of_birth: string;
  gender: string;
  residential_location: string;
  school_residential_location?: string;
  occupation_type: string;
  group_name: string;
  // Backward compatibility
  full_name?: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { people } = body as { people: BulkPersonData[] };

    if (!people || !Array.isArray(people) || people.length === 0) {
      return NextResponse.json(
        { error: 'No people data provided' },
        { status: 400 }
      );
    }

    // Validate all rows
    const errors: ValidationError[] = [];
    const validPeople: BulkPersonData[] = [];

    people.forEach((person, index) => {
      const rowNumber = index + 2; // +2 because row 1 is header, index starts at 0

      // Support both new and old field structures
      const firstName = person.first_name || (person.full_name ? person.full_name.split(' ')[0] : '');
      const lastName = person.last_name || (person.full_name ? person.full_name.split(' ').slice(1).join(' ') : '');

      // Validate first_name
      if (!firstName || firstName.trim() === '') {
        errors.push({
          row: rowNumber,
          field: 'first_name',
          message: 'First name is required',
        });
      }

      // Validate last_name
      if (!lastName || lastName.trim() === '') {
        errors.push({
          row: rowNumber,
          field: 'last_name',
          message: 'Last name is required',
        });
      }

      // Validate phone_number
      if (!person.phone_number || person.phone_number.trim() === '') {
        errors.push({
          row: rowNumber,
          field: 'phone_number',
          message: 'Phone number is required',
        });
      } else if (!/^[0-9+\-\s()]+$/.test(person.phone_number)) {
        errors.push({
          row: rowNumber,
          field: 'phone_number',
          message: 'Invalid phone number format',
        });
      }

      // Validate date_of_birth (DD-MM format)
      if (person.date_of_birth) {
        if (!/^\d{2}-\d{2}$/.test(person.date_of_birth)) {
          errors.push({
            row: rowNumber,
            field: 'date_of_birth',
            message: 'Date of birth must be in DD-MM format (e.g., 15-03)',
          });
        } else {
          const [day, month] = person.date_of_birth.split('-').map(Number);
          if (day < 1 || day > 31) {
            errors.push({
              row: rowNumber,
              field: 'date_of_birth',
              message: 'Day must be between 01 and 31',
            });
          }
          if (month < 1 || month > 12) {
            errors.push({
              row: rowNumber,
              field: 'date_of_birth',
              message: 'Month must be between 01 and 12',
            });
          }
        }
      }

      // Validate gender
      if (person.gender && person.gender !== 'Male' && person.gender !== 'Female') {
        errors.push({
          row: rowNumber,
          field: 'gender',
          message: 'Gender must be either "Male" or "Female"',
        });
      }

      // Validate occupation_type
      if (person.occupation_type && person.occupation_type !== 'Worker' && person.occupation_type !== 'Student' && person.occupation_type !== 'Unemployed') {
        errors.push({
          row: rowNumber,
          field: 'occupation_type',
          message: 'Occupation type must be "Worker", "Student", or "Unemployed"',
        });
      }

      // Validate group_name
      if (!person.group_name || person.group_name.trim() === '') {
        errors.push({
          row: rowNumber,
          field: 'group_name',
          message: 'Group is required',
        });
      }

      // If no errors for this row, add to valid people
      if (!errors.some(e => e.row === rowNumber)) {
        validPeople.push(person);
      }
    });

    // If there are validation errors, return them
    if (errors.length > 0) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          errors,
          validCount: validPeople.length,
          totalCount: people.length,
        },
        { status: 400 }
      );
    }

    // Check for duplicate phone numbers in the batch
    const phoneNumbers = validPeople.map(p => p.phone_number.trim());
    const duplicatesInBatch = phoneNumbers.filter((phone, index) => 
      phoneNumbers.indexOf(phone) !== index
    );

    if (duplicatesInBatch.length > 0) {
      return NextResponse.json(
        {
          error: 'Duplicate phone numbers found in upload',
          duplicates: Array.from(new Set(duplicatesInBatch)),
        },
        { status: 400 }
      );
    }

    // Check for existing phone numbers in database
    const existingPhonesResult = await query(
      `SELECT phone_number, first_name, last_name FROM new_converts WHERE phone_number = ANY($1)`,
      [phoneNumbers]
    );

    if (existingPhonesResult.rows.length > 0) {
      const existing = existingPhonesResult.rows.map(row => ({
        phone_number: row.phone_number,
        name: `${row.first_name} ${row.last_name}`
      }));
      return NextResponse.json(
        {
          error: 'Some phone numbers are already registered',
          existing,
        },
        { status: 409 }
      );
    }

    // Insert all valid people
    const inserted = [];
    const failed = [];

    for (const person of validPeople) {
      try {
        // Support both new and old field structures
        const firstName = person.first_name || (person.full_name ? person.full_name.split(' ')[0] : '');
        const lastName = person.last_name || (person.full_name ? person.full_name.split(' ').slice(1).join(' ') : '');

        const result = await query(
          `INSERT INTO new_converts (
            first_name, last_name, phone_number, date_of_birth, gender, 
            residential_location, school_residential_location, occupation_type,
            group_name, registered_by
          )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id, first_name, last_name, phone_number, date_of_birth, gender, 
                     residential_location, school_residential_location, occupation_type, group_name, created_at`,
          [
            firstName.trim(),
            lastName.trim(),
            person.phone_number.trim(),
            person.date_of_birth?.trim() || null,
            person.gender?.trim() || null,
            person.residential_location?.trim() || null,
            person.school_residential_location?.trim() || null,
            person.occupation_type?.trim() || null,
            person.group_name.trim(),
            user.id,
          ]
        );

        inserted.push(result.rows[0]);

        // Initialize progress stages for the new person
        const personId = result.rows[0].id;
        
        // Get all milestones from the database
        const milestonesResult = await query('SELECT stage_number, stage_name FROM milestones ORDER BY stage_number');
        const milestones = milestonesResult.rows;

        // Insert progress records for each milestone
        // First milestone is automatically completed when someone registers
        for (const milestone of milestones) {
          const isFirstMilestone = milestone.stage_number === 1;
          await query(
            `INSERT INTO progress_records (person_id, stage_number, stage_name, is_completed, date_completed, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              personId, 
              milestone.stage_number, 
              milestone.stage_name, 
              isFirstMilestone,  // First milestone is completed by default
              isFirstMilestone ? new Date().toISOString().split('T')[0] : null,  // Set completion date for first milestone
              user.id
            ]
          );
        }
      } catch (error: any) {
        // Handle unique constraint violation
        let errorMessage = error.message;
        if (error.code === '23505' && error.constraint === 'unique_phone_number') {
          errorMessage = 'Phone number already registered';
        }
        
        const firstName = person.first_name || (person.full_name ? person.full_name.split(' ')[0] : '');
        const lastName = person.last_name || (person.full_name ? person.full_name.split(' ').slice(1).join(' ') : '');
        
        failed.push({
          person: `${firstName} ${lastName}`,
          phone: person.phone_number,
          error: errorMessage,
        });
      }
    }

    return NextResponse.json({
      success: true,
      inserted: inserted.length,
      failed: failed.length,
      failedDetails: failed,
      people: inserted,
    });
  } catch (error: any) {
    console.error('Bulk registration error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
