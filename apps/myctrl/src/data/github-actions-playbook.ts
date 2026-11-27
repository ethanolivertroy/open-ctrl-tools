import type {
  AuthoritativeSource,
  ControlMapping,
  TechCommand,
  TechnologyGuidePlaybook,
  TechnologyGuideTool,
} from './types';

const GH_REPO_WORKFLOW_PERMISSIONS: TechCommand = {
  description: 'Check the repository default workflow token policy.',
  command: `gh api repos/{owner}/{repo}/actions/permissions/workflow \\
  --jq '{default_workflow_permissions, can_approve_pull_request_reviews}'`,
  type: 'cli',
  group: 'Repo baseline',
  scope: 'repo',
  notes: 'Requires repo admin or a token with repository administration rights.',
};

const GH_REPO_ALLOWED_ACTIONS: TechCommand = {
  description: 'Inspect the repository allowlist for third-party actions and reusable workflows.',
  command: `gh api repos/{owner}/{repo}/actions/permissions/selected-actions`,
  type: 'cli',
  group: 'Repo baseline',
  scope: 'repo',
  notes: 'Only meaningful when the repository policy is set to selected actions rather than all actions.',
};

const GH_BRANCH_PROTECTION: TechCommand = {
  description: 'Review the default branch protection gate for workflow changes and releases.',
  command: `gh api repos/{owner}/{repo}/branches/{branch}/protection \\
  --jq '{required_status_checks, required_pull_request_reviews, enforce_admins, allow_force_pushes, allow_deletions}'`,
  type: 'cli',
  group: 'Repo baseline',
  scope: 'repo',
  notes: 'Use the real default branch name in place of `{branch}`. Pair this with CODEOWNERS on `.github/workflows/`.',
};

const GH_ORG_WORKFLOW_PERMISSIONS: TechCommand = {
  description: 'Read the organization-wide default workflow token policy.',
  command: `gh api orgs/{org}/actions/permissions/workflow \\
  --jq '{default_workflow_permissions, can_approve_pull_request_reviews}'`,
  type: 'cli',
  group: 'Org policy',
  scope: 'org',
  notes: 'Requires organization admin access or an appropriately scoped token.',
};

const GH_ORG_ALLOWED_ACTIONS: TechCommand = {
  description: 'Read the organization-wide Actions allowlist policy.',
  command: `gh api orgs/{org}/actions/permissions/selected-actions`,
  type: 'cli',
  group: 'Org policy',
  scope: 'org',
  notes: 'Use this to confirm whether GitHub-owned actions, verified creators, and explicit patterns are allowed.',
};

const GH_ORG_SELF_HOSTED_POLICY: TechCommand = {
  description: 'Read the organization self-hosted runner policy.',
  command: `gh api orgs/{org}/actions/permissions/self-hosted-runners`,
  type: 'cli',
  group: 'Runner posture',
  scope: 'org',
  notes: 'Confirms whether self-hosted runners are disabled, allowed for all repositories, or limited to selected repositories.',
};

const GH_ORG_SELF_HOSTED_REPOSITORIES: TechCommand = {
  description: 'List repositories that are allowed to use organization self-hosted runners.',
  command: `gh api orgs/{org}/actions/permissions/self-hosted-runners/repositories \\
  --jq '.repositories[].full_name'`,
  type: 'cli',
  group: 'Runner posture',
  scope: 'org',
  notes: 'Useful when your runner policy is set to selected repositories and you want to verify the actual allowlist.',
};

const GH_LOCAL_RISKY_PATTERNS: TechCommand = {
  description: 'Search workflow files for common high-risk patterns in one pass.',
  command: `rg -n "pull_request_target|workflow_run|secrets:\\s*inherit|toJson\\(secrets\\)|GITHUB_ENV|GITHUB_PATH" .github/workflows/`,
  type: 'query',
  group: 'Workflow inspection',
  scope: 'local',
  notes: 'Fast first-pass grep for the exact trigger and secret-handling patterns discussed on this page.',
};

const GH_LOCAL_SELF_HOSTED_USAGE: TechCommand = {
  description: 'Find workflow jobs that target self-hosted runners.',
  command: `rg -n "self-hosted" .github/workflows/`,
  type: 'query',
  group: 'Workflow inspection',
  scope: 'local',
  notes: 'Review every hit and make sure it is isolated by trust level, repository scope, and runner lifecycle.',
};

const GH_ZIZMOR: TechCommand = {
  description: 'Run a GitHub Actions-focused security audit across the repository.',
  command: 'zizmor .',
  type: 'cli',
  group: 'Static analysis',
  scope: 'local',
  notes: 'Per zizmor quickstart, pointing it at the repository root collects workflows from `.github/workflows/` automatically.',
};

const GH_ACTIONLINT: TechCommand = {
  description: 'Run syntax, expression, and workflow wiring checks locally.',
  command: 'actionlint',
  type: 'cli',
  group: 'Static analysis',
  scope: 'local',
  notes: 'Installs cleanly via Homebrew on macOS (`brew install actionlint`). Install `shellcheck` and `pyflakes` too if you want its script integrations.',
};

export const GITHUB_ACTIONS_COMMANDS: TechCommand[] = [
  GH_REPO_WORKFLOW_PERMISSIONS,
  GH_REPO_ALLOWED_ACTIONS,
  GH_BRANCH_PROTECTION,
  GH_ORG_WORKFLOW_PERMISSIONS,
  GH_ORG_ALLOWED_ACTIONS,
  GH_ORG_SELF_HOSTED_POLICY,
  GH_ORG_SELF_HOSTED_REPOSITORIES,
  GH_LOCAL_RISKY_PATTERNS,
  GH_LOCAL_SELF_HOSTED_USAGE,
  GH_ZIZMOR,
  GH_ACTIONLINT,
];

export const GITHUB_ACTIONS_TOOLS: TechnologyGuideTool[] = [
  {
    id: 'zizmor',
    name: 'zizmor',
    repo: 'https://github.com/zizmorcore/zizmor',
    summary: 'Security-focused static analysis for GitHub Actions with dedicated audits for dangerous triggers, secret misuse, and permission problems.',
    quickCommand: 'zizmor .',
    notes: 'The official quickstart documents running it directly against a repository root or specific workflow files.',
  },
  {
    id: 'actionlint',
    name: 'actionlint',
    repo: 'https://github.com/rhysd/actionlint',
    summary: 'Fast static checker for workflow syntax, expressions, runner labels, reusable workflow wiring, and script injection footguns.',
    quickCommand: 'actionlint',
    notes: 'Use it to catch broken workflow syntax and wiring before you focus on deeper security review.',
  },
  {
    id: 'allstar',
    name: 'OpenSSF Allstar',
    repo: 'https://github.com/ossf/allstar',
    summary: 'GitHub App for continuously enforcing org- and repo-level policy baselines such as branch protection and restricted Actions usage.',
    notes: 'Best for organizations that want policy drift detection rather than one-off review commands.',
  },
  {
    id: 'harden-runner',
    name: 'StepSecurity Harden-Runner',
    repo: 'https://github.com/step-security/harden-runner',
    summary: 'Runner-side monitoring and egress control for GitHub Actions jobs, useful when you need more visibility into workflow runtime behavior.',
    notes: 'Use after you understand your legitimate outbound dependencies. It is most helpful for sensitive workflows and self-hosted or privileged jobs.',
  },
];

export const GITHUB_ACTIONS_SOURCES: AuthoritativeSource[] = [
  {
    id: 'github-security-hardening',
    type: 'vendor',
    title: 'GitHub Docs: Security hardening for GitHub Actions',
    url: 'https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions',
    summary: 'Primary reference for hardening guidance on untrusted pull requests, token permissions, CODEOWNERS for workflow changes, OpenID Connect, and runner risk. Use this for the supported GitHub configuration model and current platform guidance.',
  },
  {
    id: 'github-rest-actions-permissions',
    type: 'vendor',
    title: 'GitHub REST API: Actions permissions',
    url: 'https://docs.github.com/en/rest/actions/permissions?apiVersion=2022-11-28',
    summary: 'Official API reference for repository and organization Actions policy, including workflow token defaults, allowlisted actions, and self-hosted runner policy endpoints. Use this to verify the commands on this page.',
  },
  {
    id: 'github-oidc',
    type: 'vendor',
    title: 'GitHub Docs: OpenID Connect in Actions',
    url: 'https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect',
    summary: 'Official reference for replacing long-lived cloud secrets with short-lived identity-bound tokens issued through GitHub Actions OpenID Connect.',
  },
  {
    id: 'wiz-github-actions-security',
    type: 'community',
    title: 'Wiz GitHub Actions Security Guide',
    url: 'https://www.wiz.io/blog/github-actions-security-guide',
    summary: 'Practical incident-informed guidance covering poisoned pipeline execution, `toJson(secrets)`, `secrets: inherit`, `GITHUB_ENV`, organization policy, and runner exposure, with examples shaped by recent attacks.',
    additionalUrls: [
      {
        label: 'tj-actions incident analysis',
        url: 'https://www.wiz.io/blog/github-action-tj-actions-changed-files-supply-chain-attack-cve-2025-30066',
      },
    ],
  },
  {
    id: 'owasp-cicd-top-10',
    type: 'owasp',
    title: 'OWASP Top 10 CI/CD Security Risks',
    url: 'https://owasp.org/www-project-top-10-ci-cd-security-risks/',
    summary: 'Supporting reference for CI/CD risk categories and terminology. Use it as background context alongside the implementation guidance on this page.',
  },
];

export const GITHUB_ACTIONS_CONTROL_MAPPINGS: ControlMapping[] = [
  { frameworkId: 'nist-800-53-r5', controlIds: ['CM-3', 'CM-5', 'SA-10', 'SA-11', 'SI-7'] },
  { frameworkId: 'fedramp-rev5', controlIds: ['CM-3', 'CM-5', 'SA-10', 'SA-11', 'SI-7'] },
  { frameworkId: 'cis-controls-v8', controlIds: ['2.5', '2.6', '4.1', '16.1', '16.4'] },
];

export const GITHUB_ACTIONS_PLAYBOOK: TechnologyGuidePlaybook = {
  intro: 'Focused guidance for hardening GitHub Actions. Start with baseline policy, then review third-party actions, untrusted pull request handling, secrets flow, runner exposure, and cloud authentication. The emphasis is safe defaults, working examples, and verification steps that teams can use in live repositories.',
  sections: [
    {
      id: 'baseline-guardrails',
      title: 'Baseline Guardrails',
      priority: 'critical',
      summary: 'Treat Actions as a privileged execution platform, not just CI plumbing. Set secure org and repo defaults first so every new workflow starts from a safer baseline.',
      actions: [
        'Set the default `GITHUB_TOKEN` permission to read-only at the organization and repository layers.',
        'Restrict Actions usage to GitHub-owned actions, verified creators, and a small explicit allowlist.',
        'Protect `.github/workflows/`, `.github/actions/`, and `.github/dependabot.yml` with CODEOWNERS plus required reviews.',
        'Require branch protection on the default branch, including stale review dismissal and CODEOWNER approval.',
      ],
      examples: [
        {
          title: 'GOOD: Locked-Down CI Baseline',
          comparisonTitle: 'Workflow Baseline Permissions',
          language: 'yaml',
          code: `name: ci
on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read
  pull-requests: read

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@8ade135a41bc03ea155e62e844d188df1ea18608
      - run: npm ci
      - run: npm test`,
          source: 'GitHub Docs - security hardening and least privilege',
          discussion: 'Use explicit top-level permissions instead of inheriting broad defaults. Start with read-only and grant additional scopes only to the single workflow that needs them.',
        },
        {
          title: 'GOOD: CODEOWNERS for Workflow Changes',
          comparisonTitle: 'Workflow Review Ownership',
          language: 'text',
          code: `/.github/workflows/ @org/security-team @org/platform-team
/.github/actions/ @org/platform-team
/.github/dependabot.yml @org/security-team`,
          source: 'GitHub Docs - CODEOWNERS for monitoring workflow changes',
          discussion: 'Pair CODEOWNERS with branch protection that requires CODEOWNER approval. Without the branch protection gate, CODEOWNERS alone is advisory.',
        },
      ],
      commands: [
        GH_REPO_WORKFLOW_PERMISSIONS,
        GH_REPO_ALLOWED_ACTIONS,
        GH_BRANCH_PROTECTION,
        GH_ORG_WORKFLOW_PERMISSIONS,
      ],
      sourceIds: ['github-security-hardening', 'github-rest-actions-permissions'],
      toolIds: ['allstar'],
    },
    {
      id: 'third-party-actions-and-reusable-workflows',
      title: 'Third-Party Actions and Reusable Workflows',
      priority: 'high',
      summary: 'Every external action or reusable workflow is part of your build supply chain. Pin what you run, minimize what you allow, and avoid passing broad secret sets downstream.',
      actions: [
        'Pin third-party actions to a full commit SHA instead of a mutable tag or branch.',
        'Keep your allowlist small and tied to publishers you are actually willing to trust.',
        'For reusable workflows, pass only the specific secrets the callee needs.',
        'Treat reusable workflows as code dependencies that need review, versioning, and ownership.',
      ],
      examples: [
        {
          title: 'GOOD: Pin Actions to Commit SHA',
          comparisonTitle: 'Action Version Pinning',
          language: 'yaml',
          code: `# BAD: Mutable action reference
- uses: actions/checkout@v4

# GOOD: Immutable commit SHA
- uses: actions/checkout@8ade135a41bc03ea155e62e844d188df1ea18608`,
          source: 'GitHub Docs - pinning actions to a full-length commit SHA',
          discussion: 'GitHub\'s own hardening guide calls a full-length commit SHA the immutable option. Keep the readable tag in a code comment or changelog, not as the executable reference.',
        },
        {
          title: 'BAD: secrets: inherit Overexposure (AVOID)',
          comparisonTitle: 'Reusable Workflow Secret Scope',
          language: 'yaml',
          code: `# BAD: Passes every caller secret to the reusable workflow
jobs:
  deploy:
    uses: org/shared-workflows/.github/workflows/deploy.yml@v1
    secrets: inherit

# GOOD: Pass only what the reusable workflow actually needs
jobs:
  deploy:
    uses: org/shared-workflows/.github/workflows/deploy.yml@v1
    secrets:
      DEPLOY_TOKEN: \${{ secrets.DEPLOY_TOKEN }}
      REGISTRY_URL: \${{ secrets.REGISTRY_URL }}`,
          source: 'Wiz - reusable workflow secret handling',
          discussion: 'Wiz explicitly calls out `secrets: inherit` as an overexposure pattern. Keep the callee interface narrow and review it like any other dependency surface.',
        },
      ],
      commands: [
        GH_REPO_ALLOWED_ACTIONS,
        GH_ZIZMOR,
      ],
      sourceIds: ['github-security-hardening', 'wiz-github-actions-security', 'github-rest-actions-permissions'],
      toolIds: ['zizmor', 'allstar'],
    },
    {
      id: 'untrusted-prs-and-poisoned-pipeline-execution',
      title: 'Untrusted PRs and Poisoned Pipeline Execution',
      priority: 'critical',
      summary: 'Most publicized GitHub Actions compromises come from running attacker-controlled code in a privileged workflow context. Separate untrusted CI from privileged automation and avoid dangerous trigger combinations.',
      actions: [
        'Default to `pull_request` for external contributions and keep that workflow read-only.',
        'Avoid `pull_request_target` unless the job genuinely needs privileged context.',
        'Never check out or execute fork-controlled code from a privileged trigger.',
        'Treat `workflow_run` artifacts and outputs as untrusted inputs unless you can prove otherwise.',
      ],
      examples: [
        {
          title: 'BAD: Pwn Request via pull_request_target (AVOID)',
          comparisonTitle: 'Pull Request Trigger Selection',
          language: 'yaml',
          code: `# BAD: Privileged trigger plus checkout of attacker-controlled code
on: pull_request_target
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ github.event.pull_request.head.sha }}
      - run: npm install && npm test

# GOOD: Use the sandboxed pull_request trigger for untrusted PR code
on: pull_request
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@8ade135a41bc03ea155e62e844d188df1ea18608
      - run: npm ci
      - run: npm test`,
          source: 'Wiz and GitHub Docs - PPE and privileged trigger misuse',
          discussion: 'GitHub explicitly warns that `pull_request_target` and `workflow_run` become dangerous when they process untrusted code or artifacts. Keep untrusted build/test work in a low-privilege workflow.',
        },
      ],
      commands: [
        GH_LOCAL_RISKY_PATTERNS,
        GH_ZIZMOR,
        GH_ACTIONLINT,
      ],
      sourceIds: ['github-security-hardening', 'wiz-github-actions-security'],
      toolIds: ['zizmor', 'actionlint'],
    },
    {
      id: 'secrets-and-environment-handling',
      title: 'Secrets and Environment Handling',
      priority: 'critical',
      summary: 'Credential blast radius in Actions is usually self-inflicted. Keep secret scope narrow, avoid unsafe env propagation, and mask any value generated at runtime before it reaches a log.',
      actions: [
        'Do not dump the entire `secrets` context into a job or step.',
        'Avoid `secrets: inherit` unless the callee truly needs every caller secret.',
        'Do not write untrusted input to `GITHUB_ENV` or `GITHUB_PATH`.',
        'Use step-scoped `env` values and call `::add-mask::` for derived secrets before logging anything that touches them.',
      ],
      examples: [
        {
          title: 'BAD: toJson(secrets) Antipattern (AVOID)',
          comparisonTitle: 'Workflow Secret Passing',
          language: 'yaml',
          code: `# BAD: Dumps every repository secret into one environment variable
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - env:
          ALL_SECRETS: \${{ toJson(secrets) }}
        run: ./deploy.sh

# GOOD: Pass only the secrets this step needs
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - env:
          DEPLOY_TOKEN: \${{ secrets.DEPLOY_TOKEN }}
          REGISTRY_TOKEN: \${{ secrets.REGISTRY_TOKEN }}
        run: ./deploy.sh`,
          source: 'Wiz - secret passing anti-patterns',
          discussion: 'This is one of the clearest examples in the Wiz guide and one of the easiest fixes to make today.',
        },
        {
          title: 'BAD: GITHUB_ENV Injection (AVOID)',
          comparisonTitle: 'Workflow Environment Variable Handling',
          language: 'yaml',
          code: `# BAD: Writes untrusted input into a shared workflow environment file
- name: Capture branch
  run: echo "BRANCH=\${{ github.head_ref }}" >> "$GITHUB_ENV"

# GOOD: Keep untrusted values step-scoped and validate before use
- name: Process branch
  env:
    BRANCH: \${{ github.head_ref }}
  run: |
    if [[ "$BRANCH" =~ ^[a-zA-Z0-9/_-]+$ ]]; then
      echo "Safe branch name: $BRANCH"
    fi`,
          source: 'Wiz - GITHUB_ENV and GITHUB_PATH handling',
          discussion: 'Step-scoped `env` avoids poisoning later steps. Validation matters because "step-scoped" is still not the same thing as "trusted."',
        },
        {
          title: 'GOOD: Mask Runtime-Derived Secrets',
          comparisonTitle: 'Runtime Secret Masking',
          language: 'yaml',
          code: `- name: Mint short-lived token
  run: |
    TOKEN="$(./scripts/mint-token.sh)"
    echo "::add-mask::$TOKEN"
    echo "token_ready=true" >> "$GITHUB_OUTPUT"`,
          source: 'GitHub Docs - secret redaction behavior',
          discussion: 'GitHub redacts registered secrets and masked values, but only after the runner knows about them. Mask runtime-derived credentials before any debug or error output can leak them.',
        },
      ],
      commands: [
        GH_LOCAL_RISKY_PATTERNS,
        GH_ZIZMOR,
      ],
      sourceIds: ['github-security-hardening', 'wiz-github-actions-security'],
      toolIds: ['zizmor'],
    },
    {
      id: 'runner-strategy-and-isolation',
      title: 'Runner Strategy and Isolation',
      priority: 'high',
      summary: 'GitHub-hosted runners are the safer default because they are ephemeral and isolated. Self-hosted runners need strong repo scoping, trust separation, and lifecycle controls or they become a durable foothold.',
      actions: [
        'Use GitHub-hosted runners by default, especially for public repositories.',
        'Do not expose self-hosted runners to public repository pull requests.',
        'Limit self-hosted runner use to selected repositories and segregate them by trust level.',
        'Prefer JIT or otherwise ephemeral runner infrastructure, and assume the underlying host is sensitive infrastructure.',
      ],
      examples: [
        {
          title: 'BAD: Self-Hosted Runners on Public Repos (AVOID)',
          comparisonTitle: 'Runner Exposure Model',
          language: 'yaml',
          code: `# BAD: Public pull requests can execute on infrastructure you manage
on: pull_request
jobs:
  build:
    runs-on: [self-hosted]

# GOOD: Keep untrusted PR workloads on GitHub-hosted runners
on: pull_request
jobs:
  build:
    runs-on: ubuntu-latest`,
          source: 'GitHub Docs and Wiz - self-hosted runner risk',
          discussion: 'GitHub states that self-hosted runners should almost never be used for public repositories. Even private repositories need careful trust-boundary analysis.',
        },
        {
          title: 'GOOD: Restrict Self-Hosted Runner Use to Selected Repositories',
          comparisonTitle: 'Organization Runner Policy',
          language: 'json',
          code: `{
  "enabled_repositories": "selected"
}`,
          source: 'GitHub REST API - self-hosted runner policy',
          discussion: 'This is the policy body for the organization self-hosted runner setting. Follow it by managing the repository allowlist through the matching REST endpoints.',
        },
      ],
      commands: [
        GH_LOCAL_SELF_HOSTED_USAGE,
        GH_ORG_SELF_HOSTED_POLICY,
        GH_ORG_SELF_HOSTED_REPOSITORIES,
      ],
      sourceIds: ['github-security-hardening', 'github-rest-actions-permissions', 'wiz-github-actions-security'],
      toolIds: ['harden-runner', 'allstar'],
    },
    {
      id: 'cloud-auth-and-provenance',
      title: 'Cloud Auth and Provenance',
      priority: 'medium',
      summary: 'Long-lived cloud secrets in GitHub Actions are a liability. Prefer OpenID Connect for deployment auth, and add artifact attestation or provenance where your release flow needs stronger supply-chain integrity signals.',
      actions: [
        'Use OpenID Connect instead of static cloud credentials wherever your provider supports it.',
        'Grant `id-token: write` only to workflows that actually mint OIDC tokens.',
        'Keep deployment workflows separate from untrusted PR execution paths.',
        'Add build provenance or artifact attestations to release workflows that publish software externally.',
      ],
      examples: [
        {
          title: 'GOOD: OpenID Connect for Cloud Auth',
          comparisonTitle: 'Cloud Authentication Strategy',
          language: 'yaml',
          code: `# BAD: Long-lived cloud credentials in repository secrets
env:
  AWS_ACCESS_KEY_ID: \${{ secrets.AWS_ACCESS_KEY_ID }}
  AWS_SECRET_ACCESS_KEY: \${{ secrets.AWS_SECRET_ACCESS_KEY }}

# GOOD: Short-lived cloud auth with GitHub OIDC
permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-actions-deploy
          aws-region: us-east-1`,
          source: 'GitHub Docs - OpenID Connect',
          discussion: 'The permission and workflow structure are correct; pin the action to a commit SHA when you operationalize it in a production repository.',
        },
        {
          title: 'GOOD: Build Provenance for Releases',
          comparisonTitle: 'Artifact Provenance',
          language: 'yaml',
          code: `name: release
on:
  push:
    tags:
      - 'v*'

permissions:
  contents: read
  id-token: write
  attestations: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@8ade135a41bc03ea155e62e844d188df1ea18608
      - run: npm ci
      - run: npm run build
      - uses: actions/attest-build-provenance@v1
        with:
          subject-path: dist/**`,
          source: 'GitHub Docs and NIST-aligned provenance guidance',
          discussion: 'Artifact attestations are most valuable on trusted release paths, not on untrusted PR workflows. Pin the provenance action before production rollout if you adopt this pattern.',
        },
      ],
      commands: [
        GH_LOCAL_RISKY_PATTERNS,
      ],
      sourceIds: ['github-security-hardening', 'github-oidc'],
      toolIds: ['harden-runner'],
    },
  ],
};
