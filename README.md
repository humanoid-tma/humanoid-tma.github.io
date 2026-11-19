# TMA project page

Source for the project page of **TMA: Sim-to-Real Forceful Humanoid Manipulation via
Tactile-Driven Motor Adaptation**, served at <https://humanoid-tma.github.io/>.

A single static page with no build step and no frameworks. Open `index.html` through any
static server.

## Structure

Page order: cover (background video) → Overview (four highlights + tactile teaser figure) →
Real-World Experiments (doorknob picker, each doorknob's front/top views and five rollouts,
recovery, closer view) → Baselines (HTML results chart + failure videos) → Abstract + method
figure → Supplementary Video (`videos/supplementary_video.mp4`, click to play) → BibTeX.

```
index.html                 the page
static/css/style.css       all styling; palette follows the paper's figures
static/js/main.js          nav, hero video, lazy videos, results-chart tooltip, lightbox, BibTeX copy
static/figures/            web exports of paper figures (see below)
static/knobs/              doorknob thumbnails and front/top views (from the previous site)
static/media/hero*.mp4     hero background montage (landscape + portrait cut), silent
static/media/hero*_poster.jpg
tools/make_hero.sh         rebuilds the hero montage from the clips in videos/
static/posters/            first-frame posters, one per content video
videos/                    rollout, closer-view, recovery and baseline clips (with audio)
```

## Figures

Images are rendered from the paper PDFs' crop box:

| Web file                              | LaTeX source                              |
| ------------------------------------- | ----------------------------------------- |
| `static/figures/method_overview.webp` | `figures/method_overview_v3.pdf`          |
| `static/figures/teaser.webp`          | `figures/teaser_figure_v3.pdf`            |
| `static/figures/social_preview.jpg`   | `figures/teaser_figure_v3.pdf` (link-preview image) |

The real-world results chart is HTML, rebuilt from `figures/real_world_performance_3.pdf`.
Its numbers live in `index.html` (the `.bar` elements and the data table under it).
Colors are the paper's TMA / RMA / reactive hues, adjusted so they stay distinguishable
with color-blindness.

To re-export after a figure changes (from the paper's `figures/` directory):

```
pdftocairo -png -cropbox -r 360 -singlefile teaser_figure_v3.pdf /tmp/teaser
convert /tmp/teaser.png -resize 2400x -quality 86 static/figures/teaser.webp
```

If the pixel size changes, update the `width`/`height` attributes on the `<img>` too.

## Videos

Content videos are declared with `preload="none"`, a `poster` and a `data-src`. Nothing
downloads until a clip nears the viewport.
Each clip plays once at 1&times; and holds its last frame. Its outcome tag ("Door opened" /
"Failed") appears in the final second. Videos keep their audio and start muted so autoplay
is allowed.

To add one:

1. Put the `.mp4` under `videos/`.
2. Make its poster:
   ```
   ffmpeg -ss 0.5 -i videos/<path>.mp4 -vframes 1 -vf scale=960:-2 -q:v 4 static/posters/<name>.jpg
   ```
3. Copy an existing `<figure class="vcard">` block and point `data-src` and `poster` at the
   new files. Add `data-outcome="failed"` on `.vframe` for a failure clip.

### Hero montage

The hero background is the doorknob #2 close-up, followed by a crossfade into one rollout per
doorknob (doorknob 1 rollout 2, doorknob 2 rollout 1, doorknob 3 rollout 4, doorknob 4
rollout 4). Each rollout is cropped to a tall slice around the hand: reach, grasp, rotation,
push. The four start together, and each slice fades to the page background when its clip ends.
A final crossfade leads into `rollout_robustness.mp4`, which shows recovery from an external
disturbance.
Two cuts are built. `hero.mp4` (1600&times;1000) lays the slices out 1&times;4.
`hero_portrait.mp4` (720&times;1280, for phones) lays them out 2&times;2. `main.js` picks one
by screen shape.

```
tools/make_hero.sh .      # needs ffmpeg; rewrites static/media/hero*.mp4 and posters
```

Clips and per-doorknob crop centres are set at the top of the script.

### Supplementary video

`videos/supplementary_video.mp4` is the paper's supplementary video, with the "Paper ID"
line on the opening title card covered by a white box for the first 4 s. To rebuild it from
the original:

```
ffmpeg -i supplementary_video.mp4 \
  -vf "drawbox=x=770:y=596:w=380:h=66:color=white:t=fill:enable='lt(t,4)'" \
  -an -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -movflags +faststart \
  videos/supplementary_video.mp4
```

## Paper

The cover's "Paper" button links to the arXiv PDF (<https://arxiv.org/pdf/2611.18976>), and
the BibTeX section cites the arXiv preprint. Swap both for the proceedings version once it
is published.

## Local preview

```
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## License

Website content is licensed under a
[Creative Commons Attribution-ShareAlike 4.0 International License](http://creativecommons.org/licenses/by-sa/4.0/).
