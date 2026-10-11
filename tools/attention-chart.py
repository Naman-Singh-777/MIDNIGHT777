# Builds docs/generated/research/attention_pacing.png from the sourced figures in ATTENTION_AND_PACING.md.
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

BLUE, ORANGE, INK, INK2, GRID, SURF = '#2a78d6', '#eb6834', '#0b0b0b', '#52514e', '#e4e3df', '#fcfcfb'
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 10, 'axes.edgecolor': GRID, 'axes.labelcolor': INK2,
                     'xtick.color': INK2, 'ytick.color': INK2, 'axes.titleweight': 'bold', 'axes.titlesize': 11, 'axes.titlecolor': INK})
fig, ax = plt.subplots(2, 2, figsize=(13, 8.6), facecolor=SURF)
for a in ax.flat:
    a.set_facecolor(SURF)
    for s in ('top', 'right'):
        a.spines[s].set_visible(False)
    a.grid(axis='y', color=GRID, lw=0.8)
    a.set_axisbelow(True)

# A. Gloria Mark, UC Irvine: average time on one screen before switching
a = ax[0, 0]
lab, val = ['2003 study', '2012', '2016 to 2020\n(mean)', '2016 to 2020\n(median)'], [150, 75, 47, 40]
b = a.bar(lab, val, color=BLUE, width=0.55)
for r, v in zip(b, val):
    a.text(r.get_x() + r.get_width() / 2, v + 3, f'{v} s', ha='center', color=INK, fontsize=10)
a.set_title('A. Average attention on one screen before switching')
a.set_ylabel('seconds')
a.set_ylim(0, 170)
a.text(0, -0.2, 'Source: Gloria Mark, UC Irvine (UC News, 11 May 2023; UC News 2024)', transform=a.transAxes, fontsize=8, color=INK2)

# B. Newzoo Global Gamer Study 2023, share of online population
a = ax[0, 1]
gens = ['Gen Alpha\n10-13', 'Gen Z\n14-28', 'Millennials\n29-42', 'Gen X\n43-58', 'Boomers\n59-65']
play, view = [93, 88, 80, 61, 40], [72, 72, 57, 30, 11]
x = range(len(gens))
w = 0.36
b1 = a.bar([i - w / 2 - 0.01 for i in x], play, w, color=BLUE, label='played games, past 6 months')
b2 = a.bar([i + w / 2 + 0.01 for i in x], view, w, color=ORANGE, label='watched game video, past 12 months')
for bars in (b1, b2):
    for r in bars:
        a.text(r.get_x() + r.get_width() / 2, r.get_height() + 1.5, f'{int(r.get_height())}', ha='center', fontsize=8.5, color=INK)
a.set_xticks(list(x), gens)
a.set_ylim(0, 105)
a.set_ylabel('% of online population')
a.set_title('B. Who plays and who watches, by generation')
a.legend(frameon=False, fontsize=8.5, loc='upper right')
a.text(0, -0.2, 'Source: Newzoo Global Gamer Study 2023, n = 74,295, 36 markets', transform=a.transAxes, fontsize=8, color=INK2)

# C. Benoit et al. 2020, PeerJ: professional vs amateur action players
a = ax[1, 0]
lab = ['Professionals\n(Overwatch League, n=14)', 'Amateurs\n(n=16)']
val = [11.0, 13.75]
b = a.bar(lab, val, color=BLUE, width=0.45)
for r, v in zip(b, val):
    a.text(r.get_x() + r.get_width() / 2, v + 0.3, f'{v:g}', ha='center', color=INK)
a.set_ylim(0, 16)
a.set_ylabel('d2 fluctuation rate (lower = steadier)')
a.set_title('C. Top players hold attention more steadily')
a.text(0, -0.2, 'Source: Benoit et al. 2020, PeerJ 8:e10211. Pros played 55.8 h/week, amateurs 9.5 h/week.', transform=a.transAxes, fontsize=8, color=INK2)

# D. What the game does with it: pacing targets, in seconds
a = ax[1, 1]
rows = [('Longest stretch with nothing new', 20, 40), ('One visitor at the window', 60, 120),
        ('Gap between big story beats', 150, 240), ('One night', 840, 1080)]
for i, (name, lo, hi) in enumerate(rows):
    a.barh(i, hi - lo, left=lo, height=0.42, color=BLUE)
    a.text(hi * 1.08, i, f'{lo}-{hi} s', va='center', fontsize=9, color=INK)
a.set_yticks(range(len(rows)), [r[0] for r in rows])
a.invert_yaxis()
a.set_xscale('log')
a.set_xlim(10, 3000)
a.set_xticks([10, 30, 100, 300, 1000, 3000], ['10', '30', '100', '300', '1000', '3000'])
a.minorticks_off()
a.set_xlabel('seconds (log scale)')
a.grid(axis='x', color=GRID, lw=0.8)
a.grid(axis='y', visible=False)
a.set_title('D. Pacing targets used by the game')
a.text(0, -0.26, 'Derived from A to C. See ATTENTION_AND_PACING.md for the reasoning.', transform=a.transAxes, fontsize=8, color=INK2)

fig.suptitle('Attention, players and pacing for MIDNIGHT', fontsize=14, fontweight='bold', color=INK, x=0.06, ha='left')
fig.tight_layout(rect=(0, 0.02, 1, 0.96), h_pad=3.2)
fig.savefig('docs/generated/research/attention_pacing.png', dpi=130, facecolor=SURF)
print('ok')
