# Connect GoHighLevel to Orvanta

Every workflow of every GoHighLevel sub-account reports to one place. Each workflow becomes an agent in Orvanta, named after its sub-account and its name ("Bright Dental · Appointment reminders"), so an agency sees all its clients' workflows side by side.

Everything is set from **Connections → GoHighLevel**.

## What it does

| Feature | How |
|---|---|
| **See what each workflow does** | A *Webhook* action to the **activity address** after the important steps. |
| **See failures** | The same action on a failure branch, with `status=failure` and `error=…`. Alerts fire when failures pile up. |
| **Ask permission** | A *Webhook* action to the **ask-permission address** where the sensitive step was. Allowed by your rules, refused, or waiting for your click in Decisions. |
| **Continue after the decision** | A second workflow that starts with GoHighLevel's *Inbound Webhook* trigger. Orvanta posts the decision and the contact to it. |
| **Emergency stop** | Pause the agent in Orvanta: every ask-permission call of that workflow is refused, so the second workflow receives `approved = false`. |

GoHighLevel's webhook actions can't send a secret header, so the workspace's key is inside the two addresses (they start with `/api/v1/ghl/ogh_…`). Keep them private, and use **Create new addresses** if one leaks.

## Settings

Put them in the address's query string (`?action=sms.send`), in the action's **Custom data**, or in an `orvanta` object for a *Custom Webhook* JSON body.

| Setting | Used by | Meaning |
|---|---|---|
| `action` | both | What the step does, e.g. `sms.send`, `quote.send`. Rules can target it. |
| `agent` | both | Agent name, to override "Sub-account · Workflow". |
| `status`, `error` | activity | `status=failure` records a failure with its message. |
| `cost` | activity | AI cost of the step, in your currency. |
| `summary` | permission | The sentence you read in Decisions, e.g. `Send the quote to {{contact.name}}`. |
| `amount` | permission | For rules like "Over $5,000, I approve". `18,400.00` and `$18400` both work. |
| `always_ask` | permission | `true`: always wait for a human. |
| `sensitive` | permission | `true`: counts as a sensitive action. |
| `output` | permission | The text about to go out, read by the AI check. |
| `continue_url` | permission | The *Inbound Webhook* URL of the second workflow. |

The contact (`contact_id`, name, email, phone), the sub-account and the workflow are read from what GoHighLevel sends.

## Recipe: a quote that waits for your go-ahead

```
Workflow 1  "Quote follow-up"
  Trigger: Opportunity stage changed to "Quote ready"
  Webhook → <ask-permission address>
      Custom data: action = quote.send
                   summary = Send the quote to {{contact.name}}
                   amount = {{opportunity.monetary_value}}
                   continue_url = <Inbound Webhook URL of workflow 2>

Workflow 2  "Quote follow-up · send"
  Trigger: Inbound Webhook
  If/Else: approved is true
      → Send email (the quote) to the contact
      → Webhook → <activity address>?action=quote.send
```

What workflow 2 receives:

```json
{
  "approved": true,
  "decision": "approved",
  "contact_id": "…", "email": "…", "phone": "…", "first_name": "…",
  "action": "quote.send",
  "title": "Send the quote to Dana Brooks",
  "amount": 18400,
  "output": "the text, corrected by the approver if they edited it",
  "decided_by": "Isaac", "decided_at": "…"
}
```

When the rules decide on the spot, workflow 2 starts within seconds with `"automatic": true`.

## Limits

- GoHighLevel doesn't let outside tools pause a workflow: a paused agent's ask-permission calls are refused, but steps that don't ask go on.
- Only what workflows send is seen. A workflow without any Orvanta webhook stays invisible.
- *Inbound Webhook* is a premium trigger in GoHighLevel.
