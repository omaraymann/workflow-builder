# Workflow Builder

A visual AI workflow editor: every node holds a question, the model answers it with `YES` or `NO`, and that answer decides which edge execution follows.

Built with **Next.js** and **React Flow** on the front, **Inngest** running each node as a durable step behind it.

```
        "Is this a support request?"
           /                    \
        YES                      NO
         v                        v
   "Is it urgent?"        "Is it about pricing?"
```

The constraint carrying the whole design is that a node's answer is one of two words. A model that can only say `YES` or `NO` is returning a bit, and a bit is something a graph can branch on. Loosen it and this stops being a workflow engine.

## Run it

You need Node.js 20+.

```powershell
git clone https://github.com/omaraymann/workflow-builder.git
cd workflow-builder
copy .env.example .env.local     # macOS/Linux: cp .env.example .env.local
npm install
```

Then two terminals:

```powershell
npm run dev        # the app          -> http://localhost:3000
npm run inngest    # the job dashboard -> http://localhost:8288
```

## Configuration

Real values live in `.env.local`, which is git-ignored. `.env.example` is committed with placeholders.

| Variable | What it is |
|----------|------------|
| `OPENAI_BASE_URL` | which provider the client talks to |
| `OPENAI_API_KEY` | that provider's key |
| `OPENAI_MODEL` | the model each node's question is sent to |
| `INNGEST_DEV` | `1` to use the local Inngest Dev Server |

The `openai` package is the client, not the provider. It speaks a request shape most providers now copy, so pointing it at **OpenRouter** (hosted, free tier) or **Ollama** (local, free) is a change of base URL and nothing else. `.env.example` lists all three options.

## How it is put together

```
src/app/                 pages and API routes
src/app/api/inngest/     the endpoint the Inngest dev server talks to
src/inngest/             the Inngest client, and the workflow functions
src/components/flow/     React Flow canvas, custom nodes, custom edges
src/lib/                 model calls, graph helpers, shared types
```

Two rules keep the layers apart, both carried over from earlier assignments in this program:

- **`src/lib/` owns the model call.** Components never talk to a provider directly, the same way route handlers never contain SQL.
- **A model's answer is untrusted input.** It is checked against the two allowed values before it is allowed to choose an edge.

## Build phases

| Phase | What it adds | Status |
|-------|--------------|--------|
| 1 | Project setup, Inngest wired, env configured | in progress |
| 2 | Canvas, node creation, edges, prompt editing | not started |
| 3 | Execution through Inngest with AI branching | not started |
| 4 | Polish - execution state, logs, save/load, retries | not started |
