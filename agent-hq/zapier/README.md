# Orvanta for Zapier (private integration)

Zapier app built with the Zapier Platform CLI (`zapier-platform-core` 19.2.1).

| Type | Key | What it does |
|---|---|---|
| Action | `ask_permission` | Asks Orvanta whether a sensitive action may run. Allowed → the Zap continues. Otherwise the Zap is halted and a request waits in Orvanta. If Orvanta cannot be reached the step fails, so the action never runs. |
| Action | `report_activity` | Reports a success or failure (with cost, input/output for AI review). |
| Trigger (REST hook) | `decision_made` | Fires when a human approves (or refuses) a request; carries the data kept by `ask_permission`. |
| Trigger (REST hook) | `agent_state_changed` | Fires when the agent is paused/resumed in Orvanta. Pair with Zapier Manager → Turn Zap On/Off. |

Authentication: Orvanta address + the agent's connection key (one connection per agent).

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

```bash
npm install -g zapier-platform-cli
zapier login                    # your Zapier account
cd agent-hq/zapier
zapier register "Orvanta"      # once: creates the private integration
zapier push                     # uploads version 1.0.0
zapier users:links              # invite link to share with pilot users
# or: zapier users:add someone@agency.com 1.0.0
```

Private integrations need no review by Zapier. Publishing publicly later is done from the Developer Platform (Publish → Submit for Review).
