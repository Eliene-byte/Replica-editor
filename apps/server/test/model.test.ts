import test from "node:test";
import assert from "node:assert/strict";
import {
  clipEnd,
  findGap,
  firstFreeFrame,
  insertClip,
  makeClip,
  moveClip,
  rippleDelete,
  razorAt,
  setKeyframe,
  snapFrame,
  trimClip,
  valueAt,
} from "../../web/src/core/model.ts";
import { emptyTimeline } from "../../shared/types.ts";
import type { Timeline } from "../../shared/types.ts";

function timelineWith(): Timeline {
  const timeline = emptyTimeline("tl_1", 30);
  timeline.tracks[0].volume = 1;
  return timeline;
}

test("insertClip coloca o clipe e mantém a duração coerente", () => {
  const timeline = timelineWith();
  const clip = makeClip({
    trackId: "tl_1_v1",
    mediaId: "med_1",
    start: 0,
    in: 0,
    out: 90,
    id: "clp_1",
  });
  const next = insertClip(timeline, clip, { ripple: false });
  assert.equal(next.clips.length, 1);
  assert.equal(next.clips[0].start, 0);
  assert.equal(next.clips[0].out, 90);
  assert.equal(timeline.clips.length, 0, "a timeline original não é mutada");
});

test("insertClip com ripple empurra os clipes seguintes", () => {
  const timeline = timelineWith();
  const first = makeClip({ trackId: "tl_1_v1", mediaId: "med_1", start: 0, in: 0, out: 30, id: "clp_1" });
  const second = makeClip({ trackId: "tl_1_v1", mediaId: "med_1", start: 30, in: 0, out: 30, id: "clp_2" });
  let next = insertClip(timeline, first, { ripple: false });
  next = insertClip(next, second, { ripple: false });

  const inserted = makeClip({ trackId: "tl_1_v1", mediaId: "med_2", start: 0, in: 0, out: 15, id: "clp_3" });
  next = insertClip(next, inserted, { ripple: true });

  const clp1 = next.clips.find((c) => c.id === "clp_1")!;
  const clp2 = next.clips.find((c) => c.id === "clp_2")!;
  assert.equal(clp1.start, 15, "o clipe inserido empurra o que vem depois");
  assert.equal(clp2.start, 45);
});

test("rippleDelete fecha o buraco", () => {
  const timeline = timelineWith();
  const a = makeClip({ trackId: "tl_1_v1", mediaId: "med_1", start: 0, in: 0, out: 30, id: "clp_1" });
  const b = makeClip({ trackId: "tl_1_v1", mediaId: "med_1", start: 30, in: 0, out: 30, id: "clp_2" });
  let next = insertClip(timeline, a, { ripple: false });
  next = insertClip(next, b, { ripple: false });
  next = rippleDelete(next, "clp_1");
  assert.equal(next.clips.length, 1);
  assert.equal(next.clips[0].start, 0, "o clipe seguinte volta para o início");
});

test("razorAt divide o clipe no frame e conserva a duração total", () => {
  const timeline = timelineWith();
  const clip = makeClip({ trackId: "tl_1_v1", mediaId: "med_1", start: 0, in: 0, out: 100, id: "clp_1" });
  const next = insertClip(timeline, clip, { ripple: false });
  const cut = razorAt(next, 40);
  assert.equal(cut.clips.length, 2);
  const left = cut.clips.find((c) => c.id === "clp_1")!;
  const right = cut.clips.find((c) => c.id !== "clp_1")!;
  assert.equal(left.out, 40);
  assert.equal(right.in, 40);
  assert.equal(right.start, 40);
  assert.equal(left.out - left.in + (right.out - right.in), 100, "nenhum frame se perde no corte");
});

test("trimClip nunca deixa o clipe com duração zero nem passa do material", () => {
  const timeline = timelineWith();
  const clip = makeClip({ trackId: "tl_1_v1", mediaId: "med_1", start: 0, in: 10, out: 50, id: "clp_1" });
  let next = insertClip(timeline, clip, { ripple: false });

  next = trimClip(next, "clp_1", "out", 9999, 200);
  assert.equal(next.clips[0].out, 200, "não passa do fim da mídia");

  next = trimClip(next, "clp_1", "in", -999, 200);
  assert.ok(next.clips[0].out > next.clips[0].in, "duração continua positiva");
});

test("trim da entrada move o início do clipe junto", () => {
  const timeline = timelineWith();
  const clip = makeClip({ trackId: "tl_1_v1", mediaId: "med_1", start: 0, in: 10, out: 50, id: "clp_1" });
  let next = insertClip(timeline, clip, { ripple: false });
  next = trimClip(next, "clp_1", "in", 5, 200);
  assert.equal(next.clips[0].in, 15);
  assert.equal(next.clips[0].start, 5, "o clipe anda junto para não mudar a duração");
});

test("moveClip desloca o clipe e os keyframes", () => {
  const timeline = timelineWith();
  const clip = makeClip({ trackId: "tl_1_v1", mediaId: "med_1", start: 0, in: 0, out: 50, id: "clp_1" });
  let next = insertClip(timeline, clip, { ripple: false });
  next = setKeyframe(next, "clp_1", "opacity", 10, 0.5, "kf_1");
  next = moveClip(next, "clp_1", 30);
  assert.equal(next.clips[0].start, 30);
  assert.equal(next.clips[0].keyframes[0].time, 40, "o keyframe viaja com o clipe");
});

test("valueAt interpola entre keyframes", () => {
  const timeline = timelineWith();
  const clip = makeClip({ trackId: "tl_1_v1", mediaId: "med_1", start: 0, in: 0, out: 100, id: "clp_1" });
  let next = insertClip(timeline, clip, { ripple: false });
  next = setKeyframe(next, "clp_1", "opacity", 10, 0, "kf_1");
  next = setKeyframe(next, "clp_1", "opacity", 20, 1, "kf_2");
  const target = next.clips[0];
  assert.equal(valueAt(target, "opacity", 10), 0);
  assert.equal(valueAt(target, "opacity", 15), 0.5);
  assert.equal(valueAt(target, "opacity", 20), 1);
});

test("snapFrame encosta na borda mais próxima dentro da tolerância", () => {
  const timeline = timelineWith();
  const clip = makeClip({ trackId: "tl_1_v1", mediaId: "med_1", start: 100, in: 0, out: 50, id: "clp_1" });
  const next = insertClip(timeline, clip, { ripple: false });
  assert.equal(snapFrame(next, 103, 5), 100);
  assert.equal(snapFrame(next, 90, 5), 90, "fora da tolerância, o frame não muda");
});

test("firstFreeFrame acha o fim do último clip da faixa", () => {
  const timeline = timelineWith();
  const a = makeClip({ trackId: "tl_1_v1", mediaId: "med_1", start: 0, in: 0, out: 30, id: "clp_1" });
  const b = makeClip({ trackId: "tl_1_v1", mediaId: "med_1", start: 30, in: 0, out: 30, id: "clp_2" });
  let next = insertClip(timeline, a, { ripple: false });
  next = insertClip(next, b, { ripple: false });
  assert.equal(firstFreeFrame(next, "tl_1_v1"), 60);
  assert.equal(findGap(next, "tl_1_v1", 0, 30), 60);
});

test("clipEnd devolve o frame final do clipe", () => {
  const timeline = timelineWith();
  const clip = makeClip({ trackId: "tl_1_v1", mediaId: "med_1", start: 10, in: 0, out: 30, id: "clp_1" });
  const next = insertClip(timeline, clip, { ripple: false });
  assert.equal(clipEnd(next.clips[0]), 40);
});
