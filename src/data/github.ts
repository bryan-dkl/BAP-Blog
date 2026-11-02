// The GitHub repository the editor on the live site commits new posts to.
// Every commit to `branch` triggers .github/workflows/deploy.yml, which rebuilds the site.
export const GITHUB = {
  owner: 'bryan-dkl',
  repo: 'BAP-Blog',
  branch: 'main',
};
