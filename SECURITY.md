# Security and privacy

## Sensitive data

Do not commit or share:

- `AUTH_TOKEN` or any Travian session cookie;
- `.env` files;
- generated reports containing a real search center, village coordinates, or strategy notes;
- hosted-site IDs, credentials, deployment archives, or private database exports.

If a session cookie is exposed, sign out of Travian and invalidate the session before doing anything else. Remove the secret from Git history rather than only deleting it in a later commit.

## Reporting a vulnerability

Open a GitHub security advisory if the repository owner has enabled private vulnerability reporting. Otherwise, contact the maintainer privately. Do not include live credentials or private scan reports in an issue.
