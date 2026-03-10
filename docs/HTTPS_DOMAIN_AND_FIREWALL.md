# 已有域名怎么找 + 防火墙放行 80/443

## 一、怎么找「已有域名」

你们已经在用的、能自己做 DNS 解析的域名，通常来自下面几类，可以按顺序看：

1. **公司/产品主站**
   - 例如做 Comulytic、Zendesk 子域名是 rymindinc，可能就有：
     - `rymindinc.com`、`comulytic.com`、`comulytic.ai`
   - 谁负责官网/备案，就问谁「我们对外用的主域名是哪个」。

2. **邮箱域名**
   - 你们用的是 `tech@trustecho.com`，说明至少有一个域名是 **trustecho.com**。
   - 若 trustecho.com 的 DNS 在你们手里（能登录域名服务商或 Cloudflare/阿里云等），就可以用其子域名做 API，例如：`api.trustecho.com`。

3. **域名注册商 / DNS 控制台**
   - 登录买域名的地方（GoDaddy、Namecheap、阿里云万网、腾讯云、Cloudflare 等）。
   - 在「我的域名」或「DNS 解析」里能看到所有在你账号下的域名，挑一个做 API 子域名即可。

4. **不确定时**
   - 问运维/网管：我们有哪些域名？哪个可以加一条 A 记录指到一台服务器？
   - 有任意一个可用的主域名，就可以用子域名（如 `api.xxx.com`）指到 VM，不需要新买域名。

**结论**：从你当前信息看，**trustecho.com** 若你们能改 DNS，可直接用 `api.trustecho.com` 指到 VM 公网 IP（136.117.167.30），再在 VM 上配 HTTPS。

---

## 二、防火墙：放行 80、443（给 HTTPS 用）

在**本机**已配置好 gcloud 的前提下执行：

```bash
cd /Users/shichen/data_sync/cs_agent_demo
# 可选：export GCP_PROJECT=你的项目ID
bash open-firewall-80-443.sh
```

脚本会：
- 列出当前项目下部分入站防火墙规则（方便你确认是否已有 80/443）；
- 创建一条规则，放行 **tcp:80** 和 **tcp:443**（若规则已存在会提示，可忽略）。

执行完后，VM 的 80、443 即可被外网访问，Nginx + certbot 才能正常完成 HTTPS 配置。

---

## 三、在控制台里「找」防火墙

1. 打开 [GCP 控制台 - 防火墙规则](https://console.cloud.google.com/networking/fireworks/list)（需登录并选对项目）。
2. 在列表里看 **“允许的协议/端口”** 或 **“目标”**：
   - 若已有 `tcp:80`、`tcp:443` 或 `tcp:80,443`，且来源是 `0.0.0.0/0` 或包含你需要的网段，说明 80/443 已放行。
   - 若没有，用上面的 `open-firewall-80-443.sh` 创建即可。

---

## 四、小结

| 需求         | 做法 |
|--------------|------|
| 找已有域名   | 看邮箱域名（如 trustecho.com）、公司主站、域名/DNS 控制台；有任意一个可解析的即可用子域名做 API。 |
| 防火墙 80/443 | 本机执行 `bash open-firewall-80-443.sh`；或在 GCP 控制台「防火墙规则」里查看/新建放行 tcp:80、tcp:443。 |
