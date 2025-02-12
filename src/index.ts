export interface Env {
  SLACK_BOT_API_KEY: string;
  BACKLOG_API_KEY: string;
  BACKLOG_SPACE_ID: string;
  BACKLOG_PROJECT_ID: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      // 現在の日付を取得（抽出実行日）
      const today = new Date().toISOString().split("T")[0];

      // 各条件の課題取得
      const updatedIssues = await fetchUpdatedIssues(env, today);
      const unloggedTimeIssues = await fetchUnloggedTimeIssues(env, today);
      const unresolvedIssues = await fetchUnresolvedIssues(env, today);

      // メッセージの構築処理
      const message = formatSlackMessage(updatedIssues, unloggedTimeIssues, unresolvedIssues, env);
      
      // 構築したメッセージの確認
      return new Response (message);

    } catch (error) {
      console.error("Error:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },

    //   // 3. Slack Botによるメッセージ送信処理
    //   await sendSlackNotification(env, message);

    //   return new Response("Slack notification sent!", { status: 200 });
} satisfies ExportedHandler<Env>;

/**
 * 更新漏れチケットの取得
 * 期限日が実行日 かつ 完了以外のチケット
 */
async function fetchUpdatedIssues(env: Env, today: string): Promise<any[]> {
  const queryParams = new URLSearchParams();
  queryParams.append("apiKey", env.BACKLOG_API_KEY);
  queryParams.append("projectId[]", env.BACKLOG_PROJECT_ID);
  queryParams.append("dueDateSince", today);
  queryParams.append("dueDateUntil", today);
  queryParams.append("statusId[]", "1"); // 未対応
  queryParams.append("statusId[]", "2"); // 処理中
  queryParams.append("statusId[]", "3"); // 処理済み
  queryParams.append("count", "100"); // 取得上限の指定。指定しない場合は20件

  return fetchBacklogTickets(env, queryParams);
}

/**
 * 実績時間未入力チケットの取得
 * 期限日が実行日 かつ 完了 かつ actualHours が未入力 のうち、完了理由が「対応しない」を除外
 */
async function fetchUnloggedTimeIssues(env: Env, today: string): Promise<any[]> {
  const queryParams = new URLSearchParams();
  queryParams.append("apiKey", env.BACKLOG_API_KEY);
  queryParams.append("projectId[]", env.BACKLOG_PROJECT_ID);
  queryParams.append("dueDateSince", today);
  queryParams.append("dueDateUntil", today);
  queryParams.append("statusId[]", "4"); // 完了
  queryParams.append("count", "100");

  const issues = await fetchBacklogTickets(env, queryParams);

  // actualHoursが未入力 かつ resolution.id !== 1 のものを抽出
  return issues.filter((issue) => issue.actualHours === null && issue.resolution?.id !== 1);
}

/**
 * 完了理由未設定チケットの取得
 * 期限日が実行日 かつ 完了 かつ resolution が未設定
 */
async function fetchUnresolvedIssues(env: Env, today: string): Promise<any[]> {
  const queryParams = new URLSearchParams();
  queryParams.append("apiKey", env.BACKLOG_API_KEY);
  queryParams.append("projectId[]", env.BACKLOG_PROJECT_ID);
  queryParams.append("dueDateSince", today);
  queryParams.append("dueDateUntil", today);
  queryParams.append("statusId[]", "4"); // 完了
  queryParams.append("count", "100");

  const issues = await fetchBacklogTickets(env, queryParams);

  // 完了理由が未設定のものを抽出
  return issues.filter((issue) => issue.resolution === null);
}

/**
 * Backlog APIを使用して課題を取得
 */
async function fetchBacklogTickets(env: Env, queryParams: URLSearchParams): Promise<any[]> {
  const apiUrl = `https://${env.BACKLOG_SPACE_ID}.backlog.jp/api/v2/issues?${queryParams.toString()}`;
  console.log(`Fetching: ${apiUrl}`);

  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch Backlog tickets: ${response.statusText}`);
  }

  return response.json();
}

/**
 * メッセージ構築処理
 * fetchBacklogTicketsで取得したチケットからメッセージを構築する。
 */
function formatSlackMessage(
  updatedIssues: any[],
  unloggedTimeIssues: any[],
  unresolvedIssues: any[],
  env: Env
): string {
  function formatIssues(issues: any[]): string {
    if (issues.length === 0) {
      return "* なし";
    }
    return issues
      .map(
        (issue) =>
          `* [${issue.summary}](https://${env.BACKLOG_SPACE_ID}.backlog.jp/view/${issue.issueKey}) 担当: ${issue.assignee ? issue.assignee.name : "未設定"}`
      )
      .join("\n");
  }

  return `
## 完了以外のチケット

${formatIssues(updatedIssues)}

## 完了理由未設定のチケット

${formatIssues(unresolvedIssues)}

## 実績時間未入力のチケット

${formatIssues(unloggedTimeIssues)}
  `.trim();
}

// /**
//  * メッセージ送信処理
//  */
// async function sendSlackNotification(env: Env, message: string) {
//   const slackUrl = "https://slack.com/api/chat.postMessage";

//   const payload = {
//     channel: "#general", // 送信先のチャンネル（必要なら環境変数化）
//     text: message,
//   };

//   const response = await fetch(slackUrl, {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//       Authorization: `Bearer ${env.SLACK_BOT_API_KEY}`,
//     },
//     body: JSON.stringify(payload),
//   });

//   if (!response.ok) throw new Error("Failed to send Slack message");
// }
