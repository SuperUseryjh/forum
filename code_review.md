# Bun-HTTP 框架核心代码安全审计与漏洞报告

本报告针对 bun-http.ts 文件进行了系统性的代码走查（Code Review）与安全漏洞评估。报告中详细列出了发现的功能性缺陷、高危安全漏洞以及代码健壮性隐患，并为每一项给出了安全修复建议和代码示例。📊 漏洞及问题概要编号问题描述漏洞类型严重等级状态

- 01缺失 JSON 格式请求体解析支持协议实现缺陷
  中 (Medium)待修复

- 02静态文件服务的目录穿越漏洞 (Path Traversal)安全越权漏洞
  高危 (High)待修复
  
- 03高并发下的文件重名与覆盖风险逻辑设计隐患
  低 (Low)待修复🔍 
  
## 深度审计与漏洞分析

### 01. 缺失 JSON 格式请求体解析支持

#### 🔴 漏洞/缺陷描述

在目前的请求处理核心函数 _handleRequest 中，框架解析客户端请求体的条件分支非常局限。代码仅对 multipart/form-data 和 application/x-www-form-urlencoded 进行了匹配和处理：

```typescript
if (method === 'POST' || method === 'PUT') {
    if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
        // ... 仅解析了表单数据
    }
}
```

影响分析：现代的前端应用（特别是单页应用 SPA 或移动端）在发起非 GET 请求时，极大概率会发送 Content-Type: application/json。在这种情况下，当前框架中的 if 判断直接被跳过，导致 req.body 默认为空对象 {}。业务开发人员在编写路由处理器时，无法拿到客户端发送的任何 JSON 数据，严重阻碍了框架的实际可用性。🔧 修复与改造方案利用 Bun 内置的高效 API（request.json()），在条件分支中加入对 application/json 的安全解析，并增加对 PATCH 动作的支持：

```typescript
// 推荐替换的 Body 解析逻辑
let body: Record<string, any> = {};
const files: Record<string, File> = {};
const contentType = request.headers.get('content-type') || '';

if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    try {
        if (contentType.includes('application/json')) {
            // 支持现代客户端最常用的 JSON 请求体
            body = await request.json();
        } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
            // 原有的表单及文件解析逻辑
            const formData = await request.formData();
            for (const [key, value] of formData) {
                if (value instanceof File) {
                    files[key] = value;
                } else {
                    body[key] = value;
                }
            }
        }
    } catch (_) {
        // 异常捕获机制：防止由于客户端发送畸形 JSON 导致整个 Web 服务崩溃
        body = {};
    }
}
```

### 02. 静态文件服务的目录穿越漏洞 (Path Traversal)

⚠️ 严重等级：高危 (High)

#### 🔴 漏洞/缺陷描述

在 `App.static` 静态文件服务中间件中，代码使用了基于字符串的前缀匹配来判断文件路径是否在限制范围内：

```typescript
const filePath = path.join(dirPath, '.' + req.path);
if (filePath.startsWith(dirPath) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    // ... 执行文件读取并返回
}
```
漏洞原理及攻击场景：假设开发者部署的应用将 `dirPath` 设为绝对路径 `/var/www`。恶意的攻击者通过控制 `req.path`，构造特殊的路径跳转。比如，将请求的 `req.path` 设为 `/../www-secret/database.sqlite`。经 `path.join` 拼接后，`filePath` 解析得到的绝对路径将变为 `/var/www-secret/database.sqlite`。接下来校验 `filePath.startsWith(dirPath)`：

由于 `/var/www-secret/database.sqlite` 恰好以 `/var/www` 开头，此项字符串匹配结果为 `true`。安全边界被成功绕过！攻击者可以通过这个逻辑直接读取同一级别目录下（如其他应用目录、敏感日志目录）的文件。

#### 🔧 修复与改造方案

防御目录穿越不应依赖纯字符串前缀的暴力匹配，应当使用 path.relative 计算出相对于静态根目录的真实物理路径关系。如果物理相对路径中包含 ..，或者它变为了一个绝对路径，说明它已经跳出了我们设定的安全边界：

```typescript
const filePath = path.join(dirPath, '.' + req.path);

// 计算物理相对路径
const relative = path.relative(dirPath, filePath);

// 校验是否安全：
// 1. relative 不能为空
// 2. relative 不能以 '..' 开头（代表它试图跳转到上级目录之外）
// 3. relative 不能是绝对路径（防御非正常的跨盘符跳转等行为）
const isSafe = relative && !relative.startsWith('..') && !path.isAbsolute(relative);

if (isSafe && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    // ... 后续的原有 mimeMap 及文件返回逻辑 ...
}
```

### 03. 高并发下的文件重名与覆盖风险

 ⚠️ 严重等级：低 (Low) / 健壮性隐患

#### 🔴 漏洞/缺陷描述

在 `UploadHandler.single` 文件上传处理器中，文件重命名的规则由 `Date.now()` 加上 4 字节（即 8 位十六进制）的随机字符串组合而成：

```typescript
const ext = path.extname(file.name) || '';`
const fileName = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
```

隐患分析：虽然包含了 4 字节的随机数，但是在特大流量、极端高并发并发上传、或者在分布式系统部署下，仍然存在着微弱的文件名碰撞概率。一旦文件名发生碰撞，先前的上传文件将会直接被后者的物理文件静默覆盖，引发业务逻辑中的数据混乱。

#### 🔧 修复与改造方案

使用更现代且安全的 UUID（通用唯一识别码）来代替自研的随机重命名逻辑。Bun 运行环境完美支持 Node.js 核心库的 crypto.randomUUID()，该方案不仅性能优越，同时提供了统计学上的绝对唯一性保障，且代码更加简洁。

```typescript
// 替换为更健壮的命名机制
const ext = path.extname(file.name) || '';
const fileName = `${crypto.randomUUID()}${ext}`;
const filePath = path.join(this.dest, fileName);
```

## 🛠️ 下一步行动指南

修改协议支持： 在您框架的 _handleRequest 解析位置，将 JSON 解析分支补充完整。重构静态中间件： 立即替换 App.static 中的 startsWith 判断，引入安全系数更高的 path.relative 校验。升级上传逻辑： 将 UploadHandler 中的文件命名机制升级为标准 UUID 方案。通过完成上述三项调整，您的 bun-http 框架不仅能够无缝处理现代 API 请求，而且在面对恶意的目录穿越攻击和高并发上传时，也将具备坚固的安全抵御能力。