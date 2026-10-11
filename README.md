# Asylum Intake: The Midnight Shift

**Play it in your browser: [naman-singh-777.github.io/MIDNIGHT777](https://naman-singh-777.github.io/MIDNIGHT777/)**

Best on a desktop browser with headphones. Click Begin, then click the game to lock the mouse.

You work the night intake window at Vesper Hollow Hospital, October 1963. Six nights. Check each admission form against the records, ask five questions, get close to the glass, then decide. Everyone you let in walks the passage right behind your chair. Some of them are not people, and they get better at it every night. Night 1 is the demo.

## Run it

    npm install
    npm run dev

Open the printed address. Click Begin.

## Controls

Desk: 1 to 5 ask, Z records, X right up to the glass (face, breath, pulse), A let in, O hold, R turn away, T trapdoor, C under the desk (toggle), right mouse leans in, Space answers the phone, Q stand up.
Floor: WASD move, Shift run, C crouch, E use or talk (hold at the fuse box), F torch.
H shows every control in game. F3 shows the performance panel. M mutes.

URL options: `?night=3` starts a night, `?seed=7` fixes the presentation randomness, `?autostart` skips the title and the shift card, `?fast=6` speeds the sim.

## Voices

Every line is pre-recorded with Kokoro-82M (Apache-2.0), a neural voice per character, from the npm packages `kokoro-fp16-shards` (weights) and `kokoro-js` (voice styles). See `tools/voice/`. To re-record after changing lines:

    npx tsx tools/voice/collect.ts
    python3 tools/voice/render.py <kokoro-fp16.onnx> <voices.npz> 2

## Checks

    npm run typecheck
    npm test
    npm run build
    npm run e2e

`npm run e2e` needs a Chromium. Set `CHROMIUM` to its path if it is not at `/opt/pw-browsers/chromium`.
