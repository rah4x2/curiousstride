# CuriousStride

A calm, private browser workspace for the transition after university, built from the supplied CuriousStride product brief. Version 1.1 with the expressive colour theme.

## Start

Extract the whole ZIP, then open **index.html** in a modern browser. Keep the `css`, `js`, and `assets` folders beside it. There is no package installation, build step, account, backend, or external asset request.

For consistent browser storage across visits, you can use the included local launcher with Python 3:

```sh
python start.py
```

It opens `http://localhost:8000` and listens only on your computer. Keep the terminal running; Ctrl+C stops it. To use another port, run `python start.py 8001`. Browser data is specific to an address and port. If you switch from a file to a local server or hosted site, export a backup first and restore it at the new address.

## What is included

| Workspace | Features |
| --- | --- |
| Home | Encouraging empty states, four feature entry points, current priorities, recent activity, saved-record counts when relevant |
| Clarity Corner | Four guided exercises with five optional questions, automatic saving, previous/next/skip, saved reflection history, edit and delete, summary and final focus, handoff to the weekly planner |
| Career Launchpad | Application CRUD, optional details and interview date, seven statuses, table and board views, search/filter, skills and target dates, guided career exploration, saved roles/industries/questions, skills and ideas to weekly tasks |
| Weekly Reset | Monday–Sunday planning, week navigation, three priorities, task categories and optional times, completion, desktop drag/drop plus edit-day controls, mobile day selection, weekly reflection, unfinished-task carry-forward, tasks to focus timer |
| Focus Space | Focus/short/long modes, accurate elapsed-time timer, start/pause/resume/reset, adjustable durations, optional sound, optional session history, completion notice, continuity when moving between tools |
| Data controls | Versioned JSON backup and restore, validation before restore, confirmation before deletion, local storage failure feedback, unreadable-data recovery download, conflict protection when another tab changes data |

Reflection PDF export uses the browser print dialog: select **Print / save PDF**, then **Save as PDF**. No online PDF service is involved. The browser handles text, including non-Latin characters.

The timer keeps time by comparing timestamps, so it catches up when a background tab becomes active. Browsers may delay background execution and audio; completion is checked when the app regains attention. An active session intentionally resets on refresh or browser close. Completed focus sessions and preferences remain saved. Short and long breaks do not count as focus history. No automatic repeating sessions or streaks are used.

## Privacy and backups

All records stay in localStorage in this browser. There are no analytics, remote fonts, third-party scripts, network-based AI features, job-board integrations, or account services. Clearing browser data, private browsing, changing browsers, moving the folder, or using a new site address may make saved data unavailable.

Use **Settings & your data → Download backup** regularly. Backups contain plain-text personal entries; store them privately. **Restore a backup** validates the file and asks before replacing the current workspace. It does not merge records. Unknown versions and invalid files leave current data intact. Keep backups smaller than 10 MB for the importer.

This is a local workspace, not an encrypted vault. Avoid passwords, identification documents, and confidential employer information. Reflection prompts support personal thinking and do not diagnose or interpret answers.

Use one tab for editing. If another tab changes this workspace, saving in the stale tab pauses to prevent overwriting newer work. Export anything you need from that tab, then refresh.

## Design

The interface uses a more expressive version of the requested midnight navy, Curious Blue, Soft Sky, warm ivory, charcoal, and champagne palette. The richer colour layer adds a dark navy navigation rail, a saturated blue home hero, and distinct teal, blue, green, gold, and violet accents across the four workspaces while preserving the original layout. It uses an editorial serif/sans typography pairing, spacious cards, a desktop sidebar, and a mobile navigation menu. The CSS font stacks prefer Lora and DM Sans if installed, with local Georgia/system-sans fallbacks. Font binaries are not bundled, so the project remains fully offline and has no remote font requests.

Visible focus rings, labelled inputs, native keyboard-accessible dialogs, a skip link, status announcements, text status labels, and reduced-motion support are included. Mobile layouts and the seven-day planner use responsive CSS. Manual testing with assistive technology and on target phones is still recommended before public launch.

## Source structure

```text
curiousstride/
  index.html          Shared application shell
  START_HERE.txt      Quick-start instructions
  README.md           Project documentation
  start.py            Optional local web server and launcher
  assets/logo.svg     Local brand mark
  css/styles.css      Design tokens, common components, dashboard, responsive shell
  css/clarity.css      Reflection layouts
  css/career.css       Career layouts
  css/weekly.css       Planner layouts
  css/focus.css        Timer layouts
  css/vivid-theme.css  Expressive colour and contrast layer
  js/core.js          Shared store, import validation, helpers, dialogs, print
  js/app.js           Routing, home dashboard, navigation, settings
  js/clarity.js        Reflection feature
  js/career.js         Career feature
  js/weekly.js         Weekly planning feature
  js/focus.js          Timer feature
  tests/              Dependency-free Node behavior tests
```

Scripts use a shared `window.CS` namespace and classic script tags so the app works without a module server. `CS.state` holds the workspace; `CS.save()` debounces local writes and page-hide handlers flush pending changes. The storage key is `curiousstride.workspace.v1`. Imported data is reconstructed from known fields and validated before replacing state. User-entered text is escaped before rendering, and job-posting links allow HTTP/HTTPS only.

## Verification

With Node.js 20 or newer installed:

```sh
node --test tests/*.test.cjs
```

The tests exercise actual feature handlers with deterministic clocks and small DOM fixtures: reflection editing/persistence/printing, application and skills CRUD, search and board status behavior, weekly moving and carry-forward, focus timing and history, and core backup/recovery behavior. They do not simulate browser layout or certify accessibility.

JavaScript syntax and these behavior checks were run during creation. A browser-rendered visual pass could not be run in the creation environment because Chromium could not start under its socket restrictions. Before publishing, check the app in your target desktop and mobile browsers, keyboard navigation, native dialogs, drag/drop, printing, sound, and JSON downloads/restores.

## Publish

Upload `index.html`, `assets/`, `css/`, and `js/` together to any ordinary static host. No rewrite rules are needed because navigation uses URL hashes. Use HTTPS for a public site. Publishing does not upload local workspace entries; each visitor starts with their own empty browser workspace. Keep a stable site address to preserve each visitor's browser storage.

The product intentionally excludes sign-in, cloud sync, subscriptions, live job feeds, AI assessments, social features, and complex analytics, as specified in the version-one brief.
