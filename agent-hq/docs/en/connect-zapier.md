# Connect Zapier to Orvanta

With version **1.2.0** of the Orvanta app for Zapier, one key covers every Zap of a workspace, and each Zap becomes an agent in Orvanta, like n8n workflows. Everything is set from **Connections → Zapier**, step by step.

## What it does

| Feature | How |
|---|---|
| **See failures** of every Zap | One Zap to set up once: *Zapier Manager → New Zap Error* → *Orvanta → Report a Zap Error*. Each failing Zap creates or updates its agent, with the alert. |
| **See successes** | An *Orvanta → Report Activity* step at the end of the Zap (the one thing Zapier never reports on its own). |
| **Ask permission** | An *Orvanta → Ask Permission* step right before the sensitive action. The Zap **waits** for your click in Decisions (up to 30 days), then goes on by itself; declined, it stops. Amount thresholds, quiet hours, "I approve everything" and the AI check apply. |
| **Emergency stop** | One Zap to set up once: *Orvanta → Agent Paused or Resumed* (Agent empty = all) → *Zapier Manager*, the action that turns a Zap off. Even without it, a paused agent's Ask Permission steps are refused. |

**Why steps to add, when n8n connects by itself?** Zapier doesn't let outside tools read or change a customer's Zaps. Orvanta only sees what Zaps send it. Ready-to-copy Zaps (share links) spare the owner from building them.

## The Zapier key and the "Agent" field

- **Connections → Zapier → Create my Zapier key** (workspace owner). The key starts with `ozk_`.
- In Zapier, the first Orvanta step asks for the **Orvanta address** and this **key**. One connection for every Zap.
- Every Orvanta step has an **Agent** field: pick an existing agent, or type a name (tip: the Zap's) and Orvanta creates the agent the first time.
- An agent's own key (`ahq_…`) still works: the Agent field then doesn't show.
- **Create a new key** invalidates the old one: only if it leaked.

## Recipe: a quote that waits for your go-ahead

```
1. Gmail: new quote request
2. ChatGPT: writes the quote
3. Orvanta: Ask Permission       ← Agent: "Solar quotes"
                                    Summary: "Quote for {customer}: ${amount}"
                                    Amount: {amount}
                                    Text Received / Text About to Be Sent: for the AI check
                                    When Your Approval Is Needed: Wait for the decision, then go on
4. Gmail: sends the quote        ← only runs once allowed
5. Orvanta: Report Activity      ← optional, to count successes
```

- Under your thresholds: Orvanta answers "allowed" at once, the Zap goes on.
- Over them, or with "I approve everything": the request waits in **Decisions**. **Approve**: the Zap resumes at step 4. **Decline**: it stops.
- Orvanta unreachable: the step fails, so the email is not sent.

The former mode ("Stop this Zap" + a second Zap starting from *Decision Made*) is still available, and steps created before 1.2.0 keep it, so an action is never done twice.

## What the Orvanta administrator does (once for all clients)

1. Push version 1.2.0 of the app: see [zapier/README.md](../../zapier/README.md).
2. Build the "Watch all my Zaps" and "Emergency stop" Zaps in their own Zapier (and, optionally, an Ask Permission example), then copy their share links (*Zap → ⋯ → Share*).
3. Paste them, with the invite link, in **Administration → Zapier links**. They then show on every workspace's Connections → Zapier; without links, clients see how to do it by hand.

**Requirement:** Orvanta reachable from the internet over **https** (Zapier's servers call it, and Orvanta only calls back public https addresses).

## What was tested, and what was not

- ✅ **16 checks** with Zapier's official test runtime (*appTester*) against a live Orvanta, including: workspace key, agent list, agent created from a new name, Ask Permission waiting then resuming (approved) or stopping (declined), Zap error reported, an agent's pause reaching a workspace-wide subscription.
- ✅ 7 tests on the Orvanta side: key, agents by name, Zapier called back even when the decision comes first, private addresses and other workspaces refused, administrator links.
- ✅ Structure validated by Zapier's official tool.
- ❌ **Not yet tested in Zapier itself.** To check on a real account: Ask Permission's waiting ("callback"), the exact names of *Zapier Manager*'s triggers and actions, and whether they need a paid plan.
