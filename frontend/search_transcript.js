import fs from "fs";

const content = fs.readFileSync("C:\\Users\\newadmin\\.gemini\\antigravity\\brain\\5dec9305-ec4e-4658-afab-25cd17ee8610\\.system_generated\\logs\\transcript.jsonl", "utf8");
const lines = content.split("\n");

console.log("Searching transcript lines for call_mcp_tool calls...");
let found = 0;
for (const line of lines) {
  if (!line) continue;
  try {
    const obj = JSON.parse(line);
    if (obj.tool_calls && obj.tool_calls.some(tc => tc.name === "call_mcp_tool" || tc.name.includes("apply_migration"))) {
      console.log(`[Step ${obj.step_index}] ${obj.type} - Tool Calls:`, JSON.stringify(obj.tool_calls));
      found++;
      if (found > 10) break;
    }
  } catch (e) {
    // ignore
  }
}
