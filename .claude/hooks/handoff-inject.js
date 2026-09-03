// SessionStart 훅 — docs/handoff/ 의 가장 최근 핸드오프 문서를 새 세션의 컨텍스트에 넣는다.
// 왜: /clear 뒤에 Claude가 빈 기억으로 시작하지 않게. 사람이 붙여넣을 필요가 없다.
const fs = require("fs"), path = require("path");
const dir = path.join(process.cwd(), "docs", "handoff");
let out = "";
try {
  const files = fs.readdirSync(dir).filter(f => /^\d{4}-\d{2}-\d{2}.*\.md$/.test(f)).sort();
  if (files.length) {
    const latest = files[files.length - 1];
    const body = fs.readFileSync(path.join(dir, latest), "utf8");
    out = `## 직전 세션 핸드오프 (docs/handoff/${latest})\n\n${body}`;
  }
} catch {}
process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: out } }));
