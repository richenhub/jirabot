const JIRA_BASE_URL = process.env.JIRA_API_URL || "https://jira.teamforce.dev";
const TASKS_PER_PAGE = 5;

module.exports = {
  JIRA_BASE_URL,
  TASKS_PER_PAGE,
};
