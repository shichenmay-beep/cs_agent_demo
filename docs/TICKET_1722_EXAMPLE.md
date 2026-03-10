# 工单 #1722 各模块输出示例

以 [工单 #1722](https://rymindinc.zendesk.com/agent/tickets/1722) 为例，按现有逻辑说明侧栏各块应生成的内容。

---

## 工单概要（输入）

- **#1722** · （无主题）· 状态: open
- **完整对话**：客户（Saviour Expert）发送一封英文邮件，内容涉及广告成本与转化率、店铺改进建议，并询问「是否希望我分享」；未提出具体 Comulytic 产品问题或售后请求。
- **最后一条消息（原文）**：Hi Center, / Ads are getting expensive right now, and many stores are spending more without seeing better results. / In most cases, the issue isn't traffic it's small conversion gaps on the store that stop visitors from becoming buyers. / I noticed a quick improvement idea for your store that could help with this. / Would you like me to share it? / Best regards, Mr. Saviour expert
- **最后一条消息（中文翻译）**：您好，中心，目前广告费用越来越高，许多店铺在投入更多资金却未看到更好的效果。大多数情况下，问题不是流量，而是店铺中阻止访客成为买家的小转化缺口。我注意到一个快速改进的建议，可能对您的店铺有帮助。您希望我分享吗？此致，萨瓦多专家

---

## 1. 紧急程度（优先级条）

| 字段 | 示例值 |
|------|--------|
| 等级 | **P3 低** |
| 判断关键点（reason，客服偏好语言=中文） | 客户发送了关于广告成本和转化率的邮件，未提出具体问题或请求，属于一般性建议。 |

**说明**：按 Comulytic P0–P3 规则，无具体产品/售后诉求、仅为外部推广或一般性建议，判 **P3 (Low)**。

---

## 2. 用户最后一条会话 + 翻译

| 项 | 内容 |
|----|------|
| 原文 | Hi Center, Ads are getting expensive right now, and many stores are spending more without seeing better results. In most cases, the issue isn't traffic it's small conversion gaps on the store that stop visitors from becoming buyers. I noticed a quick improvement idea for your store that could help with this. Would you like me to share it? Best regards, Mr. Saviour expert |
| 翻译（客服偏好语言=中文） | 您好，中心，目前广告费用越来越高，许多店铺在投入更多资金却未看到更好的效果。大多数情况下，问题不是流量，而是店铺中阻止访客成为买家的小转化缺口。我注意到一个快速改进的建议，可能对您的店铺有帮助。您希望我分享吗？此致，萨瓦多专家 |

---

## 3. 工单总结（summary）

**示例（客服偏好语言=中文）**：

- **客户诉求总结**：客户以「Saviour Expert」名义发送邮件，内容围绕广告成本上升、店铺转化率与流量，并提出可分享「店铺改进建议」；未涉及 Comulytic 设备、账号、录音、订单等具体问题或请求。
- **关键实体**：无订单号、无设备 SN、无产品相关报错；发件人自称 Mr. Saviour expert。
- **情绪识别**：推销/建议类语气，中性、礼貌。

---

## 4. 建议回复直译（客服偏好语言）+ 回复要点

- **建议回复直译**：生成回复后，将英文建议回复按客服偏好语言直译显示在此。示例（中文）：感谢您的来信。目前我们主要处理与 Comulytic 产品及账户相关的咨询。若您有设备、录音、订阅或订单方面的问题，欢迎随时说明，我们会尽快协助。祝好。
- **回复要点**（列表）：
  - 礼貌说明本渠道主要处理 Comulytic 产品与账户相关咨询。
  - 若对方无具体产品问题，可简短收尾，不承诺采纳外部推广或「分享建议」。
  - 语气专业、不冷淡，避免与无关营销内容纠缠。

---

## 5. 建议回复（生成回复框）

**规则**：建议回复使用**用户原始语言**。本工单客户使用**英文**，故回复为英文。

**示例（English）**：

```
Thank you for reaching out. We focus on supporting Comulytic product and account-related questions. If you have any issues with your device, recordings, subscription, or orders, please share the details and we'll be happy to help. Best regards.
```

---

## 6. 回复修改建议（提示词框）

本工单可填示例（可选）：

- `对方为推广/建议类邮件，无具体产品问题，回复简短说明我们主要处理 Comulytic 产品与账户咨询即可。`
- 或留空，由默认逻辑生成上述风格回复。

---

## 与 #1698 / #1700 / #1675 的对比

| 项目 | #1722 |
|------|--------|
| 场景 | 外部推广/一般建议邮件，无具体产品或售后请求 |
| 最后一条 | 广告成本与转化率、愿分享店铺改进建议 |
| 用户语言 | 英文 |
| 建议回复语言 | 英文 |
| 优先级 | P3 低 |
| 回复重点 | 礼貌说明渠道用途，不展开无关营销内容，保持简短收尾 |

按上述示例在 #1722 上跑通，可验证优先级、总结、建议回复与回复要点是否符合「低优先级、非产品咨询」的现有逻辑。
