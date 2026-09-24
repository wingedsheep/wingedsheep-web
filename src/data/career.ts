/**
 * Career milestones, oldest first. Each one becomes a cairn on the mountain trail;
 * the last one sits closest to the summit.
 *
 * TODO(vincent): fill in real roles. LinkedIn blocks scraping, so these are placeholders.
 */
export interface Milestone {
  years: string;
  role: string;
  org: string;
  text: string;
}

export const career: Milestone[] = [];
