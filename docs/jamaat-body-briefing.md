# KSIJ Travel Directory — A Briefing for the Jamaat Body

*A plain-language overview for the committee: what it is, how it works, who runs
it, what it costs, and what we need you to decide.*

---

## In one line

One shared web link that gives any travelling member a trusted local jamaat
contact, the masjid, and somewhere to stay — in any city across India. No app to
install, no login. It is already built and running as a working prototype for the
body to review.

## The need

When our members travel to an unfamiliar city, finding a reliable local jamaat
contact, the nearest masjid, or a musafir khana to stay in still depends on
word-of-mouth and personal networks. Newcomers and younger travellers often have
neither. This directory turns that scattered knowledge into one trusted,
always-available reference — pan-India from day one, with no city treated as the
default.

## How it works

The whole system is three plain steps. The community keeps it up to date; a
jamaat moderator keeps it trustworthy.

1. **Anyone contributes.** A community member fills in a short Google Form to add
   a contact, a masjid, a place to stay, or to report/remove an entry. No
   account, no app.
2. **A moderator reviews.** A named jamaat volunteer checks the entry in a
   familiar Google Sheet — the same as reviewing a spreadsheet. Nothing goes live
   until they approve it. No developer is needed.
3. **It appears on the website.** Approved entries show up on the public
   directory. A traveller opens one link, searches a city, and finds a local
   contact, the masjid, and somewhere to stay.

## Who runs it

Day-to-day moderation happens in an ordinary Google Sheet, so a non-technical
jamaat volunteer can approve an entry or fix a typo without a developer. The
website itself is hosted on Cloudflare and needs no servers to maintain. In
short: the community contributes, named moderators approve, and the site runs
itself. All it needs from the body is oversight — and the moderators to staff it.

## Privacy & safety

Protecting members' contact details was a first-class design goal, built into the
system — not an afterthought.

- **Phone numbers are never published in bulk.** They are shown one at a time,
  only when a visitor taps "Show number", protected by a bot check and rate
  limiting.
- **Consent is required.** A contact is only listed with the person's consent,
  and anyone can report or remove their own entry at any time.
- **Moderated.** Only entries a moderator has marked "live" are ever shown.
- **Unlisted by default.** The site currently ships unlisted — it is not found on
  Google — until the body decides the access posture.

## What it costs

**₹0 / month to run at launch scale.** The system is designed to sit inside the
free tiers of Cloudflare and Google. The only optional spending is a custom web
address.

| Item | Cost | Note |
|---|---|---|
| Website + hosting (Cloudflare) | ₹0 / month | Free tier covers the expected traffic. |
| Contributions (Google Form + Sheet) | ₹0 / month | Runs on an ordinary Google account. |
| Custom domain (optional) | ~$8–12 / year | Only if we want our own web address. |
| Extra capacity (only if very large) | ~$5 / month | Not needed at launch scale. |

## Where it stands

The directory is fully built and deployed as a working prototype, loaded with
sample cities so the body can see and use it today. What remains is adding real
jamaat data and switching on live community contributions — which is exactly what
the decisions below unlock.

## What we need you to decide

1. **Access posture** — Unlisted (share by link only) or fully public (findable
   on Google)?
2. **Moderators** — Name at least two jamaat volunteers to review and approve
   entries.
3. **Hotels & restaurants** — Keep these sections in the first version, or
   contacts + masjids + stay only?
4. **Web address** — Do we want a custom domain name, and if so, which?
5. **Endorsement** — Formal go-ahead to launch, and any rules about what may be
   listed.

---

*A live, non-technical version of this briefing is also available on the site
itself at **/howitworks**.*
