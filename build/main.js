// main.ts
async function fetchMapTiles(x, y) {
  const headers = { "Content-Type": "application/json" };
  if (!isBrowser && cookie) {
    headers.Cookie = cookie;
  }
  const response = await fetch(`${baseUrl}/api/v1/map/position`, {
    method: "POST",
    headers,
    credentials: "same-origin",
    body: JSON.stringify({ data: { x, y, zoomLevel: 2, ignorePositions: [] } })
  });
  if (!response.ok) {
    throw new Error(`Map request failed at [${x}, ${y}] with HTTP ${response.status}.`);
  }
  const responseData = await response.json();
  return responseData.tiles || [];
}
var getCropSize = function(title = "") {
  const fieldType = title.match(/\{k\.f(1|2|3|4|6|7|8|9)\}/)?.[1];
  if (fieldType === "1")
    return "9";
  if (fieldType === "2" || fieldType === "3" || fieldType === "4")
    return "6";
  if (fieldType === "6")
    return "15";
  if (fieldType === "7" || fieldType === "8" || fieldType === "9")
    return "7";
  return null;
};
var parseOasis = function(tile) {
  const { position, title = "", text = "" } = tile;
  if (!position || !title.includes("{k.fo}") && !title.includes("{k.bt}")) {
    return null;
  }
  const cropBonus = text.match(/\{a\.r4\}\s*\+?(\d+)%/)?.[1];
  if (!cropBonus) {
    return null;
  }
  return {
    x: position.x,
    y: position.y,
    distance: 0,
    cropBonus: Number(cropBonus),
    occupied: !title.includes("{k.fo}")
  };
};
var isWithinOasisRange = function(firstX, firstY, secondX, secondY) {
  return Math.max(Math.abs(firstX - secondX), Math.abs(firstY - secondY)) <= CONFIG.oasisRadius;
};
var nearbyCropOases = function(villageX, villageY, allOases) {
  return allOases.filter((oasis) => isWithinOasisRange(villageX, villageY, oasis.x, oasis.y)).map((oasis) => ({
    ...oasis,
    distance: Math.max(Math.abs(oasis.x - villageX), Math.abs(oasis.y - villageY))
  })).sort((a, b) => b.cropBonus - a.cropBonus || a.distance - b.distance);
};
var bestOasisBonus = function(oases) {
  return oases.slice(0, CONFIG.maxOases).reduce((total, oasis) => total + oasis.cropBonus, 0);
};
var positionKey = function(x, y) {
  return `${x},${y}`;
};
var buildCropperReachIndex = function(cropTiles) {
  const index = new Map;
  for (const cropper of cropTiles) {
    for (let dx = -CONFIG.oasisRadius;dx <= CONFIG.oasisRadius; dx++) {
      for (let dy = -CONFIG.oasisRadius;dy <= CONFIG.oasisRadius; dy++) {
        const key = positionKey(cropper.x + dx, cropper.y + dy);
        const croppers = index.get(key);
        if (croppers)
          croppers.push(cropper);
        else
          index.set(key, [cropper]);
      }
    }
  }
  return index;
};
var findCompetingCroppers = function(villageX, villageY, availableOases, cropperReachIndex) {
  const nearbyCroppers = new Map;
  for (const oasis of availableOases) {
    for (const cropper of cropperReachIndex.get(positionKey(oasis.x, oasis.y)) || []) {
      nearbyCroppers.set(positionKey(cropper.x, cropper.y), cropper);
    }
  }
  return [...nearbyCroppers.values()].map((cropper) => {
    const sharedOases = availableOases.filter((oasis) => isWithinOasisRange(cropper.x, cropper.y, oasis.x, oasis.y)).map(({ x, y, cropBonus }) => ({ x, y, cropBonus }));
    return {
      x: cropper.x,
      y: cropper.y,
      size: cropper.size,
      distance: Math.hypot(cropper.x - villageX, cropper.y - villageY),
      oasisCropPotential: cropper.oasisCropPotential,
      risk: cropper.risk,
      sharedOases
    };
  }).sort((a, b) => a.distance - b.distance);
};
var escapeHtml = function(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
};
var tileLink = function(x, y) {
  return `${baseUrl}/position_details.php?x=${x}&y=${y}`;
};
var buildHtmlReport = function(results) {
  const report = {
    generatedAt: new Date().toISOString(),
    server: CONFIG.server,
    searchCenter: CONFIG.village,
    config: CONFIG,
    summary: {
      totalCroppers: results.length,
      sixCroppers: results.filter((village) => village.size === "6").length,
      sevenCroppers: results.filter((village) => village.size === "7").length,
      withoutOasisClash: results.filter((village) => !village.hasOasisClash).length,
      lowRiskOasisClash: results.filter((village) => village.oasisClashRisk === "low").length,
      highRiskOasisClash: results.filter((village) => village.oasisClashRisk === "high").length,
      withOasisClash: results.filter((village) => village.hasOasisClash).length
    },
    results
  };
  const json = JSON.stringify(report, null, 2);
  const rows = results.map((village) => {
    const oases = village.recommendedOases.length ? village.recommendedOases.map((oasis) => `<a href="${tileLink(oasis.x, oasis.y)}" target="_blank">` + `${escapeHtml(oasis.x)}|${escapeHtml(oasis.y)}</a> (+${oasis.cropBonus}%)`).join("<br>") : "None";
    const competitors = village.competingCroppers.length ? village.competingCroppers.map((cropper) => `<a href="${tileLink(cropper.x, cropper.y)}" target="_blank">` + `${escapeHtml(cropper.size)}c ${escapeHtml(cropper.x)}|${escapeHtml(cropper.y)}</a> ` + `(<strong>${cropper.risk === "low" ? "low risk" : "high risk"}</strong>, ` + `own potential +${cropper.oasisCropPotential}%, shares ` + `${cropper.sharedOases.map((oasis) => `${oasis.x}|${oasis.y}`).join(", ")})`).join("<br>") : "None";
    return `<tr class="${village.oasisClashRisk === "none" ? "clean" : village.oasisClashRisk === "low" ? "low-risk" : "clash"}" data-cropper="${village.size}" data-potential="${village.oasisCropPotential}">
        <td>${village.rank}</td>
        <td>${village.size}c <a href="${tileLink(village.x, village.y)}" target="_blank">${village.x}|${village.y}</a></td>
        <td>${village.distance.toFixed(2)}</td>
        <td><span class="status">${village.oasisClashRisk === "none" ? "CLEAN" : village.oasisClashRisk === "low" ? "LOW RISK" : "CLASH"}</span></td>
        <td>+${village.uncontestedOasisCropBonus}%</td>
        <td>+${village.oasisCropBonus}%</td>
        <td>+${village.oasisCropPotential}%</td>
        <td>${oases}</td><td>${competitors}</td>
      </tr>`;
  }).join("");
  return {
    json,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Travian 6c/7c report</title><style>
body{font:14px system-ui,sans-serif;margin:24px;color:#20251d;background:#f4f1e8}h1{margin-bottom:6px}.summary{color:#596052;margin-bottom:14px}.filters{display:flex;align-items:end;gap:14px;flex-wrap:wrap;margin-bottom:14px;padding:12px;background:#fff;border:1px solid #d6d2c7}.filters label{display:grid;gap:4px;font-weight:600}.filters select{min-width:140px;padding:7px}.filters span{margin-left:auto;color:#596052}button{padding:9px 14px;margin-bottom:18px;cursor:pointer}table{width:100%;border-collapse:collapse;background:white}th,td{border:1px solid #d6d2c7;padding:8px;text-align:left;vertical-align:top}th{position:sticky;top:0;background:#3f4b31;color:white}tr.clean{background:#eff9e9}tr.low-risk{background:#fff8d9}tr.clash{background:#fff0ec}tr:hover{filter:brightness(.97)}a{color:#315d99}.clean .status{color:#287029;font-weight:700}.low-risk .status{color:#9a6b00;font-weight:700}.clash .status{color:#a32d22;font-weight:700}
</style></head><body><h1>Travian 6c/7c report</h1><div class="summary">Center ${CONFIG.village.x}|${CONFIG.village.y} \xB7 radius ${CONFIG.searchRadius} \xB7 ${report.summary.totalCroppers} results (${report.summary.sixCroppers} 6c, ${report.summary.sevenCroppers} 7c) \xB7 ${report.summary.withoutOasisClash} clean \xB7 ${report.summary.lowRiskOasisClash} low risk \xB7 ${report.summary.highRiskOasisClash} clash</div><div class="filters"><label>Cropper<select id="cropper-filter"><option value="all">Both</option><option value="6">6c only</option><option value="7">7c only</option></select></label><label>Oasis potential<select id="potential-filter"><option value="all">Both</option><option value="125">125% only</option><option value="150">150% only</option></select></label><span id="visible-count"></span></div><button id="download-json">Download raw JSON</button><table><thead><tr><th>Rank</th><th>Cropper</th><th>Distance</th><th>Status</th><th>Uncontested crop</th><th>Available crop</th><th>Potential</th><th>Recommended oases</th><th>Competing 9c/15c</th></tr></thead><tbody>${rows}</tbody></table><script type="application/json" id="report-data">${json.replace(/</g, "\\u003c")}</script><script>(function(){var cropper=document.getElementById('cropper-filter');var potential=document.getElementById('potential-filter');var count=document.getElementById('visible-count');var rows=Array.from(document.querySelectorAll('tbody tr'));function applyFilters(){var visible=0;rows.forEach(function(row){var showCropper=cropper.value==='all'||row.dataset.cropper===cropper.value;var showPotential=potential.value==='all'||row.dataset.potential===potential.value;row.hidden=!(showCropper&&showPotential);if(!row.hidden)visible++});count.textContent=visible+' of '+rows.length+' shown'}cropper.addEventListener('change',applyFilters);potential.addEventListener('change',applyFilters);document.getElementById('download-json').addEventListener('click',function(){var data=document.getElementById('report-data').textContent;var url=URL.createObjectURL(new Blob([data],{type:'application/json'}));var link=document.createElement('a');link.href=url;link.download='travian-6c-7c-report.json';link.click();setTimeout(function(){URL.revokeObjectURL(url)},1000)});applyFilters()})();</script></body></html>`
  };
};
var downloadHtmlReport = function(results) {
  if (!isBrowser)
    return;
  const report = buildHtmlReport(results);
  const browserWindow = window;
  const download = () => {
    const url = URL.createObjectURL(new Blob([report.html], { type: "text/html" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `travian-6c-7c-report-${new Date().toISOString().replace(/[:.]/g, "-")}.html`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  browserWindow.travianCropReportData = JSON.parse(report.json);
  browserWindow.downloadTravianCropReport = download;
  if (CONFIG.downloadReport)
    download();
};
/*!
 * Travian 6c/7c Oasis Finder
 * Derived from Travian Crop Finder by kaareloun:
 * https://github.com/kaareloun/travian-crop-finder
 */
var DEFAULT_CONFIG = {
  server: "your-server.example.com",
  village: { x: 0, y: 0 },
  searchRadius: 50,
  negativeQuadrantOnly: false,
  types: [6, 7],
  competitionTypes: [9, 15],
  oasisRadius: 3,
  maxOases: 3,
  minPotentialCropBonus: 125,
  preferredUncontestedCropBonus: 125,
  lowRiskCompetitorPotentialMax: 25,
  downloadReport: true
};
var userConfig = globalThis.TRAVIAN_CROP_FINDER_CONFIG;
var CONFIG = {
  ...DEFAULT_CONFIG,
  ...userConfig,
  village: {
    ...DEFAULT_CONFIG.village,
    ...userConfig?.village
  }
};
var isBrowser = typeof window !== "undefined";
if (!isBrowser && CONFIG.server === "your-server.example.com") {
  throw new Error("Set CONFIG.server or TRAVIAN_CROP_FINDER_CONFIG.server before running outside the browser.");
}
var baseUrl = isBrowser ? window.location.origin : `https://${CONFIG.server}`;
var cookie = typeof document !== "undefined" ? document.cookie : process.env.AUTH_TOKEN || "";
var scanCancelled = false;
if (isBrowser) {
  window.stopTravianCropScan = () => {
    scanCancelled = true;
    console.log("Stopping Travian crop scan after the current request batch.");
  };
}
var competitionMargin = CONFIG.oasisRadius * 3;
var scanRadius = CONFIG.searchRadius + competitionMargin;
var minX = CONFIG.village.x - scanRadius;
var minY = CONFIG.village.y - scanRadius;
var viewportWidth = 21;
var viewportHeight = 17;
var columnCount = Math.ceil((scanRadius * 2 + 1) / viewportWidth);
var rowCount = Math.ceil((scanRadius * 2 + 1) / viewportHeight);
var viewportCenters = [];
for (let row = 0;row < rowCount; row++) {
  for (let column = 0;column < columnCount; column++) {
    viewportCenters.push({
      x: minX + Math.floor(viewportWidth / 2) + column * viewportWidth,
      y: minY + Math.floor(viewportHeight / 2) + row * viewportHeight
    });
  }
}
console.log(`Starting exact 6c/7c oasis scan from [${CONFIG.village.x}, ${CONFIG.village.y}]. ` + `${viewportCenters.length} map blocks to check. Call stopTravianCropScan() to stop.`);
var tileMap = new Map;
for (let index = 0;index < viewportCenters.length; index++) {
  if (scanCancelled)
    break;
  const center = viewportCenters[index];
  const tiles = await fetchMapTiles(center.x, center.y);
  for (const tile of tiles) {
    const position = tile.position;
    if (position && Math.max(Math.abs(position.x - CONFIG.village.x), Math.abs(position.y - CONFIG.village.y)) <= scanRadius) {
      tileMap.set(`${position.x},${position.y}`, tile);
    }
  }
  if ((index + 1) % 5 === 0 || index + 1 === viewportCenters.length) {
    console.log(`Loaded ${index + 1}/${viewportCenters.length} map blocks.`);
  }
}
if (scanCancelled) {
  console.log("Scan stopped. No report was generated.");
} else {
  const allCropTiles = [];
  const allOases = [];
  for (const tile of tileMap.values()) {
    const position = tile.position;
    if (!position)
      continue;
    const size = getCropSize(tile.title);
    if (size) {
      allCropTiles.push({
        x: position.x,
        y: position.y,
        scanDistance: Math.max(Math.abs(position.x - CONFIG.village.x), Math.abs(position.y - CONFIG.village.y)),
        distance: Math.hypot(position.x - CONFIG.village.x, position.y - CONFIG.village.y),
        size
      });
    }
    const oasis = parseOasis(tile);
    if (oasis)
      allOases.push(oasis);
  }
  const candidateTiles = allCropTiles.filter((tile) => CONFIG.types.includes(Number(tile.size)) && tile.scanDistance <= CONFIG.searchRadius && (!CONFIG.negativeQuadrantOnly || tile.x < 0 && tile.y < 0));
  const competingCropTiles = allCropTiles.filter((tile) => CONFIG.competitionTypes.includes(Number(tile.size)));
  console.log(`Map scan complete: ${candidateTiles.length} exact 6c/7c layouts, ` + `${competingCropTiles.length} competing 9c/15c layouts, ${allOases.length} crop oases.`);
  const scoredCompetingCropTiles = competingCropTiles.map((cropper) => {
    const oasisCropPotential = bestOasisBonus(nearbyCropOases(cropper.x, cropper.y, allOases));
    return {
      ...cropper,
      oasisCropPotential,
      risk: oasisCropPotential <= CONFIG.lowRiskCompetitorPotentialMax ? "low" : "high"
    };
  });
  const cropperReachIndex = buildCropperReachIndex(scoredCompetingCropTiles);
  const results = [];
  for (let candidateIndex = 0;candidateIndex < candidateTiles.length; candidateIndex++) {
    if (candidateIndex > 0 && candidateIndex % 250 === 0) {
      console.log(`Analyzed ${candidateIndex}/${candidateTiles.length} cropper candidates.`);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    if (scanCancelled)
      break;
    const candidate = candidateTiles[candidateIndex];
    const oases = nearbyCropOases(candidate.x, candidate.y, allOases);
    const availableOases = oases.filter((oasis) => !oasis.occupied);
    const competingCroppers = findCompetingCroppers(candidate.x, candidate.y, availableOases, cropperReachIndex);
    const clashingOasisKeys = new Set(competingCroppers.flatMap((cropper) => cropper.sharedOases.map((oasis) => `${oasis.x},${oasis.y}`)));
    const uncontestedOases = availableOases.filter((oasis) => !clashingOasisKeys.has(`${oasis.x},${oasis.y}`));
    const oasisCropBonus = bestOasisBonus(availableOases);
    const uncontestedOasisCropBonus = bestOasisBonus(uncontestedOases);
    const oasisCropPotential = bestOasisBonus(oases);
    const hasOasisClash = competingCroppers.length > 0;
    const oasisClashRisk = !hasOasisClash ? "none" : competingCroppers.some((cropper) => cropper.risk === "high") ? "high" : "low";
    if (oasisCropPotential < CONFIG.minPotentialCropBonus) {
      continue;
    }
    results.push({
      x: candidate.x,
      y: candidate.y,
      distance: candidate.distance,
      size: candidate.size,
      oasisCropBonus,
      uncontestedOasisCropBonus,
      oasisCropPotential,
      oases,
      recommendedOases: uncontestedOases.slice(0, CONFIG.maxOases),
      competingCroppers,
      hasOasisClash,
      oasisClashRisk,
      rank: 0
    });
  }
  if (scanCancelled) {
    console.log("Analysis stopped. No report was generated.");
  } else {
    console.log(`Analyzed ${candidateTiles.length}/${candidateTiles.length} cropper candidates.`);
    results.sort((a, b) => Number(b.uncontestedOasisCropBonus >= CONFIG.preferredUncontestedCropBonus) - Number(a.uncontestedOasisCropBonus >= CONFIG.preferredUncontestedCropBonus) || { none: 0, low: 1, high: 2 }[a.oasisClashRisk] - { none: 0, low: 1, high: 2 }[b.oasisClashRisk] || a.distance - b.distance || b.uncontestedOasisCropBonus - a.uncontestedOasisCropBonus);
    results.forEach((village, index) => {
      village.rank = index + 1;
    });
    console.table(results.slice(0, 50).map((village) => ({
      rank: village.rank,
      cropper: `${village.size}c`,
      coordinates: `${village.x}|${village.y}`,
      distance: village.distance.toFixed(2),
      status: village.oasisClashRisk === "none" ? "CLEAN" : village.oasisClashRisk === "low" ? "LOW RISK" : "CLASH",
      uncontestedCrop: `+${village.uncontestedOasisCropBonus}%`,
      availableCrop: `+${village.oasisCropBonus}%`,
      competitors: village.competingCroppers.length
    })));
    downloadHtmlReport(results);
    console.log(`${results.length} exact 6c/7c villages found. Run downloadTravianCropReport() if needed.`, results);
  }
}
