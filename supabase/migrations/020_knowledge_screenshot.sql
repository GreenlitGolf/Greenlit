-- Add screenshot URL to knowledge entries
ALTER TABLE concierge_knowledge ADD COLUMN IF NOT EXISTS screenshot_url TEXT;
