import * as XLSX from 'xlsx';

/**
 * Generate an Excel template for bulk member registration
 * @param groups - Array of group names to include in the template
 * @returns Blob containing the Excel file
 */
export function generateBulkRegistrationTemplate(groups: string[] = []): Blob {
  // Create sample data with instructions
  const sampleData = [
    {
      first_name: 'John',
      last_name: 'Doe',
      phone_number: '+233 123 456 789',
      date_of_birth: '15-03',
      gender: 'Male',
      residential_location: 'Accra, Ghana',
      school_residential_location: '',
      occupation_type: 'Worker',
    },
    {
      first_name: 'Jane',
      last_name: 'Smith',
      phone_number: '0244567890',
      date_of_birth: '22-08',
      gender: 'Female',
      residential_location: 'Kumasi, Ghana',
      school_residential_location: 'KNUST Campus',
      occupation_type: 'Student',
    },
    {
      first_name: 'Samuel',
      last_name: 'Mensah',
      phone_number: '+233 200 000 000',
      date_of_birth: '10-12',
      gender: 'Male',
      residential_location: 'Tema, Ghana',
      school_residential_location: '',
      occupation_type: 'Unemployed',
    },
  ];

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Create main worksheet with sample data
  const ws = XLSX.utils.json_to_sheet(sampleData);

  // Set column widths
  ws['!cols'] = [
    { wch: 15 }, // first_name
    { wch: 15 }, // last_name
    { wch: 20 }, // phone_number
    { wch: 12 }, // date_of_birth
    { wch: 10 }, // gender
    { wch: 30 }, // residential_location
    { wch: 30 }, // school_residential_location
    { wch: 15 }, // occupation_type
  ];

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Members');

  // Create instructions sheet
  const instructions = [
    { Instruction: 'HOW TO USE THIS TEMPLATE' },
    { Instruction: '' },
    { Instruction: '1. Fill in the convert details in the "Members" sheet' },
    { Instruction: '2. Delete the sample rows (rows 2-4) before uploading' },
    { Instruction: '3. Required fields: first_name, last_name, phone_number, date_of_birth, gender, residential_location, occupation_type' },
    { Instruction: '4. Optional fields: school_residential_location (only for students)' },
    { Instruction: '5. Group will be automatically assigned based on your account' },
    { Instruction: '' },
    { Instruction: 'FIELD SPECIFICATIONS:' },
    { Instruction: '' },
    { Instruction: 'first_name: First name of the convert (e.g., John)' },
    { Instruction: 'last_name: Last name of the convert (e.g., Doe)' },
    { Instruction: 'phone_number: Phone number with country code (e.g., +233 123 456 789)' },
    { Instruction: 'date_of_birth: Birth date WITHOUT year in DD-MM format (e.g., 15-03 for March 15)' },
    { Instruction: 'gender: Male or Female (required)' },
    { Instruction: 'residential_location: Primary home address or location (required)' },
    { Instruction: 'school_residential_location: School address if student (optional)' },
    { Instruction: 'occupation_type: Worker, Student, or Unemployed (required)' },
    { Instruction: '' },
    { Instruction: 'IMPORTANT NOTES:' },
    { Instruction: '- Do not change the column headers' },
    { Instruction: '- Each row represents one convert' },
    { Instruction: '- Phone numbers must contain only numbers, +, -, spaces, and ()' },
    { Instruction: '- Date of birth must be in DD-MM format (e.g., 25-12, 01-01)' },
    { Instruction: '- Gender must be exactly "Male" or "Female"' },
    { Instruction: '- Occupation type must be exactly "Worker", "Student", or "Unemployed"' },
    { Instruction: '- Group will be automatically set to your assigned group' },
    { Instruction: '- School residential location is only needed for students' },
    { Instruction: '- Maximum 500 converts per upload' },
  ];

  const wsInstructions = XLSX.utils.json_to_sheet(instructions);
  wsInstructions['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

  // Write to buffer
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

  // Return as Blob
  return new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Parse uploaded Excel file and extract member data
 * @param file - Excel file from input
 * @returns Array of member data
 */
export async function parseExcelFile(
  file: File
): Promise<Array<{
  first_name: string;
  last_name: string;
  phone_number: string;
  date_of_birth: string;
  gender: string;
  residential_location: string;
  school_residential_location?: string;
  occupation_type: string;
  group_name?: string;
}>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Get first sheet
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);

        // Map to expected format
        const members = jsonData.map((row: any) => ({
          first_name: row.first_name?.toString().trim() || '',
          last_name: row.last_name?.toString().trim() || '',
          phone_number: row.phone_number?.toString().trim() || '',
          date_of_birth: row.date_of_birth?.toString().trim() || '',
          gender: row.gender?.toString().trim() || '',
          residential_location: row.residential_location?.toString().trim() || '',
          school_residential_location: row.school_residential_location?.toString().trim() || undefined,
          occupation_type: row.occupation_type?.toString().trim() || '',
          group_name: row.group_name?.toString().trim() || '',
        }));

        resolve(members);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Validate member data before upload
 * @param members - Array of member data
 * @param groups - Array of valid group names
 * @returns Validation result with errors
 */
export function validateMemberData(members: Array<{
  first_name: string;
  last_name: string;
  phone_number: string;
  date_of_birth: string;
  gender: string;
  residential_location: string;
  school_residential_location?: string;
  occupation_type: string;
  group_name?: string;
}>, groups: string[] = []): {
  isValid: boolean;
  errors: Array<{ row: number; field: string; message: string }>;
} {
  const errors: Array<{ row: number; field: string; message: string }> = [];

  members.forEach((member, index) => {
    const rowNumber = index + 2; // +2 because row 1 is header

    if (!member.first_name || member.first_name.trim() === '') {
      errors.push({
        row: rowNumber,
        field: 'first_name',
        message: 'First name is required',
      });
    }

    if (!member.last_name || member.last_name.trim() === '') {
      errors.push({
        row: rowNumber,
        field: 'last_name',
        message: 'Last name is required',
      });
    }

    if (!member.phone_number || member.phone_number.trim() === '') {
      errors.push({
        row: rowNumber,
        field: 'phone_number',
        message: 'Phone number is required',
      });
    } else if (!/^[0-9+\-\s()]+$/.test(member.phone_number)) {
      errors.push({
        row: rowNumber,
        field: 'phone_number',
        message: 'Invalid phone number format',
      });
    }

    // Validate date_of_birth (DD-MM format)
    if (!member.date_of_birth || member.date_of_birth.trim() === '') {
      errors.push({
        row: rowNumber,
        field: 'date_of_birth',
        message: 'Date of birth is required',
      });
    } else if (!/^\d{2}-\d{2}$/.test(member.date_of_birth)) {
      errors.push({
        row: rowNumber,
        field: 'date_of_birth',
        message: 'Date of birth must be in DD-MM format (e.g., 15-03)',
      });
    } else {
      // Validate day and month ranges
      const [day, month] = member.date_of_birth.split('-').map(Number);
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

    // Validate gender (required)
    if (!member.gender || member.gender.trim() === '') {
      errors.push({
        row: rowNumber,
        field: 'gender',
        message: 'Gender is required',
      });
    } else if (member.gender !== 'Male' && member.gender !== 'Female') {
      errors.push({
        row: rowNumber,
        field: 'gender',
        message: 'Gender must be either "Male" or "Female"',
      });
    }

    // Validate residential_location (required)
    if (!member.residential_location || member.residential_location.trim() === '') {
      errors.push({
        row: rowNumber,
        field: 'residential_location',
        message: 'Residential location is required',
      });
    }

    // Validate occupation_type (required)
    if (!member.occupation_type || member.occupation_type.trim() === '') {
      errors.push({
        row: rowNumber,
        field: 'occupation_type',
        message: 'Occupation type is required',
      });
    } else if (member.occupation_type !== 'Worker' && member.occupation_type !== 'Student' && member.occupation_type !== 'Unemployed') {
      errors.push({
        row: rowNumber,
        field: 'occupation_type',
        message: 'Occupation type must be "Worker", "Student", or "Unemployed"',
      });
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}
