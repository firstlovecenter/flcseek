import { z } from 'zod'

export const registerConvertSchema = z.object({
  first_name: z.string().min(1, 'Please enter first name'),
  last_name: z.string().min(1, 'Please enter last name'),
  phone_number: z
    .string()
    .min(1, 'Please enter phone number')
    .regex(/^[0-9+\-\s()]+$/, 'Invalid phone number'),
  date_of_birth: z.string().min(1, 'Date of birth is required'),
  gender: z.enum(['Male', 'Female'], { message: 'Please select gender' }),
  residential_location: z
    .string()
    .min(1, 'Please enter residential location'),
  school_residential_location: z.string().optional(),
  occupation_type: z.enum(['Worker', 'Student', 'Unemployed'], {
    message: 'Please select worker or student',
  }),
  group_id: z.string().min(1, 'Please select group'),
})

export type RegisterConvertFormValues = z.infer<typeof registerConvertSchema>
