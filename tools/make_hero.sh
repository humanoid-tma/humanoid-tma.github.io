#!/usr/bin/env bash
# Build the hero background montage:
#   doorknob #2 close-up  ->  crossfade  ->  one rollout per doorknob, cropped onto the hand
#   (reach, grasp, rotation, push). The four start together; each slice fades to the page
#   background when its clip ends, and the segment lasts as long as the longest clip.
#   ->  crossfade  ->  robustness under external disturbance.
#
#   static/media/hero.mp4           1600x1000 (16:10), doorknobs as a 1x4 strip of tall slices
#   static/media/hero_portrait.mp4  720x1280  (9:16),  the same crops as a 2x2 grid, for phones
#
# Usage (from the site root):  tools/make_hero.sh .
# Swap clips by editing CLOSE / SRC below; crops are per doorknob (CX = horizontal centre of
# the hand/knob region in the 1280x720 source).
set -euo pipefail
R="$1"; V="$R/videos"; OUT="$R/static/media"

CLOSE="$V/more_details/closer_view_knob_2.mp4"
ROBUST="$V/more_details/rollout_robustness.mp4"
ROBUST_START=3.0       # skip the quiet opening; the person's arm enters at ~3.75 s
SRC=("$V/doorknob_1_rollouts/rollout_2.mp4" "$V/doorknob_2_rollouts/rollout_1.mp4"
     "$V/doorknob_3_rollouts/rollout_4.mp4" "$V/doorknob_4_rollouts/rollout_4.mp4")
CX=(730 740 725 780)   # hand/knob centre x per doorknob
CROP_H=600; CROP_Y=120 # vertical window shared by all four
BG=0x0c1117            # page background; finished slices fade to this

XF=0.8; FADE=0.6; END_FADE=0.4

dur() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1"; }
DC=$(python3 -c "print(round($(dur "$CLOSE") - 0.1, 3))")
DS=(); for f in "${SRC[@]}"; do DS+=("$(dur "$f")"); done
T=$(python3 -c "print(max(${DS[0]},${DS[1]},${DS[2]},${DS[3]}))")
LEN=$(python3 -c "print(round($T, 3))")
XO=$(python3 -c "print(round($DC - $XF, 3))")
DR=$(python3 -c "print(round($(dur "$ROBUST") - 0.1 - $ROBUST_START, 3))")
XO2=$(python3 -c "print(round($XO + $LEN - $XF, 3))")
END=$(python3 -c "print(round($XO2 + $DR, 3))")
FO=$(python3 -c "print(round($END - $FADE, 3))")
echo "switch@ $(python3 -c "print(round($XO + $XF/2, 1))")s (doorknobs)  $(python3 -c "print(round($XO2 + $XF/2, 1))")s (robustness)  total=${END}s"

# $1 cell width in source px, $2 output cell w, $3 output cell h -> filter for cell i
cells() {
  local cw=$1 ow=$2 oh=$3 out=""
  for i in 0 1 2 3; do
    local x=$(( ${CX[$i]} - cw / 2 ))
    local fo; fo=$(python3 -c "print(round(${DS[$i]} - $END_FADE - 0.05, 3))")
    out+="[$((i+1)):v]crop=${cw}:${CROP_H}:${x}:${CROP_Y},scale=${ow}:${oh},setsar=1,fps=30,"
    out+="fade=t=out:st=${fo}:d=${END_FADE}:color=${BG},"
    out+="tpad=stop_mode=add:stop_duration=$(python3 -c "print(round($T + 1, 3))"):color=${BG},"
    out+="trim=duration=${LEN},setpts=PTS-STARTPTS[g$i];"
  done
  printf '%s' "$out"
}

# $1 name  $2 close-up crop  $3 W  $4 H  $5 cell filters  $6 xstack layout  $7 robustness crop
build() {
  local name=$1 ccrop=$2 W=$3 H=$4 cellf=$5 layout=$6 rcrop=$7
  ffmpeg -v error -y -i "$CLOSE" -i "${SRC[0]}" -i "${SRC[1]}" -i "${SRC[2]}" -i "${SRC[3]}" -i "$ROBUST" \
    -filter_complex "
      [0:v]trim=0:${DC},setpts=PTS-STARTPTS,${ccrop},scale=${W}:${H},setsar=1,fps=30,settb=AVTB,fade=t=in:st=0:d=${FADE}[a];
      ${cellf}
      [g0][g1][g2][g3]xstack=inputs=4:layout=${layout}:fill=${BG},settb=AVTB[grid];
      [5:v]trim=start=${ROBUST_START}:duration=${DR},setpts=PTS-STARTPTS,${rcrop},scale=${W}:${H},setsar=1,fps=30,settb=AVTB[r];
      [a][grid]xfade=transition=fade:duration=${XF}:offset=${XO}[ab];
      [ab][r]xfade=transition=fade:duration=${XF}:offset=${XO2},fade=t=out:st=${FO}:d=${FADE},format=yuv420p[v]" \
    -map "[v]" -an -c:v libx264 -preset slow -crf 25 -profile:v high -movflags +faststart "$OUT/$name.mp4"
  ffmpeg -v error -y -ss 0.7 -i "$OUT/$name.mp4" -vframes 1 -q:v 3 "$OUT/${name}_poster.jpg"
  echo "built $OUT/$name.mp4"
}

# Landscape: 4 slices of 397x1000 with 4 px gaps (source crop 238x600, aspect 0.4).
build hero "crop=1152:720:64:0" 1600 1000 "$(cells 238 397 1000)" "0_0|401_0|802_0|1203_0" "crop=1088:680:0:20"
# Portrait: 2x2 cells of 358x638 with 4 px gaps (source crop 337x600, aspect 0.56).
build hero_portrait "crop=405:720:590:0" 720 1280 "$(cells 337 358 638)" "0_0|362_0|0_642|362_642" "crop=405:720:370:0"
