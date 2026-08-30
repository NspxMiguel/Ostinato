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

- **Reminders at three intensities.** Light, standard or heavy — named for the
  outcome rather than the mechanism, because nobody assembles a rule from days,
  hours, modes and repeat counts across six kinds of work. The rule editor is
  still there for anyone who wants it, one section further down.
- **Due dates anchored to a class.** "Next math class", "the class after next" — the
  app resolves it against your timetable, skipping holidays and alternating weeks.
- **A timetable you can paste or photograph.** Paste the schedule your school sent,
  or take a picture of it — text recognition runs on the device, and the grid
  builds itself. Verified end to end: a photo of a printed timetable came back as
  15 classes across eight subjects.
- **Grades and absences.** What you need to score on the next test, and how many
  classes you can still miss before failing on attendance.
- **The school calendar, filtered.** Paste or photograph the calendar your school
  published and the app sorts it into three groups: days with no class, things
  going to your agenda, and everything left out — each with the reason beside it,
  and a tap to move anything between groups.

  Lines are judged by what they change rather than what they are about, because
  the subject does not separate them: a parents' meeting matters and a planning
  meeting does not, and both are meetings. Teacher recess is a staff event that
  still cancels your classes, so "closes the school" is decided before "concerns
  staff". Audience comes from two facts asked once — student or guardian, and
  which years — which is what resolves an exam belonging to another year.

  Days with no class become holidays on the academic term, which is the part that
  changes everything else: without it, "next maths class" resolves to a Tuesday
  when the school is shut.

  Measured against a real published calendar of 148 entries: a third-year student
  sees 17 non-teaching days and 22 events, and 109 lines stay out.

## You choose what you use

Nobody should have to register a school timetable to note down an exam. The
timetable and the grades tracker are features you switch on or off in settings:
with the timetable off its tab closes and the classes section leaves the Today
screen, rather than sitting there asking for something you decided not to use.

Reminders are not on that list, because they are the app. Open it, say "biology
exam friday", and that is a complete way to use Ostinato.

The timetable screen used to be a wall: without an academic term it refused to
let anything be added, so noting that maths is on Tuesday first required a term
name and two dates. A subject still belongs to a term — that is what carries
holidays and alternating weeks — so one covering the current year is created
silently with the first subject, and can be adjusted afterwards.

## Reminder modes, and their honest limits

| Mode | What happens |
| --- | --- |
| Normal | A regular notification with the default sound. |
| Insistent | Time Sensitive, so it breaks through Focus and Do Not Disturb, with a custom sound and a burst that repeats until you answer. Actions on the notification itself: **Done** and **Snooze 10 min**. |
| Alarm | Everything above, plus a looping sound and a full-screen dismiss when the app is running — including with the phone on silent. |

Every kind of work except an exam also gets a **last-chance alarm**, anchored to
the start of the school day rather than to the deadline: two hours before the
**first class of the day**, loud and repeating, while there is still time to do
the thing before leaving the house.

The anchor matters. If maths is at 8:00 and geography at 7:30, "one hour before
maths" rings at 7:00 — in the middle of geography, where nobody is going to do
homework. On a day with no classes it does not fire at all: waking someone at 5am
on a Saturday is not insistence, it is a defect.

An exam does not get it. There is no doing the exam before leaving the house, and
an exam **completes itself** once its day has passed — nobody marks "I sat the
test". Tasks and submissions stay: those can be forgotten, and the app has no way
to know they were handed in.

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

## What it uses from the iPhone

Liquid Glass on the tab bar (iOS 26, with a blur fallback) · Live Activity and
Dynamic Island counting down to the next deadline · Time Sensitive notifications
that break through Focus, with **Done** and **Snooze** on the notification itself
· a custom 29-second alarm sound · on-device dictation through the Speech
framework · on-device text recognition through Vision · Spotlight, so a task is
findable from the home screen · background refresh to keep the reminder window
armed · and a URL scheme for Siri and Shortcuts.

Nothing here calls a server. Speech and text recognition run on the device, and
the app makes no network request at all.

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

The interface speaks Portuguese, English, Spanish and French. The system language
decides the default, the choice is changeable in settings, and
`EXPO_PUBLIC_OSTINATO_LANG=pt|en|es|fr` forces one for testing. A missing key
falls back to Portuguese silently, and `npm run teste:i18n` fails the build on
any language block that is present but incomplete.

The **sentence interpreter** understands all four. It tries the interface language
first and the others after, so someone with an English phone writing *"prova de
historia sexta que vem"* is still understood, and so is *"contrôle de maths
vendredi"* on a Portuguese one. Adding a fifth language means writing its date and
type words in `nucleo/linguagem.ts`.

## License

MIT
