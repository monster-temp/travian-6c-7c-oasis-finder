# Travian 6c/7c Oasis Finder

A browser-console tool for finding nearby 6-crop and 7-crop villages, measuring their crop-oasis potential, and estimating competition from nearby 9-crop and 15-crop villages.

This project expands on the original [Travian Crop Finder by kaareloun](https://github.com/kaareloun/travian-crop-finder). See [Credits and licensing](#credits-and-licensing) before redistributing a fork.

## Features

- Finds exact 6c and 7c village layouts from Travian map-position data.
- Scans the map in blocks instead of requesting every tile separately.
- Calculates the best crop bonus from up to three nearby oases.
- Separates currently available oasis bonus from total potential, including occupied oases.
- Calculates uncontested crop bonus after excluding oases reachable by nearby 9c/15c villages.
- Classifies competition as:
  - **Clean:** no 9c/15c competes for an available crop oasis.
  - **Low risk:** every competing 9c/15c has at most the configured crop-oasis potential.
  - **Clash:** at least one competitor exceeds the low-risk threshold.
- Prioritizes villages with strong uncontested crop potential, then lower clash risk and shorter distance.
- Supports 125% and 150% oasis-potential searches.
- Optionally limits results to the negative/negative quadrant.
- Prints the top 50 results in the console.
- Downloads a standalone HTML report with 6c/7c and 125%/150% filters plus raw JSON export.
- Can stop a running scan after its current request finishes.

## Browser-console usage

1. Sign in to the Travian game world you want to scan.
2. Open the browser developer console.
3. Paste and run a configuration like this:

```js
globalThis.TRAVIAN_CROP_FINDER_CONFIG = {
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
  downloadReport: true,
};
```

4. Copy all of [`build/main.js`](./build/main.js), paste it into the same console, and press Enter.

When used in a browser, the script automatically uses the current Travian origin. The `server` setting is only required for command-line use.

To stop a scan:

```js
stopTravianCropScan();
```

If the browser blocks the automatic report download, run this after the scan finishes:

```js
downloadTravianCropReport();
```

## Configuration

| Setting | Default | Purpose |
| --- | ---: | --- |
| `village` | `{ x: 0, y: 0 }` | Center coordinate for the search. |
| `searchRadius` | `50` | Maximum Chebyshev distance from the center. Larger values make more requests. |
| `negativeQuadrantOnly` | `false` | When `true`, only returns villages where both coordinates are negative. Competition analysis still includes nearby border tiles. |
| `types` | `[6, 7]` | Village crop-field counts to return. |
| `competitionTypes` | `[9, 15]` | Village layouts treated as oasis competitors. |
| `oasisRadius` | `3` | Maximum tile distance at which an oasis can be claimed. |
| `maxOases` | `3` | Maximum number of oases counted toward a village. |
| `minPotentialCropBonus` | `125` | Minimum total crop-oasis potential required for a result. |
| `preferredUncontestedCropBonus` | `125` | Uncontested bonus threshold promoted to the top of the ranking. |
| `lowRiskCompetitorPotentialMax` | `25` | Maximum own oasis potential for a competitor to remain low risk. |
| `downloadReport` | `true` | Automatically downloads the HTML report when complete. |

## Development

Requires [Bun](https://bun.sh/).

```sh
bun install
bun run check
bun run build
```

The committed `build/main.js` is the browser-ready bundle. Rebuild it whenever `main.ts` or `types.ts` changes.

For command-line use, copy `.env.example` to `.env`, provide the server and authentication cookie, and update the generic defaults in `main.ts`. Never commit `.env` or a real authentication value.

## Privacy and safety

- Generated HTML/JSON reports contain the searched server, center coordinate, village coordinates, and oasis data. They are intentionally ignored by Git.
- An `AUTH_TOKEN` value is equivalent to a logged-in session cookie. Never paste it into an issue, commit it, or share it.
- This project is not affiliated with Travian Games. Automated requests may violate game rules or trigger rate limits. Review the applicable rules and use responsibly.

## Credits and licensing

Original concept and implementation: [kaareloun/travian-crop-finder](https://github.com/kaareloun/travian-crop-finder).

This version adds exact 6c/7c detection, crop-oasis scoring, occupied-oasis potential, 9c/15c clash analysis, low-risk classification, block scanning, cancellation, ranking, and downloadable HTML/JSON reports.

At the time this public package was prepared, the upstream repository did not declare a license. Public source code is not automatically open-source licensed. Read [LICENSE](./LICENSE) and [NOTICE.md](./NOTICE.md), and obtain permission from the upstream author before applying a permissive license or encouraging redistribution.
