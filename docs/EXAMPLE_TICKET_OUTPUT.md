# 按现有提示词：示例工单预期输出

以下针对 **Michael Marsalis 解绑/恢复出厂** 工单（客户首条 + Zendesk 已有一条自动回复），按当前 `prompts.json` 逻辑描述的**预期输出**，用于对照侧栏实际结果或做回归测试。

---

## 工单摘要（输入）

- **客户首条**：需要将 Comulytic Note Pro 解绑/恢复出厂以便转给家人；曾卸载 App 未先解绑，重装后 App 不识别设备；设备满电、按键无法恢复出厂；希望后台解绑或获得真正的恢复出厂步骤。邮箱：mmarsalisjr@gmail.com。
- **已有回复**：Zendesk 自动回复建议先在 App「Device Management」解绑，若不行则联系 support-center@comulytic.ai 并提供设备 SN。
- **完整会话**：首条客户消息 + 一条 Agent 回复（共两段）。

---

## 1. 优先级（evaluate-priority）

- **预期等级**：**P2 中**（或 P1 高，取决于是否把「无法在 App 内解绑」视为核心功能失效）。
  - 规则上：非硬件安全/法律/极端情绪 → 非 P0；若判为「设备仍绑定、无法自行解绑需后台处理」可视为一般性排障 → P2；若强调「无法使用设备转赠」可上 P1。
- **预期 reason（客服偏好语言为中文时）**：例如「客户需后台解绑设备以便转赠家人，App 已不识别设备，属账户/绑定类排障，情绪中性。」

---

## 2. 用户最后一条会话 + 翻译

- **原文**：即客户首条（当前仅一条客户消息），为 Michael 的整段英文描述。
- **翻译（客服偏好语言 = 中文时）**：应为一整段**纯中文**译文，无 `[English]` / `[中文]` 等前缀，无解释。例如：
  - 「您好 Comulytic 客服，我需要帮助将 Comulytic Note Pro 恢复出厂并解绑，以便转给家人。情况是：……（按原文完整翻译）」

---

## 3. 工单总结 + 回复要点（summarize，按客服偏好语言）

- **工单总结（summary）**：应为**客服偏好语言**（如中文），概括全篇而非仅最后一句。预期大致包含：
  - 客户需要解绑/恢复出厂 Comulytic Note Pro 以便转给家人；
  - 曾卸载 App 未先解绑，重装后 App 不显示设备；
  - 设备满电、开机正常，但按键无法恢复出厂；
  - 设备仍绑定账户，无法在 App 内解绑；
  - 客户希望后台解绑或获得真正的恢复出厂说明；
  - 情绪：礼貌、略带无奈，非愤怒。
- **回复要点（replyPoints）**：同样为客服偏好语言，例如：
  - 确认理解其需求（解绑/恢复出厂以便转赠）；
  - 说明 App 无法识别时需后台解绑，请提供设备 **SN**；
  - 若**非 Amazon 渠道**：可写联系 support-center@comulytic.ai；
  - 若 **Amazon 渠道**：只写「请联系客服」或「提供 SN 后我们协助解绑」，不出现邮箱/链接；
  - 语气专业、共情，不提 AI 身份。

---

## 4. 建议回复（suggest-reply）

- **语言**：客户使用英文 → 建议回复应为**英文**。
- **内容逻辑（综合全文）**：
  - 应同时考虑**客户首条**（需求、经过、邮箱）和**已有 Agent 回复**（先 App 解绑、不行再联系并提供 SN），避免重复或矛盾；不可只针对「最后一句」写。
  - 可先简短致谢与共情，再说明：若 App 内无法解绑，我们可在后台协助；请提供设备 **SN**（可说明从哪里查看）；若为直营/非 Amazon 渠道可写 support-center@comulytic.ai，若为 Amazon 则仅写「our support team」或「contact us」等，不出现具体邮箱/链接。
  - 不出现「AI 生成」等表述；不把整段会话原文贴进回复；2–4 段、简洁专业。

**示例方向（英文，非逐字标准答案）**：

```text
Thank you for reaching out, Michael. We're sorry to hear the app no longer recognizes your Comulytic Note Pro after reinstall—we can help with that.

Since you can't unbind or factory reset from the device or app, we can unbind it from our side. To do that, we need the device serial number (SN), which you can find on the device or its packaging. Please reply with the SN and we’ll process the unbind so you can pair the device with your family member’s account.

If you have any trouble locating the SN, let us know and we’ll guide you.

Best regards,
Comulytic Support
```

（若工单带 Amazon 标签，则上述中的 “reply with the SN” 可保留，但不要出现 support-center@comulytic.ai，改为 “our support team will assist” 等。）

---

## 5. 建议回复直译（客服偏好语言）

- 将上述**建议回复**通过 `/translate` 转为客服偏好语言（如中文），用于「建议回复直译」区块。
- 预期：**纯中文**段落，无语言标签、无前缀。

---

## 6. 自测检查清单

| 项目           | 预期 |
|----------------|------|
| 优先级         | P2 或 P1，reason 为中文（若偏好中文） |
| 翻译           | 纯目标语言，无 [语言名] 前缀 |
| 工单总结/要点  | 按客服偏好语言，且概括**全篇**会话 |
| 建议回复       | 英文；综合首条+已有回复；含 SN、后台解绑；渠道合规（Amazon 无邮箱/链接） |
| 建议回复直译   | 纯中文（或当前偏好语言），无标签 |

若实际侧栏输出与上表不一致，可重点排查：后端是否加载了最新的 `prompts.json`（或 `backend/prompts.json`）、前端是否传入完整会话与正确 `lang`/`targetLang`。

---

## 7. 调用大模型得到实际输出

在本地用当前提示词和配置**真实调用一次大模型**，可得到该工单的实际输出，便于与侧栏或预期对比。

**步骤：**

1. 确保后端依赖已安装：`cd cs_agent_demo/backend && npm install`
2. 确保有 API 配置：`backend/.env` 或 `backend/config.json` 中配置 `OPENAI_API_KEY`、`OPENAI_API_BASE`（OpenRouter 时填）、`OPENAI_MODEL`
3. 执行脚本：`cd cs_agent_demo/backend && node run-example-output.js`

脚本会依次调用：

- **evaluate-priority**：输出 priority + reason（中文）
- **translate**：客户首条英文 → 中文译文
- **summarize**：工单总结 + 回复要点（中文）
- **suggest-reply**：建议回复（英文，综合完整会话）

终端会直接打印各步的**实际大模型返回内容**。

---

## 8. 模拟实际输出（供参考）

以下为按当前提示词、对该工单可能出现的**典型实际输出**（不同模型/温度会有差异，仅作参考）。

**1. 优先级**

```json
{ "priority": "P2", "reason": "客户需后台解绑设备以便转赠家人，App 已不识别设备，属账户/绑定类排障，情绪中性。" }
```

**2. 翻译（用户最后一条会话 → 中文）**

```
您好 Comulytic 客服，

我写信是因为需要帮助将我的 Comulytic Note Pro 恢复出厂设置并解绑，以便转给家人使用。

情况是这样的：我在手机上设置了新的 Plaud Note Pro 设备后，在未先断开/解绑 Comulytic Note Pro 的情况下删除了 Comulytic 应用。重新安装应用后，应用不再显示任何已连接的设备。Comulytic Note Pro 本身满电（100%），开机正常，但我无法使其恢复出厂设置。我尝试了各种长按按键的方式（开机时长按、关机时长按、长按 12 秒等）都不起作用，只会开始/停止录音或屏幕变暗。设备似乎仍绑定在我的账户上，但应用已无法识别设备，我无法在应用内解绑。

我需要的帮助是：将设备从我的账户解绑/释放，以便能用新账户重新配对；或提供能清除设备绑定的真正恢复出厂设置说明。

账户邮箱：mmarsalisjr@gmail.com

请告知您方能采取哪些步骤。我不太想用等电池完全耗尽作为权宜之计。

谢谢，Michael Marsalis
```

**3. 工单总结 + 回复要点（中文）**

- **工单总结**：客户需要将 Comulytic Note Pro 解绑或恢复出厂以便转给家人。曾卸载 App 未先解绑，重装后 App 不显示设备；设备满电、按键操作无法恢复出厂；设备仍绑定账户但无法在 App 内解绑。客户希望后台解绑或获得真正的恢复出厂步骤。情绪礼貌、略带无奈。
- **回复要点**：确认理解需求（解绑/恢复出厂以便转赠）；说明 App 无法识别时可后台解绑，请提供设备 SN；可引导联系 support-center@comulytic.ai（非 Amazon 渠道）；语气专业、共情。

**4. 建议回复（英文，综合全文）**

```
Thank you for reaching out, Michael.

We're sorry to hear that after reinstalling the Comulytic app, it no longer shows your Comulytic Note Pro. Since the app doesn't recognize the device and the button combinations aren't triggering a factory reset, we can unbind the device from our side so you can pair it with your family member's account.

To do that, we need the device serial number (SN). You can find it on the device itself or on the original packaging. Please reply with the SN and we'll process the unbind for you.

If you have any trouble locating the SN, let us know and we'll guide you.

Best regards,
Comulytic Support
```

以上为「调用大模型」时可能得到的实际输出示例；真实结果请以运行 `node run-example-output.js` 或侧栏实际展示为准。
