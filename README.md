# Internship Monitor — Product Design · Summer 2027

Watches 15 companies (Google, YouTube, Meta, Apple, Capital One, JPMorgan Chase,
Roblox, Microsoft, Amazon, IBM, Adobe, American Express, Mastercard, Visa, Nike)
every 3 hours and notifies you **immediately** when:

1. a matching internship posting has **never been seen before**, or
2. an existing posting goes from **closed → open**, or
3. a posting's **title changes**.

Notifications go out via **Twilio SMS**, **Discord webhook**, and a live
**status feed** that powers two mac widgets (a glass dashboard + an Übersicht
desktop widget). A **daily summary** is sent at 8 PM. Everything is logged.

---

## Project layout

```
internship-monitor/
├── config/config.json        ← companies, keywords, schedule (edit freely)
├── .env                      ← secrets (copy from .env.example)
├── src/
│   ├── index.ts              ← entry: cron scheduler / --once / --summary
│   ├── monitor.ts            ← one full check cycle
│   ├── summary.ts            ← daily summary text
│   ├── config/               ← config + secrets loading
│   ├── scrapers/             ← BaseScraper + one scraper per platform
│   ├── database/             ← SQLite layer + the diff engine
│   ├── notifiers/            ← SMS, Discord, widget feed
│   ├── utils/                ← logger, retry/backoff, robots.txt, hashing
│   └── tests/                ← diff-engine unit tests + E2E pipeline test
├── widget/
│   ├── dashboard.html        ← glass dark-blue dashboard (open in any browser)
│   └── internship-monitor.widget/  ← Übersicht desktop widget
├── data/                     ← internships.db (SQLite) + status.json (widget feed)
├── logs/                     ← one log file per day
└── .github/workflows/monitor.yml   ← runs it all automatically every 3 h
```

## Quick start (local, 5 minutes)

```bash
npm install
npx playwright install chromium     # one-time browser download
cp .env.example .env                # fill in what you have; blank = dry-run
npm run build

npm test                # diff-engine unit tests (7 scenarios)
npm run check           # ONE check cycle right now (great first test)
npm run summary         # send/print the daily summary
npm start               # long-running mode: every 3 h + 8 PM summary
```

With no Twilio credentials in `.env`, SMS runs in **dry-run** — the exact
message text is printed to the log instead of sent. Discord behaves the same
without a webhook URL. So you can test everything today and add credentials
whenever.

### Twilio setup (when you're ready)

1. Create an account at twilio.com → get a free trial number.
2. Console → Account Info: copy **Account SID** and **Auth Token**.
3. Put them in `.env` (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
   `TWILIO_FROM_NUMBER` = your Twilio number, `NOTIFY_PHONE_NUMBER` = your cell).
   On a trial account you must verify your own number in the console first.

### Discord setup (2 minutes, free)

Server Settings → Integrations → Webhooks → New Webhook → Copy URL → paste
into `DISCORD_WEBHOOK_URL` in `.env`.

## Running it 24/7 with GitHub Actions (recommended)

1. Create a **private** GitHub repo and push this folder to it.
2. Repo → Settings → Secrets and variables → Actions → add:
   `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`,
   `NOTIFY_PHONE_NUMBER`, `DISCORD_WEBHOOK_URL` (add the ones you have; missing
   ones just mean dry-run for that channel).
3. Repo → Actions tab → enable workflows. Done.

The workflow (`.github/workflows/monitor.yml`):

- runs a check every 3 hours and the daily summary at 8 PM Chicago,
- commits `data/internships.db` + `data/status.json` back to the repo so state
  persists between runs — the repo becomes the database,
- can be fired manually: Actions → Internship Monitor → Run workflow.

> GitHub schedules can drift a few minutes under load — normal and harmless.

## The mac widgets

Both read the same feed: `data/status.json`, republished after every check.
Once the repo is on GitHub, the feed's public URL is
`https://raw.githubusercontent.com/<you>/<repo>/main/data/status.json`
(for a private repo, keep the widget local-file mode or make the repo public).

**Glass dashboard** — open `widget/dashboard.html` in any browser (or keep the
Cowork artifact version). Append `?feed=<your raw URL>` or edit the `FEED_URL`
constant at the top of the file. Auto-refreshes every 5 minutes.

**Übersicht desktop widget** — a true always-on-desktop macOS widget:

1. Install Übersicht (free): https://tracesof.net/uebersicht/
2. Copy `widget/internship-monitor.widget/` into
   `~/Library/Application Support/Übersicht/widgets/`
3. Edit `index.jsx`: set `FEED_URL` (or `USE_LOCAL_FILE = true` + `LOCAL_PATH`
   if the monitor runs on this Mac).

## Editing what's monitored — `config/config.json`

- **companies** — add/remove/disable (set `"enabled": false`). New companies can
  use `"scraper": "generic"` (harvests job links + keyword-filters them) until
  you want a dedicated scraper.
- **filtering.roleKeywords / programKeywords / excludeKeywords** — what counts
  as a match. `mode: "loose"` (default) = any PD/UX internship, with explicit
  Summer-2027 postings tagged. `mode: "strict"` = only postings mentioning 2027.
- **schedule.checkCron / summaryCron / timezone** — local-mode schedule
  (`0 */3 * * *` = every 3 h). For GitHub Actions, edit the crons in
  `monitor.yml` too.

## How it stays sane (production behavior)

- **Retries with exponential backoff + jitter** on every page (2s → 4s → 8s…).
- **Cloudflare / bot walls detected** ("Just a moment…", "verify you are
  human") → treated as a failed scrape, retried, then skipped — never parsed
  as "all jobs disappeared".
- **A failed scrape never closes postings.** A posting is only marked closed
  after it's missing from **2 consecutive successful** scrapes.
- **robots.txt respected** (per-URL check, fails open politely, cached).
- **Every scraper fails soft** — one broken site never kills the run.
- **Notify conditions are unit-tested** (`npm test`, 7 scenarios) and the whole
  pipeline (browser → scraper → DB → SMS format → widget feed → summary) has an
  E2E test against a mock careers site (`npm run test:e2e`).

## Honest expectations

- **Summer 2027 postings mostly open Aug–Oct 2026.** Quiet until then is the
  system working. Loose mode means you'll still hear about evergreen PD/UX
  internship postings as they appear.
- Career sites redesign their markup. Every scraper has a generic link-harvest
  fallback, but if a company logs failures for days, that scraper may need a
  selector update — the log file tells you exactly which one.
- Workday/Phenom sites sometimes rate-limit CI IP ranges. The backoff handles
  transient blocks; persistent ones are logged, never fatal.
