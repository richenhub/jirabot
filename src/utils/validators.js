function validateJql(jql) {
  if (!jql || typeof jql !== "string") return false;

  // Проверка на несколько ORDER BY подряд
  const orderMatches = jql.match(/order\s+by/gi) || [];
  if (orderMatches.length > 1) return false;

  // Можно добавить проверку на базовые конструкции JQL
  const forbiddenPatterns = [/;;/, /,,/, /[^=<>!]+$/];
  if (forbiddenPatterns.some((re) => re.test(jql))) return false;

  return true;
}

module.exports = {
  validateJql,
};
