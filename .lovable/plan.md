
# Member Management, Call Tree & Birthday Emails

## 1. Sidebar + Onboarding entry point
- Remove **Onboarding Form** as a sidebar item under Member Management.
- On `/admin/members`, add a secondary button "Onboarding form" next to "Invite members" that opens the existing onboarding link/preview at `/admin/onboarding` (route stays, just hidden from nav).

## 2. Pending approvals — bulk approve
- Add a checkbox column to each pending application.
- Add a header bar: "Select all", "Approve selected", "Reject selected", with a running count.
- Approve/Reject buttons work on the current selection in one click.
- Per-row Approve/Reject stays for single decisions.

## 3. Call Tree (`/admin/calltree`)

### Concepts
- **Session**: a single call-tree run (name, created_at, status: draft → active → closed).
- **Pairing**: two members paired in a session (member_a, member_b). Odd member out becomes a "triad" appended to the last pair.

### Admin flow
1. **Create session**: pick chapter (optional), shuffle approved active members, generate pairs.
2. **Preview & adjust**: list of pairs with swap/regenerate buttons.
3. **Activate**: status → active, sends pairing emails to each member with:
   - Partner name + phone + email
   - A unique feedback link `/feedback/<token>`
4. **Download**: CSV export of the pairings (name, email, phone, partner name, partner contact).
5. **View feedback**: live table grouped by status (Doing Great / Not Sure / Needs Help) with a "Contact" shortcut (mailto + tel) for "Needs Help" rows.

### Member feedback page (`/feedback/$token`)
- Public route, no login. Shows partner info + radio:
  - 🟢 Doing Great
  - 🟡 Not Sure
  - 🔴 Needs Help
- Free-text "What did you learn?" box (optional).
- Submit → thank-you screen. Token is single-use (resubmission updates the same row).

## 4. Birthdays
- `/admin/birthdays` already lists upcoming birthdays. Add a daily-cron-driven email to today's celebrants ("Happy birthday from {community}!").
- Admin view gets a small "Last email run: ..." line and a "Send today's birthday emails now" manual trigger.

## 5. Email infrastructure
- Set up Lovable Emails (requires a sender domain).
- Templates:
  - **Pairing email** — partner details + feedback link
  - **Birthday email** — community-branded greeting
- These are transactional emails. Auth emails are out of scope for this turn.

## Data model (new tables)

```text
call_tree_sessions(id, community_id, chapter_id?, name, status, created_at, closed_at)
call_tree_pairings(
  id, session_id, member_a_id, member_b_id, member_c_id?,  -- c for odd triad
  feedback_token_a, feedback_token_b, feedback_token_c?,
  emailed_at
)
call_tree_feedback(
  id, pairing_id, member_id, status enum (doing_great|not_sure|needs_help),
  notes, submitted_at
)
```
Member directory currently lives in a local store — we'll keep that for selection but persist sessions/pairings/feedback in Supabase so the public feedback link works.

## Open items I need from you
1. **Email domain** — do you already have a domain you want emails sent from (e.g. `notify@kinfolk.app`)? If yes, I'll start the setup; if not, we can use the default sender for now and you can add a domain later.
2. **Pairing rule** — OK with random pairing within selected chapter, with the odd member added to the last pair as a triad? Or prefer skip-and-mark-unpaired?
3. **Birthday email cadence** — send once at 8 AM in the community's local time (need a timezone on the community), or just a single UTC send? Default suggestion: 8 AM UTC for now.
