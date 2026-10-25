# `@soryos/github` Agent Operating Guidelines

## Overview
This package provides comprehensive GitHub integration for SoryOS-Code. It enables repository management, commits, pull requests, webhooks, and automatic README generation. Inspired by Vibra Code's GitHub integration but adapted for SoryOS architecture.

## Responsibilities
- Provide `GitHubClient` for low-level GitHub API operations with retries
- Provide `GitHubManager` for high-level operations with SoryOS metadata
- Repository management (create, list, get, delete)
- Branch management (create, list, delete)
- Commit operations (create, list, get)
- File operations (create, update, delete, list)
- Pull request management (create, merge, list)
- Webhook management (create, delete, list)
- Auto README generation with language-specific templates
- Commit message formatting with SoryOS metadata
- Rate limit handling with automatic retries

## Key Files
- `src/index.ts`: Main exports, GitHubManager, READMEGenerator, CommitTemplateGenerator
- `src/client.ts`: GitHubClient with comprehensive API methods
- `src/types.ts`: Type definitions for all GitHub operations

## Architecture
```
GitHubManager
├── GitHubClient (Low-level API)
│   ├── Repository operations
│   ├── Branch operations
│   ├── Commit operations
│   ├── File operations
│   ├── Pull request operations
│   ├── Webhook operations
│   └── Rate limit handling
└── Utilities
    ├── READMEGenerator (12+ templates)
    └── CommitTemplateGenerator (10 types)
```

## Agent Guidelines
- Use `GitHubManager` for high-level operations
- Use `GitHubClient` for low-level API access when needed
- Always handle rate limiting gracefully (client handles retries automatically)
- Always include SoryOS metadata in commits using `formatCommitMessage`
- Generate README files automatically for new repositories
- Use appropriate commit message templates
- Handle errors gracefully and provide user-friendly messages
- Never expose GitHub tokens in logs or error messages

## GitHub Client Features

### Automatic Retries
- Retries on rate limiting (403 responses)
- Respects `x-ratelimit-reset` header
- Exponential backoff for retries
- Configurable retry count (default: 3)

### Error Handling
- Comprehensive error classification
- User-friendly error messages
- Proper HTTP status code handling
- Token validation

### Rate Limit Management
- Automatic rate limit detection
- Smart waiting based on reset time
- Graceful degradation when limits are reached

## README Generation

### Template Types (12 available)
| Type | Description | Status |
|------|-------------|--------|
| `generic` | Generic project template | ✅ |
| `nodejs` | Node.js project template | ✅ |
| `react` | React project template | ✅ |
| `nextjs` | Next.js project template | ✅ |
| `typescript` | TypeScript project template | ✅ |
| `python` | Python project template | ✅ |
| `go` | Go project template | ✅ |
| `rust` | Rust project template | ✅ |
| `java` | Java project template | ✅ |
| `csharp` | C# project template | ✅ |
| `php` | PHP project template | ✅ |
| `ruby` | Ruby project template | ✅ |
| `swift` | Swift project template | ✅ |
| `kotlin` | Kotlin project template | ✅ |

### README Features
- Automatic SoryOS Code branding
- Project description
- Installation instructions
- Usage examples
- Features list
- Dependencies list
- License information
- Contributing guidelines
- Custom content sections

### Example: Auto README Generation
```typescript
import { GitHubManager } from '@soryos/github';

const manager = new GitHubManager({ token: 'your-token' });

// Generate README for a Next.js project
await manager.generateAndCreateREADME(
  'owner',
  'repo',
  {
    projectName: 'My Next.js App',
    description: 'A modern web application',
    template: 'nextjs',
    author: 'SoryOS Team',
    features: ['React 18', 'TypeScript', 'Next.js 14'],
    installation: 'npm install',
    usage: 'npm run dev',
  }
);
```

## Commit Templates

### Commit Types (10 available)
| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat: add user authentication` |
| `fix` | Bug fix | `fix: resolve login redirect issue` |
| `docs` | Documentation | `docs: update README` |
| `style` | Style changes | `style: format code` |
| `refactor` | Code refactor | `refactor: extract user service` |
| `perf` | Performance | `perf: optimize database queries` |
| `test` | Tests | `test: add user login tests` |
| `chore` | Chores | `chore: update dependencies` |
| `revert` | Revert commit | `revert: feat-123` |
| `custom` | Custom template | Custom format |

### SoryOS Metadata in Commits
All commits created through SoryOS include metadata:

```
feat: add user authentication

---
Built with SoryOS Code
Agent: build
Model: gemini-2.5-flash
Provider: google
Session: session-123456
Workspace: workspace-123
Project: my-project
Sandbox: sandbox-123
Env: sandbox
Tools: read_file, write_file, shell_command
Commands: 15
Files: 8
```

## Usage Examples

### Basic Usage
```typescript
import { GitHubClient, createGitHubClient } from '@soryos/github';

// Create client
const client = createGitHubClient('your-github-token', 'your-username');

// Get repository
const repo = await client.getRepository('owner', 'repo');

// List branches
const branches = await client.listBranches('owner', 'repo');

// Create commit
const commit = await client.createCommit('owner', 'repo', {
  message: 'feat: add new feature',
});
```

### High-level Operations
```typescript
import { GitHubManager } from '@soryos/github';

const manager = new GitHubManager({ token: 'your-token' });

// Create repository with README
const result = await manager.createRepositoryWithREADME({
  name: 'my-project',
  description: 'A new project',
  private: false,
  projectName: 'My Project',
  template: 'nodejs',
});

// Get repository status
const status = await manager.getRepositoryStatus('owner', 'repo');
```

### Webhook Management
```typescript
import { GitHubClient } from '@soryos/github';

const client = new GitHubClient({ token: 'your-token' });

// Create webhook
const webhook = await client.createWebhook('owner', 'repo', {
  url: 'https://your-webhook-url.com',
  secret: 'your-secret',
  events: ['push', 'pull_request'],
});

// List webhooks
const webhooks = await client.listWebhooks('owner', 'repo');
```

## API Coverage

### Repositories ✅
- [x] Get repository
- [x] Create repository
- [x] List repositories
- [ ] Update repository
- [ ] Delete repository

### Branches ✅
- [x] Get branch
- [x] List branches
- [x] Create branch
- [x] Delete branch

### Commits ✅
- [x] Get commit
- [x] List commits
- [x] Create commit
- [ ] Get commit status
- [ ] List commit statuses

### Files ✅
- [x] Get file
- [x] Create/update file
- [x] Delete file
- [x] List files in directory

### Pull Requests ✅
- [x] Get pull request
- [x] List pull requests
- [x] Create pull request
- [x] Merge pull request
- [ ] Update pull request
- [ ] Add reviewer to pull request

### Webhooks ✅
- [x] Create webhook
- [x] List webhooks
- [x] Delete webhook
- [ ] Update webhook
- [ ] Get webhook

### Users ✅
- [x] Get authenticated user

### Rate Limits ✅
- [x] Get rate limit status

## Error Handling

The client automatically handles:
- Rate limiting with retries
- Authentication errors
- Network errors
- Invalid request data
- Resource not found

## Security Considerations
- Never log GitHub tokens
- Always use HTTPS
- Validate all inputs
- Handle rate limits gracefully
- Use minimal required permissions

## Rate Limits
- **Authenticated requests**: 5,000 per hour
- **Unauthenticated requests**: 60 per hour
- **Search API**: 30 requests per minute

The client automatically:
- Detects rate limit headers
- Waits for rate limit reset
- Retries failed requests (up to 3 times)

## Best Practices
1. **Always use authenticated requests** (higher rate limits)
2. **Use minimal required scopes** for tokens
3. **Cache responses** when possible
4. **Batch requests** to reduce API calls
5. **Handle errors gracefully** and provide user feedback
6. **Use README templates** for new repositories
7. **Include SoryOS metadata** in commits

## Future Enhancements
- [ ] Repository forks
- [ ] Issues management
- [ ] Pull request reviews
- [ ] Repository collaborators
- [ ] Repository deployments
- [ ] Repository secrets
- [ ] Repository variables
- [ ] Workflow runs
- [ ] GitHub Actions integration
- [ ] GitHub Pages management
- [ ] Repository insights
- [ ] Code scanning
- [ ] Dependabot integration
