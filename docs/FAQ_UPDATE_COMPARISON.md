# FAQ 更新对比：当前 faq.json vs 最新文档 (Desktop 5 个 docx)

## 一、当前 `product_docs/faq.json` 内容

| 项目 | 当前内容 |
|------|----------|
| **product_name** | Example Product (Shopify/Amazon) |
| **faqs** | 4 条：Returns & Refunds（30 天、订单页发起、5–7 工作日退款）、Shipping（5–7/2–3 天、美国仓）、Wrong item/Defective（订单号+照片、换货/退款）、Account & Login（忘记密码、账号合并） |
| **tone** | Professional, friendly, Reply in English for US customers. Avoid jargon. |

---

## 二、最新文档中的新增/差异点

### 1. 与当前不一致（建议改）

| 项目 | 当前 FAQ | 文档中的说法 |
|------|----------|--------------|
| **产品名** | Example Product (Shopify/Amazon) | 全部为 **Comulytic Note Pro** / Comulytic，且统一联系 **support-center@comulytic.ai** |
| **退换/售后入口** | 仅写 “order page” 发起退货 | 文档中未强调“订单页”，更多是联系 **support-center@comulytic.ai**、提供订单号/SN 等 |
| **Account & Login** | 通用“忘记密码、账号合并” | 文档为：**App 注册**（邮箱格式、密码规则、支持 support-center@comulytic.ai）、**Apple ID 登录**、**订阅取消**（App Store/Google Play 指引 + support-center@comulytic.ai） |

### 2. 当前 FAQ 完全没有、文档里有的内容（建议补）

- **1000-Using the Device**  
  开机（长按 2s）、强制复位（12s）、屏卡住（12s 重启 / 关开蓝牙 / 重启 App）、上传失败（WiFi、权限、格式）、突然关机（充电 30 分钟）、升级失败（退出 App、关开蓝牙）、不充电（清洁触点、5V/0.5A、原装线）、温度计图标（过热/过冷保护、关机前会保存数据）、温度关机后无法开机（等回到室温）。
- **2000-Using the App**  
  注册失败、Apple 账号登录、App 崩溃/无响应、转写失败或不准、说话人识别、摘要/洞察生成失败或不准确、创建/关联联系人、AI 助手能力、Web 端（web.comulytic.ai）、云端备份与同步（Me → Cloud Backup）。
- **3000-Using Accessories**  
  从磁吸壳取出、壳吸不牢、缺少配件、磁吸环丢失、配件损坏、不支持无线充电（约 1.5h 有线快充）、防水防尘（避免潮湿、收纳）。
- **4000-General**  
  手机找不到设备（2s 开机、看屏幕、充电 10 分钟）、蓝牙连不上、**设备解绑/Unbind**（Device Management → Unbind Device，失败则提供 **SN** 联系 support-center@comulytic.ai）、升级/紧急（邮件主题写 urgent）、数据存储与加密（AES-256）、数据保护（App Lock、联系人锁）、删除数据、录音时间与真实时间不一致（电量耗尽或夏令时，连接 App 后会自动校准）。
- **5000-Order & Payment**  
  未收到包裹（签收证明、物流证明、丢件 case ID、support-center@comulytic.ai）、支付方式（卡、PayPal、Apple Pay 等）、币种、支付失败/被拒（核对信息、联系发卡行、换方式、截图发 support）、支付后改地址/商品（需取消重下单或发货前联系拦截）、支付安全（PCI DSS）、发票/凭证（订单邮件、订单历史）、**转写时长无限制**、智能功能与订阅（会员说明、反馈 support）、订阅价格/降费/取消（官方公告、年付、推送、App Store/Google Play 取消 + support-center@comulytic.ai）。

### 3. 一致或可保留的

- 30 天内退换、退款 5–7 工作日：文档未推翻，可保留。
- 错发/瑕疵需订单号与照片、换货或全额退款：与文档精神一致，可保留并补充“联系 support-center@comulytic.ai”。
- 配送时效（5–7 / 2–3 天）：文档未细写，可保留简短一句或按你实际政策微调。

---

## 三、建议结论

| 结论 | 说明 |
|------|------|
| **建议更新** | 1）产品名改为 Comulytic（Comulytic Note Pro）；2）统一联系邮箱为 support-center@comulytic.ai；3）按 5 个文档补充设备/App/配件/通用/订单与支付类 FAQ，并调整 Account 相关为注册、Apple 登录、订阅取消；4）保留并微调现有退换、错发、配送、语气。 |
| **不一致处理** | 以最新 5 个 docx 为准：产品名、解绑流程（Device Management + SN）、订阅与支付相关话术、所有支持入口统一为 support-center@comulytic.ai。 |

---

## 四、请你确认

- **确认更新**：我将按上述对比，重写 `product_docs/faq.json`（Comulytic 产品名、support-center@comulytic.ai、按 5 个文档归纳的 topic + content，并保留 tone）。
- **不更新 / 部分更新**：请说明要保留当前哪些条、或只同步哪几类（例如只做设备+App，不做订单支付）。

你回复「确认更新」或具体要改的范围后，我按你的选择改 `product_docs/faq.json`。
