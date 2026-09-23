# AmaFast videos — what to shoot, and what to generate

Two different videos, two different tools. Using the wrong tool for either one
produces something that actively hurts us.

---

## 1. The install walkthrough — **screen recording, not AI**

**Do not generate this with Flow / Veo.** Veo invents plausible-looking
interfaces. It will produce a Chrome that isn't Chrome: wrong toolbar, invented
buttons, a "Load unpacked" that sits in the wrong place, menu text that doesn't
exist. Users following it will not find what they see, and every one of them
becomes a support message. An install guide has exactly one job — match reality.

Record it. It is 45 seconds and needs no editing skill.

**Setup**
- Chrome, fresh profile, no other extensions installed (a clean extensions page).
- Screen at 1920×1080. Zoom Chrome to 110% so text is readable on a phone.
- Downloads folder cleared except the AmaFast zip.
- Mac: QuickTime → File → New Screen Recording. Windows: Win+G. Both free.

**Shot list** — times are cumulative

| Time | On screen | On-screen caption |
|---|---|---|
| 0:00–0:05 | The downloaded zip in Downloads. Double-click it. Folder `amafast` appears. | "1. Unzip it" |
| 0:05–0:12 | Drag the `amafast` folder into Documents. Pause a beat on it. | "Keep this folder — don't delete it" |
| 0:12–0:20 | Click the address bar, type `chrome://extensions`, Enter. Type slowly. | "2. Go to chrome://extensions" |
| 0:20–0:27 | Cursor moves to the top-right toggle. Click. Buttons appear below. | "3. Turn on Developer mode" |
| 0:27–0:36 | Click **Load unpacked**. File picker opens. Select the `amafast` folder — **highlight that you pick the folder itself, not `src`**. Click Select. | "4. Load unpacked → pick the amafast folder" |
| 0:36–0:42 | The AmaFast card appears. Pin it. Popup opens showing live deals. | "Done — your deals are in the toolbar" |
| 0:42–0:45 | Popup with deals, cursor hovering one. | "indiaoffers.in/amafast" |

**Two things to deliberately capture**
1. **The folder-not-`src` moment.** Linger on the picker for a full two seconds.
   It is the single most common mistake and the reason installs fail.
2. **Chrome's developer-mode warning bubble** if it appears — don't cut it.
   Caption it "this is normal, click Keep". Seeing it in the video means it
   doesn't scare anyone later.

**Export**: MP4, 1080p. Also cut a silent looping GIF of 0:20–0:36 (the toggle
and Load unpacked) for embedding directly on the page — that's the part people
re-watch.

---

## 2. The promo clip — **this one Flow does well**

For the hook, Veo is the right tool: no real UI to get wrong, pure emotion. The
brief is the feeling of losing a ₹1 deal by being four seconds too slow.

### Google Flow prompt — Shot A (8s, the loss)

> Cinematic close-up, shallow depth of field. A young Indian man in a Bangalore
> apartment at night, lit only by his laptop screen. He is typing fast, leaning
> in, hopeful. Reflected in his glasses: a bright product page. His face falls —
> the screen has gone grey. He slumps back in the chair and exhales. Handheld,
> slight camera shake, warm practical lamp in the background going cool as the
> screen dims. Photoreal, 35mm, shot on Arri, moody teal-and-amber grade. No
> text, no on-screen UI.

### Google Flow prompt — Shot B (8s, the win)

> Same man, same desk, next night. He taps the laptop trackpad once, sits back,
> and folds his arms with a small satisfied smile — completely relaxed, doing
> nothing. Warm golden light rises across his face. Camera slowly pushes in.
> Photoreal, 35mm, shallow depth of field, warm amber grade, calm and confident.
> No text, no on-screen UI.

**Note both prompts end with "no on-screen UI".** That is deliberate — the
moment Veo tries to render a browser it will invent one, and a fake Amazon page
in our marketing is both embarrassing and a trademark problem. Keep every real
interface in the screen recording, every feeling in the generated footage.

### Assembly (any editor, 20s total)

```
0:00  Shot A  (8s)   the loss
0:08  caption "₹1 deals don't wait."          over the last beat of A
0:10  Shot B  (8s)   the win
0:14  caption "AmaFast checks out for you."
0:18  end card: AmaFast logo + indiaoffers.in/amafast   (2s, static)
```

Silent-first — most of this gets watched muted in a Telegram or WhatsApp feed,
so every message must survive with the sound off. Burn the captions in.

---

## Where each one goes

- **Screen recording** → embedded on `/amafast` under step 4, and linked from
  the deal post. This is the one that reduces support load.
- **Promo clip** → the deal post itself, Telegram, WhatsApp status, Instagram
  reel. This is the one that drives installs.
- **The GIF** → inline on `/amafast` at step 3, no click needed.

Once you have the files, drop them in `public/uploads/videos/` and tell me —
I'll wire them into the page.
