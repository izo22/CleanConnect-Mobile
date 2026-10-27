# Connect Zapier to Orvanta

The **Orvanta app for Zapier** is a private integration: you get access through an invite link from your Orvanta contact. Once you accept it, the Orvanta steps appear in the Zap editor like any other app.

## What it does

| Level | How | Result |
|---|---|---|
| **Control** (the most important) | An **Orvanta · Ask Permission** step right before the sensitive action, plus a second Zap that starts from **Orvanta · Decision Made** | The action **never** runs without being allowed. Under your thresholds, it goes through right away. Above them, it waits for your **Approve** in Orvanta. If Orvanta cannot be reached, the step fails and nothing goes out. |
| **See** | An **Orvanta · Report Activity** step at the end of the Zap (and on failure paths) | Tasks, failures, cost, plain-English alerts, and AI review of the answers if you send the question and the answer. |
| **Stop** | A small Zap: **Orvanta · Agent Paused or Resumed** → **Zapier Manager · Turn Zap On/Off** | **Pause** in Orvanta switches the matching Zap off. A paused agent is also refused directly by **Ask Permission**. |

**Difference with n8n:** Zapier does not let Orvanta read your Zaps on its own (that requires partner access, coming later). Monitoring therefore goes through the **Report Activity** step you add, and the emergency stop through the small Zap above.

## Connect the app (once per agent)

1. In Orvanta, open the agent that the Zap represents (create it in **My AI team → Add an agent** if needed), then **Connection → Show the connection key**.
2. In Zapier, add any Orvanta step and click **Sign in**:
   - *Orvanta Address*: the address you use to open Orvanta, for example `https://hq.your-company.com`;
   - *Agent Connection Key*: the key from step 1.

Each agent has its own key, so each agent gets its own Zapier connection. The connection is named after the agent.

## Recipe 1: a refund that waits for your go-ahead

**Zap 1: "Ask"**
1. Trigger: your usual trigger (new ticket, form…).
2. **Orvanta · Ask Permission**:
   - *Action*: `stripe.refund` (your guardrails match on this name);
   - *Summary*: `Refund ${{amount}} to {{customer}}` (the sentence you will read);
   - *Amount*: `{{amount}}`;
   - *Data to Keep for the Approved Action*: everything the action will need (order ID, customer email, amount…).
3. The refund action (Stripe…).

→ **Under the threshold**, step 3 runs right away. **Above it**, the Zap stops cleanly (status *halted* in Zapier, with the message "Waiting for approval in Orvanta") and the request shows up in **Decisions**.

**Zap 2: "Run once approved"**
1. Trigger: **Orvanta · Decision Made**, with *Only Approved Requests* = yes and *Only for This Action* = `stripe.refund`.
2. The refund action, using the fields under *Payload* (order ID, email…).

→ When you click **Approve** in Orvanta, this Zap runs within seconds. **Decline**: nothing happens.

## Recipe 2: emergency stop

1. Trigger: **Orvanta · Agent Paused or Resumed**, *When the Agent Is* = *Paused*.
2. Action: **Zapier Manager · Turn Zap On/Off** → the agent's Zap, *Off*.

Build a second identical Zap with *Resumed* → *On* if you want **Resume** to switch it back on.

## Recipe 3: see what the agent does

Add **Orvanta · Report Activity** as the last step of the Zap:

- *Action*: what the Zap did, for example `zendesk.reply`;
- *Status*: *Success* (add a second Report Activity on the error path with *Failure* and the *Error Message*);
- *What the Agent Received* and *What the Agent Answered or Did*: needed for the AI review to spot wrong or made-up answers;
- *Cost*: the AI cost of the task, if you know it.

## Good to know

- **Requirement:** Orvanta must be reachable on the internet over **https**. Zapier's servers call it, and Orvanta only sends notifications to public https addresses.
- **Ask Permission without stopping:** set *Stop the Zap Unless Allowed* to false if you prefer to keep the Zap running and decide with a Filter step on the *Allowed* field.
- **What we tested:** 12 automated checks with Zapier's own test engine against a real Orvanta server (connection and wrong key, $45 allowed, $340 held for approval, approval delivered with the kept data, decline that triggers nothing, pause delivered, paused agent refused, Orvanta unreachable so nothing runs, activity and alerts, unsubscribing). The app also passes Zapier's official `zapier validate` check.
