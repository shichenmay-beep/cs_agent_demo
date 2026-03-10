# 工单 #1675 各模块输出示例

以 [工单 #1675](https://rymindinc.zendesk.com/agent/tickets/1675) 为例，说明侧栏各块应生成的内容。

---

## 工单概要（输入）

- **#1675** · Re: Fwd: Comulytic issue · 状态: open
- **背景**：客户 Phil Hernandez 收到重复设备，要求退货并索要退货标签；客服已发出预付费退货标签（Tracking: 9400150899561316569010）、说明 20 天内有效及 USPS 寄回方式，并询问设备账户名以便赠送 2 个月会员。
- **客户最后一条消息**：回复中提供设备名 "philx"、邮箱 philx@duck.com，并附带/引用了客服此前发出的退货说明邮件（含标签、有效期、寄送方式等）。
- **最后一条消息（原文摘录）**：Hi / You're welcome. / I named my Device "philx" / And my email is philx@duck.com / Sent from my Galaxy / [随后为引用的客服邮件：退货标签、单号、20 天有效期、USPS、2 个月会员等]
- **你提供的中文翻译（对应客户最初诉求）**：你好，我今天又收到了一个设备，这一定是错误，请给我一个带有退货标签的邮寄标签，我会把它寄回去。谢谢，菲利佩·埃雷拉

---

## 1. 紧急程度（优先级条）

| 字段 | 示例值 |
|------|--------|
| 等级 | **P2 中** |
| 判断关键点（reason） | Customer received duplicate device and requested return label; request has been addressed with prepaid label; tone is calm and matter is within after-sales scope; timely handling to avoid escalation. |

**说明**：客户收到重复设备、要求退货标签，情绪平静，问题属售后处理范畴且已提供标签，故判 **P2 (Medium)**。

---

## 2. 用户最后一条会话 + 翻译

| 项 | 内容 |
|----|------|
| 原文 | 侧栏取该工单最后一条**客户**消息。若为上述长邮件，可截断展示前 300～500 字，例如：Hi / You're welcome. / I named my Device "philx" / And my email is philx@duck.com / Sent from my Galaxy / Dear Felipe, We hope this message finds you well. … |
| 翻译（客服偏好语言=中文） | 直译该段。示例（首段）：你好。/ 不客气。/ 我把设备命名为「philx」。/ 我的邮箱是 philx@duck.com。/ 来自我的 Galaxy。/ 亲爱的 Felipe，希望您一切顺利。…（后续为退货标签与说明的译文） |

若侧栏仅展示「最后一条消息」前几句，翻译也对应前几句即可。

---

## 3. 工单总结（summary）

**示例（客服偏好语言=中文）**：

- **客户诉求总结**：客户反映收到重复的 Comulytic 设备，要求提供带退货标签的邮寄标签以便寄回。客服已发送预付费退货标签（单号 9400150899561316569010），并说明 20 天内有效、可通过 USPS 预约取件或到店寄送、建议原盒寄回。客服另询问设备账户名以便赠送 2 个月会员。客户在最新回复中提供设备名 "philx" 与邮箱 philx@duck.com，并引用了客服的退货说明邮件。
- **关键实体**：客户姓名 Phil Hernandez / Felipe；邮箱 philx@duck.com、philher1@gmail.com；地址 7149 woodmont Way, Tamarac, FL 33321；退货单号 9400150899561316569010；设备名 philx。（总结与回复要点中应对姓名、邮箱、地址做脱敏或概括，勿原文照抄。）
- **情绪识别**：客户情绪平静、配合度高，已提供所需信息。

---

## 4. 建议回复直译（客服偏好语言）+ 回复要点

- **建议回复直译**：生成回复后，将「建议回复」按客服偏好语言直译显示在此。例如中文直译：「感谢您提供设备名称和邮箱。我们已记录，将为您延长 2 个月会员。请在 20 天内使用随附的退货标签通过 USPS 寄回设备。如有其他问题欢迎随时联系。」
- **回复要点**（列表）：
  - 确认已收到客户提供的设备名 "philx" 与邮箱，并说明将用于 2 个月会员延长。
  - 再次提醒退货标签 20 天内有效及 USPS 使用方式，建议原盒寄回。
  - 简短致谢与收尾，表示后续有问题可再联系。

---

## 5. 建议回复（生成回复框）

**规则**：建议回复使用**用户原始语言**。本工单客户使用**英文**，故回复为英文。

**示例（English）**：

```
Thank you for providing your device name "philx" and email address. We've noted them for your 2-month premium extension—we appreciate your cooperation with the return.

Please use the prepaid return label within 20 days and ship the device via USPS (pickup or drop-off). If you have any other questions, feel free to reach out. Thank you again.
```

---

## 6. 回复修改建议（提示词框）

本工单可填示例（可选）：

- `确认已收到设备名和邮箱，用于 2 个月会员延长；提醒 20 天内使用退货标签。`
- 或留空，由默认逻辑生成上述风格回复。

---

## 与 #1698、#1700 的对比

| 项目 | #1698 | #1700 | #1675 |
|------|--------|--------|--------|
| 场景 | 电源无法开启，请求转人工 | 文件恢复未果，后感谢 | 重复设备，已发退货标签，客户补填信息 |
| 最后一条（实质） | オペレーターに繋いでください | thank u! | 提供 philx / philx@duck.com + 引用客服邮件 |
| 用户语言 | 日文 | 英文 | 英文 |
| 建议回复语言 | 日文 | 英文 | 英文 |
| 优先级 | P1/P2 | P2 | P2 |
| 回复重点 | 确认转接、索要设备信息 | 感谢、确认人工跟进 | 确认信息、提醒标签有效期与会员延长 |

按上述示例在 #1675 上跑通，可验证优先级、总结、建议回复直译与回复要点是否符合预期；脱敏时注意姓名、邮箱、地址、单号在总结/要点中的呈现方式。
