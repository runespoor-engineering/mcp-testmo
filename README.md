# Testmo MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that exposes Testmo's REST API as tools for AI assistants (Claude, Cursor, etc.), using the official [@testmo/testmo-api](https://www.npmjs.com/package/@testmo/testmo-api) package.

- [Testmo MCP Server](#testmo-mcp-server)
  - [Features](#features)
  - [Requirements](#requirements)
  - [Setup](#setup)
    - [1. Install dependencies](#1-install-dependencies)
    - [2. Get your Testmo API token](#2-get-your-testmo-api-token)
    - [3. Configure the server](#3-configure-the-server)
  - [Using with Cursor](#using-with-cursor)
  - [Running manually (for testing)](#running-manually-for-testing)
  - [Available Tools](#available-tools)
    - [Projects](#projects)
    - [Milestones](#milestones)
    - [Test Runs (manual)](#test-runs-manual)
    - [Automation Runs](#automation-runs)
    - [Test Cases (repository)](#test-cases-repository)
    - [Folders (repository)](#folders-repository)
    - [Fields](#fields)
    - [Sessions](#sessions)
    - [Groups](#groups)
    - [Roles](#roles)
    - [Users](#users)
  - [Status IDs Reference](#status-ids-reference)
  - [Example prompts](#example-prompts)
  - [Architecture](#architecture)
  - [License](#license)

## Features

| Category | Tools |
|---|---|
| **Projects** | List projects, get project details |
| **Milestones** | List milestones, get milestone details |
| **Test Runs** | List runs, get run details, list run results |
| **Automation Runs** | Get automation sources; list, get, create automation runs; submit results; mark complete |
| **Test Cases** | List, get, create, update (with custom fields), delete repository cases |
| **Folders** | List, get, create, update, delete repository folders |
| **Fields** | List custom fields and options for a project |
| **Sessions** | List and get exploratory test sessions |
| **Groups** | Get group details |
| **Roles** | Get role details |
| **Users** | Get current user, list all users, get user by ID |

## Requirements

- **Node.js 22.12+**
- **npm** (or pnpm/yarn) – installs `@testmo/testmo-api`
- A Testmo account with an API token

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Get your Testmo API token

1. Log in to your Testmo instance  
2. Go to **My Profile → API Keys**  
3. Generate a new API key and copy it  

### 3. Configure the server

The server is configured via environment variables:

| Variable | Description | Example |
|---|---|---|
| `TESTMO_INSTANCE_URL` | Your Testmo instance URL | `https://mycompany.testmo.net` |
| `TESTMO_TOKEN` | Your Testmo API token | `tm_abc123...` |

Do not commit tokens or config files that contain them (use `.env` and add it to `.gitignore`).

## Using with Cursor

1. Open Cursor Settings → MCP (or edit ~/.cursor/mcp.json directly)
2. Add this config:

```json
{
  "mcpServers": {
    "testmo": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-testmo/index.js"],
      "env": {
        "TESTMO_INSTANCE_URL": "https://mcp.testmo.net",
        "TESTMO_TOKEN": "your-api-token"
      }
    }
  }
}
```

3. Restart Cursor — the Testmo tools will appear in the MCP tools list.

A couple of Cursor-specific tips:
- Use the server in Agent mode (Ctrl+I / Cmd+I) — that's where Cursor actually calls MCP tools
- Cursor will ask for approval before each tool call, so you stay in control of writes (creating runs, submitting results, etc.)

## Running manually (for testing)

```bash
export TESTMO_INSTANCE_URL="https://your-company.testmo.net"
export TESTMO_TOKEN="your-api-token"
npm start
```

## Available Tools

### Projects
- **`testmo_list_projects`** — List all accessible projects (pagination)
- **`testmo_get_project`** — Get a project by ID

### Milestones
- **`testmo_list_milestones`** — List milestones for a project
- **`testmo_get_milestone`** — Get a milestone by ID

### Test Runs (manual)
- **`testmo_list_runs`** — List runs for a project (optional milestone filter)
- **`testmo_get_run`** — Get a run by ID
- **`testmo_list_run_results`** — Get results for a run (filters: status, user, date range, expands)

### Automation Runs
- **`testmo_get_automation_source`** — Get a single automation source by ID
- **`testmo_list_automation_runs`** — List automation runs (optional source filter)
- **`testmo_get_automation_run`** — Get an automation run by ID
- **`testmo_create_automation_run`** — Create a new automation run (name, source, optional milestone)
- **`testmo_submit_automation_result`** — Submit a single test result (name, status_id, optional duration_ms, message)
- **`testmo_complete_automation_run`** — Mark the automation run as complete

### Test Cases (repository)
- **`testmo_list_cases`** — List cases (filter by folder, template, date)
- **`testmo_get_case`** — Get a single case by ID (with optional expands: history, comments, tags, etc.)
- **`testmo_create_case`** — Create one or more cases (`cases` array or single `name` + optional `folder_id`, `template_id`, `state_id`, `estimate`)
- **`testmo_update_case`** — Update cases by `project_id` + `ids`; supports custom fields (`custom_preconditions`, `custom_steps`, `custom_expected`, etc.)
- **`testmo_delete_case`** — Delete cases by `project_id` + `ids`

### Folders (repository)
- **`testmo_list_folders`** — List folders in a project
- **`testmo_get_folder`** — Get a single folder by ID
- **`testmo_create_folder`** — Create one or more folders (`folders` array or single `name` + optional `parent_id`)
- **`testmo_update_folder`** — Update folders by `project_id` + `ids`
- **`testmo_delete_folder`** — Delete folders by `project_id` + `ids`

### Fields
- **`testmo_list_fields`** — List custom fields and their options for a project (optional entity filter: `cases`, `runs`, etc.)

### Sessions
- **`testmo_list_sessions`** — List exploratory sessions for a project
- **`testmo_get_session`** — Get session details

### Groups
- **`testmo_get_group`** — Get a single group by ID

### Roles
- **`testmo_get_role`** — Get a single role by ID

### Users
- **`testmo_get_current_user`** — Get the current user's profile
- **`testmo_list_users`** — List all users in the instance
- **`testmo_get_user`** — Get a single user by ID

## Status IDs Reference

| ID | Status  |
|----|--------|
| 1  | Untested |
| 2  | Passed   |
| 3  | Failed   |
| 4  | Retest   |
| 5  | Blocked  |
| 6  | Skipped  |

(Custom statuses may use IDs 7–25 depending on your instance.)

## Example prompts

- "List all my Testmo projects"
- "Show me failed test results from run 15"
- "Create an automation run named 'CI Build #123' with source 'backend' in project 2"
- "Submit a failed test result for 'Login flow' with message 'Timeout after 30s'"
- "List repository cases in project 1 and create a folder named 'Regression'"

## Architecture

The server uses the official **@testmo/testmo-api** SDK and implements the [MCP JSON-RPC 2.0 protocol](https://modelcontextprotocol.io/docs/concepts/architecture) over stdio.

```
MCP Client (Claude / Cursor / …)
       │ stdio (JSON-RPC 2.0)
       ▼
testmo-mcp-server (index.js)
       │ @testmo/testmo-api (HTTPS)
       ▼
Your Testmo instance (/api/v1)
```

---

## License

MIT
