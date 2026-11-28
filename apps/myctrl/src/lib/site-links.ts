/**
 * Outbound links for the project itself, kept in one place so a repository
 * move or a new domain is a one-line change instead of a hunt.
 */

/** The monorepo that myctrl.tools and its sibling tools live in. */
export const REPO_URL = 'https://github.com/ethanolivertroy/open-ctrl-tools';

/** This site's own source inside the monorepo. */
export const SITE_SOURCE_URL = `${REPO_URL}/tree/main/apps/myctrl`;

/**
 * The umbrella project named in the header byline.
 *
 * openctrl.tools is registered but not serving a site yet, so the byline
 * points at the repository until it is. Switch `url` to https://openctrl.tools
 * once the domain is live.
 */
export const PARENT_PROJECT = {
  name: 'openctrl.tools',
  url: REPO_URL,
} as const;
