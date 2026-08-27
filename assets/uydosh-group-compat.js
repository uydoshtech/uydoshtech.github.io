// UyDosh Web — multi-member group compatibility + preference matrix.
// Port of lib/presentation/screens/listing_detail/listing_detail_group_compatibility_helper.dart
// Uses the same scoring primitives as assets/uydosh-profile-match.js (loaded first).
// Profiles are snake_case `/profiles/:userId` records.

const GROUP_CLUSTER_THRESHOLD = 0.75;
const GROUP_DEALBREAKER_CAP = 0.35;
const GROUP_DEALBREAKER_CONFLICT_THRESHOLD = 0.5;

function groupProfileId(profile) {
  const id = Number(profile?.user_id ?? profile?.userId ?? profile?.id);
  return Number.isFinite(id) ? id : 0;
}

function groupMissing(value) {
  return value == null || value === '';
}

function groupDayLabel(value) {
  if (groupMissing(value)) return null;
  if (value === 'morning' || value === 'evening' || value === 'night') {
    return UyDosh.t(`profile.lifestyle.${value}`);
  }
  return String(value);
}

function groupEnumLabel(map, value) {
  if (groupMissing(value)) return null;
  const key = map[value];
  return key ? UyDosh.t(`profile.lifestyle.${key}`) : String(value);
}

function groupScaleLabel(keys, value) {
  if (value == null || value === '') return null;
  const idx = Math.min(Math.max((Number(value) || 1) - 1, 0), keys.length - 1);
  return UyDosh.t(`profile.lifestyle.${keys[idx]}`);
}

function groupBoolLabel(value, yesKey, noKey) {
  if (value == null) return null;
  return UyDosh.t(value ? yesKey : noKey);
}

function groupLanguageLabel(code) {
  if (groupMissing(code)) return null;
  return UyDosh.languageLabelWithFlag(code) || String(code);
}

function groupFieldSpecs() {
  return [
    {
      labelKey: 'wakeup_time',
      slug: 'sleep',
      pairScore: (a, b) => dayPhaseSlotScore(a.wakeup_time, b.wakeup_time),
      displayText: (p) => groupDayLabel(p.wakeup_time),
      isDealbreakerPair: null,
    },
    {
      labelKey: 'sleep_time',
      slug: 'sleep',
      pairScore: (a, b) => dayPhaseSlotScore(a.sleep_time, b.sleep_time),
      displayText: (p) => groupDayLabel(p.sleep_time),
      isDealbreakerPair: null,
    },
    {
      labelKey: 'smoking_preference',
      slug: 'smoking',
      pairScore: (a, b) => smokingCompatibility(a.smoking_preference, b.smoking_preference)?.score ?? null,
      displayText: (p) => groupEnumLabel(
        { 'non-smoker': 'nonSmoker', occasional: 'occasionalSmoker', regular: 'regularSmoker' },
        p.smoking_preference,
      ),
      isDealbreakerPair: (a, b) => smokingCompatibility(a.smoking_preference, b.smoking_preference)?.isDealbreaker === true,
    },
    {
      labelKey: 'alcohol_preference',
      slug: 'drinking',
      pairScore: (a, b) => preferenceBinaryScore(a.alcohol_preference, b.alcohol_preference),
      displayText: (p) => groupEnumLabel(
        { 'non-drinker': 'nonDrinker', occasional: 'occasionalDrinker', regular: 'regularDrinker' },
        p.alcohol_preference,
      ),
      isDealbreakerPair: null,
    },
    {
      labelKey: 'cleanliness',
      slug: 'cleanliness',
      pairScore: (a, b) => scaleCompatibility(a.cleanliness, b.cleanliness),
      displayText: (p) => groupScaleLabel(['veryMessy', 'messy', 'average', 'clean', 'veryClean'], p.cleanliness),
      isDealbreakerPair: null,
    },
    {
      labelKey: 'noise_level',
      slug: 'noise',
      pairScore: (a, b) => scaleCompatibility(a.noise_level, b.noise_level),
      displayText: (p) => groupScaleLabel(['veryQuiet', 'quiet', 'average', 'loud', 'veryLoud'], p.noise_level),
      isDealbreakerPair: null,
    },
    {
      labelKey: 'sociability',
      slug: 'sociability',
      pairScore: (a, b) => scaleCompatibility(a.sociability, b.sociability),
      displayText: (p) => groupScaleLabel(
        ['veryIntroverted', 'introverted', 'balanced', 'extroverted', 'veryExtroverted'],
        p.sociability,
      ),
      isDealbreakerPair: null,
    },
    {
      labelKey: 'guests',
      slug: 'guests',
      pairScore: (a, b) => preferenceBinaryScore(a.guests_allowed, b.guests_allowed),
      displayText: (p) => groupBoolLabel(p.guests_allowed, 'profile.lifestyle.guestsYes', 'profile.lifestyle.guestsNo'),
      isDealbreakerPair: null,
    },
    {
      labelKey: 'cooking_habits',
      slug: 'cooking',
      pairScore: (a, b) => preferenceBinaryScore(a.cooking_habits, b.cooking_habits),
      displayText: (p) => groupBoolLabel(p.cooking_habits, 'profile.lifestyle.cook', 'profile.lifestyle.dontCook'),
      isDealbreakerPair: null,
    },
    {
      labelKey: 'language',
      slug: 'language',
      pairScore: (a, b) => preferenceBinaryScore(a.preferred_language, b.preferred_language),
      displayText: (p) => groupLanguageLabel(p.preferred_language),
      isDealbreakerPair: null,
    },
    {
      labelKey: 'pets_preference',
      slug: 'pets',
      pairScore: (a, b) => petsCompatibility(a.pets_preference, b.pets_preference)?.score ?? null,
      displayText: (p) => groupEnumLabel(
        { dont_like_pets: 'dontLikePets', like_pets: 'likePets', have_cat: 'haveCat', have_dog: 'haveDog' },
        p.pets_preference,
      ),
      isDealbreakerPair: (a, b) => petsCompatibility(a.pets_preference, b.pets_preference)?.isDealbreaker === true,
    },
  ];
}

function groupDealbreakerSlugs(profile) {
  const raw = profile?.dealbreakers;
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.map((e) => String(e).trim().toLowerCase()).filter(Boolean));
}

function groupIsPairDealbreaker(a, b, spec) {
  if (spec.isDealbreakerPair?.(a, b) === true) return true;
  const listed = groupDealbreakerSlugs(a).has(spec.slug) || groupDealbreakerSlugs(b).has(spec.slug);
  if (!listed) return false;
  const score = spec.pairScore(a, b);
  return score != null && score < GROUP_DEALBREAKER_CONFLICT_THRESHOLD;
}

function groupParticipantInDealbreaker(profile, active, spec) {
  return active.some((other) => {
    if (groupProfileId(other) === groupProfileId(profile)) return false;
    return groupIsPairDealbreaker(profile, other, spec);
  });
}

function groupBuildClusters(profiles, spec) {
  const clusters = [];
  const compatible = (a, b) => {
    const score = spec.pairScore(a, b);
    return score != null && score >= GROUP_CLUSTER_THRESHOLD;
  };
  for (const profile of profiles) {
    let placed = false;
    for (const cluster of clusters) {
      if (compatible(profile, cluster[0])) {
        cluster.push(profile);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push([profile]);
  }
  return clusters;
}

function groupDominantDisplay(cluster, spec) {
  const counts = new Map();
  for (const profile of cluster) {
    const text = spec.displayText(profile);
    if (!text) continue;
    counts.set(text, (counts.get(text) || 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || '';
}

function groupClusterSummary(clusters, spec) {
  const parts = clusters.map((cluster) => ({
    count: cluster.length,
    text: UyDosh.t('compat.groupValueCount')
      .replace('{count}', String(cluster.length))
      .replace('{value}', groupDominantDisplay(cluster, spec)),
  }));
  parts.sort((a, b) => b.count - a.count);
  return parts.map((p) => p.text).join(' · ');
}

function groupCellStatus({ displayText, sortedClusters, largestCluster, hasDealbreaker }) {
  if (!displayText) return 'missing';
  if (hasDealbreaker) return 'conflict';
  if (!largestCluster) return 'missing';
  if (sortedClusters.length === 1) return 'fullMatch';
  if (largestCluster.length < 2) return 'conflict';
  return 'mismatch';
}

function groupPreferenceAlignmentSummary(participants, spec) {
  const active = participants.filter((p) => spec.displayText(p) != null);
  if (active.length < 2) return null;
  const clusters = groupBuildClusters(active, spec);
  if (!clusters.length) return null;
  const sorted = [...clusters].sort((a, b) => b.length - a.length);
  const largest = sorted[0];
  const prefix = `${largest.length}/${participants.length}`;
  if (sorted.length === 1 && largest.length === active.length) {
    return `${prefix} · ${groupDominantDisplay(largest, spec)}`;
  }
  return `${prefix} · ${groupClusterSummary(sorted, spec)}`;
}

function groupPreferenceMatrixCells(participants, spec) {
  const active = participants.filter((p) => spec.displayText(p) != null);
  const clusters = active.length < 2 ? [] : groupBuildClusters(active, spec);
  const sortedClusters = [...clusters].sort((a, b) => b.length - a.length);
  const largest = sortedClusters[0] || null;
  return participants.map((profile) => {
    const displayText = spec.displayText(profile);
    const inLargest = largest?.some((p) => groupProfileId(p) === groupProfileId(profile));
    let status = groupCellStatus({
      displayText,
      sortedClusters,
      largestCluster: largest,
      hasDealbreaker: groupParticipantInDealbreaker(profile, active, spec),
    });
    if (status === 'mismatch' && inLargest) status = 'partialMatch';
    return {
      userId: groupProfileId(profile),
      value: displayText || UyDosh.t('profile.lifestyle.notSpecified'),
      status,
    };
  });
}

function buildGroupPreferenceMatrix(participants) {
  if (!Array.isArray(participants) || participants.length < 2) return [];
  return groupFieldSpecs().map((spec) => ({
    labelKey: spec.labelKey,
    label: groupFieldLabel(spec.labelKey),
    alignmentSummary: groupPreferenceAlignmentSummary(participants, spec),
    cells: groupPreferenceMatrixCells(participants, spec),
  }));
}

function groupFieldLabel(labelKey) {
  switch (labelKey) {
    case 'wakeup_time': return UyDosh.t('profile.lifestyle.wakeupTime');
    case 'sleep_time': return UyDosh.t('profile.lifestyle.sleepTime');
    case 'smoking_preference': return UyDosh.t('profile.lifestyle.smokingPreference');
    case 'pets_preference': return UyDosh.t('profile.lifestyle.petsPreference');
    case 'cleanliness': return UyDosh.t('profile.lifestyle.cleanliness');
    case 'noise_level': return UyDosh.t('profile.lifestyle.noiseLevel');
    case 'sociability': return UyDosh.t('profile.lifestyle.sociability');
    case 'alcohol_preference': return UyDosh.t('profile.lifestyle.alcoholPreference');
    case 'guests': return UyDosh.t('profile.lifestyle.guestsAllowed');
    case 'cooking_habits': return UyDosh.t('profile.lifestyle.cookingHabits');
    case 'language': return UyDosh.t('compat.language');
    default: return labelKey;
  }
}

function groupAnalyzeField(participants, spec) {
  const active = participants.filter((p) => spec.displayText(p) != null);
  if (active.length < 2) return null;
  const hasDealbreaker = active.some((a, i) =>
    active.slice(i + 1).some((b) => groupIsPairDealbreaker(a, b, spec)));
  const clusters = groupBuildClusters(active, spec);
  if (!clusters.length) return null;
  const sorted = [...clusters].sort((a, b) => b.length - a.length);
  const largest = sorted[0];
  if (hasDealbreaker) {
    return { category: 'discuss', summary: groupClusterSummary(sorted, spec) };
  }
  if (sorted.length === 1 && largest.length === active.length) {
    return { category: 'full', displayValue: groupDominantDisplay(largest, spec) };
  }
  if (largest.length >= 2) {
    const values = [...new Set(sorted.map((c) => groupDominantDisplay(c, spec)))];
    return { category: 'partial', displayValue: values.join(' / '), largestClusterSize: largest.length };
  }
  return { category: 'discuss', summary: groupClusterSummary(sorted, spec) };
}

function calculateGroupCompatibility(participants) {
  const empty = {
    percent: null,
    scoredFieldCount: 0,
    totalFieldCount: 12,
    fullMatches: [],
    partialMatches: [],
    discussItems: [],
  };
  if (!Array.isArray(participants) || participants.length < 2) return empty;

  const fullMatches = [];
  const partialMatches = [];
  const discussItems = [];
  let scoredFieldCount = 0;
  for (const spec of groupFieldSpecs()) {
    const analysis = groupAnalyzeField(participants, spec);
    if (!analysis) continue;
    scoredFieldCount += 1;
    if (analysis.category === 'full') {
      fullMatches.push({ labelKey: spec.labelKey, label: groupFieldLabel(spec.labelKey), value: analysis.displayValue });
    } else if (analysis.category === 'partial') {
      partialMatches.push({
        labelKey: spec.labelKey,
        label: groupFieldLabel(spec.labelKey),
        value: analysis.displayValue,
        agreeCount: analysis.largestClusterSize,
        totalCount: participants.length,
      });
    } else {
      discussItems.push({ labelKey: spec.labelKey, label: groupFieldLabel(spec.labelKey), summary: analysis.summary });
    }
  }

  return {
    percent: groupOverallPercent(participants),
    scoredFieldCount,
    totalFieldCount: 12,
    fullMatches,
    partialMatches,
    discussItems,
  };
}

function groupOverallPercent(participants) {
  if (participants.length < 2) return null;
  let pairCount = 0;
  let scoreSum = 0;
  let hasDealbreaker = false;
  for (let i = 0; i < participants.length; i += 1) {
    for (let j = i + 1; j < participants.length; j += 1) {
      const analysis = UyDosh.computeProfileCompatibility(participants[i], participants[j]);
      if (!analysis.scoredFieldCount) continue;
      pairCount += 1;
      scoreSum += analysis.percent;
      if (analysis.hasDealbreaker) hasDealbreaker = true;
    }
  }
  if (pairCount === 0) return null;
  const average = Math.round(scoreSum / pairCount);
  if (hasDealbreaker) return Math.min(average, Math.round(GROUP_DEALBREAKER_CAP * 100));
  return average;
}

window.UyDosh = window.UyDosh || {};
Object.assign(window.UyDosh, {
  buildGroupPreferenceMatrix,
  calculateGroupCompatibility,
});
