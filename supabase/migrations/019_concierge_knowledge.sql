-- Knowledge base for admin-curated concierge intelligence
CREATE TABLE concierge_knowledge (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category         TEXT NOT NULL CHECK (category IN (
    'trip_recommendation', 'course_review', 'hidden_gem',
    'dining', 'activities', 'travel_tip', 'itinerary',
    'destination_guide', 'influencer_content', 'general'
  )),
  title            TEXT NOT NULL,
  content          TEXT NOT NULL,
  source_url       TEXT,
  source_platform  TEXT CHECK (source_platform IN (
    'instagram', 'tiktok', 'youtube', 'x', 'article', 'personal', 'other'
  )),
  source_author    TEXT,
  destinations     JSONB DEFAULT '[]',
  courses_mentioned JSONB DEFAULT '[]',
  tags             JSONB DEFAULT '[]',
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_knowledge_category     ON concierge_knowledge(category);
CREATE INDEX idx_knowledge_active       ON concierge_knowledge(is_active);
CREATE INDEX idx_knowledge_destinations ON concierge_knowledge USING GIN(destinations);
CREATE INDEX idx_knowledge_courses      ON concierge_knowledge USING GIN(courses_mentioned);
CREATE INDEX idx_knowledge_tags         ON concierge_knowledge USING GIN(tags);
