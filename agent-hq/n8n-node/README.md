# n8n-nodes-orvanta

Keep your n8n workflows and AI agents under control with [Orvanta](https://orvantahq.io): ask permission before risky actions, continue when a human decides, and report activity for alerts and a full history.

Orvanta is the control center for the AI agents and automations a business runs: see what every workflow does, get alerted when something fails, set rules and budgets, pause any agent in one click, keep a tamper-evident history, and choose the few actions that should wait for an OK.

This package adds two nodes:

- **Orvanta**, with three operations:
  - **Ask Permission**: before a risky step (send a quote, issue a refund, pay a supplier, reply to a customer), checks the action against your Orvanta rules and returns the answer right away in `orvanta.decision`: `allow`, `needs_approval` or `deny`.
  - **Get Decision**: reads whether a request was approved, declined, or is still pending.
  - **Report Activity**: tells Orvanta what the workflow did (success or failure, cost, answer), for the dashboard, alerts and AI review.
- **Orvanta Trigger**: starts a workflow when someone approves or declines a request in Orvanta (or in Slack/Teams), or when an agent is paused or resumed.

Rules are written in plain English in Orvanta, for example *"Over $5,000, I approve"*, *"No customer email between 10 pm and 7 am"* or *"Never promise a discount over 10%"*. Every decision is logged with who approved it and when.

## Installation

In n8n: **Settings → Community Nodes → Install a node**, enter `n8n-nodes-orvanta`.

See the [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/installation/).

## Credentials

1. Create a free account at [orvantahq.io](https://orvantahq.io).
2. Add an agent for this workflow (source: n8n) and copy its key (`ahq_…`).
3. In n8n, create an **Orvanta API** credential: paste the key. Keep the URL `https://app.orvantahq.io` unless you run your own Orvanta.

## Usage

Put **Orvanta → Ask Permission** right before the step to protect, then branch on the answer with a **Switch** node (or an **If** node on `{{ $json.orvanta.allowed }}`):

```
Trigger → … → Orvanta (Ask Permission) → Switch on {{ $json.orvanta.decision }}
                                           ├ allow          → Send the quote
                                           ├ needs_approval → (optional) tell the team it's waiting
                                           └ deny           → (optional) notify the team
```

When a human decision is needed, finish the job in a second workflow that starts with **Orvanta Trigger** (event *Decision Made*):

```
Orvanta Trigger (Decision Made, only approved) → Send the quote
```

The trigger receives the item that was sent with Ask Permission (its JSON), plus `orvanta.approved`, `orvanta.decided_by` and `orvanta.output`. If the approver corrected the text before approving, `orvanta.output` holds the corrected version and `orvanta.edited` is `true`.

Prefer polling? Use **Orvanta → Get Decision** with the `approval_id` returned by Ask Permission, for example after a **Wait** node.

| Ask Permission field | What to put |
|---|---|
| Action | What the next step does, e.g. `quote.send`, `stripe.refund`. Rules can target an action name. |
| Summary | The sentence the approver reads, e.g. `Send a $18,400 quote to {{ $json.customer }}` |
| Options | Amount (for rules such as "Over $5,000, I approve"), always ask me, recipient, details for the approver, text about to be sent (read by Orvanta's AI check), text received, sensitive action. |

The Orvanta Trigger registers itself with Orvanta when the workflow is activated, so your n8n must be reachable over HTTPS (n8n Cloud is).

## Compatibility

Tested with n8n 2.x.

## Resources

- [How Orvanta works](https://orvantahq.io/how-it-works)
- Support: orvanta.contact@gmail.com

## License

[MIT](LICENSE)
