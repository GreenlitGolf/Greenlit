-- Add updated_at column to course_queue for stuck-processing detection
alter table course_queue
  add column if not exists updated_at timestamptz default now();
