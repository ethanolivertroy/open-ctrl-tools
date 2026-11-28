import { afterEach, describe, expect, it, vi } from 'vitest';
import { githubRepoRefUrl, loadGithubRepoCards, parseGithubRepoRef } from '../github-repo-ref';
import { getAllTechnologyGuides } from '@/data/technology-guides';

afterEach(() => vi.unstubAllGlobals());

describe('GitHub repository references', () => {
  it('reads a plain repository', () => {
    const ref = parseGithubRepoRef('okta/okta-cli-client');
    expect(ref).toEqual({ owner: 'okta', repo: 'okta-cli-client' });
    expect(githubRepoRefUrl(ref)).toBe('https://github.com/okta/okta-cli-client');
  });

  it('reads a directory inside a monorepo and links to that directory', () => {
    const ref = parseGithubRepoRef('ethanolivertroy/open-ctrl-tools/auditors/okta-inspector-py');
    expect(ref).toEqual({ owner: 'ethanolivertroy', repo: 'open-ctrl-tools', path: 'auditors/okta-inspector-py' });
    expect(githubRepoRefUrl(ref)).toBe(
      'https://github.com/ethanolivertroy/open-ctrl-tools/tree/HEAD/auditors/okta-inspector-py',
    );
  });

  it('fetches metadata for repositories but not for monorepo directories', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        owner: { login: 'okta' },
        name: 'okta-cli-client',
        description: 'CLI',
        language: 'Go',
        stargazers_count: 12,
        forks_count: 3,
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const cards = await loadGithubRepoCards(['okta/okta-cli-client', 'ethanolivertroy/open-ctrl-tools/tools/nist-cmvp-api']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cards[0]).toMatchObject({ owner: 'okta', repo: 'okta-cli-client', language: 'Go', stars: 12, forks: 3 });
    // Monorepo-wide stars and language would misdescribe one tool in it.
    expect(cards[1]).toEqual({ owner: 'ethanolivertroy', repo: 'open-ctrl-tools', path: 'tools/nist-cmvp-api' });
  });

  it('falls back to a bare card when the lookup fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))));
    await expect(loadGithubRepoCards(['okta/okta-cli-client'])).resolves.toEqual([
      { owner: 'okta', repo: 'okta-cli-client' },
    ]);
    await expect(loadGithubRepoCards(undefined)).resolves.toEqual([]);
  });

  it('no guide still points at the retired standalone repositories', () => {
    const retired = ['ethanolivertroy/myctrl.tools', 'ethanolivertroy/okta-inspector', 'hackIDLE/nist-cmvp-api'];
    const refs = getAllTechnologyGuides().flatMap((guide) => guide.githubRepos ?? []);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(retired).not.toContain(ref);
      const { owner, repo } = parseGithubRepoRef(ref);
      expect(owner).not.toBe('');
      expect(repo).not.toBe('');
    }
  });
});
