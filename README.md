# Ostinato

A student planner that warns you **before** the deadline, and keeps insisting
until you answer.

In music, an *ostinato* is a figure that repeats in the low end, over and over,
until you cannot help but notice it. That is the reminder engine: it does not
tell you once and give up.

Register your class schedule once. Then, instead of opening a calendar and hunting
for the date of the next math class, you write the task down as *"due next math
class"* and the app resolves the date — and every reminder along with it.

iOS first. The logic is plain TypeScript, so Android is a port and not a rewrite;
Swift is used only where iOS is genuinely better at something.

## What it does

- **Reminders you actually configure.** How many days ahead, at what time, how many
  times it repeats, and whether it nags like an alarm. Sensible defaults per kind of
  work, so it is useful before you open settings.
- **Due dates anchored to a class.** "Next math class", "the class after next" — the
  app resolves it against your timetable, skipping holidays and alternating weeks.
- **A timetable you can paste.** Paste the schedule your school sent, or photograph
  it, and the grid builds itself. Text recognition runs on the device.
- **Grades and absences.** What you need to score on the next test, and how many
  classes you can still miss before failing on attendance.

## Reminder modes, and their honest limits

| Mode | What happens |
| --- | --- |
| Normal | A regular notification with the default sound. |
| Insistent | Time Sensitive, so it breaks through Focus and Do Not Disturb, with a custom sound and a burst that repeats until you answer. Actions on the notification itself: **Done** and **Snooze 10 min**. |
| Alarm | Everything above, plus a looping sound and a full-screen dismiss when the app is running — including with the phone on silent. |

With the app closed **and** the phone on silent, no iOS app plays sound without
Apple's Critical Alerts entitlement, which this app does not request. In that case
the alarm behaves like the insistent mode. The app says so on the screen where you
configure it, not just here.

## Why the reminder engine is the hard part

iOS keeps at most **64 pending local notifications per app** and silently drops the
furthest ones beyond that. An app scheduling five reminders per task breaks at
thirteen tasks and then fails quietly — the worst way to fail for something whose
only job is to remember.

So the app does not let the system choose. A pure planner expands every reminder,
sorts by fire time, keeps a rolling window of 60 (four in reserve), and reports what
did not fit. The window is refilled when the app opens, on every change, and by a
background task. Settings shows how many reminders are actually armed.

## Storage and sync

Everything lives on the device. There is no account, no server and no network call.

Every record carries `id`, `atualizadoEm`, `removido` and `origem` from the very
first commit, and the merge logic — last write wins, deletion wins a tie, deterministic
tie-break so two devices reach the same answer without talking — is written and
tested against an in-memory two-device simulation, including a hundred-round
randomized convergence check.

CloudKit transport is written and compiled out behind one flag. Whether a free
Apple team can carry the iCloud entitlement has not been measured here — it is
gated because shipping code that needs an entitlement you may not have is how you
get a crash, not because Apple is known to refuse it. The day it is enabled,
syncing is a change of transport, not of logic. Android and Google-account sync implement the same interface. See
[docs/CLOUDKIT.md](docs/CLOUDKIT.md).

## Stack

Expo 57 · React Native 0.86 · React 19 · zustand + MMKV · four local Swift modules
(Liquid Glass, on-device OCR via Vision, CloudKit, Live Activity).

`nucleo/` is pure TypeScript and never imports `react-native`. That rule is what
keeps Android and web cheap later.

## Running it

```bash
cd mobile
npx expo prebuild --platform ios
npx expo run:ios
```

```bash
npm run teste        # core test suite, no simulator required
npm run teste:i18n   # fails the build on any untranslated string
```

## Siri and Shortcuts

The app answers a URL:

```
ostinato://anotar?texto=math%20test%20next%20friday
```

That opens the capture screen with the sentence already written and already
interpreted. A one-step Shortcut ("Open URL") is enough to make it work with
Siri, and it needs no paid account and no extension. Spotlight, Back Tap, a
Control Center button and a Lock Screen item all open a URL too, so they land in
the same place.

`ostinato://abrir?id=<id>` opens one item.

Anything the app does not recognise exactly is discarded. This is input from
outside the app, so it is parsed in `nucleo/atalhos.ts`, where it is testable,
and never turned into a nearby-looking command.

## Language

Portuguese and English from the first screen. The system language decides the
default, the choice is changeable in settings, and `EXPO_PUBLIC_OSTINATO_LANG=pt|en`
forces one for testing.

## License

MIT
