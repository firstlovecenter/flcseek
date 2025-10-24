import { NextResponse } from 'next/server';
import { query } from '@/lib/neon';
import { verifyToken } from '@/lib/auth';

interface BulkPersonData {
  full_name: string;
  phone_number: string;
  gender?: string;
  home_location?: string;
  work_location?: string;
  group_name: string;
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

      // Validate full_name
      if (!person.full_name || person.full_name.trim() === '') {
        errors.push({
          row: rowNumber,
          field: 'full_name',
          message: 'Full name is required',
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
      `SELECT phone_number, full_name FROM registered_people WHERE phone_number = ANY($1)`,
      [phoneNumbers]
    );

    if (existingPhonesResult.rows.length > 0) {
      return NextResponse.json(
        {
          error: 'Some phone numbers are already registered',
          existing: existingPhonesResult.rows,
        },
        { status: 409 }
      );
    }

    // Insert all valid people
    const inserted = [];
    const failed = [];

    for (const person of validPeople) {
      try {
        const result = await query(
          `INSERT INTO registered_people (full_name, phone_number, gender, home_location, work_location, group_name, registered_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, full_name, phone_number, gender, home_location, work_location, group_name, created_at`,
          [
            person.full_name.trim(),
            person.phone_number.trim(),
            person.gender?.trim() || null,
            person.home_location?.trim() || null,
            person.work_location?.trim() || null,
            person.group_name.trim(),
            user.id,
          ]
        );

        inserted.push(result.rows[0]);

        // Initialize progress stages for the new person
        const personId = result.rows[0].id;
        for (let i = 1; i <= 15; i++) {
          await query(
            `INSERT INTO progress_records (person_id, stage_number, is_completed)
             VALUES ($1, $2, false)`,
            [personId, i]
          );
        }
      } catch (error: any) {
        // Handle unique constraint violation
        let errorMessage = error.message;
        if (error.code === '23505' && error.constraint === 'unique_phone_number') {
          errorMessage = 'Phone number already registered';
        }
        
        failed.push({
          person: person.full_name,
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
