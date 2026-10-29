# Out of Office 🔒

**The email client that really doesn't want you to read your email.**

Built solo by Aneesh (team *Out of Office*) for **What The Hack?! 2.0** (ACM BPDC × MTC).

**Track:** The Ultimate Inconvenience, with bonus points for Artificial Super Unintelligence and Brainrot Engineering.

---

## The problem nobody asked us to solve

Checking email takes one click. That is far too convenient.

Out of Office is a Chrome extension that turns Gmail into a pomodoro prison. Once you start a focus session, your inbox is locked behind a blur. There is no pause button. The only way out is the **Emergency Escape Gauntlet**, and you will regret trying it.

## Features

### 🔒 Inbox Jail
- A 25-minute focus session blurs your entire Gmail inbox.
- "You're Out of Office 🔒 — back in 22:49."
- There is no pause button. That's the point.

### 🚨 The Emergency Escape Gauntlet (4 steps)
1. **Explain your emergency.** At least 15 characters and 3 real words. Keyboard mashing like "asdf" is detected and rejected. So is reusing your last excuse.
2. **Face the AI Judge v6.9**, which "consults 47 neural networks and one very tired lawyer" before stamping your excuse **DENIED** about 80% of the time.
3. **Apologize to your productivity** by retyping, exactly: *"I solemnly apologize to my productivity for abandoning it in its hour of need."* Pasting is blocked.
4. **Solve a two-digit multiplication** with no calculator. Wrong answers get a new problem.
5. **Hold the spacebar for 15 seconds.** Let go and it resets to zero.

You only get **3 escapes per day**. Clicking "Never mind, back to focus" at any step earns you a "Nice save 💪" and costs nothing.

### 📱 Brainrot Break Summaries
When the 5-minute break starts, **Skibidi-GPT 9000** reads your inbox and summarizes every email in the only language that matters:

> "Your Boss said 'Per my last email'. ohio-level email, skibidi rating 2/10"

### 🎨 Looks expensive
A draggable frosted-glass timer with a gradient progress ring that pulses in the last 10 seconds, purple for focus and green for breaks.

## Install

1. Download or clone this repo.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select this folder.
5. Open Gmail and suffer.

## Secret controls (don't tell the users)

| Shortcut | What it does |
|---|---|
| `Shift + D` | Jumps the current countdown to 0:05 |
| `Shift + S` | Forces APPROVED at the AI Judge, or finishes the spacebar hold |
| `Shift + R` | Resets today's escapes to 3 |

## Built with

- Chrome Extension (Manifest V3), plain JavaScript and CSS
- Vibecoded with Cursor and Claude
- No real AI was harmed. The AI Judge and Skibidi-GPT are fully scripted, so they can't fail on stage.

## FAQ

**Can't people just disable the extension?**
Yes. Out of Office isn't a prison, it's friction. It stops the impulse check, which is where most lost focus comes from.

**Is my email sent anywhere?**
No. Everything runs in your browser. Skibidi-GPT only reads the sender names and subject lines on your screen, and it judges them silently.
