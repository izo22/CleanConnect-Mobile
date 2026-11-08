=== Orvanta Publish Guard ===
Contributors: orvanta
Requires at least: 5.6
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 0.1.0
License: GPLv2 or later

Nothing goes live without Orvanta's OK, even if an AI agent skips its own instructions.

== Description ==

An instruction in an agent's prompt ("ask before publishing") is a request, not a control: the agent can skip it.
This plugin moves the check into WordPress itself.

Every time a post is about to go live (REST API, block editor, XML-RPC, wp-cli), WordPress asks Orvanta first:

* Allowed by your rules: the post goes live as usual.
* Needs a human decision: the post is saved as "Pending". It goes live by itself once someone approves it in Orvanta (one tap, from the phone).
* Declined, or refused by a rule: the post stays Pending, with the reason.
* Orvanta can't be reached: the post stays Pending (fails closed). Nothing is published without an answer.

Safeguards:

* The plugin never trusts a callback: it always asks Orvanta directly what was decided.
* An approval is used once, then cleared.
* If the post is edited after it was sent for approval, the approval does not cover the new version: it is not published.
* If the approver corrects the text in Orvanta, the post is not published: apply the changes, then publish again.
* The REST API response of each post has an "orvanta" field (state, reason, approval_id), so the agent sees why its post isn't live.
* Each outcome is reported to Orvanta, so publishes and refusals show in the agent's activity and in the tamper-evident log.

Your WordPress passwords never leave the site. The plugin only holds the Orvanta key of your publishing agent.

== Installation ==

1. In Orvanta, open your publishing agent and copy its API key.
2. In WordPress: Plugins → Add New → Upload Plugin, choose orvanta-publish-guard.zip, then Activate.
3. Settings → Orvanta: paste the key. In "Users to guard", enter the WordPress username your agent publishes with (leave empty to check every publish, including people's).
4. Click "Test the connection".
5. Give the agent's WordPress user the Editor or Author role, not Administrator, so it cannot turn the plugin off.

== Limits of this version ==

* Edits to posts that are already live are not checked; only the move to "published" or "scheduled" is.
* Anything that writes directly to the database (bypassing WordPress) is not covered.
* Decisions arrive instantly when Orvanta can reach your site; otherwise WordPress checks every 5 minutes (WP-Cron, which runs when the site has visitors or a system cron).
