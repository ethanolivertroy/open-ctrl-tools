export const CONTROL_SEARCH_FUSE_KEYS = [
  { name: 'id', weight: 3 },
  { name: 'title', weight: 2 },
  { name: 'description', weight: 1 },
  { name: 'family', weight: 1.5 },
  { name: 'frameworkId', weight: 0.5 },
] as const;

export const CONTROL_SEARCH_FUSE_OPTIONS = {
  keys: CONTROL_SEARCH_FUSE_KEYS,
  threshold: 0.35,
  includeScore: true,
  minMatchCharLength: 1,
  ignoreLocation: true,
} as const;

export const FRAMEWORK_SEARCH_FUSE_KEYS = [
  { name: 'title', weight: 3 },
  { name: 'frameworkId', weight: 2 },
  { name: 'description', weight: 1 },
  { name: 'tags', weight: 1.5 },
] as const;

export const FRAMEWORK_SEARCH_FUSE_OPTIONS = {
  keys: FRAMEWORK_SEARCH_FUSE_KEYS,
  threshold: 0.35,
  includeScore: true,
} as const;

export const UNIFIED_SEARCH_FUSE_KEYS = [
  { name: 'title', weight: 3 },
  { name: 'id', weight: 3 },
  { name: 'description', weight: 1 },
  { name: 'tags', weight: 1 },
  { name: 'frameworkId', weight: 0.5 },
  { name: 'vendor', weight: 1 },
  { name: 'category', weight: 0.5 },
  { name: 'family', weight: 1 },
] as const;

export const UNIFIED_SEARCH_FUSE_OPTIONS = {
  keys: UNIFIED_SEARCH_FUSE_KEYS,
  threshold: 0.35,
  includeScore: true,
  minMatchCharLength: 1,
  ignoreLocation: true,
} as const;
