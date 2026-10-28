<p align="center">
  <img src="docs/images/hero.jpg" width="100%" alt="The FairShare home screen: Split trip costs. Settle up in a few payments, with a sample trip showing expenses, balances and the settle-up plan">
</p>

<p align="center">
  <a href="https://fairshare-trips.vercel.app"><img src="https://img.shields.io/badge/live-fairshare--trips.vercel.app-4d7c0f" alt="Live at fairshare-trips.vercel.app"></a>
  <img src="https://img.shields.io/badge/AI%20Innovation%20Arena-11th%20of%20241%20%C2%B7%20top%205%25-2563EB" alt="AI Innovation Arena: 11th of 241 submitted projects by Builder score, top 5 percent">
  <img src="https://img.shields.io/badge/arena%20evaluation-100%2F100-111827" alt="Scored 100 out of 100 on the arena's security, code quality, correctness, performance and accessibility evaluation">
  <img src="https://img.shields.io/badge/tests-178%20passing-4B5563" alt="178 tests pass">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-9CA3AF" alt="License: MIT"></a>
</p>

FairShare splits the cost of a trip between friends and tells you who owes whom. You add the people and the expenses as they happen, and it keeps a running balance for everyone plus the shortest list of payments that settles the trip. There is no backend and no account: everything lives in your browser, on your phone.

**Top 5% of 241 projects.** FairShare placed 11th by Builder score in HackerEarth's [AI Innovation Arena](https://vibecodearena.ai/ai-innovation-arena) on VibeCode Arena (September to October 2026): the last of the 10 runners-up named after the Highest Project Score winner, out of 241 projects on the arena's project leaderboard and 1,726 registered participants (top 1% of everyone who joined). Its final submission scored 100 on every axis of the arena's automated evaluation: security, code quality, correctness, performance and accessibility.

<p align="center">
  <img src="docs/images/arena-evaluation.png" width="100%" alt="HackerEarth VibeCode Arena evaluation of FairShare: Security, Code Quality, Correctness, Performance and Accessibility each scored 100">
</p>
<p align="center"><sub>The arena's automated evaluation of the final submission, as shown on HackerEarth's VibeCode Arena.</sub></p>

## Try it in 30 seconds

Open **[fairshare-trips.vercel.app](https://fairshare-trips.vercel.app)** on your phone, then:

1. name the trip, pick a currency and add two to ten people, then tap **Create trip**
2. tap **+** and add a few expenses: who paid, how much, and who it was for
3. open **Balances** to see who is up and who is down, then **Settle up** for the payments that clear it

Nothing you type leaves the page. Close the tab and come back later: the trip is still there.

## The problem

Group trips run on one person's card at a time. Someone books the stay, someone else pays for dinner, a third person covers fuel, and by day three nobody knows who is ahead. The usual fixes are a spreadsheet that one person maintains, or an app that wants everyone to sign up before you can split a pizza.

FairShare is the version you can open in a browser tab on the beach. One person keeps the trip on their phone, in whatever currency the trip is in, and at the end it hands you a short list of who pays whom.

## What you get

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/gallery-dark.png">
    <img src="docs/images/gallery-light.png" width="100%" alt="Five phone screens side by side: starting a trip, the expense list, adding an expense, balances, and the settle-up plan">
  </picture>
</p>
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/desktop-dark.png">
    <img src="docs/images/desktop-light.png" width="100%" alt="The desktop dashboard with expenses, balances and the settle-up plan on one screen">
  </picture>
</p>
<p align="center"><sub>Screenshots use demo data. Sam, Priya, Jonas and Mei are not real people, and nobody really ate €212.40 of seafood.</sub></p>

- trips of 2 to 10 people, with names checked for blanks and duplicates (ignoring case)
- expenses split equally between everyone or only the people who were there
- any currency: every ISO 4217 currency your browser knows, the common ones listed first and a default picked from your region, each with its own decimal places (none for the yen, three for the Kuwaiti dinar)
- live balances in plain words: **gets back**, **owes** or **settled**
- a settle-up plan of at most one payment fewer than the number of people; tap or swipe a payment to mark it paid, with **Undo**
- ad-hoc payments between friends, which move balances without inflating the trip total
- edit any expense or payment later; deletes come with a 10-second **Undo**
- **Copy summary** puts the plan on your clipboard as plain text, ready for the group chat
- a newest-first expense list on the phone, and a desktop dashboard that shows everything at once
- a settle-up diagram that draws each payment from payer to payee, and an "Everyone's square" moment when the trip is settled
- one colour per person, the same on every screen
- light and dark themes that follow your system, reduced motion when you ask for it
- export the whole trip as JSON, and import it again to restore it or move it to another device; imports are size-limited and checked like a saved trip
- a warning instead of silent data loss when the same trip is open in two tabs

## How it works

Every amount is stored as an integer number of minor units (cents for dollars, pence for pounds, whole yen for yen), so there is no floating-point money anywhere. A member's balance is what they paid minus their share of the expenses they were part of, adjusted for payments they recorded.

**Why the leftover cent goes to the first person.** $100 between three people is $33.33 each with one cent left over. FairShare gives that cent to the first participant in trip order, so the shares are $33.34, $33.33 and $33.33 and the balances always add up to exactly zero. The same rule works in any currency, whatever its smallest unit is.

**Why the plan is short.** The settle-up pass lines up who owes, largest debt first, and who is owed, largest credit first, then pays the head of one list to the head of the other with the smaller of the two amounts. Each payment clears at least one person, so a trip of *n* people needs at most *n* − 1 payments.

A worked example, using the demo trip from the screenshots before anyone has paid anyone back. It is a Lisbon trip in euros; the maths is the same in any currency.

| Expense | Paid by | Split between | Amount |
|---|---|---|---:|
| Alfama apartment | Sam | everyone | €840.00 |
| Pastéis de Belém | Priya | everyone | €18.60 |
| Sintra train | Jonas | Sam, Priya, Jonas | €31.20 |
| Seafood dinner | Mei | everyone | €212.40 |
| Tram 28 | Sam | Sam, Mei | €12.00 |
| Fado night | Priya | Priya, Jonas, Mei | €96.00 |

| Member | Balance | Settle up |
|---|---:|---|
| Sam | gets back **€567.85** | receives three payments |
| Priya | owes €195.55 | pays Sam €195.55 |
| Jonas | owes €278.95 | pays Sam €278.95 |
| Mei | owes €93.35 | pays Sam €93.35 |

Four people, three payments, and the balances sum to zero. In the screenshots Jonas has already paid Sam, so the plan is down to two. These numbers come straight from `computeBalances` and `computeSettlements` in [`core.js`](core.js).

## Architecture

```mermaid
flowchart LR
  UI["index.html + app.js<br/>forms, lists, dialogs"] -->|"validated input"| Core["core.js<br/>pure money, split and settle logic"]
  Core -->|"balances and plan"| UI
  UI <-->|"versioned JSON, revision-checked"| LS[("localStorage<br/>on this device")]
  UI -->|"Export"| File["trip.json download"]
```

The app is four static files and no runtime dependencies. [`core.js`](core.js) holds every rule that touches money (parsing, splitting, balances, the settle plan, validation and schema migration) as pure functions with no DOM access, which is why most of the tests can run in plain Node. [`app.js`](app.js) renders the screens and wires the events. Saved trips carry a schema version and a revision number: older saves are migrated on load, and a save that would overwrite a newer copy from another tab is stopped and shown as a conflict.

For local development, [`server.js`](server.js) is a small static server that only serves an allowlist of four files, stamps each asset URL with a content hash, and sends a strict Content Security Policy. The production build does the same hashing at build time, and [`vercel.json`](vercel.json) sends the same policy from Vercel, with `frame-ancestors 'none'`, HSTS and long-lived caching for the hashed files on top.

## Privacy

- **No backend.** The live site is four static files: no server-side code, no database, no API.
- **No accounts, analytics, tracking or ads.** The page makes no network requests after it loads.
- **Data stays on your device.** Trips are kept in this browser's `localStorage` and nowhere else. Clearing site data deletes them, so export a trip you care about.
- **You can read it.** About 4,800 lines of plain JavaScript, not minified or bundled. The build only copies the files and stamps cache-busting hashes.

> **One phone, one copy.** Because nothing syncs, the trip lives on whichever device created it. Copy the summary into the group chat (or share the exported JSON) at the end.

## Quality

- 178 tests on Node's built-in runner: unit tests for the money logic, jsdom smoke tests for the UI, and integration tests for the dev server
- ESLint with zero warnings, run in CI on Node 22 and 24 along with the tests and the build
- 100/100 on the AI Innovation Arena's automated evaluation (security, code quality, correctness, performance, accessibility)
- Lighthouse 100 for accessibility, best practices and SEO on mobile and desktop
- keyboard navigation, visible focus, screen-reader labels on every control and WCAG 2.2 AA-sized targets

<details>
<summary><b>Lighthouse</b></summary>
<br>

Lighthouse 12.8, local build, 29 October 2026. Mobile uses simulated throttling; its performance score was 97 to 99 across three runs, and the table shows the lowest.

| | Performance | Accessibility | Best practices | SEO |
|---|---:|---:|---:|---:|
| Mobile | 97 | 100 | 100 | 100 |
| Desktop | 100 | 100 | 100 | 100 |

Largest contentful paint is 2.2 s on mobile and 0.5 s on desktop, with at most 10 ms of blocking time and no layout shift.

</details>

## Develop

<details>
<summary><b>Run it locally</b></summary>
<br>

You need Node.js 22.22, 24.15 or 26 and newer for the dev tools, because jsdom needs it (the app itself only needs a browser). The app has no runtime dependencies; `npm ci` installs the dev tools (ESLint and jsdom) only.

```sh
git clone https://github.com/iAnmolAgarwal/FairShare.git
cd FairShare
npm ci              # dev tools only
npm start           # http://127.0.0.1:5000; PORT and HOST override it
npm test            # unit, UI smoke and server tests
npm run lint        # ESLint, zero warnings
npm run build       # static site in dist/, as deployed to Vercel
```

</details>

<details>
<summary><b>Project layout</b></summary>
<br>

```
.
├── index.html          # app shell and markup
├── app.js              # UI: rendering, events, storage
├── core.js             # pure logic: money, splits, balances, settle plan
├── styles.css          # light and dark themes
├── server.js           # allowlisted static dev server with CSP
├── scripts/
│   ├── assets.js       # asset hashing and CSP, shared by server and build
│   └── build.js        # static build, served by Vercel
├── test/               # node:test suites
├── vercel.json         # hosting: build, security headers, caching
└── docs/images/        # README images
```

</details>

## Credits

Built by Anmol Agarwal ([@iAnmolAgarwal](https://github.com/iAnmolAgarwal)) for HackerEarth's AI Innovation Arena on [VibeCode Arena](https://vibecodearena.ai), where the app was written turn by turn through the arena's model with a human steering every turn. It started life as SplitSafar and was renamed FairShare along the way. The full history is in [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE).
