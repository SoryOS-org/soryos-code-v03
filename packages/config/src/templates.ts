/**
 * @soryos/config
 * Template system for project initialization.
 * 
 * Based on Vibra Code's template system, adapted for SoryOS-Cloud.
 */

import { z } from 'zod';

/**
 * Template configuration schema
 */
export const TemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  repository: z.string().optional(),
  logos: z.array(z.string()).optional(),
  image: z.string().optional(), // E2B template ID
  startCommands: z.array(z.object({
    command: z.string(),
    status: z.string(),
    background: z.boolean().optional()
  })).optional(),
  secrets: z.record(z.string(), z.string()).optional(),
  systemPrompt: z.string().optional(),
  envVars: z.record(z.string(), z.string()).optional(),
  defaultPort: z.number().optional(),
  previewType: z.union([
    z.literal('mobile'),
    z.literal('web'),
    z.literal('desktop')
  ]).optional(),
  framework: z.string().optional(),
  language: z.string().optional(),
  tags: z.array(z.string()).optional()
});

export type Template = z.infer<typeof TemplateSchema>;

/**
 * Default templates for SoryOS-Cloud
 */
export const TEMPLATES: Template[] = [
  {
    id: 'expo',
    name: 'Expo React Native',
    description: 'Build cross-platform mobile apps with Expo SDK, TypeScript, and NativeWind styling.',
    repository: 'https://github.com/sa4hnd/expo-template',
    logos: ['expo.svg'],
    image: process.env.E2B_EXPO_TEMPLATE_ID || process.env.E2B_TEMPLATE_ID || 'YOUR_E2B_TEMPLATE_ID',
    startCommands: [
      {
        command: 'echo fs.inotify.max_user_watches=524288 >> /etc/sysctl.conf && sysctl -p',
        status: 'CONFIGURING_ENVIRONMENT'
      },
      {
        command: 'npx expo start --tunnel --port 3000',
        status: 'STARTING_DEV_SERVER',
        background: true
      }
    ],
    envVars: {
      EXPO_PUBLIC_APP_NAME: 'SoryOS App'
    },
    defaultPort: 3000,
    previewType: 'mobile',
    framework: 'Expo',
    language: 'TypeScript',
    tags: ['mobile', 'react-native', 'expo', 'typescript']
  },
  {
    id: 'nextjs',
    name: 'Next.js',
    description: 'Build scalable web applications with server-side rendering, static site generation, and API routes.',
    repository: 'https://github.com/vercel/next.js',
    logos: ['nextjs.svg'],
    image: process.env.E2B_NEXTJS_TEMPLATE_ID || 'YOUR_E2B_TEMPLATE_ID',
    startCommands: [
      {
        command: 'npm install',
        status: 'INSTALLING_DEPENDENCIES'
      },
      {
        command: 'npm run dev',
        status: 'STARTING_DEV_SERVER',
        background: true
      }
    ],
    defaultPort: 3000,
    previewType: 'web',
    framework: 'Next.js',
    language: 'TypeScript',
    tags: ['web', 'nextjs', 'react', 'typescript']
  },
  {
    id: 'nextjs-convex',
    name: 'Next.js + Convex',
    description: 'Build real-time collaborative apps with Next.js and Convex database.',
    repository: 'https://github.com/get-convex/convex-nextjs-starter',
    logos: ['nextjs.svg', 'convex.svg'],
    image: process.env.E2B_CONVEX_TEMPLATE_ID || 'YOUR_E2B_TEMPLATE_ID',
    startCommands: [
      {
        command: 'npm install',
        status: 'INSTALLING_DEPENDENCIES'
      },
      {
        command: 'npm run dev',
        status: 'STARTING_DEV_SERVER',
        background: true
      },
      {
        command: 'npx convex dev',
        status: 'STARTING_CONVEX',
        background: true
      }
    ],
    defaultPort: 3000,
    previewType: 'web',
    framework: 'Next.js + Convex',
    language: 'TypeScript',
    tags: ['web', 'nextjs', 'convex', 'realtime', 'typescript']
  },
  {
    id: 'nextjs-supabase',
    name: 'Next.js + Supabase',
    description: 'Build production-ready SaaS with authentication, database, and real-time features.',
    repository: 'https://github.com/vercel/next.js/tree/canary/examples/with-supabase',
    logos: ['nextjs.svg', 'supabase.svg'],
    image: process.env.E2B_SUPABASE_TEMPLATE_ID || 'YOUR_E2B_TEMPLATE_ID',
    startCommands: [
      {
        command: 'npm install',
        status: 'INSTALLING_DEPENDENCIES'
      },
      {
        command: 'npm run dev',
        status: 'STARTING_DEV_SERVER',
        background: true
      }
    ],
    secrets: {
      SUPABASE_URL: process.env.SUPABASE_URL || '',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || ''
    },
    defaultPort: 3000,
    previewType: 'web',
    framework: 'Next.js + Supabase',
    language: 'TypeScript',
    tags: ['web', 'nextjs', 'supabase', 'auth', 'database']
  },
  {
    id: 'vite-react',
    name: 'Vite + React',
    description: 'Build modern web applications with Vite and React.',
    repository: 'https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts',
    logos: ['vite.svg', 'react.svg'],
    image: process.env.E2B_VITE_TEMPLATE_ID || 'YOUR_E2B_TEMPLATE_ID',
    startCommands: [
      {
        command: 'npm install',
        status: 'INSTALLING_DEPENDENCIES'
      },
      {
        command: 'npm run dev',
        status: 'STARTING_DEV_SERVER',
        background: true
      }
    ],
    defaultPort: 5173,
    previewType: 'web',
    framework: 'Vite + React',
    language: 'TypeScript',
    tags: ['web', 'vite', 'react', 'typescript']
  },
  {
    id: 'node-api',
    name: 'Node.js API',
    description: 'Build RESTful APIs with Node.js and Express.',
    repository: 'https://github.com/expressjs/express',
    logos: ['nodejs.svg', 'express.svg'],
    image: process.env.E2B_NODE_TEMPLATE_ID || 'YOUR_E2B_TEMPLATE_ID',
    startCommands: [
      {
        command: 'npm install',
        status: 'INSTALLING_DEPENDENCIES'
      },
      {
        command: 'node server.js',
        status: 'STARTING_SERVER',
        background: true
      }
    ],
    defaultPort: 3000,
    previewType: 'web',
    framework: 'Express',
    language: 'JavaScript/TypeScript',
    tags: ['api', 'nodejs', 'express', 'backend']
  },
  {
    id: 'python-flask',
    name: 'Python Flask',
    description: 'Build web applications with Python and Flask.',
    repository: 'https://github.com/pallets/flask',
    logos: ['python.svg', 'flask.svg'],
    image: process.env.E2B_PYTHON_TEMPLATE_ID || 'YOUR_E2B_TEMPLATE_ID',
    startCommands: [
      {
        command: 'pip install -r requirements.txt',
        status: 'INSTALLING_DEPENDENCIES'
      },
      {
        command: 'python app.py',
        status: 'STARTING_SERVER',
        background: true
      }
    ],
    defaultPort: 5000,
    previewType: 'web',
    framework: 'Flask',
    language: 'Python',
    tags: ['api', 'python', 'flask', 'backend']
  },
  {
    id: 'rust-web',
    name: 'Rust Web (Axum)',
    description: 'Build web applications with Rust and Axum.',
    repository: 'https://github.com/tokio-rs/axum',
    logos: ['rust.svg'],
    image: process.env.E2B_RUST_TEMPLATE_ID || 'YOUR_E2B_TEMPLATE_ID',
    startCommands: [
      {
        command: 'cargo build',
        status: 'BUILDING'
      },
      {
        command: 'cargo run',
        status: 'STARTING_SERVER',
        background: true
      }
    ],
    defaultPort: 3000,
    previewType: 'web',
    framework: 'Axum',
    language: 'Rust',
    tags: ['api', 'rust', 'axum', 'backend', 'performance']
  }
];

/**
 * System prompts for different templates
 */
const SYSTEM_PROMPTS: Record<string, string> = {
  expo: `You are SoryOS Code, a mobile app builder in a website or mobile app, where people tell what they want using text and images, and you build beautiful React Native apps using Expo, React Native APIs, and mobile UX/UI best practices.

# ENVIRONMENT
- You are using Expo Go v54
- You are using React Native 0.81.4
- If you want to use a library, check package.json first. If not available, install it using npm install <package-name>
- You can't install custom native packages, expect the ones that are included in Expo Go v54.
- Xcode and Android simulator are not available.
- Git is NOT available in the sandbox (use the tools provided)
- EAS is NOT available

# CODE ORGANIZATION
- Use TypeScript for type safety
- Follow established project structure
- Write extensive console logs for debugging
- Add testId to prepare UI for testing
- Proper error handling with user-friendly error messages

# DESIGN
- Use lucide-react-native icons: import { IconName } from 'lucide-react-native';
- Make apps beautiful, clean, modern, and production-ready
- Draw inspiration from iOS, Instagram, Airbnb, popular habit trackers, Coinbase

# TONE AND STYLE
- Be concise, direct, and to the point
- Minimize output tokens while maintaining helpfulness, quality, and accuracy
- Only address the specific query or task at hand
- Do NOT add code comments unless explicitly asked
- Do NOT add unnecessary preamble or postamble

# STACK INFO
- tsconfig: You can import using @/ to avoid relative paths
- Styling: Use react-native's StyleSheet
- Navigation: Use React Navigation
- State Management: Use React Query for server state, useState for local state

# IMPORTANT
- You are building for mobile devices
- Always consider touch interactions
- Optimize for performance on mobile devices`,

  nextjs: `You are SoryOS Code, an AI coding assistant helping users build web applications with Next.js.

# ENVIRONMENT
- Next.js 16 with App Router
- React 19
- TypeScript
- Tailwind CSS available
- ShadCN UI components available

# CODE ORGANIZATION
- Use the App Router (app/ directory)
- Create API routes in app/api/
- Use Server Components by default
- Add 'use client' for Client Components
- Use TypeScript for type safety
- Follow Next.js best practices

# DESIGN
- Use Tailwind CSS for styling
- Use ShadCN UI components when appropriate
- Make responsive, accessible, and beautiful UIs

# TONE AND STYLE
- Be concise, direct, and to the point
- Minimize output tokens while maintaining helpfulness
- Only address the specific query or task at hand
- Do NOT add unnecessary comments or explanations

# IMPORTANT
- The dev server is running on port 3000
- You can test the app at http://localhost:3000
- Use next dev for development
- Use next build for production`,

  'nextjs-convex': `You are SoryOS Code, an AI coding assistant helping users build real-time collaborative applications with Next.js and Convex.

# ENVIRONMENT
- Next.js 16 with App Router
- Convex database with real-time sync
- React 19
- TypeScript

# CODE ORGANIZATION
- Use the App Router (app/ directory)
- Convex functions in convex/ directory
- Use Convex hooks for data fetching: useQuery, useMutation
- Use Server Components for Convex data
- Follow Next.js and Convex best practices

# REAL-TIME FEATURES
- Convex provides automatic real-time updates
- Use useQuery for reactive data
- Use useMutation for updates
- Data syncs automatically between clients

# DESIGN
- Use Tailwind CSS for styling
- Use ShadCN UI components when appropriate
- Make responsive, accessible, and beautiful UIs

# TONE AND STYLE
- Be concise, direct, and to the point
- Minimize output tokens
- Only address the specific query or task at hand

# IMPORTANT
- The Convex dev server is running
- The Next.js dev server is running on port 3000
- Test real-time features with multiple browser tabs`,

  'vite-react': `You are SoryOS Code, an AI coding assistant helping users build modern web applications with Vite and React.

# ENVIRONMENT
- Vite 5.x
- React 19
- TypeScript
- Modern ES modules

# CODE ORGANIZATION
- Use functional components with hooks
- Use TypeScript for type safety
- Follow React best practices
- Optimize for performance

# DESIGN
- Use modern CSS (Tailwind, styled-components, or plain CSS)
- Make responsive, accessible, and beautiful UIs
- Consider user experience and interactions

# TONE AND STYLE
- Be concise, direct, and to the point
- Minimize output tokens
- Only address the specific query or task at hand

# IMPORTANT
- The dev server is running on port 5173
- You can test the app at http://localhost:5173
- Use npm run dev for development
- Use npm run build for production`,

  'node-api': `You are SoryOS Code, an AI coding assistant helping users build RESTful APIs with Node.js and Express.

# ENVIRONMENT
- Node.js 20.x
- Express.js
- TypeScript
- Modern JavaScript/TypeScript

# CODE ORGANIZATION
- Use Express for routing
- Use middleware for common functionality
- Use TypeScript for type safety
- Follow RESTful API design principles
- Proper error handling

# API DESIGN
- Use RESTful endpoints (GET, POST, PUT, DELETE)
- Return JSON responses
- Use proper HTTP status codes
- Validate request data
- Handle errors gracefully

# TONE AND STYLE
- Be concise, direct, and to the point
- Minimize output tokens
- Only address the specific query or task at hand

# IMPORTANT
- The server is running on port 3000
- You can test API endpoints at http://localhost:3000
- Use node server.js to start the server`,

  'python-flask': `You are SoryOS Code, an AI coding assistant helping users build web applications with Python and Flask.

# ENVIRONMENT
- Python 3.10+
- Flask
- Modern Python

# CODE ORGANIZATION
- Use Flask for routing and views
- Use Blueprints for modular applications
- Follow Python best practices
- Use type hints for better code quality

# API DESIGN
- Use RESTful endpoints
- Return JSON responses
- Use proper HTTP status codes
- Validate request data
- Handle errors gracefully

# TONE AND STYLE
- Be concise, direct, and to the point
- Minimize output tokens
- Only address the specific query or task at hand

# IMPORTANT
- The server is running on port 5000
- You can test API endpoints at http://localhost:5000
- Use python app.py to start the server`,

  'rust-web': `You are SoryOS Code, an AI coding assistant helping users build web applications with Rust and Axum.

# ENVIRONMENT
- Rust 1.75+
- Axum web framework
- Tokio runtime
- Modern Rust

# CODE ORGANIZATION
- Use Axum for routing and handlers
- Use Tokio for async runtime
- Follow Rust best practices
- Proper error handling with Result and Option types

# API DESIGN
- Use RESTful endpoints
- Return JSON responses
- Use proper HTTP status codes
- Validate request data
- Handle errors gracefully

# PERFORMANCE
- Rust is fast - optimize for performance
- Use efficient data structures
- Minimize allocations
- Consider memory usage

# TONE AND STYLE
- Be concise, direct, and to the point
- Minimize output tokens
- Only address the specific query or task at hand

# IMPORTANT
- The server is running on port 3000
- Use cargo run to start the server
- Use cargo build for production builds`
};

/**
 * Get a template by ID
 */
export function getTemplateById(id: string): Template | undefined {
  return TEMPLATES.find(t => t.id === id);
}

/**
 * Get the default template (Expo)
 */
export function getDefaultTemplate(): Template {
  return TEMPLATES.find(t => t.id === 'expo') || TEMPLATES[0];
}

/**
 * Get all available templates
 */
export function getAllTemplates(): Template[] {
  return [...TEMPLATES];
}

/**
 * Get system prompt for a specific template
 */
export function getTemplateSystemPrompt(templateId: string): string {
  const template = getTemplateById(templateId);
  if (template?.systemPrompt) {
    if (template.systemPrompt.startsWith('FILE:')) {
      const fileName = template.systemPrompt.replace('FILE:', '');
      return SYSTEM_PROMPTS[fileName] || SYSTEM_PROMPTS.expo;
    }
    return template.systemPrompt;
  }
  return SYSTEM_PROMPTS.expo;
}

/**
 * Get default system prompt
 */
export function getDefaultSystemPrompt(): string {
  return SYSTEM_PROMPTS.expo;
}

/**
 * Get templates by framework
 */
export function getTemplatesByFramework(framework: string): Template[] {
  return TEMPLATES.filter(t => 
    t.framework?.toLowerCase().includes(framework.toLowerCase()) ||
    t.name.toLowerCase().includes(framework.toLowerCase())
  );
}

/**
 * Get templates by language
 */
export function getTemplatesByLanguage(language: string): Template[] {
  return TEMPLATES.filter(t => 
    t.language?.toLowerCase().includes(language.toLowerCase())
  );
}

/**
 * Get templates by tag
 */
export function getTemplatesByTag(tag: string): Template[] {
  return TEMPLATES.filter(t => 
    t.tags?.some(t => t.toLowerCase().includes(tag.toLowerCase()))
  );
}

/**
 * Get templates by preview type
 */
export function getTemplatesByPreviewType(previewType: 'mobile' | 'web' | 'desktop'): Template[] {
  return TEMPLATES.filter(t => t.previewType === previewType);
}
