const { OpenAI } = require("openai");
const undici = require("undici");

const proxyAgent = new undici.ProxyAgent(
  "http://richen:160118ru@45.43.88.47:3128"
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  fetchOptions: {
    dispatcher: proxyAgent,
  },
});

async function generateFilter(userPrompt, statuses) {
  const systemPrompt = `
Ты Jira бот-помощник. У пользователя есть следующие статусы:
${statuses.join(", ")}.
На основе его запроса создай корректный JQL фильтр.
При непонятном неверном ответе верни {"error": "<сообщение>"}
Отвечай строго в JSON формате:
{"name": "<название фильтра максимум 10 символов можно использовать случайный айди>", "jql": "<JQL-запрос>"}
`;

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    // temperature: 0.2,
  });

  const text = response.choices[0].message.content;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("GPT вернул некорректный JSON");
  }
}

module.exports = { generateFilter };
