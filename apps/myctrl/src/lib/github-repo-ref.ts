/**
 * Guides list related repositories as `owner/repo`, or as `owner/repo/path`
 * for a project that lives in a directory of a monorepo (several of the
 * tools linked from here moved into open-ctrl-tools).
 */

export interface GithubRepoRef {
  owner: string;
  repo: string;
  /** Directory inside the repository, when the project is not the whole repo. */
  path?: string;
}

export interface GithubRepoCardData extends GithubRepoRef {
  description?: string | null;
  language?: string | null;
  stars?: number;
  forks?: number;
}

export function parseGithubRepoRef(ref: string): GithubRepoRef {
  const [owner = '', repo = '', ...rest] = ref.split('/').filter(Boolean);
  return rest.length > 0 ? { owner, repo, path: rest.join('/') } : { owner, repo };
}

export function githubRepoRefUrl({ owner, repo, path }: GithubRepoRef): string {
  const base = `https://github.com/${owner}/${repo}`;
  // HEAD resolves to the default branch, whatever it is called.
  return path ? `${base}/tree/HEAD/${path}` : base;
}

/**
 * Build-time metadata for the repository cards on guide pages. Failures fall
 * back to a bare card rather than failing the build.
 */
export async function loadGithubRepoCards(
  refs: string[] | undefined,
  token?: string,
): Promise<GithubRepoCardData[]> {
  if (!refs) return [];
  return Promise.all(
    refs.map(async (value) => {
      const ref = parseGithubRepoRef(value);
      // Stars and language describe a whole repository. For one directory of
      // a monorepo they would be the wrong numbers, so the card stays plain.
      if (ref.path) return ref;
      try {
        const res = await fetch(`https://api.github.com/repos/${ref.owner}/${ref.repo}`, {
          headers: token ? { Authorization: `token ${token}` } : {},
        });
        if (!res.ok) return ref;
        const data = await res.json();
        return {
          owner: data.owner.login,
          repo: data.name,
          description: data.description,
          language: data.language,
          stars: data.stargazers_count,
          forks: data.forks_count,
        };
      } catch {
        return ref;
      }
    }),
  );
}
