# Connect n8n to Orvanta

This guide is for the person who builds and maintains the n8n workflows (agency or in-house team). Allow 5 minutes for levels 1 and 2, then 2 minutes per sensitive workflow for level 3.

## What Orvanta can and cannot do

| Level | What you do | What you get | Limit |
|---|---|---|---|
| **1. See** | Give Orvanta an n8n API key | Each workflow becomes an agent. Its successes, failures and error messages come in every 30 seconds. Incidents are explained in plain English. | n8n does not report the cost of AI calls. |
| **2. Stop** | Nothing more | **Pause** really **switches the workflow off** in n8n (measured: under 0.3 s). **Resume** switches it back on. If someone turns it back on in n8n while it is paused in Orvanta, Orvanta switches it off again. | An execution **already running** when you pause goes to the end. |
| **3. Control** | Paste the "Ask for permission" block before the sensitive step | The workflow **stops and waits** for your go-ahead in Orvanta before it refunds, pays or sends. Approved: it continues. Declined: it stops. | Only the steps protected by the block are controlled. |

In Orvanta, each agent shows the level it really has: *Monitoring + emergency stop* or *Checked before acting*.

## Levels 1 and 2: connect n8n

1. In n8n: **Settings → n8n API → Create an API key**.
2. Give it **only** these permissions:
   `workflow:list`, `workflow:read`, `workflow:activate`, `workflow:deactivate`, `execution:list`, `execution:read`.
   Orvanta never needs to create, edit or delete your workflows.
3. In Orvanta: **Connections → Connect an n8n server**, paste the n8n address and the key, then click **Test and connect**.

The workflows show up in **My AI team**. Fill in each one's owner and budget on its page.

## Level 3: make a workflow wait for the go-ahead

1. In Orvanta, open the agent's page (the workflow), then click **Copy the "Ask for permission" block for n8n**.
2. In n8n, open the workflow and paste the block (Ctrl+V or Cmd+V). It contains 7 nodes:

```
Ask for permission → Allowed? ──yes──────────────────────────────────────────→ [your sensitive step]
                        └─no→ Approval requested? ─yes→ Wait for the green light → Green light? ─yes→ [your sensitive step]
                                   └─no → Declined                                     └─no → Declined
```

3. Connect the block right **before** the sensitive step. Replace the node "Your sensitive action (replace me)" with your step, connected to **both** "yes" outputs.
4. In **Ask for permission**, adjust the JSON body:
   - `action`: for example `stripe.refund`, `email.send`, `quote.send`. Your guardrails match on this name ("refund over $200", "no customer email between 10 pm and 7 am").
   - `amount_cents`: the amount in cents, for example `Math.round($json.body.amount * 100)`.
   - `summary`: the sentence you will read in Orvanta, for example `'Refund $' + $json.body.amount + ' to ' + $json.body.customer`.
   - Leave `callback_url: $execution.resumeUrl` as is: it is the address Orvanta calls to wake the workflow up.
5. In your sensitive step, use the original data with `$('Your trigger name').item.json`. After the block, `$json` holds Orvanta's answer, not your data.
6. Save and activate the workflow.

### What happens next

- **Under your thresholds** (for example a $45 refund): Orvanta answers "allowed" right away and the workflow goes on without waiting.
- **Over your thresholds**, or for an agent at trust level 0: the request shows up in **Decisions**, marked "The workflow is on hold". The n8n execution is paused and uses nothing while it waits.
- **Approve**: Orvanta wakes the execution up; it goes through "Green light? → yes" and runs your step.
- **Decline**: the execution wakes up and ends on "Declined".
- **Nobody answers within 24 hours**: the execution wakes up on its own and ends on "Declined". You can change this delay in "Wait for the green light".
- **The agent is paused in Orvanta**: the request is declined immediately.
- **Orvanta cannot be reached** (outage, network): the "Ask for permission" node fails and **the workflow stops without running the sensitive step**. This is on purpose: when in doubt, nothing gets paid. If you would rather continue when Orvanta is unreachable, set *Settings → On Error → Continue* on that node, knowingly.

### Security

- The agent's key is visible in the HTTP node. To hide it, create an n8n credential of type *Header Auth* (`Authorization: Bearer <key>`) and use it in the node.
- Orvanta only calls back the connected n8n server: a `callback_url` pointing anywhere else is refused.

## What we tested

The whole flow is replayed automatically against a **real n8n** (version 2.44 at the last run): three test workflows, 16 checks, including:

- a workflow's failures become a plain-English alert;
- pausing really switches the workflow off, and resuming switches it back on;
- turning a paused workflow back on in n8n is undone by Orvanta;
- a $340 refund waits for approval and is only paid after **Approve**;
- a declined refund is never paid;
- a $45 refund goes through without waiting;
- if Orvanta cannot be reached, nothing is paid.
