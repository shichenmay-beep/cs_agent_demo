# 如何更新已安装的 Zendesk App

代码改完后（例如改了 `assets/iframe.html`、`manifest.json` 等），按下面步骤更新 Zendesk 里已安装的 App，**无需卸载重装**，安装时填的 Backend URL 等会保留。

---

## 1. 本机重新打包

在项目根目录执行（需已安装 [Zendesk ZCLI](https://developer.zendesk.com/documentation/apps/app-developer-guide/zcli/) 并 `zcli login` 或配置好环境变量）：

```bash
cd /Users/shichen/data_sync/cs_agent_demo
zcli apps:package
```

成功后会在 `tmp/` 下生成一个 zip，例如 `tmp/app-xxxxxxxx.zip`。记下路径，或直接到 `tmp/` 里找最新的 zip。

---

## 2. 在 Zendesk 里上传新版本

1. 打开 **Admin Center**：  
   `https://你的子域名.zendesk.com/admin`（例如 `https://rymindinc.zendesk.com/admin`）
2. 左侧点 **Apps and integrations** → **Apps**。
3. 切到 **Zendesk Support apps**（或你当时安装时所在的分类）。
4. 找到你安装的 **CS Agent** 类 App（名称可能是 "Comulytic AI Assistant" 或 "CS Agent - Priority & Reply"），点进去。
5. 在应用详情/管理页里找 **「Update」（更新）** 或 **「Upload new version」（上传新版本）** 或 **三个点菜单里的「Update app」**，点击。
6. 选择刚才打包的 zip（`cs_agent_demo/tmp/app-xxxxxxxx.zip`），上传。
7. 上传完成后，Zendesk 会使用新包替换当前版本；**Backend URL、Title 等安装时填的参数一般不会变**，无需重填（除非你主动去改）。

---

## 3. 验证：如何确认更新已生效

**看版本号**：侧栏顶部右侧有一行小字 **「v1.0.1」**（或当前 manifest 里的 version）。上传新包后，若这里变成新版本号，说明**前端包已加载**；若仍是旧号，多半是缓存或没点到「更新」用新 zip。

**若感觉没生效，按下面排查：**

| 可能原因 | 处理办法 |
|----------|----------|
| **浏览器/Zendesk 缓存** | 工单页 **强制刷新**：Windows `Ctrl+Shift+R`，Mac `Cmd+Shift+R`；或关掉该工单标签页重新打开一条工单。 |
| **上传的不是最新 zip** | 打包后确认 `tmp/app-xxx.zip` 的**修改时间**是刚才；用解压工具打开 zip，看 `assets/iframe.html` 里是否含 `v1.0.1`（或你改的版本）和最新文案。 |
| **Zendesk 未真正替换** | Admin Center → Apps → 找到该 App → 务必点 **Update / 上传新版本**，选**新 zip** 再传一次；有的界面是「Replace」或「Update app」。 |
| **侧栏位置/应用不是同一个** | 确认你打开的是**工单右侧边栏**，且安装的正是你更新的那个 App（名称/图标一致）。 |

**建议**：每次发版把 `manifest.json` 的 `version` 改一下（如 1.0.1 → 1.0.2），并在 `assets/iframe.html` 里把顶部显示的版本号改成一致，这样一眼就能看出当前是不是最新包。

---

## 若没有看到「Update」按钮

部分 Zendesk 界面可能是：

- 在应用卡片上点 **齿轮/设置** → 选 **Update app** 或 **Replace**；
- 或：**Apps** 列表里该应用右侧 **⋯** → **Update**。

若你的后台是「上传私有应用」入口而不是已安装应用列表，可以再次走 **Upload private app**，选择新 zip；若提示「已存在同名/同 ID 应用」，通常会问是否**覆盖/更新**，选覆盖即可。

---

## 小结

| 步骤 | 操作 |
|------|------|
| 1 | 本机 `cd cs_agent_demo && zcli apps:package`，得到 `tmp/app-xxx.zip` |
| 2 | Admin Center → Apps and integrations → Apps → 找到该 App → Update / 上传新版本 → 选新 zip |
| 3 | 工单里刷新侧栏验证 |

只更新了**前端/侧栏**（iframe、manifest 等）时，只做以上步骤即可；**后端**（VM 上的 Node）需单独用 `deploy-full-to-vm.sh` 或 `upload-env-to-vm.sh` 等流程更新。
