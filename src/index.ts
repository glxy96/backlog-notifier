export interface Env {
  SLACK_BOT_API_KEY: string;
  BACKLOG_API_KEY: string;
  BACKLOG_SPACE_ID: string;
  BACKLOG_PROJECT_ID: string;
}

export default {
    try {
      // 1. Backlogのチケット取得

      // 2. 送信メッセージの構築処理

      // 3. Slack Botによるメッセージ送信処理
    } catch (error) {
      console.error("Error:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
	},
} satisfies ExportedHandler<Env>;

/**
 * チケット取得処理
 * Backlog APIはcurlでjson形式のチケット一覧を返す。
 * クエリパラメータの指定で条件に合致するチケットに絞って取得できる。
 */

/**
 * メッセージ構築処理
 * fetchBacklogTicketsで取得したチケットからメッセージを構築する。
 */

/**
 * メッセージ送信処理
 */
