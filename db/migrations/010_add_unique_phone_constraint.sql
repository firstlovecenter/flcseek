-- Add unique constraint to phone_number in registered_people table
-- This ensures each person can only be registered once based on their phone number

ALTER TABLE registered_people 
ADD CONSTRAINT unique_phone_number UNIQUE (phone_number);
