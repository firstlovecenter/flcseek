import * as XLSX from 'xlsx';
import { GROUPS } from './constants';

/**
 * Generate an Excel template for bulk member registration
 * @returns Blob containing the Excel file
 */
export function generateBulkRegistrationTemplate(): Blob {
  // Create sample data with instructions
  const sampleData = [
    {
      full_name: 'John Doe',
      phone_number: '+233 123 456 789',
      gender: 'Male',
      home_location: 'Accra, Ghana',
      work_location: 'Airport City, Accra',
      group_name: 'January',
    },
    {
      full_name: 'Jane Smith',
      phone_number: '0244567890',
      gender: 'Female',
      home_location: 'Kumasi, Ghana',
      work_location: 'Adum, Kumasi',
      group_name: 'February',
    },
    {
      full_name: 'Sample Member',
      phone_number: '+233 200 000 000',
      gender: 'Male',
      home_location: 'Tema, Ghana',
      work_location: 'Community 1, Tema',
      group_name: 'March',
    },
  ];

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Create main worksheet with sample data
  const ws = XLSX.utils.json_to_sheet(sampleData);

  // Set column widths
  ws['!cols'] = [
    { wch: 25 }, // full_name
    { wch: 20 }, // phone_number
    { wch: 10 }, // gender
    { wch: 30 }, // home_location
    { wch: 30 }, // work_location
    { wch: 15 }, // group_name
  ];

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Members');

  // Create instructions sheet
  const instructions = [
    { Instruction: 'HOW TO USE THIS TEMPLATE' },
    { Instruction: '' },
    { Instruction: '1. Fill in the member details in the "Members" sheet' },
    { Instruction: '2. Delete the sample rows (rows 2-4) before uploading' },
    { Instruction: '3. Required fields: full_name, phone_number, group_name' },
    { Instruction: '4. Optional fields: gender (Male/Female), home_location, work_location' },
    { Instruction: '' },
    { Instruction: 'FIELD SPECIFICATIONS:' },
    { Instruction: '' },
    { Instruction: 'full_name: Full name of the member (e.g., John Doe)' },
    { Instruction: 'phone_number: Phone number with country code (e.g., +233 123 456 789)' },
    { Instruction: 'gender: Male or Female (optional)' },
    { Instruction: 'home_location: Home address or location (optional)' },
    { Instruction: 'work_location: Work address or location (optional)' },
    { Instruction: 'group_name: One of the 12 groups (see Groups sheet)' },
    { Instruction: '' },
    { Instruction: 'IMPORTANT NOTES:' },
    { Instruction: '- Do not change the column headers' },
    { Instruction: '- Each row represents one member' },
    { Instruction: '- Phone numbers must contain only numbers, +, -, spaces, and ()' },
    { Instruction: '- Group names must match exactly (see Groups sheet)' },
    { Instruction: '- Maximum 500 members per upload' },
  ];

  const wsInstructions = XLSX.utils.json_to_sheet(instructions);
  wsInstructions['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

  // Create groups reference sheet
  const groupData = GROUPS.map((group) => ({ Group: group }));
  const wsGroups = XLSX.utils.json_to_sheet(groupData);
  wsGroups['!cols'] = [{ wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsGroups, 'Groups');

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
  full_name: string;
  phone_number: string;
  gender?: string;
  home_location?: string;
  work_location?: string;
  group_name: string;
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
          full_name: row.full_name?.toString().trim() || '',
          phone_number: row.phone_number?.toString().trim() || '',
          gender: row.gender?.toString().trim() || undefined,
          home_location: row.home_location?.toString().trim() || undefined,
          work_location: row.work_location?.toString().trim() || undefined,
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
 * @returns Validation result with errors
 */
export function validateMemberData(members: Array<{
  full_name: string;
  phone_number: string;
  gender?: string;
  home_location?: string;
  work_location?: string;
  group_name: string;
}>): {
  isValid: boolean;
  errors: Array<{ row: number; field: string; message: string }>;
} {
  const errors: Array<{ row: number; field: string; message: string }> = [];

  members.forEach((member, index) => {
    const rowNumber = index + 2; // +2 because row 1 is header

    if (!member.full_name || member.full_name.trim() === '') {
      errors.push({
        row: rowNumber,
        field: 'full_name',
        message: 'Full name is required',
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

    if (!member.group_name || member.group_name.trim() === '') {
      errors.push({
        row: rowNumber,
        field: 'group_name',
        message: 'Group is required',
      });
    } else if (!GROUPS.includes(member.group_name)) {
      errors.push({
        row: rowNumber,
        field: 'group_name',
        message: `Invalid group. Must be one of: ${GROUPS.join(', ')}`,
      });
    }

    if (
      member.gender &&
      member.gender !== 'Male' &&
      member.gender !== 'Female'
    ) {
      errors.push({
        row: rowNumber,
        field: 'gender',
        message: 'Gender must be either "Male" or "Female"',
      });
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}
