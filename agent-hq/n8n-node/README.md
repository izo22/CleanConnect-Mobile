# n8n-nodes-orvanta

Ask a human before your n8n workflows and AI agents take a risky action.

[Orvanta](https://orvantahq.io) is the control room for the AI agents and automations a business runs. This package adds two nodes to n8n:

- **Orvanta Ask Permission**: put it right before a risky step (send a quote, issue a refund, pay a supplier, reply to a customer). Orvanta checks the owner's rules and answers:
  - **allowed**: the item leaves by the **Approved** output right away;
  - **needs approval**: the workflow waits until someone clicks **Approve** or **Decline** in Orvanta (or in Slack/Teams), then continues by **Approved** or **Declined**, with the same item it had before;
  - **refused** (agent paused, out of budget, out of policy): the item leaves by **Declined**.
- **Orvanta**: report what the workflow did (success or failure, cost, answer), so Orvanta can show it on the dashboard, raise alerts and review answers.

Rules are written in plain English in Orvanta, for example *"Over $5,000, I approve"*, *"No customer email between 10 pm and 7 am"* or *"Never promise a discount over 10%"*. Every decision is logged with who approved it and when.

## Installation

In n8n: **Settings → Community Nodes → Install a node**, enter `n8n-nodes-orvanta`.

See the [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/installation/).

## Credentials

1. Create a free account at [orvantahq.io](https://orvantahq.io).
2. In **My AI team**, add an agent for this workflow (source: n8n) and copy its key (`ahq_…`).
3. In n8n, create an **Orvanta API** credential: paste the key. Keep the URL `https://app.orvantahq.io` unless you run your own Orvanta.

## Usage

```
Trigger → … → Orvanta Ask Permission ─Approved→ Send quote email
                                      └Declined→ (optional) notify the team
```

| Field | What to put |
|---|---|
| Action | What the next step does, e.g. `quote.send`, `stripe.refund`. Rules can target an action name. |
| Summary | The sentence the approver reads, e.g. `Send a $18,400 quote to {{ $json.customer }}` |
| Amount | The amount, for rules such as "Over $5,000, I approve". 0 if none. |
| Options | Always ask me, recipient, details, text about to be sent (read by Orvanta's AI check), maximum wait (default 24 h; after that, the item leaves by Declined). |

The item that reaches **Approved** after a wait is the item the node received: Orvanta keeps a copy of its JSON while it waits. Binary data is not kept across a wait.

**Good to know**

- The node waits for one approval at a time. For a list, put a **Loop Over Items** node (batch size 1) before it.
- Orvanta wakes the workflow up by calling its resume URL, so your n8n must be reachable over HTTPS (n8n Cloud is).

## Compatibility

Tested with n8n 2.x.

## Resources

- [How Orvanta works](https://orvantahq.io/how-it-works)
- Support: orvanta.contact@gmail.com

## License

[MIT](LICENSE)
