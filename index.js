#!/usr/bin/env node
/**
 * Testmo MCP Server
 * Implements the Model Context Protocol for Testmo's REST API using @testmo/testmo-api
 * Compatible with Claude Desktop, Cursor, and other MCP clients
 */

const readline = require("node:readline");
const testmo = require("@testmo/testmo-api");

// ── Tool Definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  // ─ Projects ───────────────────────────────────────────────────────────────
  {
    name: "testmo_list_projects",
    description: "List all Testmo projects accessible by the current user",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number", description: "Page number (default: 1)" },
        per_page: { type: "number", description: "Results per page (default: 25, max: 100)" },
      },
    },
  },
  {
    name: "testmo_get_project",
    description: "Get details of a specific Testmo project",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "number", description: "The project ID" },
      },
      required: ["project_id"],
    },
  },

  // ─ Milestones ─────────────────────────────────────────────────────────────
  {
    name: "testmo_list_milestones",
    description: "List milestones for a project",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "number", description: "The project ID" },
        page: { type: "number", description: "Page number (default: 1)" },
        per_page: { type: "number", description: "Results per page" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "testmo_get_milestone",
    description: "Get details of a specific milestone",
    inputSchema: {
      type: "object",
      properties: {
        milestone_id: { type: "number", description: "The milestone ID" },
      },
      required: ["milestone_id"],
    },
  },

  // ─ Runs ───────────────────────────────────────────────────────────────────
  {
    name: "testmo_list_runs",
    description: "List test runs for a project",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "number", description: "The project ID" },
        milestone_id: { type: "number", description: "Filter by milestone ID" },
        page: { type: "number", description: "Page number" },
        per_page: { type: "number", description: "Results per page" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "testmo_get_run",
    description: "Get details of a specific test run",
    inputSchema: {
      type: "object",
      properties: {
        run_id: { type: "number", description: "The run ID" },
      },
      required: ["run_id"],
    },
  },
  {
    name: "testmo_list_run_results",
    description: "List test results for a run with optional filters",
    inputSchema: {
      type: "object",
      properties: {
        run_id: { type: "number", description: "The run ID" },
        status_id: {
          type: "number",
          description:
            "Filter by status (1=Untested, 2=Passed, 3=Failed, 4=Retest, 5=Blocked, 6=Skipped)",
        },
        created_by: { type: "number", description: "Filter by user ID" },
        created_after: { type: "string", description: "Filter results after date (ISO 8601)" },
        created_before: { type: "string", description: "Filter results before date (ISO 8601)" },
        expands: { type: "string", description: "Comma-separated expands: users,issues" },
        page: { type: "number", description: "Page number" },
        per_page: { type: "number", description: "Results per page" },
      },
      required: ["run_id"],
    },
  },

  // ─ Automation Sources ─────────────────────────────────────────────────────
  {
    name: "testmo_get_automation_source",
    description: "Get a single automation source by ID",
    inputSchema: {
      type: "object",
      properties: {
        automation_source_id: { type: "number", description: "The automation source ID" },
        expands: { type: "string", description: "Comma-separated list of expands" },
      },
      required: ["automation_source_id"],
    },
  },
  {
    name: "testmo_list_automation_runs",
    description: "List automation test runs for a project",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "number", description: "The project ID" },
        source_id: {
          type: "string",
          description: "Comma-separated automation source IDs to filter by",
        },
        page: { type: "number", description: "Page number" },
        per_page: { type: "number", description: "Results per page" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "testmo_get_automation_run",
    description: "Get details of a specific automation run",
    inputSchema: {
      type: "object",
      properties: {
        automation_run_id: { type: "number", description: "The automation run ID" },
      },
      required: ["automation_run_id"],
    },
  },
  {
    name: "testmo_create_automation_run",
    description: "Create a new automation run to submit test results",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "number", description: "The project ID" },
        name: { type: "string", description: "Run name" },
        source: { type: "string", description: "Source identifier (e.g. 'frontend', 'api-tests')" },
        milestone_id: { type: "number", description: "Associate with a milestone" },
      },
      required: ["project_id", "name", "source"],
    },
  },
  {
    name: "testmo_submit_automation_result",
    description:
      "Submit a test result to an automation run (creates a thread and appends the test)",
    inputSchema: {
      type: "object",
      properties: {
        automation_run_id: { type: "number", description: "The automation run ID" },
        name: { type: "string", description: "Test name" },
        status_id: {
          type: "number",
          description: "Status (1=Untested, 2=Passed, 3=Failed, 4=Retest, 5=Blocked, 6=Skipped)",
        },
        duration_ms: { type: "number", description: "Duration in milliseconds" },
        message: { type: "string", description: "Optional failure message or log" },
      },
      required: ["automation_run_id", "name", "status_id"],
    },
  },
  {
    name: "testmo_complete_automation_run",
    description: "Mark an automation run as complete",
    inputSchema: {
      type: "object",
      properties: {
        automation_run_id: { type: "number", description: "The automation run ID" },
      },
      required: ["automation_run_id"],
    },
  },

  // ─ Test Cases (repository cases) ─────────────────────────────────────────
  {
    name: "testmo_list_cases",
    description: "List repository test cases for a project",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "number", description: "The project ID" },
        folder_id: { type: "number", description: "Filter by folder ID" },
        template_id: { type: "number", description: "Filter by template ID" },
        created_after: { type: "string", description: "Filter by creation date (ISO 8601)" },
        page: { type: "number", description: "Page number" },
        per_page: { type: "number", description: "Results per page" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "testmo_create_case",
    description: "Create one or more repository test cases in a project",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "number", description: "The project ID" },
        name: {
          type: "string",
          description: "Case name (for single case; use cases array for multiple)",
        },
        folder_id: { type: "number", description: "Folder ID (for single case)" },
        cases: {
          type: "array",
          description:
            "Array of cases to create; each has name and optional folder_id, template_id, state_id, estimate",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              folder_id: { type: "number" },
              template_id: { type: "number" },
              state_id: { type: "number" },
              estimate: { type: "number" },
            },
            required: ["name"],
          },
        },
      },
      required: ["project_id"],
    },
  },
  {
    name: "testmo_update_case",
    description: "Update one or more repository test cases",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "number", description: "The project ID" },
        ids: { type: "array", items: { type: "number" }, description: "Case IDs to update" },
        name: { type: "string", description: "New name (optional)" },
        folder_id: { type: "number", description: "New folder ID (optional)" },
        state_id: { type: "number" },
        status_id: { type: "number" },
        estimate: { type: "number" },
      },
      required: ["project_id", "ids"],
    },
  },
  {
    name: "testmo_get_case",
    description: "Get a single repository test case by ID (looks up via project cases list)",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "number", description: "The project ID" },
        case_id: { type: "number", description: "The case ID (repository case id)" },
        expands: {
          type: "string",
          description: "Comma-separated expands: history,comments,automation_links,tags,etc.",
        },
      },
      required: ["project_id", "case_id"],
    },
  },
  {
    name: "testmo_delete_case",
    description: "Delete one or more repository test cases",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "number", description: "The project ID" },
        ids: { type: "array", items: { type: "number" }, description: "Case IDs to delete" },
      },
      required: ["project_id", "ids"],
    },
  },

  // ─ Folders ────────────────────────────────────────────────────────────────
  {
    name: "testmo_list_folders",
    description: "List repository folders for a project",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "number", description: "The project ID" },
        parent_id: { type: "number", description: "Filter by parent folder ID" },
        page: { type: "number" },
        per_page: { type: "number" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "testmo_get_folder",
    description: "Get a single repository folder by ID (looks up via project folders list)",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "number", description: "The project ID" },
        folder_id: { type: "number", description: "The folder ID" },
      },
      required: ["project_id", "folder_id"],
    },
  },
  {
    name: "testmo_create_folder",
    description: "Create one or more repository folders",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "number", description: "The project ID" },
        name: { type: "string", description: "Folder name (for single folder)" },
        parent_id: { type: "number", description: "Parent folder ID (for single folder)" },
        folders: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              parent_id: { type: "number" },
              docs: { type: "string" },
            },
            required: ["name"],
          },
        },
      },
      required: ["project_id"],
    },
  },
  {
    name: "testmo_update_folder",
    description: "Update one or more repository folders",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "number", description: "The project ID" },
        ids: { type: "array", items: { type: "number" } },
        name: { type: "string" },
        parent_id: { type: "number" },
        docs: { type: "string" },
      },
      required: ["project_id", "ids"],
    },
  },
  {
    name: "testmo_delete_folder",
    description: "Delete one or more repository folders",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "number", description: "The project ID" },
        ids: { type: "array", items: { type: "number" }, description: "Folder IDs to delete" },
      },
      required: ["project_id", "ids"],
    },
  },

  // ─ Sessions ───────────────────────────────────────────────────────────────
  {
    name: "testmo_list_sessions",
    description: "List exploratory test sessions for a project",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "number", description: "The project ID" },
        page: { type: "number", description: "Page number" },
        per_page: { type: "number", description: "Results per page" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "testmo_get_session",
    description: "Get details of a specific exploratory session",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "number", description: "The session ID" },
      },
      required: ["session_id"],
    },
  },

  // ─ Groups ─────────────────────────────────────────────────────────────────
  {
    name: "testmo_get_group",
    description: "Get a single group by ID",
    inputSchema: {
      type: "object",
      properties: {
        group_id: { type: "number", description: "The group ID" },
        expands: { type: "string", description: "Comma-separated list of expands" },
      },
      required: ["group_id"],
    },
  },

  // ─ Roles ──────────────────────────────────────────────────────────────────
  {
    name: "testmo_get_role",
    description: "Get a single role by ID",
    inputSchema: {
      type: "object",
      properties: {
        role_id: { type: "number", description: "The role ID" },
        expands: { type: "string", description: "Comma-separated list of expands" },
      },
      required: ["role_id"],
    },
  },

  // ─ Users ──────────────────────────────────────────────────────────────────
  {
    name: "testmo_get_current_user",
    description: "Get the current authenticated user's profile",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "testmo_list_users",
    description: "List all users in the Testmo instance",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number", description: "Page number" },
        per_page: { type: "number", description: "Results per page" },
      },
    },
  },
  {
    name: "testmo_get_user",
    description: "Get a single user by ID",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "number", description: "The user ID" },
        expands: { type: "string", description: "Comma-separated list of expands" },
      },
      required: ["user_id"],
    },
  },
];

// ── API client setup (@testmo/testmo-api) ───────────────────────────────────

function createTestmoApis(instanceUrl, token) {
  const basePath = instanceUrl.replace(/\/+$/, "");
  const client = new testmo.ApiClient(basePath);
  client.authentications.bearerAuth.accessToken = token;

  return {
    projects: new testmo.ProjectsApi(client),
    milestones: new testmo.MilestonesApi(client),
    runs: new testmo.RunsApi(client),
    runResults: new testmo.RunResultsApi(client),
    user: new testmo.UserApi(client),
    users: new testmo.UsersApi(client),
    sessions: new testmo.SessionsApi(client),
    automationRuns: new testmo.AutomationRunsApi(client),
    automationSources: new testmo.AutomationSourcesApi(client),
    repositoryCases: new testmo.RepositoryCasesApi(client),
    folders: new testmo.FoldersApi(client),
    groups: new testmo.GroupsApi(client),
    roles: new testmo.RolesApi(client),
  };
}

// Status ID to Testmo status alias (configurable in Testmo admin)
const STATUS_ID_TO_ALIAS = {
  1: "untested",
  2: "passed",
  3: "failed",
  4: "blocked",
  5: "retest",
  6: "skipped",
};

function statusAlias(statusId) {
  return STATUS_ID_TO_ALIAS[statusId] ?? "untested";
}

// Slug for automation test key (a-z0-9_, max 64)
function slugForKey(name) {
  const s = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 64);
  return s || `test_${Math.random().toString(36).slice(2, 10)}`;
}

// ── Tool Handlers ─────────────────────────────────────────────────────────────

async function handleTool(apis, name, args) {
  const a = args || {};

  switch (name) {
    // Projects
    case "testmo_list_projects":
      return apis.projects.getProjectPage({
        page: a.page,
        perPage: a.per_page,
      });
    case "testmo_get_project": {
      const row = await apis.projects.getProject(a.project_id);
      return row?.result ?? row;
    }

    // Milestones
    case "testmo_list_milestones":
      return apis.milestones.getMilestonePage(a.project_id, {
        page: a.page,
        perPage: a.per_page,
      });
    case "testmo_get_milestone": {
      const row = await apis.milestones.getMilestone(a.milestone_id);
      return row?.result ?? row;
    }

    // Runs
    case "testmo_list_runs":
      return apis.runs.getRunPage(a.project_id, {
        milestoneId: a.milestone_id != null ? String(a.milestone_id) : undefined,
        page: a.page,
        perPage: a.per_page,
      });
    case "testmo_get_run": {
      const row = await apis.runs.getRun(a.run_id);
      return row?.result ?? row;
    }
    case "testmo_list_run_results":
      return apis.runResults.getRunResultPage(a.run_id, {
        statusId: a.status_id != null ? String(a.status_id) : undefined,
        createdBy: a.created_by != null ? String(a.created_by) : undefined,
        createdAfter: a.created_after,
        createdBefore: a.created_before,
        expands: a.expands,
        page: a.page,
        perPage: a.per_page,
      });

    // Automation sources
    case "testmo_get_automation_source": {
      const srcRow = await apis.automationSources.getAutomationSource(a.automation_source_id, {
        expands: a.expands,
      });
      return srcRow?.result ?? srcRow;
    }

    // Automation runs
    case "testmo_list_automation_runs":
      return apis.automationRuns.getAutomationRunPage(a.project_id, {
        sourceId: a.source_id,
        page: a.page,
        perPage: a.per_page,
      });
    case "testmo_get_automation_run": {
      const row = await apis.automationRuns.getAutomationRun(a.automation_run_id);
      return row?.result ?? row;
    }
    case "testmo_create_automation_run": {
      const createRun = testmo.CreateAutomationRun.constructFromObject({
        name: a.name,
        source: a.source,
        milestone_id: a.milestone_id,
      });
      return apis.automationRuns.createAutomationRun(a.project_id, createRun);
    }
    case "testmo_submit_automation_result": {
      const runId = a.automation_run_id;
      const threadPayload = testmo.CreateAutomationRunThread.constructFromObject({});
      const created = await apis.automationRuns.createAutomationRunThread(runId, threadPayload);
      const threadId = created?.id;
      if (threadId == null) throw new Error("Failed to create automation run thread");
      const elapsedUs = a.duration_ms != null ? a.duration_ms * 1000 : undefined;
      const testPayload = testmo.AppendToAutomationRunThread.constructFromObject({
        tests: [
          {
            key: slugForKey(a.name),
            name: a.name,
            status: statusAlias(a.status_id),
            folder: "default",
            elapsed: elapsedUs,
            fields: a.message ? [{ type: 2, name: "message", value: a.message }] : undefined,
          },
        ],
      });
      await apis.automationRuns.appendToAutomationRunThread(threadId, testPayload);
      await apis.automationRuns.completeAutomationRunThread(
        threadId,
        testmo.CompleteAutomationRunThread.constructFromObject({})
      );
      return { thread_id: threadId, submitted: true };
    }
    case "testmo_complete_automation_run":
      await apis.automationRuns.completeAutomationRun(
        a.automation_run_id,
        testmo.CompleteAutomationRun.constructFromObject({})
      );
      return { completed: true };

    // Repository cases
    case "testmo_get_case": {
      const caseId = a.case_id;
      let page = 1;
      const perPage = 100;
      for (;;) {
        const pageData = await apis.repositoryCases.getCasesPage(a.project_id, {
          page,
          perPage,
          sort: "repository_cases:id",
          order: "asc",
          expands: a.expands,
        });
        const list = pageData?.result ?? [];
        const found = list.find((c) => c.id === caseId || c.key === caseId);
        if (found) return found;
        if (list.length < perPage || page >= (pageData?.last_page ?? page)) break;
        page += 1;
      }
      throw new Error(`Case with id ${caseId} not found in project ${a.project_id}`);
    }
    case "testmo_list_cases":
      return apis.repositoryCases.getCasesPage(a.project_id, {
        folderId: a.folder_id != null ? String(a.folder_id) : undefined,
        templateId: a.template_id != null ? String(a.template_id) : undefined,
        createdAfter: a.created_after,
        page: a.page,
        perPage: a.per_page,
      });
    case "testmo_create_case": {
      const casesPayload = Array.isArray(a.cases)
        ? a.cases
        : a.name
          ? [{ name: a.name, folder_id: a.folder_id }]
          : [];
      if (casesPayload.length === 0)
        throw new Error("Provide either 'cases' array or 'name' for a single case");
      const createCase = testmo.CreateRepositoryCase.constructFromObject({ cases: casesPayload });
      return apis.repositoryCases.createCases(a.project_id, createCase);
    }
    case "testmo_update_case": {
      const updateCase = testmo.UpdateRepositoryCase.constructFromObject({
        ids: a.ids,
        name: a.name,
        folder_id: a.folder_id,
        state_id: a.state_id,
        status_id: a.status_id,
        estimate: a.estimate,
      });
      return apis.repositoryCases.updateCases(a.project_id, updateCase);
    }
    case "testmo_delete_case": {
      const deleteCase = testmo.DeleteRepositoryCases.constructFromObject({ ids: a.ids });
      await apis.repositoryCases.deleteCases(a.project_id, deleteCase);
      return { deleted: a.ids.length };
    }

    // Folders
    case "testmo_get_folder": {
      const folderId = a.folder_id;
      let page = 1;
      const perPage = 100;
      for (;;) {
        const pageData = await apis.folders.getFoldersPage(a.project_id, {
          page,
          perPage,
        });
        const list = pageData?.result ?? [];
        const found = list.find((f) => f.id === folderId);
        if (found) return found;
        if (list.length < perPage || page >= (pageData?.last_page ?? page)) break;
        page += 1;
      }
      throw new Error(`Folder with id ${folderId} not found in project ${a.project_id}`);
    }
    case "testmo_list_folders":
      return apis.folders.getFoldersPage(a.project_id, {
        parentId: a.parent_id,
        page: a.page,
        perPage: a.per_page,
      });
    case "testmo_create_folder": {
      const foldersPayload = Array.isArray(a.folders)
        ? a.folders
        : a.name
          ? [{ name: a.name, parent_id: a.parent_id }]
          : [];
      if (foldersPayload.length === 0)
        throw new Error("Provide either 'folders' array or 'name' for a single folder");
      const createFolders = testmo.CreateRepositoryFolders.constructFromObject({
        folders: foldersPayload,
      });
      return apis.folders.createFolders(a.project_id, createFolders);
    }
    case "testmo_update_folder": {
      const updateFolders = testmo.UpdateRepositoryFolders.constructFromObject({
        ids: a.ids,
        name: a.name,
        parent_id: a.parent_id,
        docs: a.docs,
      });
      return apis.folders.updateFolders(a.project_id, updateFolders);
    }
    case "testmo_delete_folder": {
      const deleteFolders = testmo.DeleteRepositoryFolders.constructFromObject({ ids: a.ids });
      await apis.folders.deleteFolders(a.project_id, deleteFolders);
      return { deleted: a.ids.length };
    }

    // Sessions
    case "testmo_list_sessions":
      return apis.sessions.getSessionPage(a.project_id, {
        page: a.page,
        perPage: a.per_page,
      });
    case "testmo_get_session": {
      const row = await apis.sessions.getSession(a.session_id);
      return row?.result ?? row;
    }

    // Groups
    case "testmo_get_group": {
      const groupRow = await apis.groups.getGroup(a.group_id, { expands: a.expands });
      return groupRow?.result ?? groupRow;
    }

    // Roles
    case "testmo_get_role": {
      const roleRow = await apis.roles.getRole(a.role_id, { expands: a.expands });
      return roleRow?.result ?? roleRow;
    }

    // Users
    case "testmo_get_current_user":
      return apis.user.getCurrentUser();
    case "testmo_list_users":
      return apis.users.getUserPage({
        page: a.page,
        perPage: a.per_page,
      });
    case "testmo_get_user": {
      const userRow = await apis.users.getUser(a.user_id, { expands: a.expands });
      return userRow?.result ?? userRow;
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── MCP Server (stdio JSON-RPC 2.0) ──────────────────────────────────────────

const INSTANCE_URL = process.env.TESTMO_INSTANCE_URL;
const TOKEN = process.env.TESTMO_TOKEN;

if (!INSTANCE_URL || !TOKEN) {
  process.stderr.write(
    "Error: TESTMO_INSTANCE_URL and TESTMO_TOKEN environment variables are required.\n"
  );
  process.exit(1);
}

const apis = createTestmoApis(INSTANCE_URL, TOKEN);

function sendResponse(id, result) {
  const msg = JSON.stringify({ jsonrpc: "2.0", id, result });
  process.stdout.write(`${msg}\n`);
}

function sendError(id, code, message) {
  const msg = JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } });
  process.stdout.write(`${msg}\n`);
}

async function handleRequest(req) {
  const { id, method, params } = req;

  try {
    switch (method) {
      case "initialize":
        sendResponse(id, {
          protocolVersion: "2024-11-05",
          serverInfo: { name: "testmo-mcp-server", version: "1.0.0" },
          capabilities: { tools: {} },
        });
        break;

      case "notifications/initialized":
        break;

      case "tools/list":
        sendResponse(id, { tools: TOOLS });
        break;

      case "tools/call": {
        const { name, arguments: args } = params;
        try {
          const result = await handleTool(apis, name, args || {});
          sendResponse(id, {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          });
        } catch (err) {
          sendResponse(id, {
            content: [{ type: "text", text: `Error: ${err.message}` }],
            isError: true,
          });
        }
        break;
      }

      case "ping":
        sendResponse(id, {});
        break;

      default:
        sendError(id, -32601, `Method not found: ${method}`);
    }
  } catch (err) {
    sendError(id, -32603, err.message);
  }
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let req;
  try {
    req = JSON.parse(trimmed);
  } catch {
    sendError(null, -32700, "Parse error");
    return;
  }
  await handleRequest(req);
});

process.stderr.write(`Testmo MCP Server started (instance: ${INSTANCE_URL})\n`);
