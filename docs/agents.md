# SoryOS-Code Agents System Documentation

## Overview of Agent Matrix

SoryOS-Code features a multi-agent matrix designed for autonomous software development tasks:

### 1. Build Agent (`build`)
- **Role**: Autonomous Developer
- **Capabilities**: Surgical patching, file writing, shell command execution, build validation.
- **Permissions**: Full access (`read`, `write`, `shell`).
- **Use Case**: Feature implementation, bug fixing, dependency installation.

### 2. Plan Agent (`plan`)
- **Role**: Architect & Planner
- **Capabilities**: Architecture analysis, roadmap generation, read-only inspection.
- **Permissions**: Read-only (`write` and `shell` commands blocked).
- **Use Case**: System design, code auditing, planning complex migrations.

### 3. Explore Agent (`explore`)
- **Role**: Fast Search & Discovery
- **Capabilities**: Fast glob pattern matching, regex symbol search, file discovery.
- **Permissions**: Read-only (`read`, `glob`, `grep`).
- **Use Case**: Locating symbols, files, or references across large codebases.

### 4. QA Reviewer (`code-reviewer`)
- **Role**: Security & Quality Assurance
- **Capabilities**: Code review, security auditing, test suite execution.
- **Permissions**: Read and test execution.
- **Use Case**: Verifying pull requests, running typecheck and engine tests.
