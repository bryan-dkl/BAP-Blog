// Central place for the blog's filters.
// Add / rename pillars or post types here — the schema, filters and tags all read from this file.
// (If you change the keys, also update the lists at the top of scripts/new-post.mjs.)

export const PILLARS = {
  development: { label: 'Development', color: '#2f5fd0' },
  ux: { label: 'UX', color: '#0b8a65' },
  design: { label: 'Design', color: '#c4421a' },
} as const;

export const POST_TYPES = {
  experiment: { label: 'Experiment' },
  research: { label: 'Research' },
  feedback: { label: 'Feedback' },
  meeting: { label: 'Meeting' },
  milestone: { label: 'Milestone' },
  reflection: { label: 'Reflection' },
} as const;

export type Pillar = keyof typeof PILLARS;
export type PostType = keyof typeof POST_TYPES;

export const pillarKeys = Object.keys(PILLARS) as [Pillar, ...Pillar[]];
export const postTypeKeys = Object.keys(POST_TYPES) as [PostType, ...PostType[]];
