// UyDosh Web — 1-on-1 lifestyle compatibility scoring for the Telegram Mini
// App listing detail page (listing.html).
//
// This is a line-for-line port of the Flutter app's
// lib/domain/utils/profile_match_scoring.dart — same weights, thresholds and
// dealbreaker rules — so a viewer and a listing owner see the *same* match
// percentage whether they're on the native app or in the Mini App. Keep the
// two in sync; operates on the raw snake_case `/profiles/:userId` response
// fields (gender, region_id, university_id, sleep_time, wakeup_time,
// cleanliness, noise_level, sociability, smoking_preference,
// alcohol_preference, guests_allowed, cooking_habits, pets_preference,
// preferred_language, birth_year, budget_min/max, pref_age_min/max,
// pref_roommate_gender, pref_budget_overlap_required, dealbreakers,
// top_priorities) rather than the Dart model's camelCase getters.
//
// Depends on nothing (pure functions). Load anywhere before listing.html's
// inline script uses `UyDosh.computeProfileCompatibility`.

const MATCH_PRIORITY_BOOST = 2.0;
const MATCH_DEALBREAKER_CAP = 0.35;
const MATCH_DEALBREAKER_CONFLICT_THRESHOLD = 0.5;

function dayPhaseOrder(value) {
  switch (value) {
    case 'morning': return 0;
    case 'evening': return 1;
    case 'night': return 2;
    default: return null;
  }
}

/** Public — reused by the listing-detail breakdown to render wake/sleep rows separately. */
function dayPhaseSlotScore(x, y) {
  if (x == null || y == null) return null;
  const ox = dayPhaseOrder(x);
  const oy = dayPhaseOrder(y);
  if (ox != null && oy != null) {
    const dist = Math.abs(ox - oy);
    return 1.0 - Math.min(Math.max(dist / 2.0, 0), 1);
  }
  return x === y ? 1.0 : 0.0;
}

function sleepScheduleCompatibility(sleepA, wakeA, sleepB, wakeB) {
  const sleepSlot = dayPhaseSlotScore(sleepA, sleepB);
  const wakeSlot = dayPhaseSlotScore(wakeA, wakeB);
  if (sleepSlot == null && wakeSlot == null) return null;
  if (sleepSlot == null) return wakeSlot;
  if (wakeSlot == null) return sleepSlot;
  return (sleepSlot + wakeSlot) / 2.0;
}

/** `a === b ? 1 : 0` when both set; null when either side is missing. */
function preferenceBinaryScore(a, b) {
  if (a == null || b == null) return null;
  return a === b ? 1.0 : 0.0;
}

/** Same university = 1.0; both students at different schools = 0.55. */
function universityScore(a, b) {
  if (a == null || b == null) return null;
  if (Number(a) === Number(b)) return 1.0;
  return 0.55;
}

/** 1-5 scale: exact = 1.0, ±1 = 0.75, ±2 = 0.35, farther = 0.0. */
function scaleCompatibility(a, b, tolerance = 1) {
  if (a == null || b == null) return null;
  const dist = Math.abs(Number(a) - Number(b));
  if (dist === 0) return 1.0;
  if (dist <= tolerance) return 0.75;
  if (dist === tolerance + 1) return 0.35;
  return 0.0;
}

/**
 * Viewer's desired roommate gender ('any'|'male'|'female') vs a candidate's
 * `gender` (1 = male, 2 = female). Null when the viewer has no preference, or
 * the candidate's gender is unknown for a specific preference.
 */
function roommateGenderScore(pref, candidateGender) {
  if (pref == null || String(pref).trim() === '') return null;
  const p = String(pref).trim().toLowerCase();
  if (p === 'any') return 1.0;
  if (candidateGender == null) return null;
  if (p === 'male') return Number(candidateGender) === 1 ? 1.0 : 0.0;
  if (p === 'female') return Number(candidateGender) === 2 ? 1.0 : 0.0;
  return null;
}

/**
 * Candidate age (from `birthYear`) against the viewer's desired range.
 * In range = 1.0, within 2 yrs = 0.5, within 4 yrs = 0.25, else 0.0. Null when
 * the viewer set no range, or the candidate has no birth year.
 */
function ageRangeScore(prefMin, prefMax, birthYear, nowYear = new Date().getFullYear()) {
  if (prefMin == null && prefMax == null) return null;
  if (birthYear == null) return null;
  const age = nowYear - Number(birthYear);
  if (age < 0 || age > 120) return null;
  const lo = prefMin != null ? Number(prefMin) : 0;
  const hi = prefMax != null ? Number(prefMax) : 200;
  if (age >= lo && age <= hi) return 1.0;
  const dist = age < lo ? lo - age : age - hi;
  if (dist <= 2) return 0.5;
  if (dist <= 4) return 0.25;
  return 0.0;
}

/**
 * Overlap of two monthly-budget ranges. Full overlap = 1.0, a near miss (gap
 * within 15% of the larger budget) = 0.5, otherwise 0.0. Null when either
 * side provided no budget at all. Missing bounds default to an open end (no
 * minimum = 0, no maximum = unbounded).
 */
function budgetOverlapScore(aMin, aMax, bMin, bMax) {
  const aHasAny = aMin != null || aMax != null;
  const bHasAny = bMin != null || bMax != null;
  if (!aHasAny || !bHasAny) return null;

  const aLo = aMin != null ? Number(aMin) : 0;
  const aHi = aMax != null ? Number(aMax) : Infinity;
  const bLo = bMin != null ? Number(bMin) : 0;
  const bHi = bMax != null ? Number(bMax) : Infinity;

  const overlapLo = Math.max(aLo, bLo);
  const overlapHi = Math.min(aHi, bHi);
  if (overlapLo <= overlapHi) return 1.0;

  const gap = overlapLo - overlapHi;
  const finiteRefs = [aHi, bHi, aLo, bLo].filter((v) => Number.isFinite(v));
  const ref = finiteRefs.reduce((m, v) => Math.max(m, v), 0);
  if (ref <= 0) return 0.0;
  return gap <= ref * 0.15 ? 0.5 : 0.0;
}

function smokingCompatibility(a, b) {
  if (a == null || b == null) return null;
  if (a === b) return { score: 1.0, isDealbreaker: false };

  const nonSmoker = 'non-smoker';
  const occasional = 'occasional';
  const regular = 'regular';

  const isDealbreaker = (a === nonSmoker && b === regular) || (b === nonSmoker && a === regular);
  if (isDealbreaker) return { score: 0.0, isDealbreaker: true };
  if ((a === nonSmoker && b === occasional) || (b === nonSmoker && a === occasional)) {
    return { score: 0.35, isDealbreaker: false };
  }
  if ((a === occasional && b === regular) || (b === occasional && a === regular)) {
    return { score: 0.55, isDealbreaker: false };
  }
  return { score: 0.0, isDealbreaker: false };
}

const PETS_HAS_PET = new Set(['have_cat', 'have_dog']);

function petsPreferenceCompatible(a, b) {
  if (a === b) return true;
  if (a === 'like_pets' && PETS_HAS_PET.has(b)) return true;
  if (b === 'like_pets' && PETS_HAS_PET.has(a)) return true;
  return false;
}

/** API slugs: `like_pets` | `dont_like_pets` | `have_cat` | `have_dog`. */
function petsCompatibility(a, b) {
  if (a == null || b == null) return null;
  if (petsPreferenceCompatible(a, b)) return { score: 1.0, isDealbreaker: false };
  const isDealbreaker = (a === 'dont_like_pets' && PETS_HAS_PET.has(b)) ||
    (b === 'dont_like_pets' && PETS_HAS_PET.has(a));
  if (isDealbreaker) return { score: 0.0, isDealbreaker: true };
  return { score: 0.2, isDealbreaker: false };
}

function slugSet(raw) {
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.map((e) => String(e).trim().toLowerCase()).filter(Boolean));
}

function weightFor(slug, baseWeight, ctx) {
  return ctx.priorities.has(slug) ? baseWeight * MATCH_PRIORITY_BOOST : baseWeight;
}

/**
 * Builds a field result, applying the viewer's dealbreaker list and priority
 * weight boost on top of a pre-computed `partial` score. Mirrors Dart's
 * `_finalizeField` + `ProfileMatchFieldResult`.
 */
function finalizeField({
  labelKey,
  slug,
  baseWeight,
  partial,
  ctx,
  builtInDealbreaker = false,
  forceDealbreaker = false,
}) {
  const weight = weightFor(slug, baseWeight, ctx);
  if (partial == null) {
    return { labelKey, weight, status: 'incomplete', partialScore: null, isDealbreaker: false };
  }
  const listedDealbreaker = ctx.dealbreakers.has(slug) && partial < MATCH_DEALBREAKER_CONFLICT_THRESHOLD;
  const isDealbreaker = Boolean(builtInDealbreaker || forceDealbreaker || listedDealbreaker);
  const status = isDealbreaker ? 'dealbreaker' : (partial >= 0.75 ? 'match' : 'difference');
  return { labelKey, weight, status, partialScore: partial, isDealbreaker };
}

/** Scores `candidate` from `viewer`'s perspective (viewer's prefs apply). */
function directionalAnalysis(viewer, candidate) {
  const ctx = {
    dealbreakers: slugSet(viewer.dealbreakers),
    priorities: slugSet(viewer.top_priorities),
  };

  const smoking = smokingCompatibility(viewer.smoking_preference, candidate.smoking_preference);
  const pets = petsCompatibility(viewer.pets_preference, candidate.pets_preference);
  const genderPartial = roommateGenderScore(viewer.pref_roommate_gender, candidate.gender);
  const specificGenderMismatch = genderPartial != null && genderPartial === 0.0;
  const budgetPartial = budgetOverlapScore(viewer.budget_min, viewer.budget_max, candidate.budget_min, candidate.budget_max);
  const overlapRequiredMiss = Boolean(viewer.pref_budget_overlap_required) &&
    budgetPartial != null && budgetPartial < 1.0;

  const fields = [
    finalizeField({
      labelKey: 'sleep_schedule', slug: 'sleep', baseWeight: 0.18, ctx,
      partial: sleepScheduleCompatibility(viewer.sleep_time, viewer.wakeup_time, candidate.sleep_time, candidate.wakeup_time),
    }),
    finalizeField({
      labelKey: 'smoking_preference', slug: 'smoking', baseWeight: 0.18, ctx,
      partial: smoking?.score, builtInDealbreaker: smoking?.isDealbreaker ?? false,
    }),
    finalizeField({
      labelKey: 'pets_preference', slug: 'pets', baseWeight: 0.10, ctx,
      partial: pets?.score, builtInDealbreaker: pets?.isDealbreaker ?? false,
    }),
    finalizeField({
      labelKey: 'cleanliness', slug: 'cleanliness', baseWeight: 0.10, ctx,
      partial: scaleCompatibility(viewer.cleanliness, candidate.cleanliness),
    }),
    finalizeField({
      labelKey: 'noise_level', slug: 'noise', baseWeight: 0.10, ctx,
      partial: scaleCompatibility(viewer.noise_level, candidate.noise_level),
    }),
    finalizeField({
      labelKey: 'sociability', slug: 'sociability', baseWeight: 0.08, ctx,
      partial: scaleCompatibility(viewer.sociability, candidate.sociability),
    }),
    finalizeField({
      labelKey: 'alcohol_preference', slug: 'drinking', baseWeight: 0.08, ctx,
      partial: preferenceBinaryScore(viewer.alcohol_preference, candidate.alcohol_preference),
    }),
    finalizeField({
      labelKey: 'university', slug: 'university', baseWeight: 0.08, ctx,
      partial: universityScore(viewer.university_id, candidate.university_id),
    }),
    finalizeField({
      labelKey: 'guests', slug: 'guests', baseWeight: 0.05, ctx,
      partial: preferenceBinaryScore(viewer.guests_allowed, candidate.guests_allowed),
    }),
    finalizeField({
      labelKey: 'cooking_habits', slug: 'cooking', baseWeight: 0.03, ctx,
      partial: preferenceBinaryScore(viewer.cooking_habits, candidate.cooking_habits),
    }),
    finalizeField({
      labelKey: 'region', slug: 'region', baseWeight: 0.01, ctx,
      partial: preferenceBinaryScore(viewer.region_id, candidate.region_id),
    }),
    finalizeField({
      labelKey: 'language', slug: 'language', baseWeight: 0.01, ctx,
      partial: preferenceBinaryScore(viewer.preferred_language, candidate.preferred_language),
    }),
    finalizeField({
      // A specific gender preference that is not met is always a hard filter.
      labelKey: 'roommate_gender', slug: 'gender', baseWeight: 0.12, ctx,
      partial: genderPartial, forceDealbreaker: specificGenderMismatch,
    }),
    finalizeField({
      labelKey: 'age', slug: 'age', baseWeight: 0.06, ctx,
      partial: ageRangeScore(viewer.pref_age_min, viewer.pref_age_max, candidate.birth_year),
    }),
    finalizeField({
      labelKey: 'budget', slug: 'budget', baseWeight: 0.10, ctx,
      partial: budgetPartial, forceDealbreaker: overlapRequiredMiss,
    }),
  ];

  const scored = fields.filter((f) => f.status !== 'incomplete' && f.partialScore != null);
  const hasDealbreaker = fields.some((f) => f.isDealbreaker);

  let rawScore = 0.0;
  if (scored.length > 0) {
    const weightSum = scored.reduce((sum, f) => sum + f.weight, 0);
    const weighted = scored.reduce((sum, f) => sum + f.weight * f.partialScore, 0);
    rawScore = weightSum === 0 ? 0.0 : Math.min(Math.max(weighted / weightSum, 0), 1);
  }

  return {
    rawScore,
    fields,
    scoredFieldCount: scored.length,
    totalFieldCount: fields.length,
    hasDealbreaker,
  };
}

/**
 * Unified profile compatibility. Asymmetric: each side's own dealbreakers,
 * priorities and "what I'm looking for" preferences are applied to the other.
 * The breakdown `fields` are from `a`'s perspective (the viewing user); the
 * numeric score is `min(a→b, b→a)` so either party's dealbreaker tanks it.
 *
 * `percent` is always a number here (0 when nothing could be scored) — the
 * caller decides whether to null it out to show a "complete your profile"
 * prompt instead (see listing.html's compatibility tile).
 */
function computeProfileCompatibility(a, b) {
  const viewerProfile = a || {};
  const candidateProfile = b || {};
  const forward = directionalAnalysis(viewerProfile, candidateProfile);
  const reverse = directionalAnalysis(candidateProfile, viewerProfile);

  const hasDealbreaker = forward.hasDealbreaker || reverse.hasDealbreaker;
  let score = Math.min(forward.rawScore, reverse.rawScore);
  if (hasDealbreaker) score = Math.min(Math.max(score, 0), MATCH_DEALBREAKER_CAP);

  return {
    score,
    percent: Math.round(score * 100),
    scoredFieldCount: forward.scoredFieldCount,
    totalFieldCount: forward.totalFieldCount,
    fields: forward.fields,
    hasDealbreaker,
  };
}

window.UyDosh = window.UyDosh || {};
Object.assign(window.UyDosh, {
  computeProfileCompatibility,
  dayPhaseSlotScore,
});
