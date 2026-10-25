# VIBRA CODE COMPLETE AUDIT REPORT

## Executive Summary

Vibra Code is a production-grade, open-source AI app builder that enables users to describe mobile apps in natural language and have them built automatically in cloud sandboxes with native preview on mobile devices. The system is built by a single developer using Claude Code and represents the first open-source alternative to Vibe Code App, Rork, Lovable, and Bolt.new.

**Key Achievement**: Vibra Code successfully combines Claude Code CLI, E2B cloud sandboxes, Convex real-time database, Inngest background jobs, and native mobile apps (Expo Go) into a cohesive, production-ready system.

---

## 1. ARCHITECTURE OVERVIEW

### 1.1 System Topology

```
┌─────────────────────────────────────────────────────────────────────┐
│                        VIBRA CODE SYSTEM                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │   Mobile     │    │   Backend    │    │    Cloud     │          │
│  │   (iOS)      │◄──►│  (Next.js)   │◄──►│  Services    │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│         │                 │                    │                    │
│         │ Expo Go        │ Next.js 15        │ E2B Sandbox          │
│         │ + Texture      │ + Convex           │ + Claude Code        │
│         │ + IGListKit    │ + Inngest          │ + Cursor Agent       │
│         │                │ + Clerk Auth       │ + Gemini CLI         │
│         │                │                    │                    │
│         └────────────────────────────────────────────────────────────┘
│                                                                         │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow Pipeline

```
User Description (Mobile)
         ↓
   API Call → /api/run-agent
         ↓
   Inngest Queue → vibracode/run.agent
         ↓
   E2B Sandbox Creation
         ↓
   Agent Execution (Claude/Cursor/Gemini)
         ↓
   Real-time Updates (Convex Streaming)
         ↓
   Mobile Preview (Tunnel URL)
         ↓
   User Interaction
```

### 1.3 Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React Native / Expo SDK 54 | Mobile app runtime |
| **Chat UI** | Texture + IGListKit | 60fps native chat |
| **Backend** | Next.js 15 (App Router) | API server |
| **Database** | Convex | Real-time sync, sessions/messages |
| **Job Queue** | Inngest | Background job processing |
| **Sandboxes** | E2B | Cloud code execution |
| **AI Agents** | Claude Code CLI / Cursor Agent / Gemini CLI | Code generation |
| **Auth** | Clerk | Authentication |
| **Payments** | Stripe + RevenueCat | Billing |
| **Mobile Nav** | React Navigation | Stack + bottom tabs |

---

## 2. BACKEND ARCHITECTURE (vibracode-backend/)

### 2.1 Directory Structure

```
vibracode-backend/
├── app/
│   ├── api/                          # API routes (Next.js App Router)
│   │   ├── run-agent/route.ts        # Trigger agent execution
│   │   ├── create-session/route.ts   # Create new session
│   │   ├── session/                  # Session management APIs
│   │   │   ├── [id]/route.ts          # Session operations
│   │   │   ├── resume/route.ts        # Resume existing session
│   │   │   ├── restart-dev-server/route.ts
│   │   │   └── ...
│   │   ├── github/                   # GitHub integration
│   │   │   ├── create-and-push/route.ts
│   │   │   ├── disconnect/route.ts
│   │   │   ├── exchange-token/route.ts
│   │   │   └── ...
│   │   ├── files/                    # File operations
│   │   ├── generate-image/route.ts   # Image generation
│   │   ├── generate-audio/route.ts   # Audio generation
│   │   ├── generate-video/route.ts   # Video generation
│   │   └── ...
│   ├── actions/                      # Server Actions
│   │   └── vibrakit.ts               # Core agent actions
│   ├── session/                      # Session pages
│   │   └── [id]/page.tsx             # Session view
│   └── auth/                         # Authentication
│       └── github/page.tsx           # GitHub OAuth
├── convex/                          # Database layer
│   ├── schema.ts                    # Database schema (users, sessions, messages, etc.)
│   ├── sessions.ts                  # Session queries/mutations
│   ├── messages.ts                  # Message queries/mutations
│   ├── billing.ts                   # Billing logic
│   ├── credits.ts                   # Credit system
│   ├── costs.ts                     # Cost tracking
│   ├── github.ts                    # GitHub credentials
│   ├── files.ts                     # File storage
│   ├── images.ts                    # Image generation
│   ├── audios.ts                    # Audio generation
│   ├── videos.ts                    # Video generation
│   ├── pushNotifications.ts         # Push notifications
│   ├── usage.ts                     # Usage tracking
│   └── _generated/                  # Auto-generated types
├── lib/
│   ├── inngest/                     # Inngest job functions
│   │   ├── client.ts                # Inngest client setup
│   │   ├── middleware.ts            # Shared middleware (retry, OCC handling)
│   │   ├── functions/
│   │   │   ├── create-session.ts    # Session creation job
│   │   │   ├── run-agent.ts         # Agent execution job
│   │   │   ├── push-to-github.ts    # GitHub push job
│   │   │   ├── generate-image.ts    # Image generation job
│   │   │   ├── generate-audio.ts    # Audio generation job
│   │   │   ├── generate-video.ts    # Video generation job
│   │   │   └── steal-app.ts         # App stealing job
│   ├── e2b/                         # E2B integration
│   │   ├── config.ts                # E2B Manager + Sandbox config
│   │   └── ...
│   ├── prompts.ts                   # AI system prompts
│   ├── auth/                        # Authentication utilities
│   │   └── clerk.ts                 # Clerk integration
│   └── api/                         # API utilities
│       └── error-handler.ts         # Error handling
├── e2b-cursor-template/             # E2B Docker template
│   └── Dockerfile                   # Custom sandbox image
└── package.json
```

### 2.2 Core Components

#### API Routes
- **POST /api/run-agent**: Triggers agent execution via Inngest
- **POST /api/create-session**: Creates new session and spawns sandbox
- **POST /api/session/[id]/run**: Runs commands in existing session
- **GET /api/session/[id]**: Retrieves session data
- **POST /api/github/create-and-push**: Pushes code to GitHub
- **POST /api/filesystem/read**: Reads files from sandbox
- **POST /api/filesystem/list**: Lists files in sandbox
- **POST /api/generate-image**: Generates images via AI
- **POST /api/generate-audio**: Generates audio via AI
- **POST /api/generate-video**: Generates video via AI

#### Server Actions
- **runAgentAction**: Main agent execution trigger
- **createSessionAction**: Session creation
- **deleteSessionAction**: Session cleanup
- **createPullRequestAction**: GitHub PR creation

---

## 3. AGENT EXECUTION PIPELINE

### 3.1 Complete Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AGENT EXECUTION PIPELINE                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. USER REQUEST                                                      │
│     ├─ User describes app in mobile chat interface                     │
│     ├─ Mobile app sends POST /api/run-agent                            │
│     └─ Body: { sessionId, id, message, templateId, repository, token }  │
│                                                                         │
│  2. PRE-FLIGHT CHECKS                                                 │
│     ├─ validateRequiredFields (sessionId, id, message)                │
│     ├─ Resolve template from templateId or default to expo             │
│     ├─ Get GitHub token from Clerk if not provided                     │
│     └─ Check billing status (credits/tokens)                           │
│                                                                         │
│  3. INNGEST JOB QUEUE                                                 │
│     ├─ Send event: vibracode/run.agent                                 │
│     ├─ Data: { sessionId, id, message, template, repository, token }    │
│     └─ Concurrency: 25, Retries: 0                                     │
│                                                                         │
│  4. INNGEST FUNCTION: run-agent                                       │
│     ├─ onFailure: Handles timeouts, sandbox errors, general failures  │
│     │   └─ Sends appropriate error message to chat                    │
│     ├─ Step 1: generate code                                          │
│     │   ├─ Get session data from Convex                               │
│     │   ├─ Reset agentStopped flag                                    │
│     │   ├─ Connect to existing E2B sandbox via sessionId                │
│     │   ├─ Update session status to CUSTOM                             │
│     │   ├─ Set up stdout/stderr handlers                               │
│     │   │   ├─ handleStdout: Parse JSON lines, accumulate content       │
│     │   │   │   ├─ Handle message type (user/assistant)                 │
│     │   │   │   ├─ Handle result type (final response)                  │
│     │   │   │   ├─ Handle tool calls (Cursor Agent)                     │
│     │   │   │   └─ Handle old Claude format (backward compat)           │
│     │   │   └─ handleStderr: Log errors, detect critical issues          │
│     │   ├─ Check if first message (for system prompt)                  │
│     │   ├─ Extract file info (images, audios, videos from DB fields)    │
│     │   ├─ Build prompt with system prompt + user message + file info   │
│     │   ├─ Pre-flight billing check (credits/tokens)                    │
│     │   ├─ Build MCP config (Context7, RevenueCat if connected)        │
│     │   ├─ Execute agent based on type (claude/cursor/gemini)           │
│     │   │   ├─ Claude: claude -p --output-format stream-json --verbose │
│     │   │   ├─ Cursor: cursor-agent --api-key --output-format stream-json│
│     │   │   └─ Gemini: gemini --output-format stream-json --yolo       │
│     │   └─ Handle message tracking (cost extraction, credit deduction)│
│     │                                                                  │
│     ├─ Step 2: update session                                          │
│     │   └─ Set status to RUNNING                                       │
│     │                                                                  │
│     └─ Step 3: auto-push to github                                     │
│         ├─ Check if GitHub repo exists                                 │
│         ├─ Check if not already pushing                                  │
│         └─ Trigger vibracode/push.github job                            │
│                                                                         │
│  5. REAL-TIME UPDATES                                                  │
│     ├─ Convex streaming: Messages added via fetchMutation             │
│     │   └─ api.messages.add: Creates message in DB                      │
│     ├─ Session status updates via api.sessions.update                 │
│     └─ Push notifications when app is ready                            │
│                                                                         │
│  6. MOBILE PREVIEW                                                    │
│     ├─ Mobile app listens to Convex changes                            │
│     ├─ Opens WKWebView with tunnel URL                                 │
│     └─ Native preview for mobile projects                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Key Features

#### Streaming JSON Output
- Claude Code CLI outputs newline-delimited JSON
- Each line is a separate JSON object with type field
- Types: `message`, `result`, `init`, `user`, `assistant`, `tool_call`
- Delta streaming: `delta: true` indicates partial content
- Accumulates streaming content and updates messages in real-time

#### Tool Call Handling
- **Cursor Agent**: Uses tool_call with subtype (started/completed)
- **Claude**: Uses message.content[0] with name field
- Supported tools:
  - `TodoWrite`, `Write`, `Edit`, `Read`, `Bash`, `WebSearch`
  - `updateTodosToolCall`, `writeToolCall`, `editToolCall`, `readToolCall`
  - `shellToolCall`, `lsToolCall`, `grepToolCall`, `globToolCall`
  - `semSearchToolCall`, `codebaseSearchToolCall`, `searchReplaceToolCall`
  - MCP tools (dynamic, any tool name)

#### Error Recovery
- **Timeout handling**: Detects FUNCTION_INVOCATION_TIMEOUT, timeout, etc.
- **Sandbox termination**: Detects terminated, [unknown], SandboxError, unavailable
- **onFailure handler**: Runs in NEW execution context, can still send messages
- **User-friendly messages**: Different messages for timeout vs sandbox issues
- **Secret sanitization**: Removes API keys, tokens, Bearer headers from error messages

#### Cost Tracking
- **Token mode**: Consume 1 token per message
- **Credit mode**: Track actual API costs, deduct credits
- **Cost extraction**: Parse stdout for `total_cost_usd` field
- **Fallback cost**: $0.01 if extraction fails
- **Message tracking**: Update message with cost data, deduct credits

---

## 4. E2B SANDBOX INTEGRATION

### 4.1 E2BManager Class

**File**: `vibracode-backend/lib/e2b/config.ts`

**Responsibilities**:
- Sandbox lifecycle management (create, connect, kill, pause, resume)
- Command execution with streaming support
- Agent execution (Claude, Cursor, Gemini)
- File operations (read, write, list)
- Host/port management
- Git operations (init, commit, push)

**Key Methods**:

```typescript
class E2BManager {
  // Lifecycle
  createSandbox(): Promise<Sandbox>
  connectToSandbox(sandboxId: string): Promise<Sandbox>
  kill(): Promise<void>
  pause(): Promise<void>
  resume(): Promise<void>
  
  // Execution
  executeAgent(prompt: string, agentType: 'claude'|'cursor'|'gemini', options): Promise<{stdout, stderr, exitCode}
  executeCommand(command: string, options: {onStdout?, onStderr?, background?, cwd?, envVars?}): Promise<{stdout, stderr, exitCode}
  
  // Files
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  listFiles(path: string): Promise<FileEntry[]>
  
  // Network
  getHost(port: number): Promise<string>
  
  // Git
  initializeGit(): Promise<void>
  commitAndPush(githubToken: string, repository: string, commitMessage: string, isInitialPush: boolean): Promise<{success, error?}
}
```

### 4.2 Sandbox Configuration

**Template**: Custom E2B Docker image with:
- Node.js 20.17.0
- Python 3.10.12
- Git
- Claude Code CLI
- Cursor Agent CLI
- Gemini CLI
- Expo CLI
- npm packages pre-installed

**Working Directory**: `/vibe0/`

**Startup Script** (`startup.sh` in template):
- Generates session token
- Creates `.session_token` file
- Configures `.env.local` with sandbox ID and session token
- Sets up environment for Expo dev server

**Auto-Pause**: Enabled with configurable timeout (default: 15 minutes)

### 4.3 Session Token System

- Each sandbox has a unique session token
- Token stored in `/vibe0/.session_token`
- Injected into environment via `.env.local`:
  ```
  EXPO_PUBLIC_PROJECT_ID=<sandboxId>
  EXPO_PUBLIC_SESSION_TOKEN=<sessionToken>
  ```
- Used for real-time sync between mobile and sandbox

### 4.4 Dev Server Configuration

**Expo Start Command**:
```bash
echo fs.inotify.max_user_watches=524288 >> /etc/sysctl.conf && \
sysctl -p && \
npx expo start --tunnel --port 3000
```

**Tunnel URL**: Generated by E2B, accessible via `sandbox.getHost(port)`

**Port Detection**: Automatic detection of dev server port (3000)

---

## 5. SESSION MANAGEMENT

### 5.1 Session Schema

**File**: `vibracode-backend/convex/schema.ts`

```typescript
sessions: defineTable({
  createdBy: v.optional(v.string()),      // Clerk user ID
  sessionId: v.optional(v.string()),      // E2B sandbox ID
  name: v.string(),                       // Session name (from first message)
  tunnelUrl: v.optional(v.string()),       // Preview tunnel URL
  repository: v.optional(v.string()),     // GitHub repository
  templateId: v.string(),                 // Template ID (expo, nextjs, etc.)
  pullRequest: v.optional(v.any()),        // GitHub PR data
  githubRepository: v.optional(v.string()), // Full repo name (owner/repo)
  githubRepositoryUrl: v.optional(v.string()),
  githubPushStatus: v.optional(...),      // pending, in_progress, completed, failed
  githubPushDate: v.optional(v.number()),
  status: v.union(...)                      // IN_PROGRESS, CLONING_REPO, INSTALLING_DEPENDENCIES, STARTING_DEV_SERVER, CREATING_TUNNEL, CUSTOM, RUNNING, etc.
  statusMessage: v.optional(v.string()),
  agentStopped: v.optional(v.boolean()),   // True when user stops agent
  totalCostUSD: v.optional(v.number()),
  messageCount: v.optional(v.number()),
  lastCostUpdate: v.optional(v.number()),
  envs: v.optional(v.record(v.string(), v.string())), // Environment variables
  convexProject: v.optional(...)            // Convex project info
})
```

### 5.2 Session Status Flow

```
IN_PROGRESS
    ↓
CLONING_REPO (if repository provided)
    ↓
INSTALLING_DEPENDENCIES
    ↓
STARTING_DEV_SERVER
    ↓
CREATING_TUNNEL
    ↓
RUNNING (dev server ready)
    ↓
CUSTOM (agent working)
    ↓
RUNNING (after agent completes)
```

### 5.3 Session Creation Flow

1. **User sends first message** → `POST /api/run-agent`
2. **Backend validates** and calls `runAgentAction`
3. **Inngest receives** `vibracode/run.agent` event
4. **But first**: `createSession` job is triggered separately
5. **createSession job**:
   - Generates session title from message
   - Creates E2B sandbox
   - Updates session status: CLONING_REPO → STARTING_DEV_SERVER → CREATING_TUNNEL
   - Starts dev server in background
   - Gets tunnel URL
   - Updates session with tunnelUrl
6. **run-agent job**:
   - Connects to existing sandbox via sessionId
   - Executes agent with prompt
   - Streams output to Convex

### 5.4 Session Resume

- **Connect to existing sandbox**: `E2BManager.connectToSandbox(sessionId)`
- **Reset timeout**: `sandbox.setTimeout(timeoutMs)`
- **Skip re-initialization**: Session token and env files already exist
- **Continue agent**: Use `--continue` flag (Claude) or `--resume` flag (Cursor)

---

## 6. REAL-TIME SYNCHRONIZATION

### 6.1 Convex Database

**Purpose**: Real-time database with automatic synchronization

**Key Tables**:
- `users`: User profiles, billing, subscriptions
- `sessions`: Build sessions with status and metadata
- `messages`: Chat messages with tool calls, edits, bash output
- `paymentTransactions`: Billing transactions
- `githubCredentials`: GitHub OAuth tokens
- `revenuecatCredentials`: RevenueCat OAuth tokens
- `globalConfig`: Admin-controlled settings (agentType, etc.)
- `generatedImages`, `generatedAudios`, `generatedVideos`: Media generation
- `stolenApps`: App stealing research data

### 6.2 Convex Schema Features

- **Indexes**: Optimized queries by user, session, status, etc.
- **Validation**: Type-safe schema with `convex/values`
- **Real-time**: Automatic streaming of changes to clients
- **Server Functions**: Type-safe mutations and queries

### 6.3 Real-time Flow

1. **Backend** calls `fetchMutation(api.messages.add, {...})`
2. **Convex** stores message and streams to all subscribed clients
3. **Mobile app** receives update via Convex client
4. **Chat UI** updates with new message
5. **User sees** real-time agent output

### 6.4 OCC (Optimistic Concurrency Control) Handling

- **Retry mechanism**: `retryMutation` function with exponential backoff
- **Max retries**: 3
- **Base delay**: 100ms, doubles each retry
- **Only retries on OCC conflicts**: Detects `OptimisticConcurrencyControlFailure`

---

## 7. INNGEST JOB QUEUE

### 7.1 Inngest Configuration

**File**: `vibracode-backend/lib/inngest/client.ts`

```typescript
const inngest = new Inngest({
  id: "vibracode",
  eventKey: process.env.INNGEST_EVENT_KEY,
  signKey: process.env.INNGEST_SIGNING_KEY,
});
```

### 7.2 Job Functions

| Function | Event | Purpose |
|----------|-------|---------|
| `createSession` | `vibracode/create.session` | Create E2B sandbox, start dev server |
| `runAgent` | `vibracode/run.agent` | Execute AI agent in sandbox |
| `pushToGithub` | `vibracode/push.github` | Push code to GitHub |
| `generateImage` | `vibracode/generate.image` | Generate images via AI |
| `generateAudio` | `vibracode/generate.audio` | Generate audio via AI |
| `generateVideo` | `vibracode/generate.video` | Generate video via AI |
| `stealApp` | `vibracode/steal.app` | Research existing apps |

### 7.3 Job Settings

- **Concurrency**: 25 (can run 25 jobs simultaneously)
- **Retries**: 0 (no automatic retries, handled by onFailure)
- **onFailure**: Custom handler for each job
- **Step-based**: Jobs divided into steps for better error handling

### 7.4 Step System

Each job uses `step.run(name, asyncFn)` to:
- Track step execution
- Handle errors per-step
- Provide better logging
- Enable step-specific retry logic

---

## 8. GITHUB INTEGRATION

### 8.1 GitHub OAuth Flow

1. **User connects GitHub** in mobile app
2. **Mobile app** opens GitHub OAuth URL
3. **GitHub redirects** to backend callback URL
4. **Backend** exchanges code for token via `app/api/github/exchange-token/route.ts`
5. **Token stored** in Convex `githubCredentials` table
6. **Mobile app** can now push to GitHub

### 8.2 GitHub Push Flow

1. **User requests push** or auto-push triggered
2. **Backend** retrieves GitHub token from Convex
3. **E2BManager** initializes git repo in sandbox:
   - Removes old .git directory
   - Configures git (user.email, user.name, safe.directory)
   - Creates .gitignore
   - Initializes new git repo
   - Adds all files
   - Creates commit
4. **Pushes to GitHub** with token authentication
5. **Updates session** with push status

### 8.3 Auto-Push Feature

- **Triggered automatically** after agent completes
- **Checks**: GitHub repo exists, not already pushing
- **Job**: `vibracode/push.github`
- **Data**: sessionId, convexId, repository, isInitialPush

### 8.4 GitHub Pull Request

- **Direct API**: Uses Octokit REST client
- **PR creation**: Creates PR from vibracode branch to main
- **PR title**: "🎖️ VibraCode"
- **PR body**: "Pull request created by VibraCode"

---

## 9. PREVIEW SYSTEM

### 9.1 Preview Types

- **Mobile Preview**: Native preview via Expo Go on device
- **Web Preview**: WKWebView for non-mobile projects
- **QR Code**: For scanning with Expo Go app

### 9.2 Preview Flow

1. **Dev server starts** in sandbox (port 3000)
2. **E2B creates tunnel** for the port
3. **Tunnel URL** returned via `sandbox.getHost(port)`
4. **Session updated** with tunnelUrl
5. **Mobile app** receives tunnelUrl via Convex
6. **Mobile app** opens preview:
   - For mobile projects: Uses Expo Go with tunnel URL
   - For web projects: Uses WKWebView with tunnel URL

### 9.3 Tunnel Configuration

- **Port**: 3000 (default)
- **Command**: `npx expo start --tunnel --port 3000`
- **Host**: `https://<tunnel-id>.e2b.dev`

---

## 10. AI PROVIDERS

### 10.1 Supported Providers

| Provider | CLI | Model | Key Required | Output Format |
|----------|-----|-------|--------------|---------------|
| Claude | `claude` | claude-opus-4-5-20251101 | ANTHROPIC_SANDBOX_API_KEY | stream-json |
| Cursor | `cursor-agent` | auto | CURSOR_AGENT_API_KEY | stream-json |
| Gemini | `gemini` | auto | GEMINI_API_KEY | stream-json |

### 10.2 Provider Selection

- **Global config**: Stored in Convex `globalConfig` table
- **Key**: `agentType`
- **Values**: `cursor`, `claude`, `gemini`
- **Per-user override**: Users can select in mobile app

### 10.3 Agent Configuration

**Claude**:
```bash
claude -p --output-format stream-json --verbose --dangerously-skip-permissions --model <model> [--continue] [--mcp-config <config>]
```

**Cursor**:
```bash
cursor-agent --api-key <key> -p --output-format stream-json --force --model auto [--resume=vibracode]
```

**Gemini**:
```bash
GEMINI_API_KEY=<key> gemini --output-format stream-json --yolo
```

### 10.4 MCP (Model Context Protocol) Support

**Claude only**: Supports MCP servers for extended capabilities

**Configured MCP Servers**:
- **Context7**: Documentation lookup (`https://mcp.context7.com/mcp`)
  - Requires: `CONTEXT7_API_KEY`
- **RevenueCat**: Payment integration (`https://mcp.revenuecat.ai/mcp`)
  - Requires: RevenueCat OAuth token from Convex

---

## 11. MEDIA GENERATION

### 11.1 Image Generation

- **API**: `POST /api/generate-image`
- **Inngest Job**: `vibracode/generate.image`
- **Provider**: Uses AI image generation API
- **Storage**: Stored in Convex storage + `generatedImages` table

### 11.2 Audio Generation

- **API**: `POST /api/generate-audio`
- **Inngest Job**: `vibracode/generate.audio`
- **Provider**: ElevenLabs or similar
- **Storage**: Stored in Convex storage + `generatedAudios` table

### 11.3 Video Generation

- **API**: `POST /api/generate-video`
- **Inngest Job**: `vibracode/generate.video`
- **Storage**: Stored in Convex storage + `generatedVideos` table

### 11.4 File Upload

- **Images**: `POST /api/upload-image`
- **Audios**: `POST /api/upload-audio`
- **Videos**: `POST /api/upload-video`
- **Storage**: Uploaded to Convex storage
- **Metadata**: Stored in message fields (images, audios, videos arrays)

---

## 12. MOBILE ARCHITECTURE (vibracode-mobile/)

### 12.1 Directory Structure

```
vibracode-mobile/
├── apps/
│   └── expo-go/                       # Modified Expo Go app
│       ├── src/
│       │   ├── screens/               # App screens
│       │   │   ├── VibraCreateAppScreen.tsx  # Main creation screen
│       │   │   ├── VibraSessionsScreen.tsx   # Session list
│       │   │   └── ...
│       │   ├── services/              # Business logic
│       │   │   ├── VibraSessionService.ts   # Session management
│       │   │   ├── VibraNotificationService.ts
│       │   │   └── ...
│       │   ├── hooks/                 # Custom hooks
│       │   ├── components/            # UI components
│       │   │   └── vibra/             # Vibra-specific components
│       │   ├── navigation/           # App navigation
│       │   ├── contexts/             # React contexts
│       │   └── ...
│       ├── ios/                      # Native iOS code
│       │   └── Client/
│       │       └── Menu/            # Native chat UI
│       │           ├── EXPreviewZoomManager.h/m  # Main singleton
│       │           ├── Chat/        # Chat components
│       │           │   ├── EXChatListAdapter.h/m
│       │           │   ├── EXChatMessageNode.h/m
│       │           │   ├── EXChatGroupNode.h/m
│       │           │   ├── EXChatTaskCardNode.h/m
│       │           │   ├── EXChatStatusNode.h/m
│       │           │   └── ...
│       │           ├── EXPreviewZoomManager+*.m  # Extensions
│       │           └── Services/     # Native services
│       │               ├── EXChatBackendService.h/m
│       │               ├── EXAudioRecorderService.h/m
│       │               └── ...
│       └── android/                  # Android code
└── expo-template/                    # Sandbox app template (submodule)
```

### 12.2 Native iOS Chat System

**Core**: `EXPreviewZoomManager` singleton

**Responsibilities**:
- Coordinate zoom, chat, bars, and preview experience
- Handle chat UI with Texture + IGListKit
- Manage session loading from Convex
- Handle zoom/gestures
- Manage web preview (WKWebView)
- Handle keyboard show/hide

**Chat Components**:
- `EXChatListAdapter`: IGListKit + Texture adapter with O(N) diffing
- `EXChatMessageNode`: User/assistant text messages with markdown
- `EXChatGroupNode`: Tool operations (file reads, edits, bash)
- `EXChatTaskCardNode`: Todo task cards with Liquid Glass effect
- `EXChatStatusNode`: "Working..." status with shimmer animation
- `EXChatMessageCache`: Message caching for offline support

**Services**:
- `EXChatBackendService`: API calls to Convex backend
- `EXAudioRecorderService`: Voice recording
- `EXAssemblyAIService`: Speech-to-text transcription
- `EXWebPreviewView`: WKWebView wrapper for web previews

**Modals**:
- APIModal: AI provider selector
- FilesModal: File browser
- LogsModal: Live logs viewer
- PublishModal: Publish to GitHub
- HapticModal: Haptic feedback settings
- ENVModal: Environment variables editor

### 12.3 Message Types

| Type | Node | Visual | Purpose |
|------|------|--------|---------|
| `message` | `EXChatMessageNode` | User/assistant text | Chat messages |
| `read` | `EXChatGroupNode` | Blue accent | File read operations |
| `edit` | `EXChatGroupNode` | Orange accent | File edit operations |
| `bash` | `EXChatGroupNode` | Green accent | Terminal commands |
| `tasks` | `EXChatTaskCardNode` | Liquid Glass | Todo list |
| `status` | `EXChatStatusNode` | Shimmer | Working indicator |

### 12.4 Performance Features

- **60fps rendering**: Texture + IGListKit off-main-thread
- **O(N) diffing**: Efficient list updates
- **Liquid Glass**: iOS 26+ glass effects
- **Spring animations**: Smooth transitions
- **Message caching**: Offline support

---

## 13. VOICE & IMAGE INPUT

### 13.1 Voice Input

**Flow**:
1. User taps microphone button
2. `EXAudioRecorderService` starts recording
3. Audio sent to `EXAssemblyAIService` for transcription
4. Transcription returned as text
5. Text sent to agent as user message

**Components**:
- `EXAudioRecorderService`: Native audio recording
- `EXAssemblyAIService`: Speech-to-text (AssemblyAI)

### 13.2 Image Input

**Flow**:
1. User taps image attach button
2. Image picked from gallery or camera
3. Image uploaded via `POST /api/upload-image`
4. Image stored in Convex storage
5. Image metadata stored in message `images` array
6. Agent receives image path in prompt

**Message Fields**:
```typescript
images: [
  {
    fileName: string,
    path: string,
    storageId: v.optional(v.id('_storage'))
  }
]
```

### 13.3 File Path Extraction

**iOS Format**: `[Image: /path/to/file]`
**Web Format**: `[Image: filename at /path]`

**Processing**:
- Extracts paths from message content
- Adds to fileInfo in prompt
- Agent can use Read tool to analyze images

---

## 14. BILLING & CREDITS

### 14.1 Billing Modes

| Mode | Description | Tracking |
|------|-------------|----------|
| **Tokens** | Message-based billing | Consume 1 token per message |
| **Credits** | Cost-based billing | Track actual API costs, deduct credits |

### 14.2 Token Mode

- **Messages remaining**: Stored in `users.messagesRemaining`
- **Messages used**: Stored in `users.messagesUsed`
- **Reset**: Monthly reset via `lastMessageReset`
- **Consumption**: 1 token per message

### 14.3 Credit Mode

- **Credits USD**: Stored in `users.creditsUSD` (2x actual value)
- **Real cost**: Tracked in `users.realCostUSD`
- **Profit**: Calculated as `totalPaidUSD - realCostUSD`
- **Cost extraction**: From Claude API response `total_cost_usd`
- **Fallback**: $0.01 if extraction fails
- **Multiplier**: Credits displayed as 4x (for pricing tiers)

### 14.4 Pre-flight Checks

Before running agent:
1. Check billing mode (tokens or credits)
2. If credits mode: Check `creditsRemaining >= MIN_CREDITS_REQUIRED * 4`
3. If tokens mode: Check `tokensRemaining > 0`
4. If insufficient: Send error message, stop execution

### 14.5 Cost Tracking Flow

1. Agent executes, stdout captured
2. `handleMessageTracking` extracts cost data
3. If credit mode:
   - Extract `total_cost_usd` from stdout
   - Deduct from `users.creditsUSD`
   - Update `users.realCostUSD`
   - Update message with cost data
4. If token mode:
   - Consume 1 token
   - Still track costs for monitoring

---

## 15. ERROR HANDLING

### 15.1 Error Types

| Error | Detection | User Message |
|-------|-----------|--------------|
| **Timeout** | FUNCTION_INVOCATION_TIMEOUT, timeout, timed out, ETIMEDOUT, deadline exceeded | "Request Timed Out" with recovery instructions |
| **Sandbox Terminated** | terminated, [unknown], SandboxError, unavailable, sandbox not found | "Session Interrupted" with recovery instructions |
| **General Error** | Any other error | "Agent Error" with sanitized error |

### 15.2 Secret Sanitization

**Patterns Removed**:
- API keys: `sk-ant-`, `sk-`, `ctx7sk-`, `xai-`
- GitHub tokens: `ghp_`, `gho_`
- Bearer tokens: `Bearer`
- Authorization headers
- Generic: `api_key`, `token`, `secret`, `password`
- Ngrok URLs

### 15.3 Error Recovery

- **User can resume**: Send new message to continue
- **Session preserved**: Code and progress saved
- **Auto-retry**: None (user must manually retry)
- **Fallback messages**: User-friendly error messages

---

## 16. TEMPLATES

### 16.1 Template System

**File**: `vibracode-backend/config.ts`

**Template Structure**:
```typescript
{
  id: string,
  name: string,
  description: string,
  repository: string,
  logos: string[],
  image?: string,           // E2B template ID
  startCommands: [          // Commands to start dev server
    {
      command: string,
      status: string,
      background?: boolean
    }
  ],
  secrets?: Record<string, string>,  // Environment variables
  systemPrompt: string      // AI system prompt
}
```

### 16.2 Default Templates

| ID | Name | Description | E2B Template |
|----|------|-------------|--------------|
| `expo` | Expo React Native | Cross-platform mobile apps | vibracode-expo-cursor-v2 |
| `nextjs` | Next.js | Web applications | superagent-ai/e2b-nextjs |
| `nextjs-supabase-auth` | Next.js + Supabase + Auth | Production SaaS | vercel/next.js/.../with-supabase |
| `nextjs-convex-clerk` | Next.js + Convex + Clerk | Collaborative apps | get-convex/convex-clerk-users-table |
| `shopify-hydrogen` | Shopify | Headless commerce | superagent-ai/e2b-shopify |
| `fastapi-nextjs` | FastAPI + Next.js | Full-stack apps | - |

### 16.3 Template Resolution

1. User selects template or defaults to `expo`
2. Template ID used for E2B sandbox creation
3. Start commands executed in sandbox
4. System prompt included in first message

---

## 17. PUSH NOTIFICATIONS

### 17.1 Push Notification System

- **Provider**: RevenueCat for iOS, Firebase for Android
- **Storage**: Push tokens stored in `users.pushToken`
- **Trigger**: When session status changes to RUNNING
- **Content**: "App Ready! 🚀 Your app '<name>' is ready to preview"

### 17.2 Notification Flow

1. Session status updated to RUNNING
2. `sendAppReadyPushNotification` called
3. Push token retrieved from Convex
4. Notification sent via Convex action
5. Mobile app receives notification
6. User taps to open app

---

## 18. ADMIN & MONITORING

### 18.1 Admin Features

- **Global config**: Manage agentType, billing settings
- **User management**: View users, subscriptions, usage
- **Session monitoring**: View active sessions, costs
- **Billing analytics**: Track revenue, costs, profit

### 18.2 Monitoring

- **Logging**: Comprehensive console logging
- **Error tracking**: All errors logged with context
- **Cost monitoring**: Track API costs for optimization
- **Usage analytics**: Track messages, sessions, features

---

## 19. SECURITY

### 19.1 Authentication

- **Provider**: Clerk
- **OAuth**: GitHub, RevenueCat
- **Session verification**: Always check ownership in queries
- **API security**: Next.js API routes with auth checks

### 19.2 Data Protection

- **Secret sanitization**: Remove API keys from error messages
- **No secret logging**: Never log sensitive data
- **Ownership checks**: Verify user owns session before access
- **Rate limiting**: Inngest concurrency limits (25)

### 19.3 Sandbox Security

- **Isolation**: Each session in separate E2B sandbox
- **Auto-pause**: Sandboxes auto-pause after inactivity
- **Timeout**: Configurable timeout (15 minutes default)
- **Cleanup**: Sandboxes killed when session deleted

---

## 20. PERFORMANCE OPTIMIZATIONS

### 20.1 Backend

- **OCC retry**: Exponential backoff for conflicts
- **Step-based jobs**: Parallel execution where possible
- **Streaming**: Real-time updates without polling
- **Caching**: Message caching for offline support

### 20.2 Mobile

- **60fps UI**: Texture + IGListKit off-main-thread
- **O(N) diffing**: Efficient list updates
- **Lazy loading**: Load sessions/messages on demand
- **Message caching**: Cache messages for offline viewing

### 20.3 Network

- **Compression**: Efficient data transfer
- **Batching**: Multiple updates in single requests
- **WebSockets**: Real-time via Convex

---

## 21. DEPLOYMENT

### 21.1 Backend Deployment

```bash
cd vibracode-backend
npm install
cp .env.example .env.local
npx convex deploy           # Deploy Convex database
npx inngest-cli dev         # Start Inngest dev server
npm run dev                 # Start Next.js
npm run build               # Build for production
```

### 21.2 Mobile Deployment

```bash
cd vibracode-mobile/apps/expo-go
brew bundle                 # Install dependencies
cd packages/expo && yarn build
cd react-native-lab/react-native && yarn install
cd apps/expo-go/ios && pod install
cd apps/expo-go && yarn start  # Metro on port 80
```

Then open in Xcode and build.

### 21.3 E2B Template Deployment

```bash
npm install -g @e2b/cli
e2b auth login
cd vibracode-backend/e2b-cursor-template
e2b template build
# Copy template ID to config
```

---

## 22. KEY INSIGHTS FOR SORYOS-CLOUD

### 22.1 What Vibra Code Does Well

1. **Production-ready E2B integration**: Real sandbox execution, not simulation
2. **True streaming JSON**: Real-time agent output parsing
3. **Background job processing**: Inngest for reliable job queue
4. **Real-time sync**: Convex for instant updates
5. **GitHub auto-push**: Automatic code commits and pushes
6. **Multi-AI provider**: Claude, Cursor, Gemini support
7. **Voice/image input**: Native mobile media handling
8. **Cost tracking**: Accurate billing with fallback
9. **Error recovery**: Graceful handling of failures
10. **Template system**: Pre-configured project templates

### 22.2 What SoryOS-Cloud Should Adopt

1. **Real E2B Provider**: Replace simulated E2B with actual SDK calls
2. **Inngest Job Queue**: For background agent execution
3. **Streaming JSON Parser**: For real-time agent output
4. **GitHub Auto-Push**: Automatic repository management
5. **Multi-Provider Support**: Add Cursor and Gemini providers
6. **Voice Input**: AssemblyAI integration
7. **Media Upload**: Image/audio/video handling
8. **Cost Tracking**: Credit/token billing system
9. **Session Resume**: Reconnect to existing sandboxes
10. **Preview System**: Tunnel URL detection and preview

### 22.3 What SoryOS-Cloud Already Has

1. **Rust Engine**: Core execution engine
2. **Agent Runtime**: Multi-turn agent loop
3. **Tool System**: Tool registry and execution
4. **Sandbox Architecture**: Project/Workspace/Session/Environment hierarchy
5. **Provider System**: AI provider registry
6. **Permission System**: Role-based access control
7. **Git Integration**: Git operations manager
8. **Event Bus**: Global event streaming

### 22.4 Integration Strategy

**Phase 1: Core Infrastructure**
- [ ] Implement real E2B provider using @e2b/code-interpreter SDK
- [ ] Add Inngest job queue for background tasks
- [ ] Implement streaming JSON output parsing
- [ ] Add session resume capability

**Phase 2: Features**
- [ ] GitHub auto-push integration
- [ ] Multi-provider support (Cursor, Gemini)
- [ ] Preview system with tunnel detection
- [ ] Voice input with AssemblyAI

**Phase 3: Advanced**
- [ ] Media upload (image/audio/video)
- [ ] Cost tracking and billing
- [ ] Template system
- [ ] Push notifications

---

## 23. RECOMMENDATIONS

### 23.1 High Priority (Must Implement)

1. **Real E2B Provider**: Current implementation is simulated. Must use actual E2B SDK.
2. **Inngest Job Queue**: Current agent execution is synchronous. Must move to background jobs.
3. **Streaming JSON**: Current output is buffered. Must support real-time streaming.
4. **Session Resume**: Current sessions are ephemeral. Must support reconnection.

### 23.2 Medium Priority (Should Implement)

1. **GitHub Auto-Push**: Add automatic code commits and pushes
2. **Multi-Provider**: Add Cursor and Gemini support
3. **Preview System**: Add tunnel URL detection and preview
4. **Voice Input**: Add AssemblyAI for speech-to-text

### 23.3 Low Priority (Nice to Have)

1. **Media Generation**: Image/audio/video generation
2. **Cost Tracking**: Billing and credit system
3. **Template System**: Pre-configured project templates
4. **Push Notifications**: App ready notifications

### 23.4 Architecture Preservation

**DO NOT REPLACE**:
- Rust Engine (keep as core)
- Agent Runtime (enhance, don't replace)
- Tool System (extend, don't replace)
- Sandbox Architecture (adapt, don't replace)
- Permission System (preserve)
- Event Bus (extend, don't replace)

**DO ADOPT**:
- E2B SDK integration patterns
- Inngest job queue patterns
- Streaming JSON parsing
- GitHub integration patterns
- Multi-provider patterns

---

## 24. CONCLUSION

Vibra Code represents a production-grade implementation of an AI app builder with:
- Real cloud sandbox execution (E2B)
- True background job processing (Inngest)
- Real-time synchronization (Convex)
- Multi-AI provider support (Claude, Cursor, Gemini)
- Native mobile apps (Expo Go)

**Key Takeaway**: Vibra Code proves that a single developer can build a complex, production-ready AI coding system by combining the right tools (E2B, Inngest, Convex, Claude Code) with good architecture.

**For SoryOS-Cloud**: The main gap is real execution. SoryOS-Cloud has excellent architecture but needs to implement actual E2B integration, background jobs, and streaming to match Vibra Code's production readiness.

---

*Report generated after complete analysis of Vibra Code source code*
*Analysis date: 2025-01-07*
*Analyst: Mistral Vibe Code Agent*
