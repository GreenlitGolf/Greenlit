-- Add PDF generation tracking to trips
ALTER TABLE trips ADD COLUMN IF NOT EXISTS report_pdf_url TEXT;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS report_generated_at TIMESTAMPTZ;
