# 配置 SOURCE_TOKEN（CI 读取私有源码仓所需）

`dramaCube-docker` 的 CI（`build-web-image`）需要拉取**私有**源码仓 `g-star1024/hongguo-desktop`
来构建 Flutter Web 产物。公开仓的 Actions 默认只能访问本仓，所以要用一个带 `repo` 读权限的
GitHub Personal Access Token（PAT）作为 `SOURCE_TOKEN`。

> 本仓**不持有、不修改**源码，构建完产物不入库，只把 `flutter build web` 的产物打包进 nginx 镜像。

---

## 一、创建 PAT

1. 打开 https://github.com/settings/tokens （或 头像 → Settings → Developer settings → Personal access tokens）
2. 选择 **Tokens (classic)** → **Generate new token (classic)**
   - （也可用 Fine-grained token，但 classic 更简单；二选一即可）
3. 设置：
   - **Expiration**：按需（建议 90 天或 No expiration 后自行定期轮换）
   - **Scopes**：勾选 **`repo`**（完整私有仓读/写权限；本流程只用读，但 `repo` 最省心）
   - Fine-grained 等价项：对该 token 指定 `g-star1024/hongguo-desktop` 的 **Contents: read**
4. 点击生成，**立即复制 token**（形如 `ghp_xxxxxxxxxxxx`，只显示一次）

## 二、存入仓库 Secret

1. 打开 https://github.com/g-star1024/dramaCube-docker/settings/secrets/actions
2. **New repository secret**
   - **Name**：`SOURCE_TOKEN`（必须一字不差，CI 里写死读这个名）
   - **Secret**：粘贴刚才复制的 PAT
3. **Add secret**

## 三、验证

1. 进入仓库 **Actions → build-web-image → Run workflow**
2. 填 `version`（如 `2.7.83`，可选）与 `source_ref`（默认 `main`）
3. 运行后看 **"Checkout 私有源码仓 hongguo-desktop"** 这一步：
   - 成功 → 继续 `flutter build web`
   - 报 `Authentication failed` / `repository not found` → 说明 PAT 无权限或 Secret 名写错，回第二步检查

## 四、安全提示

- `SOURCE_TOKEN` 是**只读私有仓**的凭证，**不要**用于其他仓库或提交到代码里。
- 离职/泄密时到第一步页面 **revoke** 即可，不影响其他东西。
- 公开仓的 `GITHUB_TOKEN` 仅用于推送本仓镜像到 GHCR，与 `SOURCE_TOKEN` 职责分离，二者不要混用。

## 五、替代方案（可选）

若不希望用个人 PAT，可改用一个 **GitHub App**（安装到 `hongguo-desktop` 并授权 contents:read），
把 App 的 installation token 写入 `SOURCE_TOKEN`。流程更复杂但便于团队轮换与审计。
常规场景用上面 classic PAT 即可。
