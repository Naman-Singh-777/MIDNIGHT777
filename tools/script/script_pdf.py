"""The six night script, in play format, built from the game's own data.
npx tsx tools/script/dump.ts nights.json && python3 tools/script/script_pdf.py nights.json out.pdf"""
import json, sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, PageBreak, KeepTogether, CondPageBreak, Table
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

data = json.load(open(sys.argv[1]))
OUT = sys.argv[2]
F = '/usr/share/fonts/truetype/dejavu/'
for n, f in [('Serif', 'DejaVuSerif'), ('Serif-B', 'DejaVuSerif-Bold'), ('Serif-I', 'DejaVuSerif-Italic'), ('Sans', 'DejaVuSans'), ('Sans-B', 'DejaVuSans-Bold')]:
    pdfmetrics.registerFont(TTFont(n, F + f + '.ttf'))
INK, DIM, RED, RULE = colors.HexColor('#1d1a17'), colors.HexColor('#6b6258'), colors.HexColor('#7a1f1a'), colors.HexColor('#c9bfae')
S = {
    'title': ParagraphStyle('t', fontName='Serif-B', fontSize=34, leading=40, alignment=TA_CENTER, textColor=INK),
    'sub': ParagraphStyle('s', fontName='Serif-I', fontSize=13, leading=18, alignment=TA_CENTER, textColor=DIM),
    'h1': ParagraphStyle('h1', fontName='Serif-B', fontSize=20, leading=25, textColor=INK, spaceAfter=4, keepWithNext=1),
    'h1s': ParagraphStyle('h1s', fontName='Serif-I', fontSize=12, leading=16, textColor=DIM, spaceAfter=10, keepWithNext=1),
    'h2': ParagraphStyle('h2', fontName='Sans-B', fontSize=11.5, leading=15, textColor=RED, spaceBefore=12, spaceAfter=4, keepWithNext=1),
    'body': ParagraphStyle('b', fontName='Serif', fontSize=10.5, leading=15, textColor=INK, spaceAfter=6),
    'small': ParagraphStyle('sm', fontName='Serif-I', fontSize=9, leading=12.5, textColor=DIM, spaceAfter=4),
    'scene': ParagraphStyle('sc', fontName='Sans-B', fontSize=10.5, leading=14, textColor=INK, spaceBefore=14, spaceAfter=2, keepWithNext=1),
    'note': ParagraphStyle('n', fontName='Sans', fontSize=8.5, leading=11.5, textColor=RED, spaceAfter=4, keepWithNext=1),
    'dir': ParagraphStyle('d', fontName='Serif-I', fontSize=10, leading=14, textColor=DIM, leftIndent=36, rightIndent=20, spaceAfter=5),
    'who': ParagraphStyle('w', fontName='Sans-B', fontSize=9.5, leading=12, textColor=INK, leftIndent=110, spaceBefore=4, keepWithNext=1),
    'paren': ParagraphStyle('p', fontName='Serif-I', fontSize=9.5, leading=12, textColor=DIM, leftIndent=96, keepWithNext=1),
    'line': ParagraphStyle('l', fontName='Serif', fontSize=10.5, leading=14.5, textColor=INK, leftIndent=60, rightIndent=40, spaceAfter=3),
    'bullet': ParagraphStyle('bu', fontName='Serif', fontSize=10.5, leading=14.5, textColor=INK, leftIndent=14, bulletIndent=3, spaceAfter=3),
}
EMO = {'calm': 'calm', 'warm': 'warmly', 'kind': 'kindly', 'bright': 'brightly', 'dry': 'drily', 'sly': 'slyly', 'stern': 'sternly', 'cold': 'coldly',
       'flat': 'flat, without feeling', 'nervous': 'nervous', 'scared': 'frightened', 'panic': 'panicking', 'urgent': 'urgently', 'tired': 'tired',
       'grief': 'grieving', 'broken': 'breaking', 'whisper': 'whispering', 'angry': 'angry'}
TELLS = {'no_breath': 'no breath on the glass', 'kin_wrong': 'wrong next of kin', 'sender_wrong': 'wrong doctor', 'too_fast': 'answers too fast',
         'deceased': 'the records say they are dead', 'photo': 'face does not match the photo', 'wristband': 'wristband number wrong', 'echo': 'says your question back',
         'borrowed_memory': "someone else's memory", 'no_blink': 'never blinks', 'ahead': 'answers the question you have not asked', 'mirror': 'the mark is on the wrong side',
         'no_pulse': 'no pulse in the throat', 'still_breath': 'breath on the glass does not fade', 'dob_swap': 'date of birth swapped', 'clerk_typo': 'a typing mistake on the form'}
REVEAL = {'unhinge': 'the jaw drops past where a jaw can go', 'grin': 'the smile pulls back past the cheeks', 'rolled': 'the eyes roll up into the head',
          'hollow': 'the eyes go black and the head lengthens', 'neck': 'the neck stretches up', 'owl': 'the head turns all the way round', 'split': 'the face widens past the skull',
          'melt': 'the face slides down', 'eyes': 'more eyes open on the face', 'backbend': 'it folds backwards at the waist', 'reach': 'the arms keep getting longer',
          'stutter': 'it moves in jerks, like a film missing frames'}
Q = [('name', 'Name for the ledger?'), ('dob', 'Date of birth?'), ('sender', 'Who sent you?'), ('kin', 'Who should we call?'), ('memory', 'What do you remember of tonight?')]
P = data['persons']

def esc(t): return t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def txt(l): return l if isinstance(l, str) else l[0]
def emo(l): return 'calm' if isinstance(l, str) else l[1]
def clock(m):
    t = int(round(22 * 60 + m * 1.6)) % (24 * 60)
    return f'{t // 60:02d}:{t % 60:02d}'
def name(pid): return P[pid]['name'] if pid in P else pid

story = []
def para(t, s='body'): story.append(Paragraph(t, S[s]))
def speak(who, l, extra=''):
    e = EMO.get(emo(l), emo(l))
    story.append(KeepTogether([Paragraph(esc(who).upper(), S['who']), Paragraph(f'({esc(e + extra)})', S['paren']), Paragraph(esc(txt(l)), S['line'])]))
def scene(t, note=None):
    story.append(CondPageBreak(55 * mm))
    para(esc(t), 'scene')
    story.append(Table([['']], colWidths=[166 * mm], rowHeights=[0.6], style=[('LINEABOVE', (0, 0), (-1, -1), 0.6, RULE)]))
    if note: para(esc(note), 'note')
def direction(t): para(esc(t), 'dir')

story += [Spacer(1, 45 * mm), Paragraph('MIDNIGHT', S['title']), Spacer(1, 4), Paragraph('Asylum Intake: The Midnight Shift', S['sub']), Paragraph('The complete script. Six nights.', S['sub']),
          Spacer(1, 12 * mm), Paragraph('Vesper Hollow Hospital, 15 to 20 October 1963. The night intake window, 22:00 to 06:00.', S['sub']), Spacer(1, 50 * mm),
          Paragraph('Every spoken line is the game\'s own text, recorded with a neural voice per character. The word in brackets is how the line is said and sets the pace of the recording. Stage directions in italics are for readers and actors. Truth notes in red tell you what each visitor is, what gives a fake away, and how its face goes when it slips.', S['small']), PageBreak()]

para('The people', 'h1')
para('Staff and family', 'h2')
for pid in ['imogen', 'pell', 'kessler', 'matron', 'abara', 'ada']:
    p = P[pid]
    story.append(Paragraph(f"<b>{esc(p['name'])}.</b> {esc(p['record']['note'] or '')} Voice: {esc(p['voice'])}.", S['bullet'], bulletText='•'))
para('The vending machine', 'h2')
for v in data['vending']:
    story.append(Paragraph(f"<b>{esc(v['name'])}</b> (night {v['night']}, {v['cost']} token{'s' if v['cost'] > 1 else ''}). {esc(v['effect'])}", S['bullet'], bulletText='•'))
story.append(PageBreak())

for n in data['nights']:
    para(f"Night {n['n']}: {esc(n['name'])}", 'h1')
    para(esc(n['date']), 'h1s')
    for c in n['card']: para(esc(c), 'dir')
    if n.get('demoEnd'): para('Night 1 is the demo. It ends with the jumpscare described at the end of the night.', 'note')
    events = [(v['at'], 'v', v) for v in n['visitors']] + [(b['at'], 'b', b) for b in n['beats']]
    events.sort(key=lambda e: e[0])
    if n['n'] == 1:
        pass
    for at, kind, e in events:
        if kind == 'b':
            where = e.get('where', 'intercom')
            head = {'phone': 'THE DESK PHONE', 'intercom': 'THE INTERCOM', 'back': 'AT THE BACK WINDOW, IN PERSON', 'corridor': 'IN THE CORRIDOR, IN PERSON', 'window': 'AT THE WINDOW'}[where]
            note = []
            if e.get('minStage') is not None: note.append(f"Plays only if the fakes have learned enough (stage {e['minStage']}).")
            if e.get('wrong'): note.append('The voice is wrong. It is not them.')
            scene(f"{clock(at)}. {head}" + (f": {name(e['who']).upper()}" if e['who'] == 'radio' else ''), ' '.join(note) or None)
            if where == 'phone': direction('The desk phone rings. The officer picks up.')
            speak(name(e['who']), e['text'])
            for t in e.get('talk') or []: speak(name(e['who']), t, ', if you talk to them')
            continue
        v = e
        truth = 'Truth: a fake.' if v.get('fake') else 'Truth: a real person.'
        extra = []
        if v.get('tells'): extra.append('Tells: ' + '; '.join(TELLS.get(t, t) for t in v['tells']) + '.')
        if v.get('form'): extra.append('The form: ' + ', '.join(f'{k} {val}' for k, val in v['form'].items()) + '.')
        if v.get('face'): extra.append(f"The face shows {v['face']}.")
        if v.get('reveal'): extra.append(f"When it slips: {REVEAL[v['reveal']]}.")
        if v.get('tutorial'): extra.append('The tutorial visitor.')
        head = 'THE GATE INTERCOM' if v.get('gate') else 'AT THE WINDOW'
        scene(f"{clock(at)}. {head}: {name(v['person']).upper()}", truth + ' ' + ' '.join(extra))
        direction(v['quirk'])
        who = name(v['person'])
        speak(who, v['greet'])
        if v.get('tutorial'):
            direction('Pell teaches the window one step at a time. Each step waits until the officer does it.')
            for st in data['tutorial']['steps']:
                speak(who, st['line'], f", step: {st['hint']}")
                if st.get('after'): speak(who, st['after'], ', once it is done')
        direction('The officer may ask any of the five questions, in any order, or none.')
        for q, qt in Q:
            story.append(KeepTogether([Paragraph('OFFICER', S['who']), Paragraph('(reading from the form)', S['paren']), Paragraph(esc(qt), S['line'])]))
            speak(who, v['say'][q])
        if v.get('bye'):
            direction('If the officer lets them in, they walk the admissions passage and stop at the window behind the chair:')
            speak(who, v['bye'])
        if v.get('tutorial'):
            direction('From the passage, after the goodbye:')
            for l in data['tutorial']['after']: speak(who, l)
            direction('If the officer turns him away or drops him:')
            for l in data['tutorial']['wrong']: speak(who, l)
    scene(f"{clock(287)}. SIX O'CLOCK")
    speak(name(n['dawn']['pell']['who']), n['dawn']['pell']['text'])
    direction('If Pell locked himself in Ward B, or is gone, a different voice holds the door:')
    speak(name(n['dawn']['wrong']['who']), n['dawn']['wrong']['text'], ', not them')
    if n['endings']:
        para('How this night can end', 'h2')
        for k, (title, text) in n['endings'].items():
            para(f'<b>{esc(title)}</b> ({k}). {esc(text)}')
    if n.get('demoEnd'):
        para('The end of the demo', 'h2')
        direction('As the officer turns from the Ward B slot, the thing that wore their mother is a step away. It says "There you are." Its face goes hollow. It looks straight into the lens and comes through it. Black. End of Night 1.')
    story.append(PageBreak())

para('Lines any night can use', 'h1')
para('When something the officer did comes due, staff say one of these. On nights 5 and 6 Sister Imogen says Pell\'s.', 'small')
for k, l in data['common'].items():
    speak({'obs': 'Night Nurse Kessler', 'miss_task': "Matron's Office", 'dead_you': 'Your own voice', 'breach_warn': 'On screen'}.get(k, 'Orderly Pell'), l, f", {k.replace('_', ' ')}")

def deco(c, d):
    c.saveState(); c.setFont('Sans', 7.5); c.setFillColor(DIM)
    if d.page > 1:
        c.drawString(22 * mm, 10 * mm, 'MIDNIGHT . The script . Six nights')
        c.drawRightString(A4[0] - 22 * mm, 10 * mm, str(d.page))
    c.restoreState()
doc = BaseDocTemplate(OUT, pagesize=A4, leftMargin=22 * mm, rightMargin=22 * mm, topMargin=20 * mm, bottomMargin=18 * mm, title='MIDNIGHT script, six nights', author='Naman Singh')
doc.addPageTemplates([PageTemplate('p', [Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height)], onPage=deco)])
doc.build(story)
print('ok')
