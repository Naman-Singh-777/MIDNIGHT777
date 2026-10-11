# Multiplayer: two and three players

Status: design only. Nothing here is built yet. The single player game was built so this can be added without rewriting it: the simulation (`src/sim`) has no DOM or Three.js in it and is deterministic from a seed, so one machine can run it and the others can follow.

## The idea

One person checks the visitor. A different person, somewhere else in the building, opens the door. The second person cannot see the visitor. All they have is the first person's voice on the radio. And something in the building can speak in the first person's voice.

## Two players

**Player 1: the Window.** Sits in the booth, exactly as in single player: form, records, questions, face close up, the stare, the trapdoor. They cannot let anybody in. They have no door control. They decide, then they have to say it.

**Player 2: the Gate.** Works the admissions passage and the ward door at the far end of it, in a separate part of the map they never leave and Player 1 never sees. They hold the only key. They cannot see the hall or the visitor until the visitor is already in the passage with them.

What makes Player 2's job more than opening a door:

1. **The passage is theirs to keep.** Bulbs fail, the floor floods, the ward door jams. Player 2 changes bulbs, mops, and works the door's two locks by hand in the dark, with a torch that runs on batteries they have to find.
2. **They meet everyone face to face.** When Player 1 says yes, the visitor walks to Player 2, an arm's length away, before the ward door. Player 2 has their own check: a wristband reader, a cold hand to take, a pulse to feel. If they disagree with Player 1 they can hold the visitor in the passage, which is dangerous for both of them.
3. **The ward is behind them.** Player 2 hears Ward B through the door: counts, bangs, someone saying their name. The head count, the dawn walk and the tall one in the corridor are their jobs, not Player 1's.
4. **The radio.** Player 2's only line to Player 1 is the in game radio (voice chat, push to talk). It crackles, cuts out in storms, and drops when the power goes.

**The mimic.** Some nights, a fake learns Player 1's voice from the radio. The game records short phrases from Player 1's push to talk ("let him in", "he's fine", "open it") and, later in the night, plays them back to Player 2 at the wrong moment, through the same radio, with the same crackle. Player 2 must decide whether the voice saying "open the door" is really their partner. Counter play: the pair agree a word at the start of the night; the mimic only knows phrases it has heard, so a fresh question ("what colour was her coat?") breaks it. The game never says which messages were fake until the end card.

**Why this works as horror:** Player 2's life is in Player 1's hands, Player 1 can never see what their decision does, and neither can fully trust what they hear.

## Three players

Add **Player 3: the Night Porter.** Roams the whole building with a torch and a set of keys:

* Runs the fuse box, the vending machine restock and the jobs list, so the other two can stay at their posts.
* Is the only one who can go out to the yard and the bus stop to look at who is coming before they knock, and report back.
* Is the one the tall one hunts. The corridor and the stair become theirs. Their noise draws it toward the passage, which puts Player 2 at risk too.
* Can be copied. A fake wearing Player 3 can walk up to Player 2's door and ask to be let through.

The three roles split the single player loop into look, decide, act, with each player holding one third of the truth.

## What the build needs

1. **Netcode.** One player's browser hosts the simulation (host authoritative). The others send inputs (questions, verdicts, door actions, positions) and receive sim events and positions. Peer to peer over WebRTC data channels keeps hosting free; a tiny signalling server is the only backend. Expected bandwidth is small: the sim is event driven and the visitors are positioned from the seed.
2. **Voice.** WebRTC audio between players, pushed through the game's own Web Audio graph so the radio filter, dropouts and the mimic can sit on top of it. Recording for the mimic stays on the listener's machine and is thrown away at the end of the night.
3. **Map.** Player 2's area is the admissions passage and a gatehouse at its end (already started: `src/render/annex.ts`). Player 3 needs the yard and a stair, which the map does not have yet.
4. **Sim changes.** Split `Simulation.verdict` into a decision (Window) and an action (Gate). Add a "held in passage" state. Add per player positions to the stalker's input. All of it pure logic, testable without a browser, like the rest of `src/sim`.
5. **Consent and safety.** The mimic uses players' voices, so it is opt in, off by default, clearly labelled, and never records anyone who has not agreed. Text chat and a mute for every player.

## Suggested order

1. Two player, no mimic, on a local network test page.
2. The radio filter and dropouts.
3. The mimic (opt in).
4. Three players and the yard.
