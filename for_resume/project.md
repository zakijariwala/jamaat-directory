---
schema: 2
slug: ksij-travel-directory
title: KSIJ Travel Directory
tagline: Privacy-first community travel directory on Cloudflare
publish: true
reason: ""
status: active
kind: product
size: medium
started: 2026-07
ended: null
role: "Owner — scoped, designed, built, deployed"
summary: Built and deployed a pan-India community directory prototype at about $0 a month, where members' phone numbers never appear in bulk and nothing goes live without a named moderator's approval.
problem: Members travelling to an unfamiliar city relied on word of mouth to find a local community contact, the mosque and somewhere to stay, and newcomers often had neither.
stack: [TypeScript, Astro, Cloudflare Pages Functions, Cloudflare D1, Cloudflare KV, Cloudflare R2, Turnstile, Google Apps Script, Vitest]
categories: [cloud, security, product]
links: { live: "", docs: "", demo: "" }
metrics:
  - value: "$0"
    label: "monthly running cost at launch scale on free tiers (domain optional)"
    evidence: "docs/DEPLOYMENT.md (Costs)"
  - value: "60"
    label: "automated test cases across 6 suites, including a guard that no phone number reaches the public snapshot"
    evidence: "test/*.ts"
  - value: "8"
    label: "build stages delivered, from schema to backups and analytics"
    evidence: "handover.md ; commits 4d1ee2c..01fc133"
  - value: "1"
    label: "command to provision every Cloudflare resource and deploy"
    evidence: "scripts/provision.sh"
highlights:
  recruiter:
    - Owned the product from brief to deployed prototype, including a plain-language briefing, costs and decisions for the community committee.
    - Protected members' privacy by design, so phone numbers are revealed one at a time with rate limits and never published as a list.
    - Kept day-to-day running with non-technical volunteers, who moderate in a familiar spreadsheet while the system stays at about $0 a month.
  engineer:
    - D1 is the source of truth; a snapshot builder constructs public objects field by field, publishes only live and consented rows, and a test fails if any phone number leaks.
    - Client downloads one edge-cached JSON snapshot and searches it in memory with alias-aware matching, so search survives a poor connection.
    - Numbers come from a separate reveal endpoint with per-IP rate limiting in KV and Turnstile; ingest from the spreadsheet is HMAC-signed.
    - Community problem reports older than 48 hours without moderator action show a visible caution instead of letting an entry stay silently wrong.
    - A scheduled Worker backs D1 up to R2 nightly; schema changes ship as numbered migrations, and a provisioning script patches resource ids and deploys.
  story: ""
skills: [Privacy by design, Stakeholder communication, Cost-constrained architecture, Serverless operations, Backup and recovery, Non-technical operating model, Abuse prevention]
ai_assisted: true
media: []
todo_owner:
  - "Has the committee approved a public launch, and is there a public URL to add to links.live?"
  - "How many cities, contacts or facilities are live, and how many members have used it? The repo holds only seed data."
  - "Is this voluntary community work or a commissioned project? The entry describes it as built for the community."
  - "Why did you take this on? A 1–3 sentence first-person story would fill highlights.story."
  - "Has the first-party in-site intake experiment replaced the Google Form, or do both run?"
generated: { at: 2026-09-27, commit: f577678 }
---

## Overview

The KSIJ Travel Directory is a web directory of community contacts and facilities across India for a Khoja Shia jamaat network. A traveller opens one link, searches a city and gets a trusted local contact, the mosque, somewhere to stay and somewhere to eat. There is no login and no app. It runs on Cloudflare with a Google Form and Sheet as the intake and moderation surface, so volunteers can maintain it without a developer.

## The problem

Finding a reliable contact or a place to stay in an unfamiliar city depended on personal networks. Newcomers and younger travellers often had none. The information existed, scattered across people's phones, but sharing it openly would expose members' phone numbers to scraping and misuse.

## What I built

- A static Astro site with a home screen, city pages, search, a contribution guide, an about page with feedback, and a plain-language "how it works" page.
- A public snapshot endpoint that serves the whole directory without any phone numbers.
- A reveal endpoint that returns a single number on request, protected by rate limiting and a bot check.
- An intake path from a Google Form through Apps Script to a signed ingest endpoint, plus an experimental in-site form that stages submissions as pending, with an Excel round-trip for moderators.
- A flag and removal flow for reported problems, with a 48-hour caution.
- A nightly backup Worker, a deployment runbook with cost breakdown, a one-command provisioning script and a briefing document for the community body.

## Architecture

- **Intake:** Google Form and Sheet, with Apps Script posting HMAC-signed payloads, or the in-site contribute form.
- **Store:** D1 (SQLite) with numbered migrations for cities, contacts, facilities, flags, consent, contact provenance and feedback.
- **Publish:** Pages Functions rebuild a phone-free snapshot, cached at the edge for about 5 minutes.
- **Read:** the static site fetches the snapshot once and searches it on the device.
- **Reveal:** one number per request, rate limited per IP in KV, with Turnstile.
- **Operations:** a scheduled Worker writes nightly JSON backups to R2; analytics is cookieless.

## Key decisions

- **Numbers never travel in bulk.** Excluding phone numbers from the snapshot entirely, and building public objects field by field rather than copying database rows, makes a leak a code change that a test would catch.
- **Consent before publication.** An entry added by someone else is not published unless consent is recorded, and the contributor's relationship to the person is kept as a private trust note.
- **Keep the spreadsheet as the moderation tool.** A custom admin page would need a developer. The Sheet lets a named volunteer fix a typo or approve an entry in a tool they already know.
- **One snapshot, client-side search.** Shipping the directory once and searching in memory keeps the site usable on poor mobile connections and keeps Function requests low enough for the free tier.
- **Visible caution over silent errors.** Unresolved reports older than 48 hours show a warning, so a stale entry cannot mislead a traveller quietly.
- **Closed-set form fields.** Contribution fields such as role and languages became dropdowns and checkboxes to keep data consistent for moderators.

## Results

- All 8 build stages are complete and deployed as an unlisted prototype on Cloudflare Pages with seed data.
- Launch cost is effectively $0 a month on free tiers, plus an optional domain.
- A briefing for the community body sets out the need, how it works, who runs it and the decisions required.

## What's next

- Committee review and a decision on public launch and a custom domain.
- Enable Turnstile, web analytics and the R2 backup bucket in production.
- Load real content through the moderation workflow.
