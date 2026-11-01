# Orvanta for Zapier (private integration)

Zapier app built with the Zapier Platform CLI (`zapier-platform-core` 19.2.1).

| Type | Key | What it does |
|---|---|---|
| Action | `ask_permission` | Asks Orvanta before a sensitive action. Allowed → the Zap continues. Needs approval → by default the Zap **waits** (Zapier callback, up to 30 days) and resumes when someone clicks Approve in Orvanta; declined → halted. "Stop this Zap" keeps the former behaviour (halt, then `decision_made`). If Orvanta cannot be reached the step fails, so the action never runs. |
| Action | `report_activity` | Reports a success or failure (with cost, input/output for AI review). |
| Action | `report_zap_error` | Reports that a Zap failed. Paired once with *Zapier Manager → New Zap Error*, it watches every Zap of the account. |
| Trigger (REST hook) | `decision_made` | Fires when a human approves (or refuses) a request made in "Stop this Zap" mode; carries the data kept by `ask_permission`. |
| Trigger (REST hook) | `agent_state_changed` | Fires when an agent is paused/resumed in Orvanta (Agent empty = every agent of the workspace). Pair with Zapier Manager to turn the Zap off. |
| Trigger (hidden) | `agent_list` | Feeds the "Agent" dropdown. |

Authentication: Orvanta address + a connection key. The workspace's **Zapier key** (`ozk_…`, Connections → Zapier) covers every Zap: each step then has an **Agent** field (an existing agent, or a new name that Orvanta creates). An agent's own key (`ahq_…`) also works, without the Agent field.

## Test locally

```bash
# terminal 1, in agent-hq/
ALLOW_PRIVATE_HOOKS=true npm start
# terminal 2, in agent-hq/zapier/
npm install
AGENT_HQ_URL=http://localhost:8787 npm test
```

The tests run the app with Zapier's own `appTester` against a live Orvanta, and use a local server as the webhook receiver to exercise the REST hooks end to end.

## Publish privately and invite pilot users

Orvanta must be reachable from the internet over **https** (Zapier's servers call it, and Orvanta only pushes hooks to public https addresses).

The CLI command is `zapier-platform` (version 19). Without Node.js on the machine, run it in a throwaway container from `agent-hq/`:

```bash
sudo docker run --rm -it -v "$PWD/zapier":/app -w /app node:22 bash
npm install -g zapier-platform-cli && npm install
zapier-platform login --sso            # paste a deploy key from developer.zapier.com → Deploy Keys
zapier-platform register "Orvanta"     # once: creates the private integration
zapier-platform push                   # uploads the version in package.json
zapier-platform users:links            # invite link to share with pilot users
# or: zapier-platform users:add someone@agency.com 1.2.0
```

Version 1.2.0 adds the workspace Zapier key, the Agent field, Ask Permission waiting for the decision, and Report a Zap Error (1.1.0 added Text Received / Text About to Be Sent for the AI check). After pushing it, move existing users with `zapier-platform migrate 1.0.0 1.2.0`. Delete the deploy key once you are done.

Private integrations need no review by Zapier. Publishing publicly later is done from the Developer Platform (Publish → Submit for Review).
