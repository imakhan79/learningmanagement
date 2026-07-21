-- exam_attempts was first created (0002 migration) without `auto_evaluated`; the later
-- "CREATE TABLE IF NOT EXISTS exam_attempts" migration that added it was a no-op since the
-- table already existed, so the column was never actually added. The app writes to it on submit.
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS auto_evaluated boolean DEFAULT false;

-- exam_responses.selected_option_ids was typed uuid[], but the app stores question_bank
-- option array indices (integers), not uuids. Every MCQ / multiple-select answer save fails
-- against the current type. Question options have no ids of their own (they're a jsonb text
-- array), so integer[] is the correct type here.
ALTER TABLE exam_responses DROP COLUMN IF EXISTS selected_option_ids;
ALTER TABLE exam_responses ADD COLUMN selected_option_ids integer[];
