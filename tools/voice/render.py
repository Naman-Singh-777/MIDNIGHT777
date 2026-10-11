"""Records every line in tools/voice/lines.json with Kokoro-82M (Apache-2.0) into public/voice/<key>.mp3.
Model: kokoro-fp16-shards from npm, joined. Voices: kokoro-js/voices/*.bin from npm, packed into an npz.
python3 tools/voice/render.py <model.onnx> <voices.npz> [workers]
Lines already recorded are skipped, so it can be stopped and restarted."""
import json, os, re, subprocess, sys, tempfile, time
from multiprocessing import Pool
import numpy as np

MODEL, VOICES = sys.argv[1], sys.argv[2]
WORKERS = int(sys.argv[3]) if len(sys.argv) > 3 else 2
OUT = 'public/voice'
UNITS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

def two(n):
    if n < 10: return UNITS[n]
    if n < 20: return TEENS[n - 10]
    return TENS[n // 10] + ('' if n % 10 == 0 else ' ' + UNITS[n % 10])

def year(m):
    y = int(m.group(0))
    hi, lo = divmod(y, 100)
    if lo == 0: return two(hi) + ' hundred'
    if lo < 10: return two(hi) + ' oh ' + UNITS[lo]
    return two(hi) + ' ' + two(lo)

def speakable(t):
    t = re.sub(r'\b1[89]\d\d\b', year, t)
    t = t.replace('Dr. ', 'Doctor ').replace('Mr. ', 'Mister ').replace('Mrs. ', 'Missus ').replace('St. ', 'Saint ')
    t = re.sub(r'\bMm mm mm mm\b', 'Hmm hmm hmm hmm', t)
    t = t.replace('Mrs.', 'Missus.')
    return t

_k = None
_voices = None
def init():
    global _k, _voices
    from kokoro_onnx import Kokoro
    _k = Kokoro(MODEL, VOICES)
    _voices = np.load(VOICES)

def style(spec):
    acc = None
    for part in spec.split('+'):
        name, _, w = part.partition('*')
        v = _voices[name] * (float(w) if w else 1.0)
        acc = v if acc is None else acc + v
    return acc

def render(row):
    path = f"{OUT}/{row['key']}.mp3"
    if os.path.exists(path):
        return row['key'], None
    text = speakable(row['text'])
    samples = np.zeros(0)
    sr = 24000
    # a take shorter than the words could possibly fit into came back broken: try again
    need = max(0.35, 0.17 * len(text.split()) / row['speed'])
    for attempt in range(3):
        samples, sr = _k.create(text + (' ' * attempt), voice=style(row['voice']), speed=row['speed'], lang='en-gb')
        if len(samples) >= sr * need:
            break
    if len(samples) < sr * need:
        # some long lines come back silent in fp16; say them a sentence at a time instead
        parts = []
        for sent in re.split(r'(?<=[.!?])\s+', text):
            want = max(0.25, 0.17 * len(sent.split()) / row['speed'])
            s2, sr = _k.create(sent, voice=style(row['voice']), speed=row['speed'], lang='en-gb')
            for extra in range(1, 4):
                if len(s2) >= sr * want:
                    break
                s2, sr = _k.create(sent + ' ' * extra, voice=style(row['voice']), speed=row['speed'] * (1 - 0.02 * extra), lang='en-gb')
            parts += [s2, np.zeros(int(sr * 0.22), dtype=np.float32)]
        samples = np.concatenate(parts) if parts else np.zeros(0)
    if len(samples) == 0:
        return row['key'], 'empty'
    pk = float(np.abs(samples).max()) or 1.0
    samples = samples / pk * 0.89
    pad = np.zeros(int(sr * 0.06), dtype=np.float32)
    samples = np.concatenate([pad, samples.astype(np.float32), pad])
    with tempfile.NamedTemporaryFile(suffix='.f32', delete=False) as f:
        samples.astype('<f4').tofile(f)
        raw = f.name
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'f32le', '-ar', str(sr), '-ac', '1', '-i', raw,
                    '-codec:a', 'libmp3lame', '-b:a', '40k', '-ar', '24000', path], check=True)
    os.unlink(raw)
    return row['key'], round(len(samples) / sr, 2)

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    rows = json.load(open('tools/voice/lines.json'))
    man_path = f'{OUT}/manifest.json'
    man = json.load(open(man_path)) if os.path.exists(man_path) else {}
    todo = [r for r in rows if not os.path.exists(f"{OUT}/{r['key']}.mp3")]
    print(len(rows), 'lines,', len(todo), 'to record', flush=True)
    t0 = time.time()
    with Pool(WORKERS, initializer=init) as pool:
        for i, (key, dur) in enumerate(pool.imap_unordered(render, todo), 1):
            if isinstance(dur, float):
                man[key] = dur
            elif dur == 'empty':
                print('EMPTY', key, flush=True)
            if i % 10 == 0:
                json.dump(man, open(man_path, 'w'))
                print(f'{i}/{len(todo)} {time.time() - t0:.0f}s', flush=True)
    # durations for lines recorded in an earlier run
    for r in rows:
        if r['key'] not in man and os.path.exists(f"{OUT}/{r['key']}.mp3"):
            out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f"{OUT}/{r['key']}.mp3"], capture_output=True, text=True).stdout
            man[r['key']] = round(float(out), 2)
    keep = {r['key'] for r in rows}
    man = {k: v for k, v in man.items() if k in keep}
    json.dump(man, open(man_path, 'w'), separators=(',', ':'))
    print('done', len(man), f'{time.time() - t0:.0f}s', flush=True)
