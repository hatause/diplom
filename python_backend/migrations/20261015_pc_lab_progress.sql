-- Additive migration. Run once with psql -v ON_ERROR_STOP=1 against the app database.
-- Existing learning data is untouched; Prisma supplies UUIDs and updated_at.
BEGIN;
CREATE TABLE public.pc_lab_progress (
    id TEXT NOT NULL PRIMARY KEY,
    user_id TEXT NOT NULL,
    inspected_parts TEXT[] DEFAULT ARRAY[]::TEXT[],
    inspected_parts_count INTEGER NOT NULL DEFAULT 0,
    assembly_completed BOOLEAN NOT NULL DEFAULT false,
    assembly_mistakes INTEGER NOT NULL DEFAULT 0,
    bios_flashed BOOLEAN NOT NULL DEFAULT false,
    windows_installed BOOLEAN NOT NULL DEFAULT false,
    resolved_faults TEXT[] DEFAULT ARRAY[]::TEXT[],
    system_drive_gb INTEGER NOT NULL DEFAULT 200,
    total_score INTEGER NOT NULL DEFAULT 0,
    revision INTEGER NOT NULL DEFAULT 0,
    resume JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMP(3) NOT NULL,
    completed_at TIMESTAMP(3),
    CONSTRAINT pc_lab_progress_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE UNIQUE INDEX pc_lab_progress_user_id_key ON public.pc_lab_progress(user_id);
COMMIT;
