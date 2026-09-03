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
src/app/api/inngest/     the endpoint the Inngest dev server talks to
src/app/api/run/         start a run, and report its progress
src/inngest/             the Inngest client and the workflow runner
src/components/flow/     canvas, node types, and the run panel
src/lib/model.ts         the only file that calls a model
src/lib/runStore.ts      progress for recent runs, held in memory
src/lib/storage.ts       save, load, export and import a workflow
```

Two rules keep the layers apart, both carried over from earlier assignments in this program:

- **`src/lib/` owns the model call.** Components never talk to a provider directly, the same way route handlers never contain SQL.
- **A model's answer is untrusted input.** It is checked against the two allowed values before it is allowed to choose an edge.

## Build phases

| Phase | What it adds | Status |
|-------|--------------|--------|
| 1 | Project setup, Inngest wired, env configured | done |
| 2 | Canvas, node creation, edges, prompt editing | done |
| 3 | Execution through Inngest with AI branching | done |
| 4 | Outcome nodes, execution log, live state, save/load | done |

## How a run works

1. **Run workflow** posts the graph and the input text to `/api/run`.
2. That route validates the graph - every node has a question, exactly one node
   has no arrow into it - and rejects a bad one with a 400 before spending a
   single model call.
3. It sends a `workflow/run` event to Inngest and answers `202` immediately. No
   model call happens inside the request.
4. The Inngest function walks the graph from the starting node. Each node is one
   `step.run`, so a failure retries that node alone rather than replaying the run.
5. Each step asks the model the node's question about the input and accepts only
   `YES` or `NO`. Anything else throws, because an ambiguous answer cannot choose
   an edge.
6. That answer selects the outgoing edge with the matching handle. No edge means
   the branch has ended, which is how a run finishes.
7. A run is capped at 20 steps, so a graph containing a loop costs a few calls
   rather than an unbounded number of them.

## Two kinds of node

A **question** node is put to the model and branches on its answer. An **outcome**
node ends a run and reports a verdict - it is never sent to the model, because
"accept" is not a question. Earlier versions had only questions, so an endpoint
worked only by accident: the model was asked "accept", answered something
arbitrary, and the run stopped because nothing was connected after it.

## Seeing what happened

Every decision records the model's own reasoning alongside its verdict, and the
run panel shows both. A screening tool that rejects someone and cannot say why is
one you cannot defend.

That reasoning is also what makes the answers correct. Asked for a bare YES or NO
with no room to write, the model answers from impression - it read "1 year here,
2 years there" and said NO to "three or more years in total", because it had
nowhere to compute 1 + 2 first. These models think by writing; given no output
budget, they cannot think at all. The fix was to let it reason in one field and
commit in another, and validate only the second.

## What is not built

Run progress lives in memory in the Next.js process, so restarting the server
loses in-flight runs and history. That is the right trade for a local tool and
the wrong one for a deployment, where this belongs in Redis or a database - the
shape of the code would not change.

Every node also sees the same unchanged input; nothing accumulates along the
path. That makes this a decision tree rather than an agent, and passing data
along the edges is the change that would alter it.
