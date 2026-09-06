import { Octokit } from 'octokit';

export const GIST_FILENAME = 'leetsrs-backup.json';

// The workflow creates one client per operation and retains it across requests.
// Return requests directly so response handling and error policy stay in services.
export function createGitHubClient(pat: string) {
  const octokit = new Octokit({ auth: pat });

  return {
    getAuthenticated() {
      return octokit.rest.users.getAuthenticated();
    },
    getGist(gistId: string) {
      return octokit.rest.gists.get({ gist_id: gistId });
    },
    createGist(description: string, content: string) {
      return octokit.rest.gists.create({
        description,
        public: false,
        files: {
          [GIST_FILENAME]: {
            content,
          },
        },
      });
    },
    updateGist(gistId: string, content: string) {
      return octokit.rest.gists.update({
        gist_id: gistId,
        files: {
          [GIST_FILENAME]: {
            content,
          },
        },
      });
    },
  };
}

export type GitHubClient = ReturnType<typeof createGitHubClient>;
