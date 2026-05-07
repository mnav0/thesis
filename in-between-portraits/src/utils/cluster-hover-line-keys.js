/**
 * @typedef {object} ClusterSvgLine
 * @property {string} key
 * @property {string} kind
 * @property {string} [sourcePointKey]
 * @property {string} [targetPointKey]
 * @property {number|string} [sourceClusterId]
 * @property {number|string} [targetClusterId]
 */

export function centerPointLinesFrom(lines) {
  return lines.filter((line) => line.kind === "center-point");
}

export function artistIdFromPointKey(pointDetailsByKey, pointKey) {
  const raw = pointDetailsByKey[pointKey]?.artistId;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Points that should not be dimmed in exhibition mode — used to pre-filter
 * which lines are eligible for direct/secondary emphasis.
 */
export function buildExhibitionNonDimmedPointKeys(opts) {
  const { hoveredPoint, activeClusterIds, pointDetailsByKey, allLines } = opts;
  const keys = new Set();
  const clusterIds =
    activeClusterIds instanceof Set ? activeClusterIds : new Set(activeClusterIds ?? []);

  if (clusterIds.size) {
    for (const [pk, details] of Object.entries(pointDetailsByKey)) {
      if (details.clusterId != null && clusterIds.has(Number(details.clusterId))) {
        keys.add(pk);
      }
    }
    for (const line of allLines) {
      if (!clusterIds.has(Number(line.sourceClusterId))) continue;
      if (line.targetPointKey) keys.add(line.targetPointKey);
    }
  }
  if (hoveredPoint) keys.add(hoveredPoint);
  return keys;
}

function exhibitionCenterPointArtistKeys(line) {
  const out = [];
  if (line.sourcePointKey) out.push(line.sourcePointKey);
  if (line.targetPointKey && line.targetPointKey !== line.sourcePointKey) {
    out.push(line.targetPointKey);
  }
  return out;
}

function exhibitionLineMatchesNonDimmed(line, nonDimmedPointKeys) {
  if (!nonDimmedPointKeys) return true;
  const ends = exhibitionCenterPointArtistKeys(line);
  if (!ends.length) return true;
  return ends.every((pk) => nonDimmedPointKeys.has(pk));
}

export function buildExhibitionDirectLineKeys(ctx) {
  const { centerPointLines, hoveredPoint, hoveredClusterId, pointDetailsByKey, nonDimmedPointKeys } =
    ctx;
  const directKeys = new Set();

  if (hoveredPoint) {
    const hoveredArtistId = artistIdFromPointKey(pointDetailsByKey, hoveredPoint);
    const artistPointKeys = new Set();

    if (hoveredArtistId != null) {
      for (const [pk, details] of Object.entries(pointDetailsByKey)) {
        const n = Number(details?.artistId);
        if (Number.isFinite(n) && n === hoveredArtistId) artistPointKeys.add(pk);
      }
    } else {
      artistPointKeys.add(hoveredPoint);
    }

    for (const line of centerPointLines) {
      const touchesArtist =
        artistPointKeys.has(line.sourcePointKey) ||
        artistPointKeys.has(line.targetPointKey);
      if (!touchesArtist) continue;
      if (!exhibitionLineMatchesNonDimmed(line, nonDimmedPointKeys)) continue;
      directKeys.add(line.key);
    }
  } else if (hoveredClusterId != null) {
    const hoveredId = Number(hoveredClusterId);
    for (const line of centerPointLines) {
      if (Number(line.sourceClusterId) !== hoveredId) continue;
      if (!exhibitionLineMatchesNonDimmed(line, nonDimmedPointKeys)) continue;
      directKeys.add(line.key);
    }
  }

  return directKeys;
}

export function buildExhibitionSecondaryLineKeys(ctx) {
  const {
    centerPointLines,
    hoveredPoint,
    directKeys,
    nonDimmedPointKeys,
  } = ctx;
  const secondaryKeys = new Set();

  if (hoveredPoint) {
    const directExhibitionIds = new Set();
    for (const line of centerPointLines) {
      if (!directKeys.has(line.key)) continue;
      const sid = Number(line.sourceClusterId);
      if (Number.isFinite(sid)) directExhibitionIds.add(sid);
    }

    for (const line of centerPointLines) {
      if (directKeys.has(line.key)) continue;
      // Non-direct lines from hovered artist are intentionally suppressed.
      if (line.sourcePointKey === hoveredPoint) continue;
      const sid = Number(line.sourceClusterId);
      if (!directExhibitionIds.has(sid)) continue;
      if (!exhibitionLineMatchesNonDimmed(line, nonDimmedPointKeys)) continue;
      secondaryKeys.add(line.key);
    }
  }

  return secondaryKeys;
}

export function buildNonExhibitionDirectLineKeys(ctx) {
  const { centerPointLines, hoveredPoint, hoveredClusterId, pointDetailsByKey, primaryLikePoint } =
    ctx;
  const directKeys = new Set();

  if (hoveredPoint) {
    const d = pointDetailsByKey[hoveredPoint];
    for (const line of centerPointLines) {
      if (line.sourcePointKey !== hoveredPoint) continue;
      const targetClusterId = Number(line.targetClusterId);
      if (primaryLikePoint(d, targetClusterId)) {
        directKeys.add(line.key);
      }
    }
  } else if (hoveredClusterId != null) {
    const hoveredId = Number(hoveredClusterId);
    for (const line of centerPointLines) {
      const targetClusterId = Number(line.targetClusterId);
      if (targetClusterId !== hoveredId) continue;
      const details = pointDetailsByKey[line.sourcePointKey];
      if (primaryLikePoint(details, hoveredId)) {
        directKeys.add(line.key);
      }
    }
  }

  return directKeys;
}

export function buildNonExhibitionSecondaryLineKeys(ctx) {
  const { centerPointLines, hoveredPoint, pointDetailsByKey, directKeys, primaryLikePoint } = ctx;
  const secondaryKeys = new Set();

  if (hoveredPoint) {
    // Clusters that the hovered artist is directly/primarily connected to.
    const primarySpokeTargets = new Set();
    for (const line of centerPointLines) {
      if (!directKeys.has(line.key)) continue;
      if (line.sourcePointKey !== hoveredPoint) continue;
      const t = Number(line.targetClusterId);
      if (Number.isFinite(t)) primarySpokeTargets.add(t);
    }

    for (const line of centerPointLines) {
      if (directKeys.has(line.key)) continue;
      // non-activated centers don't show hovered lines
      if (line.sourcePointKey === hoveredPoint) continue;

      // show other artists in activated clusters
      const t = Number(line.targetClusterId);
      if (!primarySpokeTargets.has(t)) continue;
      const details = pointDetailsByKey[line.sourcePointKey];
      if (details && primaryLikePoint(details, t)) secondaryKeys.add(line.key);
    }
  }

  return secondaryKeys;
}

/** @typedef {{ direct: Set<string>; secondary: Set<string> }} ClusterLineHoverSets */

export function buildLineHoverHighlight(opts) {
  const {
    viewMode,
    allLines,
    hoveredPoint,
    hoveredClusterId,
    pointDetailsByKey,
    primaryLikePoint,
    activeClusterIds,
  } = opts;

  const centerPointLines = centerPointLinesFrom(allLines);
  const ctx = {
    centerPointLines,
    hoveredPoint,
    hoveredClusterId,
    pointDetailsByKey,
  };

  if (viewMode === "exhibitions") {
    const nonDimmedPointKeys = buildExhibitionNonDimmedPointKeys({
      hoveredPoint,
      activeClusterIds,
      pointDetailsByKey,
      allLines,
    });
    const exCtx = { ...ctx, nonDimmedPointKeys };
    const direct = buildExhibitionDirectLineKeys(exCtx);
    return {
      direct,
      secondary: buildExhibitionSecondaryLineKeys({
        ...exCtx,
        directKeys: direct,
      }),
    };
  }

  const direct = buildNonExhibitionDirectLineKeys({ ...ctx, primaryLikePoint });
  return {
    direct,
    secondary: buildNonExhibitionSecondaryLineKeys({
      ...ctx,
      directKeys: direct,
      primaryLikePoint,
    }),
  };
}
