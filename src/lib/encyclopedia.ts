import { isNull, sql } from 'drizzle-orm';
import { flags } from '@/db/schema';

/**
 * The encyclopedia is real flags only. Flags people designed moved to their makers' profiles as
 * posts (see scripts/community/move-custom-flags.ts); their rows stay, marked `moved_to_post_id`,
 * so every list, count, search and pick of flags goes through this.
 */
export const inEncyclopedia = isNull(flags.movedToPostId);

/** The same, for raw SQL that names the table `vexilo_flag`. */
export const inEncyclopediaSql = sql.raw('vexilo_flag.moved_to_post_id IS NULL');
