const axios = require("axios");
const { JIRA_BASE_URL } = require("../config/jira");

const jiraApi = (token, endpoint, method = "GET", data = null) => {
  return axios({
    method,
    url: `${JIRA_BASE_URL}/rest/api/2${endpoint}`,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    data,
  });
};

const getMyself = async (token) => {
  const response = await jiraApi(token, "/myself");
  return response.data;
};

const searchIssues = async (
  token,
  jql,
  fields = "key,summary,status",
  maxResults = 1000
) => {
  const response = await jiraApi(
    token,
    `/search?jql=${encodeURIComponent(
      jql
    )}&fields=${fields}&maxResults=${maxResults}`,
    "GET"
  );
  return response.data.issues;
};

const getComments = async (token, issueKey) => {
  try {
    const response = await jiraApi(token, `/issue/${issueKey}/comment`);
    return response.data.comments;
  } catch (error) {
    console.error(
      "Error fetching comments:",
      error.response?.data || error.message
    );
    return [];
  }
};

const getIssue = async (token, issueKey) => {
  const response = await jiraApi(token, `/issue/${issueKey}`);
  return response.data;
};

const getTransitions = async (token, issueKey) => {
  const response = await jiraApi(
    token,
    `/issue/${issueKey}/transitions?expand=transitions.fields`
  );
  return response.data.transitions;
};

const changeStatus = async (token, issueKey, transitionId) => {
  await jiraApi(token, `/issue/${issueKey}/transitions`, "POST", {
    transition: { id: parseInt(transitionId) },
  });
};

const changeAssignee = async (token, issueKey, username) => {
  await jiraApi(token, `/issue/${issueKey}`, "PUT", {
    fields: {
      assignee: { name: username },
    },
  });
};

const logWork = async (token, issueKey, timeSpent) => {
  await jiraApi(token, `/issue/${issueKey}/worklog`, "POST", {
    timeSpent,
  });
};

const getWorklog = async (token, issueKey) => {
  const response = await jiraApi(token, `/issue/${issueKey}/worklog`);
  return response.data.worklogs;
};

const getStatuses = async (token) => {
  try {
    const response = await jiraApi(token, "/status");
    return response.data.map((status) => status.name);
  } catch (error) {
    console.error(
      "Error fetching Jira statuses:",
      error.response?.data || error.message
    );
    return [];
  }
};

module.exports = {
  jiraApi,
  getMyself,
  searchIssues,
  getIssue,
  getTransitions,
  changeStatus,
  changeAssignee,
  logWork,
  getWorklog,
  getIssue,
  getStatuses,
  getComments,
};
