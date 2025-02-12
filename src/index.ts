export interface Env {
  SLACK_BOT_TOKEN: string;
  BACKLOG_API_KEY: string;
  BACKLOG_SPACE_ID: string;
  BACKLOG_PROJECT_ID: string;
}

export default {
  async scheduled(_scheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    try {
      // 現在の日付を取得（抽出実行日）
      const today = new Date().toISOString().split("T")[0];

      // チケットデータ取得
      const updatedIssues = await fetchUpdatedIssues(env, today);
      const unloggedTimeIssues = await fetchUnloggedTimeIssues(env, today);
      const unresolvedIssues = await fetchUnresolvedIssues(env, today);

      // メッセージを整形
      const message = createSlackBlocks(updatedIssues, unloggedTimeIssues, unresolvedIssues, env);

      // Slackへ通知
      await sendSlackNotification(env, updatedIssues, unloggedTimeIssues, unresolvedIssues);

      console.log("通知完了:", today);
    } catch (error) {
      console.error("エラー:", error);
    }
  }
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
 * Block Kitを使ったSlackメッセージを生成
 */
function createSlackBlocks(updatedIssues: any[], unloggedTimeIssues: any[], unresolvedIssues: any[], env: Env) {
  function formatIssuesBlock(title: string, issues: any[]): any[] {
    if (issues.length === 0) {
      return [{
        type: "section",
        text: { type: "mrkdwn", text: `*${title}*\nなし` }
      }];
    }

    return [
      { type: "section", text: { type: "mrkdwn", text: `*${title}*` } },
      ...issues.map((issue) => ({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `• <https://${env.BACKLOG_SPACE_ID}.backlog.jp/view/${issue.issueKey}|${issue.summary}> | 担当: ${issue.assignee ? issue.assignee.name : "未設定"}`
        }
      }))
    ];
  }

  return [
    { type: "header", text: { type: "plain_text", text: "📢 チケット更新チェック", emoji: true } },
    ...formatIssuesBlock("🚨 未更新のチケット", updatedIssues),
    ...formatIssuesBlock("❓ 完了理由未設定のチケット", unresolvedIssues),
    ...formatIssuesBlock("⏳ 実績時間未入力のチケット", unloggedTimeIssues)
  ];
}

/**
 * SlackにBlock Kitを使ってメッセージを送信
 */
async function sendSlackNotification(env: Env, updatedIssues: any[], unloggedTimeIssues: any[], unresolvedIssues: any[]): Promise<Response> {
  if (!env.SLACK_BOT_TOKEN) {
    console.error("SLACK_BOT_TOKEN が設定されていません");
    return new Response("Slack Bot Token is missing", { status: 500 });
  }

  const payload = {
    channel: "#general", // 送信するチャンネル
    blocks: createSlackBlocks(updatedIssues, unloggedTimeIssues, unresolvedIssues, env),
  };

  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json() as { ok: boolean; error?: string };

  if (!result.ok) {
    console.error("Slack通知エラー:", result.error);
    return new Response(`Slack notification failed: ${result.error}`, { status: 500 });
  }

  return new Response("Slack notification sent!", { status: 200 });
}
